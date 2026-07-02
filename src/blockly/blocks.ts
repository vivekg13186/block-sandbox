// Dynamic Blockly blocks for Block Sandbox.
//
// Three families of data-driven blocks are (re)registered for the module
// currently open in the editor:
//   - bs_in_<portId>  : value block, reads one of this module's inputs
//   - bs_out_<portId> : statement block, writes one of this module's outputs
//   - bs_mod_<moduleId> : value block, calls another module (Option A)
//
// Plus a matching Python generator for each, so the Run tab can preview code.

import * as Blockly from "blockly";
import { pythonGenerator, Order } from "blockly/python";
import type { Module } from "../types/module";
import { portIdent, normalizeFolder } from "../types/module";
import { registerCodeField } from "./fieldCode";
import {
  registerLodashBlocks,
  lodashCategories,
  listCategoryExtras,
  objectCategoryExtras,
  textCategoryExtras,
} from "./lodashBlocks";

export const IN_COLOUR = 160;
export const OUT_COLOUR = 20;
export const MOD_COLOUR = 230;
export const ENV_COLOUR = 60;
export const JSON_COLOUR = 200;
export const OBJ_COLOUR = 300;
export const FILE_COLOUR = 45;

let staticRegistered = false;

/** Register blocks that don't depend on module data (env var getter, etc.). */
function registerStaticBlocks(): void {
  if (staticRegistered) return;
  staticRegistered = true;

  registerCodeField();

  Blockly.common.defineBlocksWithJsonArray([
    {
      type: "env_get",
      message0: "env %1",
      args0: [{ type: "field_input", name: "NAME", text: "base_url" }],
      output: null,
      colour: ENV_COLOUR,
      tooltip: "Value of an environment variable from the active environment",
    },
    {
      type: "assert_true",
      message0: "assert %1 message %2",
      args0: [
        { type: "input_value", name: "COND" },
        { type: "field_input", name: "MSG", text: "" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: OUT_COLOUR,
      tooltip: "Fail the run if the condition is falsy",
    },
    {
      type: "assert_equals",
      message0: "assert %1 = %2 message %3",
      args0: [
        { type: "input_value", name: "A" },
        { type: "input_value", name: "B" },
        { type: "field_input", name: "MSG", text: "" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: OUT_COLOUR,
      tooltip: "Fail the run if the two values are not equal",
    },
    {
      type: "json_parse",
      message0: "parse JSON %1",
      args0: [{ type: "input_value", name: "TEXT" }],
      output: null,
      colour: JSON_COLOUR,
      tooltip: "Parse a JSON string into a value (json.loads)",
    },
    {
      type: "json_stringify",
      message0: "JSON of %1",
      args0: [{ type: "input_value", name: "VALUE" }],
      output: null,
      colour: JSON_COLOUR,
      tooltip: "Serialize a value to a JSON string (json.dumps)",
    },
    {
      type: "json_get",
      message0: "get key %1 from %2",
      args0: [
        { type: "input_value", name: "KEY" },
        { type: "input_value", name: "OBJ" },
      ],
      inputsInline: true,
      output: null,
      colour: JSON_COLOUR,
      tooltip: "Get a key from a dict / parsed JSON object",
    },
    {
      type: "object_empty",
      message0: "empty object",
      output: null,
      colour: OBJ_COLOUR,
      tooltip: "An empty object / dict {}",
    },
    {
      type: "object_get",
      message0: "get key %1 of %2",
      args0: [
        { type: "input_value", name: "KEY" },
        { type: "input_value", name: "OBJ" },
      ],
      inputsInline: true,
      output: null,
      colour: OBJ_COLOUR,
      tooltip: "Read a key from an object (returns None if missing)",
    },
    {
      type: "object_set",
      message0: "set key %1 of %2 to %3",
      args0: [
        { type: "input_value", name: "KEY" },
        { type: "input_value", name: "OBJ" },
        { type: "input_value", name: "VALUE" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: OBJ_COLOUR,
      tooltip: "Set a key on an object",
    },
    {
      type: "object_keys",
      message0: "keys of %1",
      args0: [{ type: "input_value", name: "OBJ" }],
      output: null,
      colour: OBJ_COLOUR,
      tooltip: "List of an object's keys",
    },
    {
      type: "object_values",
      message0: "values of %1",
      args0: [{ type: "input_value", name: "OBJ" }],
      output: null,
      colour: OBJ_COLOUR,
      tooltip: "List of an object's values",
    },
    {
      type: "object_get_path",
      message0: "get path %1 of %2",
      args0: [
        { type: "field_input", name: "PATH", text: "address.line1" },
        { type: "input_value", name: "OBJ" },
      ],
      inputsInline: true,
      output: null,
      colour: OBJ_COLOUR,
      tooltip: "Read a nested value by dotted path (None if missing)",
    },
    {
      type: "object_set_path",
      message0: "set path %1 of %2 to %3",
      args0: [
        { type: "field_input", name: "PATH", text: "address.line1" },
        { type: "input_value", name: "OBJ" },
        { type: "input_value", name: "VALUE" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: OBJ_COLOUR,
      tooltip: "Set a nested value by dotted path, creating intermediate objects",
    },
    {
      type: "file_read",
      message0: "read text file %1",
      args0: [{ type: "input_value", name: "PATH" }],
      output: null,
      colour: FILE_COLOUR,
      tooltip: "Read a text file and return its contents",
    },
    {
      type: "file_write",
      message0: "write text %1 to file %2",
      args0: [
        { type: "input_value", name: "TEXT" },
        { type: "input_value", name: "PATH" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: FILE_COLOUR,
      tooltip: "Write text to a file (overwrites)",
    },
    {
      type: "file_append",
      message0: "append text %1 to file %2",
      args0: [
        { type: "input_value", name: "TEXT" },
        { type: "input_value", name: "PATH" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: FILE_COLOUR,
      tooltip: "Append text to a file",
    },
    {
      type: "file_read_json",
      message0: "read JSON file %1",
      args0: [{ type: "input_value", name: "PATH" }],
      output: null,
      colour: FILE_COLOUR,
      tooltip: "Read and parse a JSON file",
    },
    {
      type: "file_write_json",
      message0: "write JSON %1 to file %2",
      args0: [
        { type: "input_value", name: "VALUE" },
        { type: "input_value", name: "PATH" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: FILE_COLOUR,
      tooltip: "Serialize a value to a JSON file",
    },
    {
      type: "file_exists",
      message0: "file %1 exists",
      args0: [{ type: "input_value", name: "PATH" }],
      output: null,
      colour: FILE_COLOUR,
      tooltip: "True if the path exists",
    },
    {
      type: "list_dir",
      message0: "list directory %1",
      args0: [{ type: "input_value", name: "PATH" }],
      output: null,
      colour: FILE_COLOUR,
      tooltip: "List entries in a directory",
    },
    {
      type: "file_delete",
      message0: "delete file %1",
      args0: [{ type: "input_value", name: "PATH" }],
      previousStatement: null,
      nextStatement: null,
      colour: FILE_COLOUR,
      tooltip: "Delete a file",
    },
    {
      type: "log_value",
      message0: "log %1",
      args0: [{ type: "input_value", name: "VALUE" }],
      previousStatement: null,
      nextStatement: null,
      colour: "#6b7280",
      tooltip: "Print a value to the run output (log)",
    },
    {
      type: "log_labeled",
      message0: "log %1 = %2",
      args0: [
        { type: "field_input", name: "LABEL", text: "value" },
        { type: "input_value", name: "VALUE" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: "#6b7280",
      tooltip: "Print a labeled value to the run output (log)",
    },
  ]);

  pythonGenerator.forBlock["env_get"] = (block) => {
    const name = block.getFieldValue("NAME") || "";
    return [`env(${JSON.stringify(name)})`, Order.FUNCTION_CALL];
  };

  pythonGenerator.forBlock["assert_true"] = (block) => {
    const cond = pythonGenerator.valueToCode(block, "COND", Order.NONE) || "False";
    const msg = (block.getFieldValue("MSG") || "").trim();
    return msg ? `assert ${cond}, ${JSON.stringify(msg)}\n` : `assert ${cond}\n`;
  };

  pythonGenerator.forBlock["assert_equals"] = (block) => {
    const a = pythonGenerator.valueToCode(block, "A", Order.NONE) || "None";
    const b = pythonGenerator.valueToCode(block, "B", Order.NONE) || "None";
    const msg = (block.getFieldValue("MSG") || "").trim();
    return msg ? `assert ${a} == ${b}, ${JSON.stringify(msg)}\n` : `assert ${a} == ${b}\n`;
  };

  // JSON blocks rely on a module-level `import json`, which generateProgram emits.
  pythonGenerator.forBlock["json_parse"] = (block) => {
    const text = pythonGenerator.valueToCode(block, "TEXT", Order.NONE) || "'{}'";
    return [`json.loads(${text})`, Order.FUNCTION_CALL];
  };
  pythonGenerator.forBlock["json_stringify"] = (block) => {
    const value = pythonGenerator.valueToCode(block, "VALUE", Order.NONE) || "None";
    return [`json.dumps(${value})`, Order.FUNCTION_CALL];
  };
  pythonGenerator.forBlock["json_get"] = (block) => {
    const key = pythonGenerator.valueToCode(block, "KEY", Order.NONE) || "''";
    const obj = pythonGenerator.valueToCode(block, "OBJ", Order.NONE) || "{}";
    return [`(${obj}).get(${key})`, Order.FUNCTION_CALL];
  };

  // Object / dict blocks.
  pythonGenerator.forBlock["object_empty"] = () => ["{}", Order.ATOMIC];
  pythonGenerator.forBlock["object_get"] = (block) => {
    const key = pythonGenerator.valueToCode(block, "KEY", Order.NONE) || "''";
    const obj = pythonGenerator.valueToCode(block, "OBJ", Order.NONE) || "{}";
    return [`(${obj}).get(${key})`, Order.FUNCTION_CALL];
  };
  pythonGenerator.forBlock["object_set"] = (block) => {
    const key = pythonGenerator.valueToCode(block, "KEY", Order.NONE) || "''";
    const obj = pythonGenerator.valueToCode(block, "OBJ", Order.NONE) || "{}";
    const value = pythonGenerator.valueToCode(block, "VALUE", Order.NONE) || "None";
    return `(${obj})[${key}] = ${value}\n`;
  };
  pythonGenerator.forBlock["object_keys"] = (block) => {
    const obj = pythonGenerator.valueToCode(block, "OBJ", Order.NONE) || "{}";
    return [`list((${obj}).keys())`, Order.FUNCTION_CALL];
  };
  pythonGenerator.forBlock["object_values"] = (block) => {
    const obj = pythonGenerator.valueToCode(block, "OBJ", Order.NONE) || "{}";
    return [`list((${obj}).values())`, Order.FUNCTION_CALL];
  };
  pythonGenerator.forBlock["object_get_path"] = (block) => {
    const fn = pythonGenerator.provideFunction_("bs_get_path", [
      `def ${pythonGenerator.FUNCTION_NAME_PLACEHOLDER_}(obj, path):`,
      "    d = obj",
      "    for k in str(path).split('.'):",
      "        if not isinstance(d, dict):",
      "            return None",
      "        d = d.get(k)",
      "    return d",
    ]);
    const obj = pythonGenerator.valueToCode(block, "OBJ", Order.NONE) || "{}";
    const path = block.getFieldValue("PATH") || "";
    return [`${fn}(${obj}, ${JSON.stringify(path)})`, Order.FUNCTION_CALL];
  };
  pythonGenerator.forBlock["object_set_path"] = (block) => {
    const fn = pythonGenerator.provideFunction_("bs_set_path", [
      `def ${pythonGenerator.FUNCTION_NAME_PLACEHOLDER_}(obj, path, value):`,
      "    parts = str(path).split('.')",
      "    d = obj",
      "    for k in parts[:-1]:",
      "        if not isinstance(d.get(k), dict):",
      "            d[k] = {}",
      "        d = d[k]",
      "    d[parts[-1]] = value",
      "    return obj",
    ]);
    const obj = pythonGenerator.valueToCode(block, "OBJ", Order.NONE) || "{}";
    const value = pythonGenerator.valueToCode(block, "VALUE", Order.NONE) || "None";
    const path = block.getFieldValue("PATH") || "";
    return `${fn}(${obj}, ${JSON.stringify(path)}, ${value})\n`;
  };

  // File I/O blocks. Helpers are emitted once per program via provideFunction_.
  const path = (b: Blockly.Block) => pythonGenerator.valueToCode(b, "PATH", Order.NONE) || "''";
  const PH = pythonGenerator.FUNCTION_NAME_PLACEHOLDER_;

  pythonGenerator.forBlock["file_read"] = (block) => {
    const fn = pythonGenerator.provideFunction_("bs_read_file", [
      `def ${PH}(p):`,
      "    with open(p, encoding='utf-8') as f:",
      "        return f.read()",
    ]);
    return [`${fn}(${path(block)})`, Order.FUNCTION_CALL];
  };
  pythonGenerator.forBlock["file_write"] = (block) => {
    const fn = pythonGenerator.provideFunction_("bs_write_file", [
      `def ${PH}(p, text, mode='w'):`,
      "    with open(p, mode, encoding='utf-8') as f:",
      "        f.write(str(text))",
    ]);
    const text = pythonGenerator.valueToCode(block, "TEXT", Order.NONE) || "''";
    return `${fn}(${path(block)}, ${text})\n`;
  };
  pythonGenerator.forBlock["file_append"] = (block) => {
    const fn = pythonGenerator.provideFunction_("bs_write_file", [
      `def ${PH}(p, text, mode='w'):`,
      "    with open(p, mode, encoding='utf-8') as f:",
      "        f.write(str(text))",
    ]);
    const text = pythonGenerator.valueToCode(block, "TEXT", Order.NONE) || "''";
    return `${fn}(${path(block)}, ${text}, 'a')\n`;
  };
  pythonGenerator.forBlock["file_read_json"] = (block) => {
    const fn = pythonGenerator.provideFunction_("bs_read_json", [
      `def ${PH}(p):`,
      "    import json",
      "    with open(p, encoding='utf-8') as f:",
      "        return json.load(f)",
    ]);
    return [`${fn}(${path(block)})`, Order.FUNCTION_CALL];
  };
  pythonGenerator.forBlock["file_write_json"] = (block) => {
    const fn = pythonGenerator.provideFunction_("bs_write_json", [
      `def ${PH}(p, value):`,
      "    import json",
      "    with open(p, 'w', encoding='utf-8') as f:",
      "        json.dump(value, f, indent=2)",
    ]);
    const value = pythonGenerator.valueToCode(block, "VALUE", Order.NONE) || "None";
    return `${fn}(${path(block)}, ${value})\n`;
  };
  pythonGenerator.forBlock["file_exists"] = (block) => [
    `__import__('os').path.exists(${path(block)})`,
    Order.FUNCTION_CALL,
  ];
  pythonGenerator.forBlock["list_dir"] = (block) => [
    `__import__('os').listdir(${path(block)})`,
    Order.FUNCTION_CALL,
  ];
  pythonGenerator.forBlock["file_delete"] = (block) =>
    `__import__('os').remove(${path(block)})\n`;

  pythonGenerator.forBlock["log_value"] = (block) => {
    const value = pythonGenerator.valueToCode(block, "VALUE", Order.NONE) || "''";
    return `print(${value})\n`;
  };
  pythonGenerator.forBlock["log_labeled"] = (block) => {
    const label = block.getFieldValue("LABEL") || "";
    const value = pythonGenerator.valueToCode(block, "VALUE", Order.NONE) || "''";
    return `print(${JSON.stringify(label + ":")}, ${value})\n`;
  };
}

const inType = (portId: string) => `bs_in_${portId}`;
const outType = (portId: string) => `bs_out_${portId}`;
const modType = (moduleId: string) => `bs_mod_${moduleId}`;

/** Safe Python function name for a module. */
export function moduleFuncName(m: Module): string {
  const base = (m.name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^([0-9])/, "_$1");
  return `mod_${base || m.id.slice(0, 8)}`;
}

/**
 * (Re)register all data-driven blocks + generators for the given module and
 * the set of all modules. Safe to call repeatedly — definitions overwrite.
 */
export function registerDynamicBlocks(current: Module, all: Module[]): void {
  registerStaticBlocks();
  registerLodashBlocks();
  const defs: object[] = [];

  // Inputs -> value getter blocks.
  for (const p of current.inputs) {
    const type = inType(p.id);
    defs.push({
      type,
      message0: "%1",
      args0: [{ type: "field_label_serializable", name: "L", text: p.name || "input" }],
      output: null,
      colour: IN_COLOUR,
      tooltip: `Input: ${p.name} (${p.type})`,
    });
    pythonGenerator.forBlock[type] = () => [portIdent(p), Order.ATOMIC];
  }

  // Outputs -> statement setter blocks.
  for (const p of current.outputs) {
    const type = outType(p.id);
    defs.push({
      type,
      message0: "set output %1 = %2",
      args0: [
        { type: "field_label_serializable", name: "L", text: p.name || "output" },
        { type: "input_value", name: "VALUE" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: OUT_COLOUR,
      tooltip: `Set output: ${p.name} (${p.type})`,
    });
    pythonGenerator.forBlock[type] = (block) => {
      const value = pythonGenerator.valueToCode(block, "VALUE", Order.NONE) || "None";
      return `${portIdent(p)} = ${value}\n`;
    };
  }

  // Other modules -> call (value) blocks. Option A: a module returns a value.
  for (const m of all) {
    if (m.id === current.id) continue; // avoid trivial self-recursion in palette
    const type = modType(m.id);
    const msgParts = [m.name];
    const args: object[] = [];
    m.inputs.forEach((p, i) => {
      msgParts.push(`${p.name || "arg"} %${i + 1}`);
      args.push({ type: "input_value", name: `IN_${p.id}` });
    });
    defs.push({
      type,
      message0: msgParts.join(" "),
      args0: args,
      output: null,
      colour: MOD_COLOUR,
      inputsInline: false,
      tooltip: m.description || `Call module: ${m.name}`,
    });
    const fn = moduleFuncName(m);
    const inputs = m.inputs;
    pythonGenerator.forBlock[type] = (block) => {
      const callArgs = inputs
        .map((p) => pythonGenerator.valueToCode(block, `IN_${p.id}`, Order.NONE) || "None")
        .join(", ");
      return [`${fn}(${callArgs})`, Order.FUNCTION_CALL];
    };
  }

  if (defs.length) Blockly.common.defineBlocksWithJsonArray(defs);
}

interface ModTreeNode {
  subs: Map<string, ModTreeNode>;
  blocks: Module[];
}

/**
 * Nest other modules into subcategories mirroring their folder tree, so the
 * "Modules" palette doesn't become one giant flat list as projects grow.
 * Root-level modules appear directly; foldered modules go under sub-categories.
 */
function buildModuleCategories(current: Module, all: Module[]): object[] {
  const root: ModTreeNode = { subs: new Map(), blocks: [] };
  for (const m of all) {
    if (m.id === current.id) continue;
    const parts = normalizeFolder(m.folder).split("/").filter(Boolean);
    let node = root;
    for (const seg of parts) {
      if (!node.subs.has(seg)) node.subs.set(seg, { subs: new Map(), blocks: [] });
      node = node.subs.get(seg)!;
    }
    node.blocks.push(m);
  }

  const render = (node: ModTreeNode): object[] => {
    const cats = [...node.subs.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, child]) => ({
        kind: "category",
        name,
        colour: String(MOD_COLOUR),
        contents: render(child),
      }));
    const blocks = [...node.blocks]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => ({ kind: "block", type: modType(m.id) }));
    return [...cats, ...blocks];
  };

  return render(root);
}

/** Build a category toolbox tailored to the current module. */
export function buildToolbox(current: Module, all: Module[]): object {
  const inputBlocks = current.inputs.map((p) => ({ kind: "block", type: inType(p.id) }));
  const outputBlocks = current.outputs.map((p) => ({ kind: "block", type: outType(p.id) }));
  const moduleContents = buildModuleCategories(current, all);

  return {
    kind: "categoryToolbox",
    contents: [
      {
        kind: "category",
        name: "Inputs",
        colour: String(IN_COLOUR),
        contents: inputBlocks.length
          ? inputBlocks
          : [{ kind: "label", text: "No inputs declared" }],
      },
      {
        kind: "category",
        name: "Outputs",
        colour: String(OUT_COLOUR),
        contents: outputBlocks.length
          ? outputBlocks
          : [{ kind: "label", text: "No outputs declared" }],
      },
      {
        kind: "category",
        name: "Modules",
        colour: String(MOD_COLOUR),
        contents: moduleContents.length
          ? moduleContents
          : [{ kind: "label", text: "No other modules yet" }],
      },
      {
        kind: "category",
        name: "Environment",
        colour: String(ENV_COLOUR),
        contents: [{ kind: "block", type: "env_get" }],
      },
      {
        kind: "category",
        name: "Assert",
        colour: String(OUT_COLOUR),
        contents: [
          { kind: "block", type: "assert_true" },
          { kind: "block", type: "assert_equals" },
        ],
      },
      {
        kind: "category",
        name: "Debug",
        colour: "#6b7280",
        contents: [
          {
            kind: "block",
            type: "log_value",
            inputs: { VALUE: { shadow: { type: "text", fields: { TEXT: "message" } } } },
          },
          {
            kind: "block",
            type: "log_labeled",
            inputs: { VALUE: { shadow: { type: "text", fields: { TEXT: "" } } } },
          },
        ],
      },
      {
        kind: "category",
        name: "JSON",
        colour: String(JSON_COLOUR),
        contents: [
          {
            kind: "block",
            type: "json_parse",
            inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "{}" } } } },
          },
          { kind: "block", type: "json_stringify" },
          {
            kind: "block",
            type: "json_get",
            inputs: { KEY: { shadow: { type: "text", fields: { TEXT: "key" } } } },
          },
        ],
      },
      {
        kind: "category",
        name: "Objects",
        colour: String(OBJ_COLOUR),
        contents: [
          { kind: "block", type: "object_empty" },
          {
            kind: "block",
            type: "object_get",
            inputs: { KEY: { shadow: { type: "text", fields: { TEXT: "key" } } } },
          },
          {
            kind: "block",
            type: "object_set",
            inputs: { KEY: { shadow: { type: "text", fields: { TEXT: "key" } } } },
          },
          { kind: "block", type: "object_keys" },
          { kind: "block", type: "object_values" },
          { kind: "block", type: "object_get_path" },
          { kind: "block", type: "object_set_path" },
          ...objectCategoryExtras(),
        ],
      },
      {
        kind: "category",
        name: "File",
        colour: String(FILE_COLOUR),
        contents: [
          {
            kind: "block",
            type: "file_read",
            inputs: { PATH: { shadow: { type: "text", fields: { TEXT: "path/to/file.txt" } } } },
          },
          {
            kind: "block",
            type: "file_write",
            inputs: { PATH: { shadow: { type: "text", fields: { TEXT: "path/to/file.txt" } } } },
          },
          {
            kind: "block",
            type: "file_append",
            inputs: { PATH: { shadow: { type: "text", fields: { TEXT: "path/to/file.txt" } } } },
          },
          {
            kind: "block",
            type: "file_read_json",
            inputs: { PATH: { shadow: { type: "text", fields: { TEXT: "path/to/file.json" } } } },
          },
          {
            kind: "block",
            type: "file_write_json",
            inputs: { PATH: { shadow: { type: "text", fields: { TEXT: "path/to/file.json" } } } },
          },
          {
            kind: "block",
            type: "file_exists",
            inputs: { PATH: { shadow: { type: "text", fields: { TEXT: "path/to/file" } } } },
          },
          {
            kind: "block",
            type: "list_dir",
            inputs: { PATH: { shadow: { type: "text", fields: { TEXT: "." } } } },
          },
          {
            kind: "block",
            type: "file_delete",
            inputs: { PATH: { shadow: { type: "text", fields: { TEXT: "path/to/file" } } } },
          },
        ],
      },
      { kind: "sep" },
      {
        kind: "category",
        name: "Logic",
        colour: "210",
        contents: [
          { kind: "block", type: "controls_if" },
          { kind: "block", type: "logic_compare" },
          { kind: "block", type: "logic_operation" },
          { kind: "block", type: "logic_negate" },
          { kind: "block", type: "logic_boolean" },
          { kind: "block", type: "logic_null" },
          { kind: "block", type: "logic_ternary" },
        ],
      },
      {
        kind: "category",
        name: "Loops",
        colour: "120",
        contents: [
          {
            kind: "block",
            type: "controls_repeat_ext",
            inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 10 } } } },
          },
          { kind: "block", type: "controls_whileUntil" },
          { kind: "block", type: "controls_for" },
          { kind: "block", type: "controls_forEach" },
          { kind: "block", type: "controls_flow_statements" },
        ],
      },
      {
        kind: "category",
        name: "Math",
        colour: "230",
        contents: [
          { kind: "block", type: "math_number" },
          { kind: "block", type: "math_arithmetic" },
          { kind: "block", type: "math_single" },
          { kind: "block", type: "math_round" },
          { kind: "block", type: "math_modulo" },
          { kind: "block", type: "math_random_int" },
        ],
      },
      {
        kind: "category",
        name: "Text",
        colour: "160",
        contents: [
          { kind: "block", type: "text" },
          { kind: "block", type: "code_text" },
          { kind: "block", type: "text_join" },
          {
            kind: "block",
            type: "text_append",
            inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "" } } } },
          },
          {
            kind: "block",
            type: "text_length",
            inputs: { VALUE: { shadow: { type: "text", fields: { TEXT: "abc" } } } },
          },
          {
            kind: "block",
            type: "text_isEmpty",
            inputs: { VALUE: { shadow: { type: "text", fields: { TEXT: "" } } } },
          },
          {
            kind: "block",
            type: "text_indexOf",
            inputs: {
              VALUE: { shadow: { type: "text", fields: { TEXT: "abc" } } },
              FIND: { shadow: { type: "text", fields: { TEXT: "a" } } },
            },
          },
          {
            kind: "block",
            type: "text_charAt",
            inputs: { VALUE: { shadow: { type: "text", fields: { TEXT: "abc" } } } },
          },
          {
            kind: "block",
            type: "text_getSubstring",
            inputs: { STRING: { shadow: { type: "text", fields: { TEXT: "abc" } } } },
          },
          {
            kind: "block",
            type: "text_changeCase",
            inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "abc" } } } },
          },
          {
            kind: "block",
            type: "text_trim",
            inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "abc" } } } },
          },
          {
            kind: "block",
            type: "text_count",
            inputs: {
              SUB: { shadow: { type: "text", fields: { TEXT: "a" } } },
              TEXT: { shadow: { type: "text", fields: { TEXT: "abc" } } },
            },
          },
          {
            kind: "block",
            type: "text_replace",
            inputs: {
              FROM: { shadow: { type: "text", fields: { TEXT: "" } } },
              TO: { shadow: { type: "text", fields: { TEXT: "" } } },
              TEXT: { shadow: { type: "text", fields: { TEXT: "" } } },
            },
          },
          {
            kind: "block",
            type: "text_reverse",
            inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "abc" } } } },
          },
          {
            kind: "block",
            type: "text_print",
            inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "abc" } } } },
          },
          {
            kind: "block",
            type: "text_prompt_ext",
            inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "abc" } } } },
          },
          ...textCategoryExtras(),
        ],
      },
      {
        kind: "category",
        name: "Lists",
        colour: "260",
        contents: [
          { kind: "block", type: "lists_create_with" },
          { kind: "block", type: "lists_length" },
          { kind: "block", type: "lists_isEmpty" },
          { kind: "block", type: "lists_getIndex" },
          { kind: "block", type: "lists_setIndex" },
          ...listCategoryExtras(),
        ],
      },
      { kind: "sep" },
      ...lodashCategories(),
      { kind: "sep" },
      { kind: "category", name: "Variables", colour: "330", custom: "VARIABLE" },
      { kind: "category", name: "Functions", colour: "290", custom: "PROCEDURE" },
    ],
  };
}
