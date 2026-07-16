# Block Sandbox

Build automations out of Scratch-style blocks (Blockly), and Block Sandbox
generates and runs the equivalent Python for you. It's a React + TypeScript UI
served by a small Python (FastAPI) backend — everything runs locally.

## What you can build

- **Block modules** — wire blocks together on a canvas; each module compiles to
  a Python function and can call other modules as blocks.
- **Script modules** — drop the canvas for a raw Python editor when you'd rather
  write code. They still appear as callable blocks in other modules.
- **Dashboards** — a block module whose **widget** blocks (table, metric, text,
  chart, JSON, HTML) render a live grid. Refresh on demand or on an interval.

## Run

```bash
# 1. Build the UI
npm install
npm run build                      # outputs to dist/

# 2. Serve it with the Python backend
cd server
pip install -r requirements.txt
mkdir -p static && cp -r ../dist/* static/   # the server serves server/static/
python run.py                      # http://127.0.0.1:8000
```

Development (hot-reload UI + API):

```bash
cd server && pip install -r requirements.txt && python run.py   # API on :8000
npm run dev                                                     # UI on :5173, proxies /api
```

## Docker

```bash
docker build -t block-sandbox ./server
docker run -p 8000:8000 -v block-sandbox-data:/app/server/data block-sandbox
```

To point the app at an existing flows directory that is a git repo (so the
in-app Git panel version-controls it), use Compose:

```bash
FLOWS_DIR=/path/to/your/flows-repo docker compose -f server/docker-compose.yml up --build
```

The compose file mounts `FLOWS_DIR` as the data dir and keeps the runtime Python
venv in a separate named volume so it never lands inside your repo.

> **Security:** the `/api/run` endpoint executes arbitrary Python with the
> server's privileges. Keep it on localhost / a trusted network.

## Data & storage

Data lives in `server/data/` (or a mounted directory) as human-friendly
**YAML**:

- `modules/<folder>/<name>.yml` — one file per module; generated/script Python
  appears as readable block scalars. Copy a whole directory of `.yml` files in
  and they show up automatically (a missing id/name is filled in on load, and
  the folder comes from the path). Exported `.yml`/`.json` files import too.
- `environments.yml` — named environments of variables (read with the `env`
  block / `env()` in scripts).
- `schedules.yml` — scheduled jobs.

If the data directory is a **git repo**, the Home page shows a **Git** panel:
status, colored diff, commit, push, and pull — all from the UI.

## Blocks

Alongside the standard Blockly categories (Logic, Loops, Math, Text, Lists,
Variables, Functions), Block Sandbox adds:

- **Inputs / Outputs** — getter/setter blocks for the module's declared ports.
- **Modules** — every other module as a callable value block.
- **Objects** — `transform` (map an object or list of objects to a new shape,
  with `=expr` computed fields), get/set by dotted path, keys/values, merge, and
  more.
- **Lists** — sort by key, filter/find (search) by field with operators, take,
  slice, chunk, uniq, and aggregates (`sum`/`min`/`max`/`mean`) that can fold a
  field across a list of objects.
- **JSON, File, HTTP, XML/HTML (XPath & CSS)** — parse/stringify, read/write
  files and Excel/CSV, make HTTP requests, extract by selector.
- **Script** — a generic block for raw Python statements inline in a flow.
- **Widgets** — table / metric / text / chart / JSON / HTML for dashboards.
- **Assert / Debug / Environment** — testing, logging, env-var access.

Right-click a block for a **shared clipboard** (copy/paste blocks across
different diagrams). The Diagram toolbar can also export the blocks as a PNG.

## Scheduling

Schedules run **server-side**: a background thread fires due cron jobs while the
server is running (no browser tab required), runs the module, records the
result, and sends an OS desktop notification (macOS `osascript` / Linux
`notify-send`). The Scheduler tab's **Run now** triggers a job on demand.

Block modules run headlessly from their cached generated Python (`module.program`,
refreshed on save); script modules run from their body directly.

## Bundle & release

```bash
python tools/build_dist.py                    # -> build/block-sandbox/ and a zip
python tools/build_dist.py --skip-frontend    # reuse an existing dist/
```

The recipient needs only Python 3.10+ and runs
`pip install -r requirements.txt && python run.py`. The **Release** GitHub
Action produces the same zip on each `v*` tag.

## Layout

```
src/
  types/module.ts        Module data model (block / script / dashboard kinds)
  storage/               Modules, environments, schedules, import/export, git (HTTP API)
  blockly/
    blocks.ts            Dynamic blocks (inputs/outputs/module calls) + toolbox
    lodashBlocks.ts      List/object/text/number utility blocks
    transformBlock.ts    The object/list "transform" mutator block
    fieldCode.ts         Code-editor field + generic "python" script block
    codegen.ts           Module -> Python function + full runnable program
    clipboard.ts         Cross-diagram shared block clipboard
    exportImage.ts       Export the workspace as PNG/SVG
    sanitize.ts          Drop unknown/removed block types when loading
  components/            OverviewTab, DiagramTab, ScriptTab, RunTab, DashboardTab, Widget, …
  pages/                 Home, Editor, Scheduler
server/
  app.py                 FastAPI app: YAML storage, run/venv, scheduler, git API, static UI
  scheduler.py           Cron matcher + minute timer
  run.py                 uvicorn launcher
  Dockerfile             Container image
  docker-compose.yml     Mount a flows git repo as the data dir
```

The Run/Dashboard features need Python 3 available to the server; it manages its
own virtualenv under `data/venv` and installs a module's requirements there.
