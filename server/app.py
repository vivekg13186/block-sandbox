"""Block Sandbox web server.

Serves the built React UI and a small JSON API backing the same features the
desktop (Tauri) build provided:

  * module storage as a folder tree of human-friendly YAML files (one per
    module) — copy a directory of .yml files in and they just work
  * global environments + schedules (YAML documents)
  * running generated Python (in a managed virtualenv)
  * installing pip requirements into that venv

Trusted, single-user use only: the /api/run endpoint executes arbitrary Python
with the server's privileges, so bind to localhost and don't expose it.
"""

import json
import os
import platform
import re
import subprocess
import sys
import threading
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from scheduler import MinuteTimer, cron_matches

try:
    import yaml
except Exception:  # pragma: no cover - yaml is a declared dependency
    yaml = None

ROOT = Path(__file__).resolve().parent
DATA = Path(os.environ.get("BLOCK_SANDBOX_DATA", ROOT / "data"))
MODULES_DIR = DATA / "modules"
VENV_DIR = DATA / "venv"
STATIC_DIR = ROOT / "static"  # built UI is copied here at package time
DOC_EXT = ".yml" if yaml else ".json"
READ_EXTS = (".yml", ".yaml", ".json")  # accept any; write .yml

DATA.mkdir(parents=True, exist_ok=True)
MODULES_DIR.mkdir(parents=True, exist_ok=True)


# --------------------------------------------------------------------------
# Serialization: YAML on disk (multi-line script/program become readable block
# scalars); falls back to JSON if PyYAML is unavailable. YAML is a JSON
# superset, so .json files still parse.
# --------------------------------------------------------------------------

if yaml is not None:
    def _str_representer(dumper, data):
        style = "|" if "\n" in data else None
        return dumper.represent_scalar("tag:yaml.org,2002:str", data, style=style)

    yaml.add_representer(str, _str_representer, Dumper=yaml.SafeDumper)


def dumps(obj: Any) -> str:
    if yaml is not None:
        return yaml.safe_dump(obj, sort_keys=False, allow_unicode=True, default_flow_style=False)
    return json.dumps(obj, indent=2)


def loads(text: str) -> Any:
    if yaml is not None:
        return yaml.safe_load(text)
    return json.loads(text)


def _doc_path(stem: str) -> Path:
    return DATA / f"{stem}{DOC_EXT}"


def read_doc(stem: str, default: Any) -> Any:
    for ext in READ_EXTS:
        p = DATA / f"{stem}{ext}"
        if p.exists():
            try:
                return loads(p.read_text(encoding="utf-8")) or default
            except Exception:
                return default
    return default


def write_doc(stem: str, obj: Any) -> None:
    target = _doc_path(stem)
    target.write_text(dumps(obj), encoding="utf-8")
    for ext in READ_EXTS:  # drop stale copies in other formats
        p = DATA / f"{stem}{ext}"
        if p != target and p.exists():
            try:
                p.unlink()
            except OSError:
                pass


@asynccontextmanager
async def lifespan(_app: FastAPI):
    timer = MinuteTimer(_on_minute)
    timer.start()
    try:
        yield
    finally:
        timer.stop()


app = FastAPI(title="Block Sandbox", lifespan=lifespan)


# --------------------------------------------------------------------------
# Module storage (folder tree, one YAML file per module)
# --------------------------------------------------------------------------

def safe_base(name: str) -> str:
    name = (name or "").strip() or "module"
    return re.sub(r'[/\\:*?"<>|]+', "_", name)


def module_path(folder: str, name: str) -> Path:
    folder = "/".join(p for p in (folder or "").split("/") if p.strip())
    base = MODULES_DIR / folder if folder else MODULES_DIR
    return base / f"{safe_base(name)}{DOC_EXT}"


def _load_module_file(path: Path) -> Optional[dict]:
    """Read a module file, tolerating hand-copied files: unwrap the export
    envelope ({format, version, module}) and backfill a missing id/name.
    Self-heals the file on disk when it had to be normalized."""
    try:
        data = loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    changed = False
    # Unwrap an exported envelope.
    if (
        isinstance(data, dict)
        and data.get("format") == "block-sandbox.module"
        and isinstance(data.get("module"), dict)
    ):
        data = data["module"]
        changed = True
    if not isinstance(data, dict):
        return None
    if not data.get("id"):
        data["id"] = str(uuid.uuid4())
        changed = True
    if not data.get("name"):
        data["name"] = path.stem
        changed = True
    if changed:
        try:
            path.write_text(dumps(data), encoding="utf-8")
        except OSError:
            pass
    return data


