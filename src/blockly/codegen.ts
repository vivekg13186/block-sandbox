// Turns modules into runnable Python.
//
// Each module compiles to a function `mod_<name>(...inputs)` that returns:
//   - the single output's value if it declares exactly one output,
//   - a dict {name: value} if it declares several,
//   - None if it declares none.
// A full program defines every module's function (so cross-module calls
// resolve) and adds a stdin/stdout harness that runs the target module.

import * as Blockly from "blockly";
import { pythonGenerator } from "blockly/python";
import { registerDynamicBlocks, moduleFuncName } from "./blocks";
import { portIdent } from "../types/module";
import type { Module } from "../types/module";

function indent(code: string, spaces = 4): string {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.trim() ? pad + line : line))
    .join("\n");
}

/** Build the body (statements, pre-return) for a module. */
function moduleBody(m: Module, all: Module[]): string {
  if (m.kind === "script") {
    return m.script && m.script.trim() ? m.script.replace(/\s+$/, "") : "";
  }
  registerDynamicBlocks(m, all);
  const ws = new Blockly.Workspace();
  try {
    if (m.workspace) Blockly.serialization.workspaces.load(m.workspace, ws);
    return (pythonGenerator.workspaceToCode(ws) || "").replace(/\s+$/, "");
  } finally {
    ws.dispose();
  }
}

/** Compile one module to a Python function definition. */
export function generateModuleFunction(m: Module, all: Module[]): string {
  const args = m.inputs.map(portIdent).join(", ");
  // Initialize outputs to None, but never clobber an input that shares the
  // same name (then the output simply defaults to the input value).
  const inputIdents = new Set(m.inputs.map(portIdent));
  const initOuts = m.outputs
    .filter((p) => !inputIdents.has(portIdent(p)))
    .map((p) => `${portIdent(p)} = None`)
    .join("\n");
  const body = moduleBody(m, all);

  let combined = [initOuts, body].filter(Boolean).join("\n");
  if (!combined.trim()) combined = "pass";

  let ret = "";
  if (m.outputs.length === 1) {
    ret = `return ${portIdent(m.outputs[0])}`;
  } else if (m.outputs.length > 1) {
    const pairs = m.outputs
      .map((p) => `${JSON.stringify(portIdent(p))}: ${portIdent(p)}`)
      .join(", ");
    ret = `return {${pairs}}`;
  }

  const full = ret ? `${combined}\n${ret}` : combined;
  return `def ${moduleFuncName(m)}(${args}):\n${indent(full)}`;
}

/** Generate a full runnable program that executes `target` from stdin JSON. */
export function generateProgram(target: Module, all: Module[]): string {
  // Merge the live target over the (possibly stale) list so its function name
  // and body match exactly what the harness calls — e.g. after a rename.
  const byId = new Map<string, Module>();
  for (const m of all) byId.set(m.id, m);
  byId.set(target.id, target);
  const modules = Array.from(byId.values());

  const funcs = modules.map((m) => generateModuleFunction(m, modules)).join("\n\n\n");

  const callArgs = target.inputs
    .map((p) => `_inputs.get(${JSON.stringify(portIdent(p))})`)
    .join(", ");

  let mapOutputs: string;
  if (target.outputs.length === 0) {
    mapOutputs = "_outputs = {}";
  } else if (target.outputs.length === 1) {
    mapOutputs = `_outputs = {${JSON.stringify(portIdent(target.outputs[0]))}: _result}`;
  } else {
    mapOutputs = "_outputs = _result if isinstance(_result, dict) else {}";
  }

  return `import json, sys, os

# Environment variables for the active environment (dev / test / ...).
_ENV = {}
def env(name, default=None):
    """Read an environment variable from the active environment."""
    return _ENV.get(name, default)

${funcs}


if __name__ == "__main__":
    _payload = json.loads(sys.stdin.read() or "{}")
    _inputs = _payload.get("inputs", {})
    _ENV.update(_payload.get("env", {}))
    os.environ.update({k: str(v) for k, v in _ENV.items()})
    _result = ${moduleFuncName(target)}(${callArgs})
    ${mapOutputs}
    print(json.dumps(_outputs, default=str))
`;
}

/** Just the target module's own function — used for the code preview. */
export function previewFunction(target: Module, all: Module[]): string {
  return generateModuleFunction(target, all);
}

/** Union of pip requirements across the target and every module in the run. */
export function collectRequirements(target: Module, all: Module[]): string[] {
  const byId = new Map<string, Module>();
  for (const m of all) byId.set(m.id, m);
  byId.set(target.id, target);
  const set = new Set<string>();
  for (const m of byId.values()) {
    for (const r of m.requirements ?? []) {
      const spec = r.trim();
      if (spec) set.add(spec);
    }
  }
  return [...set];
}
