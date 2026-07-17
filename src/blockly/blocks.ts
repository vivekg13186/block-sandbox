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
import { registerTransformBlock } from "./transformBlock";
import { registerObjectCreateBlock } from "./objectBlock";
import { registerClipboardMenus } from "./clipboard";
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
export const HTTP_COLOUR = 195;
export const XML_COLOUR = 290;
export const WIDGET_COLOUR = 260;

// Trailing size selector shared by all widget blocks (auto / wide / full width).
const SIZE_FIELD = {
  type: "field_dropdown",
  name: "SIZE",
  options: [
    ["auto", ""],
    ["wide", "wide"],
    ["full", "full"],
  ],
};

let staticRegistered = false;

/** Register blocks that don't depend on module data (env var getter, etc.). */
function registerStaticBlocks(): void {
  if (staticRegistered) return;
  staticRegistered = true;

  registerCodeField();
  registerTransformBlock();
  registerObjectCreateBlock();
  registerClipboardMenus();

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
      type: "object_empty",
      message0: "empty object",
      output: null,
      colour: OBJ_COLOUR,
      tooltip: "An empty object / dict {}",
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
      type: "http_request",
      message0: "HTTP %1 %2",
      args0: [
        {
          type: "field_dropdown",
          name: "METHOD",
          options: [
            ["GET", "GET"],
            ["POST", "POST"],
            ["PUT", "PUT"],
            ["PATCH", "PATCH"],
            ["DELETE", "DELETE"],
          ],
        },
        { type: "input_value", name: "URL" },
      ],
      message1: "query params %1",
      args1: [{ type: "input_value", name: "PARAMS" }],
      message2: "headers %1 body %2",
      args2: [
        { type: "input_value", name: "HEADERS" },
        { type: "input_value", name: "BODY" },
      ],
      message3: "auth %1 verify ssl %2",
      args3: [
        { type: "input_value", name: "AUTH" },
        { type: "field_checkbox", name: "VERIFY", checked: false },
      ],
      output: null,
      colour: HTTP_COLOUR,
      tooltip:
        "Send an HTTP request; returns {status, ok, data, text}. Query params is " +
        "an object like {q: 'term', page: 2}.",
    },
    {
      type: "http_basic_auth",
      message0: "basic auth user %1 password %2",
      args0: [
        { type: "input_value", name: "USER" },
        { type: "input_value", name: "PASS" },
      ],
      inputsInline: true,
      output: null,
      colour: HTTP_COLOUR,
      tooltip: "HTTP Basic auth credentials (username, password) for the auth slot",
    },
    {
      type: "http_status",
      message0: "status of %1",
      args0: [{ type: "input_value", name: "RESP" }],
      output: null,
      colour: HTTP_COLOUR,
      tooltip: "HTTP status code of a response",
    },
    {
      type: "http_body",
      message0: "body of %1",
      args0: [{ type: "input_value", name: "RESP" }],
      output: null,
      colour: HTTP_COLOUR,
      tooltip: "Parsed JSON body (or text) of a response",
    },
    {
      type: "http_ok",
      message0: "ok of %1",
      args0: [{ type: "input_value", name: "RESP" }],
      output: null,
      colour: HTTP_COLOUR,
      tooltip: "True if the response status was 2xx",
    },
    {
      type: "read_table",
      message0: "read rows from %1",
      args0: [{ type: "input_value", name: "PATH" }],
      output: null,
      colour: FILE_COLOUR,
      tooltip: "Read a CSV or Excel (.xlsx) file into a list of row objects keyed by header",
    },
    {
      type: "write_excel",
      message0: "write rows %1 to excel %2",
      args0: [
        { type: "input_value", name: "DATA" },
        { type: "input_value", name: "PATH" },
      ],
      message1: "headers %1 sheet %2",
      args1: [
        { type: "input_value", name: "HEADERS" },
        { type: "field_input", name: "SHEET", text: "" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: FILE_COLOUR,
      tooltip: "Write an array of row objects/arrays to an .xlsx file (needs openpyxl)",
    },
    {
      type: "for_each_row",
      message0: "for each row %1 in file %2",
      args0: [
        { type: "field_variable", name: "VAR", variable: "row" },
        { type: "input_value", name: "PATH" },
      ],
      message1: "do %1",
      args1: [{ type: "input_statement", name: "DO" }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: FILE_COLOUR,
      tooltip: "Loop over each row (as an object) of a CSV or Excel file",
    },
    {
      type: "xml_get",
      message0: "xml get text at %1 from %2",
      args0: [
        { type: "input_value", name: "SEL" },
        { type: "input_value", name: "XML" },
      ],
      inputsInline: true,
      output: null,
      colour: XML_COLOUR,
      tooltip: "Text of the first XPath match in an XML/HTML string",
    },
    {
      type: "xml_get_all",
      message0: "xml get all at %1 from %2",
      args0: [
        { type: "input_value", name: "SEL" },
        { type: "input_value", name: "XML" },
      ],
      inputsInline: true,
      output: null,
      colour: XML_COLOUR,
      tooltip: "List of texts for all XPath matches in an XML/HTML string",
    },
    {
      type: "xml_set",
      message0: "xml set %1 at %2 in %3",
      args0: [
        { type: "input_value", name: "VALUE" },
        { type: "input_value", name: "SEL" },
        { type: "input_value", name: "XML" },
      ],
      inputsInline: true,
      output: null,
      colour: XML_COLOUR,
      tooltip: "Set the text of XPath-matched nodes; returns the updated XML string",
    },
    {
      type: "css_get",
      message0: "css get text at %1 from %2",
      args0: [
        { type: "input_value", name: "SEL" },
        { type: "input_value", name: "XML" },
      ],
      inputsInline: true,
      output: null,
      colour: XML_COLOUR,
      tooltip: "Text of the first CSS-selector match (HTML/XML)",
    },
    {
      type: "css_get_all",
      message0: "css get all at %1 from %2",
      args0: [
        { type: "input_value", name: "SEL" },
        { type: "input_value", name: "XML" },
      ],
      inputsInline: true,
      output: null,
      colour: XML_COLOUR,
      tooltip: "List of texts for all CSS-selector matches",
    },
    {
      type: "css_attr",
      message0: "css get attribute %1 at %2 from %3",
      args0: [
        { type: "input_value", name: "ATTR" },
        { type: "input_value", name: "SEL" },
        { type: "input_value", name: "XML" },
      ],
      inputsInline: true,
      output: null,
      colour: XML_COLOUR,
      tooltip: "Attribute of the first CSS-selector match (e.g. href of a link)",
    },
    {
      type: "css_set",
      message0: "css set %1 at %2 in %3",
      args0: [
        { type: "input_value", name: "VALUE" },
        { type: "input_value", name: "SEL" },
        { type: "input_value", name: "XML" },
      ],
      inputsInline: true,
      output: null,
      colour: XML_COLOUR,
      tooltip: "Set the text of CSS-selector-matched nodes; returns the updated markup",
    },
    {
      type: "gen_uuid",
      message0: "new uuid",
      output: null,
      colour: "160",
      tooltip: "Generate a random UUID4 string",
    },
    {
      type: "to_base64",
      message0: "base64 encode %1",
      args0: [{ type: "input_value", name: "VALUE" }],
      output: null,
      colour: "160",
      tooltip: "Base64-encode a string",
    },
    {
      type: "from_base64",
      message0: "base64 decode %1",
      args0: [{ type: "input_value", name: "VALUE" }],
      output: null,
      colour: "160",
      tooltip: "Decode a base64 string to text",
    },
    {
      type: "url_join",
      message0: "join url %1 / %2",
      args0: [
        { type: "input_value", name: "BASE" },
        { type: "input_value", name: "PATH" },
      ],
      inputsInline: true,
      output: null,
      colour: "160",
      tooltip: "Join a base URL and a path without double slashes",
    },
    {
      type: "path_join",
      message0: "join path %1 / %2",
      args0: [
        { type: "input_value", name: "A" },
        { type: "input_value", name: "B" },
      ],
      inputsInline: true,
      output: null,
      colour: "160",
      tooltip: "Join two file path segments (os.path.join)",
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
    // --- Dashboard widgets: append a render-spec to the `widgets` list. ---
    // Each widget ends with a SIZE dropdown (auto / wide / full width).
    {
      type: "widget_table",
      message0: "table widget %1 rows %2 %3",
      args0: [
        { type: "field_input", name: "TITLE", text: "Table" },
        { type: "input_value", name: "ROWS" },
        SIZE_FIELD,
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: WIDGET_COLOUR,
      tooltip: "Show a list of objects (rows) as a table on the dashboard",
    },
    {
      type: "widget_metric",
      message0: "metric widget %1 = %2 %3",
      args0: [
        { type: "field_input", name: "TITLE", text: "Metric" },
        { type: "input_value", name: "VALUE" },
        SIZE_FIELD,
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: WIDGET_COLOUR,
      tooltip: "Show a single value as a big number on the dashboard",
    },
    {
      type: "widget_stat",
      message0: "stat widget %1 = %2 delta %3 %4",
      args0: [
        { type: "field_input", name: "TITLE", text: "Stat" },
        { type: "input_value", name: "VALUE" },
        { type: "input_value", name: "DELTA" },
        SIZE_FIELD,
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: WIDGET_COLOUR,
      tooltip: "A big value with a change indicator (delta > 0 shows green ▲, < 0 red ▼)",
    },
    {
      type: "widget_status",
      message0: "status widget %1 = %2 %3 %4",
      args0: [
        { type: "field_input", name: "TITLE", text: "Status" },
        { type: "input_value", name: "VALUE" },
        {
          type: "field_dropdown",
          name: "STATUS",
          options: [
            ["ok", "ok"],
            ["warning", "warn"],
            ["error", "error"],
            ["info", "info"],
            ["neutral", "neutral"],
          ],
        },
        SIZE_FIELD,
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: WIDGET_COLOUR,
      tooltip: "Show a value as a colored status badge",
    },
    {
      type: "widget_progress",
      message0: "progress widget %1 = %2 of %3 %4",
      args0: [
        { type: "field_input", name: "TITLE", text: "Progress" },
        { type: "input_value", name: "VALUE" },
        { type: "input_value", name: "MAX" },
        SIZE_FIELD,
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: WIDGET_COLOUR,
      tooltip: "A progress bar of value / max (percentage)",
    },
    {
      type: "widget_list",
      message0: "list widget %1 items %2 %3",
      args0: [
        { type: "field_input", name: "TITLE", text: "List" },
        { type: "input_value", name: "ITEMS" },
        SIZE_FIELD,
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: WIDGET_COLOUR,
      tooltip: "Show an array as a bulleted list",
    },
    {
      type: "widget_text",
      message0: "text widget %1 = %2 %3",
      args0: [
        { type: "field_input", name: "TITLE", text: "Text" },
        { type: "input_value", name: "TEXT" },
        SIZE_FIELD,
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: WIDGET_COLOUR,
      tooltip: "Show a block of text on the dashboard",
    },
    {
      type: "widget_alert",
      message0: "%1 alert widget %2 = %3 %4",
      args0: [
        {
          type: "field_dropdown",
          name: "LEVEL",
          options: [
            ["info", "info"],
            ["success", "success"],
            ["warning", "warning"],
            ["error", "error"],
          ],
        },
        { type: "field_input", name: "TITLE", text: "Alert" },
        { type: "input_value", name: "TEXT" },
        SIZE_FIELD,
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: WIDGET_COLOUR,
      tooltip: "A colored callout box (info / success / warning / error)",
    },
    {
      type: "widget_link",
      message0: "link widget %1 url %2 %3",
      args0: [
        { type: "field_input", name: "TITLE", text: "Open" },
        { type: "input_value", name: "URL" },
        SIZE_FIELD,
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: WIDGET_COLOUR,
      tooltip: "A button that links to a URL",
    },
    {
      type: "widget_chart",
      message0: "%1 chart widget %2 data %3 %4",
      args0: [
        {
          type: "field_dropdown",
          name: "CHART",
          options: [
            ["bar", "bar"],
            ["line", "line"],
            ["area", "area"],
            ["pie", "pie"],
          ],
        },
        { type: "field_input", name: "TITLE", text: "Chart" },
        { type: "input_value", name: "DATA" },
        SIZE_FIELD,
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: WIDGET_COLOUR,
      tooltip: "Chart a list of {label, value} objects on the dashboard",
    },
    {
      type: "widget_json",
      message0: "json widget %1 = %2 %3",
      args0: [
        { type: "field_input", name: "TITLE", text: "JSON" },
        { type: "input_value", name: "VALUE" },
        SIZE_FIELD,
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: WIDGET_COLOUR,
      tooltip: "Pretty-print any value as JSON on the dashboard",
    },
    {
      type: "widget_html",
      message0: "html widget %1 = %2 %3",
      args0: [
        { type: "field_input", name: "TITLE", text: "HTML" },
        { type: "input_value", name: "HTML" },
        SIZE_FIELD,
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: WIDGET_COLOUR,
      tooltip: "Render an HTML string on the dashboard",
    },
    {
      type: "widget_section",
      message0: "section header %1",
      args0: [{ type: "field_input", name: "TITLE", text: "Section" }],
      previousStatement: null,
      nextStatement: null,
      colour: WIDGET_COLOUR,
      tooltip: "A full-width section header to group widgets below it",
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

  // Object / dict blocks.
  pythonGenerator.forBlock["object_empty"] = () => ["{}", Order.ATOMIC];
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

  const readRowsFn = () =>
    pythonGenerator.provideFunction_("bs_read_rows", [
      `def ${pythonGenerator.FUNCTION_NAME_PLACEHOLDER_}(path):`,
      "    p = str(path)",
      "    if p.lower().endswith(('.xlsx', '.xlsm', '.xls')):",
      "        import openpyxl",
      "        wb = openpyxl.load_workbook(p, read_only=True, data_only=True)",
      "        rows = list(wb.active.iter_rows(values_only=True))",
      "        if not rows:",
      "            return []",
      "        headers = [str(h) if h is not None else '' for h in rows[0]]",
      "        return [ {headers[i]: (r[i] if i < len(r) else None) for i in range(len(headers))} for r in rows[1:] ]",
      "    import csv",
      "    with open(p, newline='', encoding='utf-8') as f:",
      "        return [dict(row) for row in csv.DictReader(f)]",
    ]);

  pythonGenerator.forBlock["read_table"] = (block) => {
    const fn = readRowsFn();
    return [`${fn}(${path(block)})`, Order.FUNCTION_CALL];
  };
  pythonGenerator.forBlock["write_excel"] = (block) => {
    const fn = pythonGenerator.provideFunction_("bs_write_excel", [
      `def ${pythonGenerator.FUNCTION_NAME_PLACEHOLDER_}(path, data, headers=None, sheet=''):`,
      "    import openpyxl",
      "    wb = openpyxl.Workbook()",
      "    ws = wb.active",
      "    if str(sheet).strip():",
      "        ws.title = str(sheet).strip()",
      "    hdrs = list(headers) if headers else []",
      "    rows_in = list(data) if data else []",
      "    if not hdrs and rows_in and isinstance(rows_in[0], dict):",
      "        hdrs = list(rows_in[0].keys())",
      "    if hdrs:",
      "        ws.append([str(h) for h in hdrs])",
      "    for r in rows_in:",
      "        if isinstance(r, dict):",
      "            ws.append([r.get(h) for h in hdrs])",
      "        elif isinstance(r, (list, tuple)):",
      "            ws.append(list(r))",
      "        else:",
      "            ws.append([r])",
      "    wb.save(str(path))",
    ]);
    const data = pythonGenerator.valueToCode(block, "DATA", Order.NONE) || "[]";
    const headers = pythonGenerator.valueToCode(block, "HEADERS", Order.NONE) || "None";
    const sheet = block.getFieldValue("SHEET") || "";
    return `${fn}(${path(block)}, ${data}, ${headers}, ${JSON.stringify(sheet)})\n`;
  };
  pythonGenerator.forBlock["for_each_row"] = (block) => {
    const fn = readRowsFn();
    const varName = pythonGenerator.getVariableName(block.getFieldValue("VAR"));
    let branch = pythonGenerator.statementToCode(block, "DO");
    if (!branch) branch = pythonGenerator.INDENT + "pass\n";
    return `for ${varName} in ${fn}(${path(block)}):\n${branch}`;
  };
  const httpFn = () =>
    pythonGenerator.provideFunction_("bs_http", [
      `def ${pythonGenerator.FUNCTION_NAME_PLACEHOLDER_}(method, url, headers=None, body=None, auth=None, verify=False, params=None):`,
      "    import requests",
      "    if not verify:",
      "        try:",
      "            import urllib3",
      "            urllib3.disable_warnings()",
      "        except Exception:",
      "            pass",
      "    kw = {'timeout': 30, 'verify': verify}",
      "    if headers:",
      "        kw['headers'] = headers",
      "    if params:",
      "        kw['params'] = params",
      "    if auth:",
      "        kw['auth'] = tuple(auth) if isinstance(auth, (list, tuple)) else auth",
      "    if body is not None:",
      "        if isinstance(body, (dict, list)):",
      "            kw['json'] = body",
      "        else:",
      "            kw['data'] = body",
      "    r = requests.request(str(method).upper(), str(url), **kw)",
      "    try:",
      "        data = r.json()",
      "    except Exception:",
      "        data = None",
      "    return {'status': r.status_code, 'ok': r.ok, 'data': data, 'text': r.text}",
    ]);
  pythonGenerator.forBlock["http_request"] = (block) => {
    const fn = httpFn();
    const method = block.getFieldValue("METHOD") || "GET";
    const url = pythonGenerator.valueToCode(block, "URL", Order.NONE) || "''";
    const headers = pythonGenerator.valueToCode(block, "HEADERS", Order.NONE) || "None";
    const body = pythonGenerator.valueToCode(block, "BODY", Order.NONE) || "None";
    const auth = pythonGenerator.valueToCode(block, "AUTH", Order.NONE) || "None";
    const verify = block.getFieldValue("VERIFY") === "TRUE" ? "True" : "False";
    const params = pythonGenerator.valueToCode(block, "PARAMS", Order.NONE) || "None";
    return [
      `${fn}(${JSON.stringify(method)}, ${url}, ${headers}, ${body}, ${auth}, ${verify}, ${params})`,
      Order.FUNCTION_CALL,
    ];
  };
  pythonGenerator.forBlock["http_basic_auth"] = (block) => {
    const user = pythonGenerator.valueToCode(block, "USER", Order.NONE) || "''";
    const pass = pythonGenerator.valueToCode(block, "PASS", Order.NONE) || "''";
    return [`(str(${user}), str(${pass}))`, Order.ATOMIC];
  };
  pythonGenerator.forBlock["http_status"] = (block) => {
    const resp = pythonGenerator.valueToCode(block, "RESP", Order.NONE) || "{}";
    return [`(${resp}).get("status")`, Order.FUNCTION_CALL];
  };
  pythonGenerator.forBlock["http_body"] = (block) => {
    const resp = pythonGenerator.valueToCode(block, "RESP", Order.NONE) || "{}";
    return [
      `((${resp}).get("data") if (${resp}).get("data") is not None else (${resp}).get("text"))`,
      Order.CONDITIONAL,
    ];
  };
  pythonGenerator.forBlock["http_ok"] = (block) => {
    const resp = pythonGenerator.valueToCode(block, "RESP", Order.NONE) || "{}";
    return [`(${resp}).get("ok")`, Order.FUNCTION_CALL];
  };

  // Dashboard widgets: append a render-spec dict to the module's `widgets` list.
  // (Dashboard-kind modules seed `widgets = []`; see codegen.ts.)
  const widgetTitle = (block: Blockly.Block) =>
    JSON.stringify(block.getFieldValue("TITLE") || "");
  const wSize = (block: Blockly.Block) =>
    JSON.stringify(block.getFieldValue("SIZE") || "");
  const wVal = (block: Blockly.Block, name: string, def = "None") =>
    pythonGenerator.valueToCode(block, name, Order.NONE) || def;
  // Emit a widgets.append({...}) with a common size field.
  const widget = (block: Blockly.Block, fields: string) =>
    `widgets.append({${fields}, "size": ${wSize(block)}})\n`;

  pythonGenerator.forBlock["widget_table"] = (block) =>
    widget(block, `"type": "table", "title": ${widgetTitle(block)}, "rows": ${wVal(block, "ROWS", "[]")}`);
  pythonGenerator.forBlock["widget_metric"] = (block) =>
    widget(block, `"type": "metric", "title": ${widgetTitle(block)}, "value": ${wVal(block, "VALUE")}`);
  pythonGenerator.forBlock["widget_stat"] = (block) =>
    widget(
      block,
      `"type": "stat", "title": ${widgetTitle(block)}, "value": ${wVal(block, "VALUE")}, "delta": ${wVal(block, "DELTA")}`
    );
  pythonGenerator.forBlock["widget_status"] = (block) =>
    widget(
      block,
      `"type": "status", "title": ${widgetTitle(block)}, "value": ${wVal(block, "VALUE", "''")}, "status": ${JSON.stringify(block.getFieldValue("STATUS") || "neutral")}`
    );
  pythonGenerator.forBlock["widget_progress"] = (block) =>
    widget(
      block,
      `"type": "progress", "title": ${widgetTitle(block)}, "value": ${wVal(block, "VALUE", "0")}, "max": ${wVal(block, "MAX", "100")}`
    );
  pythonGenerator.forBlock["widget_list"] = (block) =>
    widget(block, `"type": "list", "title": ${widgetTitle(block)}, "items": ${wVal(block, "ITEMS", "[]")}`);
  pythonGenerator.forBlock["widget_text"] = (block) =>
    widget(block, `"type": "text", "title": ${widgetTitle(block)}, "text": ${wVal(block, "TEXT", "''")}`);
  pythonGenerator.forBlock["widget_alert"] = (block) =>
    widget(
      block,
      `"type": "alert", "level": ${JSON.stringify(block.getFieldValue("LEVEL") || "info")}, "title": ${widgetTitle(block)}, "text": ${wVal(block, "TEXT", "''")}`
    );
  pythonGenerator.forBlock["widget_link"] = (block) =>
    widget(block, `"type": "link", "title": ${widgetTitle(block)}, "url": ${wVal(block, "URL", "''")}`);
  pythonGenerator.forBlock["widget_chart"] = (block) =>
    widget(
      block,
      `"type": "chart", "chart": ${JSON.stringify(block.getFieldValue("CHART") || "bar")}, "title": ${widgetTitle(block)}, "data": ${wVal(block, "DATA", "[]")}`
    );
  pythonGenerator.forBlock["widget_json"] = (block) =>
    widget(block, `"type": "json", "title": ${widgetTitle(block)}, "value": ${wVal(block, "VALUE")}`);
  pythonGenerator.forBlock["widget_html"] = (block) =>
    widget(block, `"type": "html", "title": ${widgetTitle(block)}, "html": ${wVal(block, "HTML", "''")}`);
  pythonGenerator.forBlock["widget_section"] = (block) =>
    `widgets.append({"type": "section", "title": ${widgetTitle(block)}, "size": "full"})\n`;

  // XML / HTML by XPath selector (lxml). Handles both XML and HTML.
  const xmlRootFn = () =>
    pythonGenerator.provideFunction_("bs_xml_root", [
      `def ${pythonGenerator.FUNCTION_NAME_PLACEHOLDER_}(s):`,
      "    from lxml import etree, html",
      "    s = str(s)",
      "    low = s.lower()",
      "    if '<!doctype html' in low or '<html' in low:",
      "        return html.fromstring(s)",
      "    return etree.fromstring(s.encode('utf-8'), etree.XMLParser(recover=True))",
    ]);
  const nodeText = "(n if isinstance(n, str) else (n.text if getattr(n, 'text', None) is not None else ''.join(n.itertext())))";
  pythonGenerator.forBlock["xml_get"] = (block) => {
    const root = xmlRootFn();
    const fn = pythonGenerator.provideFunction_("bs_xml_get", [
      `def ${pythonGenerator.FUNCTION_NAME_PLACEHOLDER_}(xml, xpath):`,
      `    res = ${root}(xml).xpath(str(xpath))`,
      "    if not res:",
      "        return None",
      "    n = res[0]",
      `    return ${nodeText}`,
    ]);
    const sel = pythonGenerator.valueToCode(block, "SEL", Order.NONE) || "''";
    const xml = pythonGenerator.valueToCode(block, "XML", Order.NONE) || "''";
    return [`${fn}(${xml}, ${sel})`, Order.FUNCTION_CALL];
  };
  pythonGenerator.forBlock["xml_get_all"] = (block) => {
    const root = xmlRootFn();
    const fn = pythonGenerator.provideFunction_("bs_xml_get_all", [
      `def ${pythonGenerator.FUNCTION_NAME_PLACEHOLDER_}(xml, xpath):`,
      `    return [${nodeText} for n in ${root}(xml).xpath(str(xpath))]`,
    ]);
    const sel = pythonGenerator.valueToCode(block, "SEL", Order.NONE) || "''";
    const xml = pythonGenerator.valueToCode(block, "XML", Order.NONE) || "''";
    return [`${fn}(${xml}, ${sel})`, Order.FUNCTION_CALL];
  };
  pythonGenerator.forBlock["xml_set"] = (block) => {
    const root = xmlRootFn();
    const fn = pythonGenerator.provideFunction_("bs_xml_set", [
      `def ${pythonGenerator.FUNCTION_NAME_PLACEHOLDER_}(xml, xpath, value):`,
      "    from lxml import etree",
      `    root = ${root}(xml)`,
      "    for el in root.xpath(str(xpath)):",
      "        if isinstance(el, str):",
      "            continue",
      "        el.text = str(value)",
      "    return etree.tostring(root, encoding='unicode')",
    ]);
    const value = pythonGenerator.valueToCode(block, "VALUE", Order.NONE) || "''";
    const sel = pythonGenerator.valueToCode(block, "SEL", Order.NONE) || "''";
    const xml = pythonGenerator.valueToCode(block, "XML", Order.NONE) || "''";
    return [`${fn}(${xml}, ${sel}, ${value})`, Order.FUNCTION_CALL];
  };
  pythonGenerator.forBlock["css_get"] = (block) => {
    const root = xmlRootFn();
    const fn = pythonGenerator.provideFunction_("bs_css_get", [
      `def ${pythonGenerator.FUNCTION_NAME_PLACEHOLDER_}(xml, css):`,
      `    res = ${root}(xml).cssselect(str(css))`,
      "    if not res:",
      "        return None",
      "    n = res[0]",
      `    return ${nodeText}`,
    ]);
    const sel = pythonGenerator.valueToCode(block, "SEL", Order.NONE) || "''";
    const xml = pythonGenerator.valueToCode(block, "XML", Order.NONE) || "''";
    return [`${fn}(${xml}, ${sel})`, Order.FUNCTION_CALL];
  };
  pythonGenerator.forBlock["css_get_all"] = (block) => {
    const root = xmlRootFn();
    const fn = pythonGenerator.provideFunction_("bs_css_get_all", [
      `def ${pythonGenerator.FUNCTION_NAME_PLACEHOLDER_}(xml, css):`,
      `    return [${nodeText} for n in ${root}(xml).cssselect(str(css))]`,
    ]);
    const sel = pythonGenerator.valueToCode(block, "SEL", Order.NONE) || "''";
    const xml = pythonGenerator.valueToCode(block, "XML", Order.NONE) || "''";
    return [`${fn}(${xml}, ${sel})`, Order.FUNCTION_CALL];
  };
  pythonGenerator.forBlock["css_attr"] = (block) => {
    const root = xmlRootFn();
    const fn = pythonGenerator.provideFunction_("bs_css_attr", [
      `def ${pythonGenerator.FUNCTION_NAME_PLACEHOLDER_}(xml, css, attr):`,
      `    res = ${root}(xml).cssselect(str(css))`,
      "    return res[0].get(str(attr)) if res else None",
    ]);
    const attr = pythonGenerator.valueToCode(block, "ATTR", Order.NONE) || "''";
    const sel = pythonGenerator.valueToCode(block, "SEL", Order.NONE) || "''";
    const xml = pythonGenerator.valueToCode(block, "XML", Order.NONE) || "''";
    return [`${fn}(${xml}, ${sel}, ${attr})`, Order.FUNCTION_CALL];
  };
  pythonGenerator.forBlock["css_set"] = (block) => {
    const root = xmlRootFn();
    const fn = pythonGenerator.provideFunction_("bs_css_set", [
      `def ${pythonGenerator.FUNCTION_NAME_PLACEHOLDER_}(xml, css, value):`,
      "    from lxml import etree",
      `    root = ${root}(xml)`,
      "    for el in root.cssselect(str(css)):",
      "        el.text = str(value)",
      "    return etree.tostring(root, encoding='unicode')",
    ]);
    const value = pythonGenerator.valueToCode(block, "VALUE", Order.NONE) || "''";
    const sel = pythonGenerator.valueToCode(block, "SEL", Order.NONE) || "''";
    const xml = pythonGenerator.valueToCode(block, "XML", Order.NONE) || "''";
    return [`${fn}(${xml}, ${sel}, ${value})`, Order.FUNCTION_CALL];
  };

  pythonGenerator.forBlock["gen_uuid"] = () => [
    "str(__import__('uuid').uuid4())",
    Order.FUNCTION_CALL,
  ];
  pythonGenerator.forBlock["to_base64"] = (block) => {
    const value = pythonGenerator.valueToCode(block, "VALUE", Order.NONE) || "''";
    return [`__import__('base64').b64encode(str(${value}).encode()).decode()`, Order.FUNCTION_CALL];
  };
  pythonGenerator.forBlock["from_base64"] = (block) => {
    const value = pythonGenerator.valueToCode(block, "VALUE", Order.NONE) || "''";
    return [
      `__import__('base64').b64decode(str(${value})).decode('utf-8', 'replace')`,
      Order.FUNCTION_CALL,
    ];
  };

  pythonGenerator.forBlock["url_join"] = (block) => {
    const fn = pythonGenerator.provideFunction_("bs_url_join", [
      `def ${pythonGenerator.FUNCTION_NAME_PLACEHOLDER_}(base, path):`,
      "    return str(base).rstrip('/') + '/' + str(path).lstrip('/')",
    ]);
    const base = pythonGenerator.valueToCode(block, "BASE", Order.NONE) || "''";
    const path = pythonGenerator.valueToCode(block, "PATH", Order.NONE) || "''";
    return [`${fn}(${base}, ${path})`, Order.FUNCTION_CALL];
  };
  pythonGenerator.forBlock["path_join"] = (block) => {
    const a = pythonGenerator.valueToCode(block, "A", Order.NONE) || "''";
    const b = pythonGenerator.valueToCode(block, "B", Order.NONE) || "''";
    return [`__import__('os').path.join(str(${a}), str(${b}))`, Order.FUNCTION_CALL];
  };

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

  if (defs.length) {
    // These data-driven blocks are re-registered whenever a module's ports or
    // name change. Drop any prior definition first so Blockly doesn't warn
    // ("Block definition X overwrites previous definition") on every refresh.
    for (const d of defs) {
      const t = (d as { type?: string }).type;
      if (t && Blockly.Blocks[t]) delete Blockly.Blocks[t];
    }
    Blockly.common.defineBlocksWithJsonArray(defs);
  }
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

  const isDash = current.kind === "dashboard";
  const widgetCategory = {
    kind: "category",
    name: "Widgets",
    colour: String(WIDGET_COLOUR),
    contents: [
      {
        kind: "block",
        type: "widget_table",
        inputs: { ROWS: { shadow: { type: "object_empty" } } },
      },
      { kind: "block", type: "widget_metric" },
      { kind: "block", type: "widget_stat" },
      {
        kind: "block",
        type: "widget_status",
        inputs: { VALUE: { shadow: { type: "text", fields: { TEXT: "OK" } } } },
      },
      {
        kind: "block",
        type: "widget_progress",
        inputs: {
          VALUE: { shadow: { type: "math_number", fields: { NUM: 30 } } },
          MAX: { shadow: { type: "math_number", fields: { NUM: 100 } } },
        },
      },
      { kind: "block", type: "widget_list" },
      {
        kind: "block",
        type: "widget_text",
        inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "" } } } },
      },
      {
        kind: "block",
        type: "widget_alert",
        inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "Heads up" } } } },
      },
      {
        kind: "block",
        type: "widget_link",
        inputs: { URL: { shadow: { type: "text", fields: { TEXT: "https://example.com" } } } },
      },
      { kind: "block", type: "widget_chart" },
      { kind: "block", type: "widget_json" },
      {
        kind: "block",
        type: "widget_html",
        inputs: { HTML: { shadow: { type: "text", fields: { TEXT: "<b>hello</b>" } } } },
      },
      { kind: "block", type: "widget_section" },
    ],
  };

  return {
    kind: "categoryToolbox",
    contents: [
      ...(isDash ? [widgetCategory] : []),
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
        name: "Script",
        colour: "20",
        contents: [{ kind: "block", type: "python_script" }],
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
        ],
      },
      {
        kind: "category",
        name: "Objects",
        colour: String(OBJ_COLOUR),
        contents: [
          { kind: "block", type: "object_create" },
          { kind: "block", type: "object_transform" },
          { kind: "block", type: "object_empty" },
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
          {
            kind: "block",
            type: "read_table",
            inputs: { PATH: { shadow: { type: "text", fields: { TEXT: "data.csv" } } } },
          },
          {
            kind: "block",
            type: "write_excel",
            inputs: { PATH: { shadow: { type: "text", fields: { TEXT: "out.xlsx" } } } },
          },
          {
            kind: "block",
            type: "for_each_row",
            inputs: { PATH: { shadow: { type: "text", fields: { TEXT: "data.csv" } } } },
          },
        ],
      },
      {
        kind: "category",
        name: "HTTP",
        colour: String(HTTP_COLOUR),
        contents: [
          {
            kind: "block",
            type: "http_request",
            inputs: {
              URL: { shadow: { type: "text", fields: { TEXT: "https://api.example.com" } } },
            },
          },
          {
            kind: "block",
            type: "http_basic_auth",
            inputs: {
              USER: { shadow: { type: "text", fields: { TEXT: "user" } } },
              PASS: { shadow: { type: "text", fields: { TEXT: "password" } } },
            },
          },
          { kind: "block", type: "http_status" },
          { kind: "block", type: "http_body" },
          { kind: "block", type: "http_ok" },
        ],
      },
      {
        kind: "category",
        name: "XML",
        colour: String(XML_COLOUR),
        contents: [
          {
            kind: "block",
            type: "xml_get",
            inputs: { SEL: { shadow: { type: "text", fields: { TEXT: "//name" } } } },
          },
          {
            kind: "block",
            type: "xml_get_all",
            inputs: { SEL: { shadow: { type: "text", fields: { TEXT: "//item/@id" } } } },
          },
          {
            kind: "block",
            type: "xml_set",
            inputs: { SEL: { shadow: { type: "text", fields: { TEXT: "//name" } } } },
          },
          {
            kind: "block",
            type: "css_get",
            inputs: { SEL: { shadow: { type: "text", fields: { TEXT: "div.title" } } } },
          },
          {
            kind: "block",
            type: "css_get_all",
            inputs: { SEL: { shadow: { type: "text", fields: { TEXT: "a" } } } },
          },
          {
            kind: "block",
            type: "css_attr",
            inputs: {
              ATTR: { shadow: { type: "text", fields: { TEXT: "href" } } },
              SEL: { shadow: { type: "text", fields: { TEXT: "a" } } },
            },
          },
          {
            kind: "block",
            type: "css_set",
            inputs: { SEL: { shadow: { type: "text", fields: { TEXT: "div.title" } } } },
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
          { kind: "block", type: "gen_uuid" },
          {
            kind: "block",
            type: "to_base64",
            inputs: { VALUE: { shadow: { type: "text", fields: { TEXT: "hello" } } } },
          },
          {
            kind: "block",
            type: "from_base64",
            inputs: { VALUE: { shadow: { type: "text", fields: { TEXT: "aGVsbG8=" } } } },
          },
          {
            kind: "block",
            type: "url_join",
            inputs: {
              BASE: { shadow: { type: "text", fields: { TEXT: "https://api.example.com" } } },
              PATH: { shadow: { type: "text", fields: { TEXT: "v1/users" } } },
            },
          },
          {
            kind: "block",
            type: "path_join",
            inputs: {
              A: { shadow: { type: "text", fields: { TEXT: "folder" } } },
              B: { shadow: { type: "text", fields: { TEXT: "file.txt" } } },
            },
          },
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
