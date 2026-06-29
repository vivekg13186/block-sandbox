# Block Sandbox — Phase Plan

A Tauri + React desktop app for a block-based programming sandbox, using **Blockly** (Scratch-style snap-together blocks) and Lucide icons. Blockly's Python code generator handles "convert programs to executable Python." Reference concepts (module/project model, Python execution engine, import/export) are drawn from the `nbt` project.

**Module connection model (locked): Option A — modules as value/call blocks.** Each module compiles to a Blockly block with input slots that returns a value; you nest it inside another module's script, exactly like a Scratch custom block / function call.

## Architecture at a glance
- **Shell:** Tauri 2 (Rust) + React + TypeScript, Lucide icons.
- **Editor:** Blockly embedded in React (`blockly`, optionally `react-blockly`).
- **Execution:** generated Python run via a bundled Python sidecar process.
- **Persistence:** modules stored on disk via Tauri fs as JSON (Blockly workspace + metadata).

**Module data model:** `name`, `description`, `inputs[]`, `outputs[]`, `workspace` (serialized Blockly state).

---

## Phase 0 — Scaffold & decisions
Stand up Tauri 2 + React + TypeScript with Lucide. Add Blockly. Decide and stub the Python sidecar approach (Rust spawns a Python process to run generated code). Define the module data model and Home ↔ Editor routing.
**Done when:** app boots and navigates between an empty Home and Editor.

## Phase 1 — Module model & Home page
Home page lists modules with create / rename / delete; click-to-open transitions to the Editor. Persist modules to disk via Tauri fs.
**Done when:** modules can be created, saved, and reopened across restarts.

## Phase 2 — Editor shell, three tabs
Editor tab bar: **Overview / Diagram / Run**. Overview is a form for name, description, and declared inputs/outputs — these define the module's block signature (input slots + return value).
**Done when:** module metadata edits persist and drive the generated block signature.

## Phase 3 — Blockly editor (Diagram tab)
Embed Blockly in React. Build the toolbox: Blockly built-ins (logic, loops, math, text, variables) plus custom module-block categories. Each module's declared inputs/outputs **auto-generate a value/call block** (input slots + return value, per Option A) so it can be nested inside other modules. Save/restore the workspace to the module file.
**Done when:** a module can be built from blocks, nest other modules as call blocks, and round-trip to disk.

## Phase 4 — Python codegen & Run tab
Use Blockly's Python generator to compile the workspace to a runnable script; register code generators for custom module blocks (each emits a Python function + call). The Run tab takes user inputs, executes the generated Python via the sidecar, and streams output/errors back. Include a "Show generated code" view.
**Done when:** a module runs end-to-end with user inputs and shows results + generated source.

## Phase 5 — Scripting (script module)
A script-module type: the user writes raw Python plus a JSON block definition (label, input fields, output). The app registers it as a new Blockly block with a matching code generator, so it appears in the toolbox like any standard block.
**Done when:** a user-authored script block can be placed and run inside a module.

## Phase 6 — Import / export
Export/import modules as JSON (Blockly workspace + metadata), interchangeable and self-describing (carries name + I/O). Support drag-and-drop import onto the window.
**Done when:** a module round-trips between machines and re-registers its call block.

## Phase 7 — Polish & package
Undo/redo and zoom (Blockly built-ins), block/toolbox search, error surfacing for broken script blocks, theming / dark mode, and bundling the Python sidecar into the Tauri installer for each platform.
**Done when:** a signed/distributable desktop app is produced.

---

## Suggested MVP cut
Phases 0–4 deliver the core loop: create a module, build it from blocks, nest modules, and run generated Python. Phases 5–7 add scripting, portability, and polish.
