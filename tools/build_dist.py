"""Bundle Block Sandbox (UI + Python server) into a runnable folder and zip.

    python tools/build_dist.py                 # full build
    python tools/build_dist.py --skip-frontend # reuse existing dist/
    python tools/build_dist.py --no-zip        # just stage the folder

Output:
    server/static/          the built UI, in place (so `python server/run.py` works)
    build/block-sandbox/    a clean, self-contained tree
    build/block-sandbox-<version>.zip
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
SERVER = ROOT / "server"
STATIC = SERVER / "static"
OUT = ROOT / "build"
STAGE = OUT / "block-sandbox"

SERVER_FILES = ["app.py", "run.py", "scheduler.py", "requirements.txt"]

README = """\
Block Sandbox
=============

Requirements: Python 3.10+

    pip install -r requirements.txt
    python run.py                 # then open http://127.0.0.1:8000
    python run.py --port 9000     # different port

Data (modules / environments / schedules / the venv used to run code) is stored
in ./data next to run.py. The Run feature executes Python with the server's
privileges, so keep it on localhost / a trusted network.
"""


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd))
    subprocess.run(cmd, cwd=ROOT, check=True)


def app_version() -> str:
    import json
    pkg = json.loads((ROOT / "package.json").read_text())
    return pkg.get("version", "0.0.0")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-frontend", action="store_true", help="reuse existing dist/")
    ap.add_argument("--no-zip", action="store_true")
    args = ap.parse_args()

    # 1. Build the UI.
    if not args.skip_frontend:
        npm = "npm.cmd" if sys.platform == "win32" else "npm"
        run([npm, "ci"])
        run([npm, "run", "build"])
    if not DIST.exists():
        sys.exit("dist/ not found — run without --skip-frontend first.")

    # 2. Put the built UI where the server serves it (server/static).
    if STATIC.exists():
        shutil.rmtree(STATIC)
    shutil.copytree(DIST, STATIC)

    # 3. Assemble a clean, self-contained tree.
    if STAGE.exists():
        shutil.rmtree(STAGE)
    (STAGE / "static").mkdir(parents=True)
    shutil.copytree(DIST, STAGE / "static", dirs_exist_ok=True)
    for name in SERVER_FILES:
        shutil.copy(SERVER / name, STAGE / name)
    samples = ROOT / "samples modules"
    if samples.exists():
        shutil.copytree(samples, STAGE / "samples", dirs_exist_ok=True)
    (STAGE / "README.txt").write_text(README)

    print(f"\nStaged: {STAGE}")

    # 4. Zip it.
    if not args.no_zip:
        version = app_version()
        archive = OUT / f"block-sandbox-{version}"
        if (archive.with_suffix(".zip")).exists():
            archive.with_suffix(".zip").unlink()
        shutil.make_archive(str(archive), "zip", root_dir=OUT, base_dir="block-sandbox")
        print(f"Zipped:  {archive.with_suffix('.zip')}")

    print("\nRun it:")
    print("  cd server && pip install -r requirements.txt && python run.py")
    print("  (or unzip the build/ archive elsewhere and run there)")


if __name__ == "__main__":
    main()