def walk_modules() -> list[tuple[Path, dict]]:
    out: list[tuple[Path, dict]] = []
    for path in MODULES_DIR.rglob("*"):
        if not path.is_file() or path.suffix not in READ_EXTS:
            continue
        m = _load_module_file(path)
        if m is None:
            continue
        rel = path.relative_to(MODULES_DIR)
        m["folder"] = "/".join(rel.parts[:-1])
        out.append((path, m))
    return out


@app.get("/api/modules")
def list_modules() -> list[dict]:
    return [m for _, m in walk_modules()]


@app.get("/api/modules/{module_id}")
def get_module(module_id: str) -> dict:
    for _, m in walk_modules():
        if m.get("id") == module_id:
            return m
    raise HTTPException(status_code=404, detail="module not found")


@app.put("/api/modules/{module_id}")
def save_module(module_id: str, module: dict = Body(...)) -> dict:
    module["id"] = module_id
    found = next((p for p, m in walk_modules() if m.get("id") == module_id), None)

    target = module_path(module.get("folder", ""), module.get("name", "module"))
    # Avoid clobbering a different module occupying the same folder/name.
    others = {p.resolve() for p, m in walk_modules() if m.get("id") != module_id}
    if target.resolve() in others:
        target = module_path(module.get("folder", ""),
                             f"{module.get('name', 'module')}-{module_id[:6]}")

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(dumps(module), encoding="utf-8")

    if found and found.resolve() != target.resolve():
        try:
            found.unlink()
        except OSError:
            pass
    return module


@app.delete("/api/modules/{module_id}")
def delete_module(module_id: str) -> dict:
    found = next((p for p, m in walk_modules() if m.get("id") == module_id), None)
    if found:
        try:
            found.unlink()
        except OSError:
            pass
    return {"deleted": True, "id": module_id}


# --------------------------------------------------------------------------
# Environments + schedules (single YAML documents)
# --------------------------------------------------------------------------

@app.get("/api/environments")
def get_environments() -> dict:
    return read_doc("environments", {"active": "", "environments": []})


@app.put("/api/environments")
def put_environments(store: dict = Body(...)) -> dict:
    write_doc("environments", store)
    return store


@app.get("/api/schedules")
def get_schedules() -> list:
    return read_doc("schedules", [])


@app.put("/api/schedules")
def put_schedules(schedules: list = Body(...)) -> list:
    write_doc("schedules", schedules)
    return schedules


# --------------------------------------------------------------------------
# Python execution (managed virtualenv)
# --------------------------------------------------------------------------

def venv_python() -> Path:
    if os.name == "nt":
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python3"


def base_python() -> str:
    return sys.executable or ("python" if os.name == "nt" else "python3")


def ensure_venv() -> Path:
    py = venv_python()
    if not py.exists():
        VENV_DIR.parent.mkdir(parents=True, exist_ok=True)
        out = subprocess.run([base_python(), "-m", "venv", str(VENV_DIR)],
                             capture_output=True, text=True)
        if out.returncode != 0:
            raise HTTPException(status_code=500,
                                detail=f"venv creation failed: {out.stderr}")
    return py


class RunResult(BaseModel):
    stdout: str
    stderr: str
    code: Optional[int]


def _run_code(code: str, stdin: str) -> RunResult:
    py = venv_python() if venv_python().exists() else Path(base_python())
    proc = subprocess.run([str(py), "-c", code], input=stdin,
                          capture_output=True, text=True, timeout=300)
    return RunResult(stdout=proc.stdout, stderr=proc.stderr, code=proc.returncode)


def _ensure(packages: list[str]) -> RunResult:
    pkgs = [p.strip() for p in packages if p and p.strip()]
    if not pkgs:
        return RunResult(stdout="", stderr="", code=0)
    py = ensure_venv()
    marker = VENV_DIR / ".installed.txt"
    installed = set()
    if marker.exists():
        installed = {ln.strip() for ln in marker.read_text().splitlines() if ln.strip()}
    missing = [p for p in pkgs if p not in installed]
    if not missing:
        return RunResult(stdout="", stderr="", code=0)
    proc = subprocess.run([str(py), "-m", "pip", "install", *missing],
                          capture_output=True, text=True)
    if proc.returncode == 0:
        marker.write_text("\n".join(sorted(installed | set(missing))), encoding="utf-8")
    return RunResult(stdout=proc.stdout, stderr=proc.stderr, code=proc.returncode)


