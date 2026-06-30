# Block Sandbox

A web app for building programs out of Scratch-style blocks (Blockly), then
generating and running Python. A React + TypeScript UI served by a small Python
(FastAPI) web server.

## Run

```bash
# 1. Build the UI
npm install
npm run build                      # outputs to dist/

# 2. Serve it with the Python backend
cd server
pip install -r requirements.txt
# copy the built UI in (the server serves server/static/)
mkdir -p static && cp -r ../dist/* static/
python run.py                      # http://127.0.0.1:8000
```

Development (hot-reload UI + API on :8000):

```bash
cd server && pip install -r requirements.txt && python run.py   # API on :8000
npm run dev                                                     # UI on :5173, proxies /api
```

Data (modules, environments, schedules, and the managed venv used to run code)
lives in `server/data/`. The Run feature executes Python with the server's
privileges — keep it on localhost / a trusted network.

A prebuilt single zip (UI + server) is produced by the **Release** GitHub
Action on each `v*` tag; recipients only need Python 3.10+.

## Scheduling

Schedules run **server-side**: a background thread fires due cron jobs while the
server process is running (no browser tab required), runs each module's modules,
records the result, and sends an OS desktop notification (macOS `osascript` /
Linux `notify-send`). The Scheduler tab's **Run now** triggers a job on demand
via the API.

To run a module on a schedule, open it in the editor once and save — the editor
caches the module's generated Python (`module.program`) so the server can run it
headlessly. Script modules also work without this (the server generates their
program from the script body).

## Status

Phases 1–7 of `PHASE_PLAN.md` are implemented:

- **Phase 1 — Home & modules:** a project **tree** — modules live in nested
  folders (e.g. `proj/mod1`, `prj2/subprj2/mode2`). Create / rename / move (by
  editing the path) / delete; click to open. Each module is a single JSON file
  stored under a path that mirrors its folder
  (`modules/prj2/subprj2/mode2.json`) in the Tauri app-data directory, with a
  localStorage fallback for plain-browser use.
- **Phase 2 — Editor shell:** Overview / Diagram / Run tabs. Overview edits the
  module name, description, and declared inputs/outputs (each with a type).
- **Phase 3 — Blockly diagram:** a Blockly workspace with standard blocks
  (Logic, Loops, Math, Text, Lists, Variables, Functions) plus data-driven
  categories: **Inputs** (getter blocks), **Outputs** (setter blocks), and
  **Modules** — every other module becomes a callable value block (Option A).
  The workspace autosaves into the module file.
- **Phase 4 — Python codegen + Run:** every module compiles to a Python
  function (`src/blockly/codegen.ts`); the Run tab collects typed inputs, runs
  the generated program through a Rust `run_python` command (system Python via
  stdin/stdout JSON), and shows output, errors, and the generated source.
- **Phase 5 — Script modules:** a "script" module kind swaps the Diagram tab
  for a Python editor. Script modules still appear as callable blocks in other
  modules and compile to functions from their raw Python body.
- **Phase 6 — Import / export:** export a module to JSON (save dialog / browser
  download), import with a fresh id (open dialog / file input), and drag a
  `.json` module file onto the window.
- **Phase 7 — Polish & packaging:** dark Blockly theme (thrasos renderer), a
  diagram toolbar (undo / redo / zoom in-out / zoom-to-fit / clean-up), in-canvas
  block search (⌘F), in-app modals replacing the unsupported `window.prompt`,
  safe codegen with errors surfaced in the Run tab, and a bundled-Python sidecar
  path with system-Python fallback (see `PACKAGING.md`).

## Develop

```bash
npm install

# Full desktop app (requires the Rust + Tauri prerequisites for your OS):
npm run tauri dev

# Or just the web UI in a browser (uses localStorage for persistence):
npm run dev          # http://localhost:1420
```

Tauri prerequisites: https://tauri.app/start/prerequisites/

## Build

```bash
npm run build          # type-check + bundle the frontend
npm run tauri build    # produce a desktop installer
```

## Layout

```
src/
  types/module.ts        Module data model + helpers (block & script kinds)
  storage/modules.ts     Load/save modules (Tauri fs or localStorage)
  storage/io.ts          Import/export modules as JSON
  blockly/blocks.ts      Dynamic blocks (inputs/outputs/module calls) + toolbox
  blockly/codegen.ts     Module -> Python function + full runnable program
  runtime/python.ts      Calls the Rust run_python command
  components/            OverviewTab, DiagramTab, ScriptTab, RunTab, BlocklyWorkspace
  pages/                 Home, Editor
src-tauri/               Rust shell (run_python + file commands), config, capabilities
```

Note: the Run tab needs Python 3 on PATH (Phase 7 will bundle a sidecar).