class RunRequest(BaseModel):
    code: str
    stdin: str = ""


@app.post("/api/run", response_model=RunResult)
def run_python(req: RunRequest) -> RunResult:
    try:
        return _run_code(req.code, req.stdin)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="run timed out")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"could not start python: {e}")


class PackagesRequest(BaseModel):
    packages: list[str] = []


@app.post("/api/ensure-packages", response_model=RunResult)
def ensure_packages(req: PackagesRequest) -> RunResult:
    return _ensure(req.packages)


# --------------------------------------------------------------------------
# Scheduling (server-side; fires while the server is running)
# --------------------------------------------------------------------------

def _safe_ident(name: str) -> str:
    c = re.sub(r"[^A-Za-z0-9_]", "_", (name or "").strip())
    return re.sub(r"^([0-9])", r"_\1", c)


def _port_ident(p: dict) -> str:
    return _safe_ident(p.get("name", "")) or f"p_{p.get('id', '')}"


def _module_func_name(m: dict) -> str:
    base = re.sub(r"[^a-z0-9_]", "_", (m.get("name", "") or "").strip().lower())
    base = re.sub(r"^([0-9])", r"_\1", base)
    return "mod_" + (base or str(m.get("id", ""))[:8])


def _gen_script_program(m: dict) -> str:
    """Build a runnable program for a script module (server-side fallback when
    no cached `program` was stored by the editor)."""
    inputs = m.get("inputs", [])
    outputs = m.get("outputs", [])
    in_idents = {_port_ident(p) for p in inputs}
    args = ", ".join(_port_ident(p) for p in inputs)
    init = "\n".join(f"    {_port_ident(o)} = None"
                     for o in outputs if _port_ident(o) not in in_idents)
    body = "\n".join(("    " + ln) if ln.strip() else ln
                     for ln in (m.get("script", "") or "").split("\n"))
    if not body.strip():
        body = "    pass"
    if len(outputs) == 1:
        ret = f"    return {_port_ident(outputs[0])}"
    elif len(outputs) > 1:
        pairs = ", ".join(f'"{_port_ident(o)}": {_port_ident(o)}' for o in outputs)
        ret = f"    return {{{pairs}}}"
    else:
        ret = ""
    fn = f"def {_module_func_name(m)}({args}):\n"
    fn += (init + "\n" if init else "") + body + ("\n" + ret if ret else "")

    call_args = ", ".join(f'_inputs.get("{_port_ident(p)}")' for p in inputs)
    if len(outputs) == 0:
        mapo = "_outputs = {}"
    elif len(outputs) == 1:
        mapo = f'_outputs = {{"{_port_ident(outputs[0])}": _result}}'
    else:
        mapo = "_outputs = _result if isinstance(_result, dict) else {}"

    return (
        "import json, sys, os\n\n"
        "_ENV = {}\n"
        "def env(name, default=None):\n    return _ENV.get(name, default)\n\n"
        f"{fn}\n\n\n"
        'if __name__ == "__main__":\n'
        '    _payload = json.loads(sys.stdin.read() or "{}")\n'
        '    _inputs = _payload.get("inputs", {})\n'
        '    _ENV.update(_payload.get("env", {}))\n'
        "    os.environ.update({k: str(v) for k, v in _ENV.items()})\n"
        f"    _result = {_module_func_name(m)}({call_args})\n"
        f"    {mapo}\n"
        "    print(json.dumps(_outputs, default=str))\n"
    )


def _module_program(m: dict) -> Optional[str]:
    prog = m.get("program")
    if prog:
        return prog
    if m.get("kind") == "script":
        return _gen_script_program(m)
    return None


def notify(title: str, body: str) -> None:
    try:
        system = platform.system()
        if system == "Darwin":
            subprocess.run(["osascript", "-e",
                            f"display notification {json.dumps(body)} "
                            f"with title {json.dumps(title)}"], check=False)
        elif system == "Linux":
            subprocess.run(["notify-send", title, body], check=False)
        else:
            print(f"[notify] {title}: {body}")
    except Exception:
        print(f"[notify] {title}: {body}")


_running: set[str] = set()
_running_lock = threading.Lock()


def _env_vars(name: str) -> dict:
    store = read_doc("environments", {"environments": []})
    for e in store.get("environments", []):
        if e.get("name") == name:
            return e.get("vars", {}) or {}
    return {}


def run_schedule(sched: dict) -> dict:
    modules = {m.get("id"): m for _, m in walk_modules()}
    env_vars = _env_vars(sched.get("env", ""))
    stdin = json.dumps({"inputs": {}, "env": env_vars})
    results = []
    for mid in sched.get("moduleIds", []):
        m = modules.get(mid)
        name = m.get("name") if m else "(missing)"
        if not m:
            results.append({"id": mid, "name": name, "ok": False, "detail": "module not found"})
            if sched.get("stopOnError"):
                break
            continue
        prog = _module_program(m)
        if not prog:
            results.append({"id": mid, "name": name, "ok": False,
                            "detail": "no generated program — open & save the module once"})
            if sched.get("stopOnError"):
                break
            continue
        reqs = list(m.get("requirements") or [])
        for imp, pkg in (("import openpyxl", "openpyxl"), ("import requests", "requests")):
            if imp in prog and pkg not in reqs:
                reqs.append(pkg)
        if reqs:
            dep = _ensure(reqs)
            if dep.code != 0:
                results.append({"id": mid, "name": name, "ok": False,
                                "detail": f"dependency install failed: {dep.stderr or dep.stdout}"})
                if sched.get("stopOnError"):
                    break
                continue
        try:
            out = _run_code(prog, stdin)
            ok = out.code == 0
            detail = (out.stdout.strip() if ok else out.stderr.strip()) or ("ok" if ok else "failed")
        except Exception as e:
            ok, detail = False, str(e)
        results.append({"id": mid, "name": name, "ok": ok, "detail": detail})
        if not ok and sched.get("stopOnError"):
            break

    passed = sum(1 for r in results if r["ok"])
    failed = len(results) - passed
    ok = failed == 0 and len(results) > 0
    run = {"at": datetime.now().isoformat(), "passed": passed, "failed": failed, "ok": ok}

    # Persist lastRun back onto the schedule.
    all_scheds = read_doc("schedules", [])
    for s in all_scheds:
        if s.get("id") == sched.get("id"):
            s["lastRun"] = run
    write_doc("schedules", all_scheds)

    mode = sched.get("notify", "always")
    if mode == "always" or (mode == "on-failure" and not ok):
        notify(f"{sched.get('name', 'Schedule')}: {'passed' if ok else 'failed'}",
               f"{passed} passed, {failed} failed")

    return {"passed": passed, "failed": failed, "ok": ok, "results": results}


def _on_minute(now: datetime) -> None:
    for s in read_doc("schedules", []):
        if not s.get("enabled") or not s.get("moduleIds"):
            continue
        sid = s.get("id")
        with _running_lock:
            if sid in _running:
                continue
        if cron_matches(s.get("cron", ""), now):
            with _running_lock:
                _running.add(sid)
            threading.Thread(target=_fire, args=(s,), daemon=True).start()


def _fire(sched: dict) -> None:
    try:
        run_schedule(sched)
    finally:
        with _running_lock:
            _running.discard(sched.get("id"))


@app.post("/api/schedules/{schedule_id}/run")
def run_schedule_now(schedule_id: str) -> dict:
    sched = next((s for s in read_doc("schedules", []) if s.get("id") == schedule_id), None)
    if not sched:
        raise HTTPException(status_code=404, detail="schedule not found")
    return run_schedule(sched)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


# --------------------------------------------------------------------------
# Static UI (mounted last so /api routes win)
# --------------------------------------------------------------------------

if STATIC_DIR.exists():
    # index.html references content-hashed asset files, so it must never be
    # cached — otherwise a browser keeps loading old JS/CSS after an update.
    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(
            STATIC_DIR / "index.html",
            headers={"Cache-Control": "no-store, must-revalidate"},
        )

    # Hashed assets (dist/assets/*) are safe to cache long-term; everything
    # else falls through to here.
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
