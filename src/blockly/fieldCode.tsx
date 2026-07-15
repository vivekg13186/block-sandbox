// A custom Blockly field that edits its string value in a CodeMirror modal,
// with syntax highlighting for the language chosen on the block (JSON / XML /
// Python / JS / plain text). Used by the `code_text` value block.

import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import * as Blockly from "blockly";
import { pythonGenerator, Order } from "blockly/python";
import CodeMirror, { type Extension } from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { javascript } from "@codemirror/lang-javascript";

function extensionsFor(lang: string): Extension[] {
  switch (lang) {
    case "json":
      return [json()];
    case "xml":
      return [xml()];
    case "javascript":
      return [javascript()];
    case "python":
      return [python()];
    default:
      return [];
  }
}

interface Check {
  status: "ok" | "error" | "none";
  message: string;
}

function validate(lang: string, value: string): Check {
  if (!value.trim()) return { status: "none", message: "" };
  try {
    if (lang === "json") {
      JSON.parse(value);
      return { status: "ok", message: "Valid JSON" };
    }
    if (lang === "xml") {
      const doc = new DOMParser().parseFromString(value, "application/xml");
      const err = doc.querySelector("parsererror");
      if (err) throw new Error(err.textContent?.split("\n")[0] || "Invalid XML");
      return { status: "ok", message: "Valid XML" };
    }
    if (lang === "javascript") {
      // Rough syntax check.
      // eslint-disable-next-line no-new-func
      new Function(value);
      return { status: "ok", message: "Valid JS" };
    }
    return { status: "none", message: "" };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

const canFormat = (lang: string) => lang === "json" || lang === "xml";

function formatXml(xml: string): string {
  const withBreaks = xml.replace(/>\s*</g, ">\n<");
  const pad = "  ";
  let depth = 0;
  const out: string[] = [];
  for (const raw of withBreaks.split("\n")) {
    const node = raw.trim();
    if (!node) continue;
    const isClosing = /^<\//.test(node);
    const isDecl = /^<[?!]/.test(node);
    const isSelfClosing = /\/>\s*$/.test(node);
    // A bare opening tag: "<tag ...>" with nothing after the ">".
    const isOpening =
      /^<[\w:-][^>]*>\s*$/.test(node) && !isSelfClosing && !isClosing && !isDecl;
    if (isClosing) depth = Math.max(depth - 1, 0);
    out.push(pad.repeat(depth) + node);
    if (isOpening) depth++;
  }
  return out.join("\n");
}

function formatValue(lang: string, value: string): { ok: boolean; value: string; message: string } {
  try {
    if (lang === "json") {
      return { ok: true, value: JSON.stringify(JSON.parse(value), null, 2), message: "Formatted" };
    }
    if (lang === "xml") {
      return { ok: true, value: formatXml(value), message: "Formatted" };
    }
    return { ok: false, value, message: "Format not available" };
  } catch (e) {
    return { ok: false, value, message: e instanceof Error ? e.message : String(e) };
  }
}

function CodeModal({
  initial,
  lang,
  onDone,
}: {
  initial: string;
  lang: string;
  onDone: (value: string | null) => void;
}) {
  const [value, setValue] = useState(initial);
  const [notice, setNotice] = useState<string>("");
  const check = useMemo(() => validate(lang, value), [lang, value]);

  const doFormat = () => {
    const r = formatValue(lang, value);
    if (r.ok) {
      setValue(r.value);
      setNotice("");
    } else {
      setNotice(r.message);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }} onMouseDown={() => onDone(null)}>
      <div className="modal code-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Edit {lang} value</h3>
        <div className="code-modal-editor">
          <CodeMirror
            value={value}
            height="100%"
            theme={oneDark}
            extensions={extensionsFor(lang)}
            basicSetup={{ lineNumbers: true, bracketMatching: true, closeBrackets: true }}
            onChange={(v) => {
              setValue(v);
              setNotice("");
            }}
            autoFocus
          />
        </div>

        <div className="code-modal-status">
          {check.status === "ok" && <span className="ok-text">✓ {check.message}</span>}
          {check.status === "error" && <span className="err-text">✗ {notice || check.message}</span>}
          {check.status === "none" && <span className="muted">{notice}</span>}
        </div>

        <div className="modal-actions">
          {canFormat(lang) && (
            <button className="btn" style={{ marginRight: "auto" }} onClick={doFormat}>
              Format
            </button>
          )}
          <button className="btn" onClick={() => onDone(null)}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => onDone(value)}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function openCodeModal(initial: string, lang: string, onSave: (value: string) => void): void {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const done = (value: string | null) => {
    root.unmount();
    host.remove();
    if (value !== null) onSave(value);
  };
  root.render(<CodeModal initial={initial} lang={lang} onDone={done} />);
}

/** Text field whose editor is a CodeMirror modal. */
class FieldCode extends Blockly.FieldTextInput {
  static fromJson(options: Blockly.FieldTextInputFromJsonConfig): FieldCode {
    return new FieldCode(String(options["text"] ?? ""));
  }

  // Open the CodeMirror modal instead of the default inline editor. Blocks with
  // a LANG dropdown (code_text) pick the language; a bare code field (the
  // python_script block) defaults to Python.
  showEditor_(): void {
    const lang = this.getSourceBlock()?.getFieldValue("LANG") || "python";
    openCodeModal(String(this.getValue() ?? ""), lang, (v) => this.setValue(v));
  }

  // Show a compact preview on the block.
  override getText(): string {
    const v = String(this.getValue() ?? "");
    const first = v.split("\n")[0];
    if (!first) return "‹edit code›";
    return first.length > 28 ? first.slice(0, 28) + "…" : first;
  }
}

let registered = false;

/** Register the field, the `code_text` block, and its Python generator. */
export function registerCodeField(): void {
  if (registered) return;
  registered = true;

  Blockly.fieldRegistry.register("field_code", FieldCode);

  Blockly.common.defineBlocksWithJsonArray([
    {
      type: "code_text",
      message0: "%1 %2",
      args0: [
        {
          type: "field_dropdown",
          name: "LANG",
          options: [
            ["JSON", "json"],
            ["XML", "xml"],
            ["Python", "python"],
            ["JS", "javascript"],
            ["Text", "text"],
          ],
        },
        { type: "field_code", name: "CODE", text: "" },
      ],
      output: null,
      colour: 160,
      tooltip: "Edit a JSON / XML / Python / JS / text value in a code editor",
    },
    {
      // Generic script block: raw Python statements injected into the flow.
      type: "python_script",
      message0: "python %1",
      args0: [{ type: "field_code", name: "CODE", text: "" }],
      previousStatement: null,
      nextStatement: null,
      colour: 20,
      tooltip:
        "Run raw Python statements. Read inputs by name, set outputs, and use " +
        "variables from surrounding blocks (e.g. result = {...}).",
    },
  ]);

  // The value is emitted as a Python string literal (JSON escaping is valid
  // Python string syntax, including newlines).
  pythonGenerator.forBlock["code_text"] = (block) => {
    const text = block.getFieldValue("CODE") || "";
    return [JSON.stringify(text), Order.ATOMIC];
  };

  // The generic script block injects its code verbatim as statements. Leading
  // indentation is normalized to column 0 so Blockly can re-indent it for the
  // block's nesting depth; internal relative indentation is preserved.
  pythonGenerator.forBlock["python_script"] = (block) => {
    const raw = String(block.getFieldValue("CODE") || "").replace(/\s+$/, "");
    if (!raw.trim()) return "";
    const lines = raw.split("\n");
    const indents = lines
      .filter((l) => l.trim())
      .map((l) => l.match(/^\s*/)![0].length);
    const strip = indents.length ? Math.min(...indents) : 0;
    const body = lines.map((l) => l.slice(strip)).join("\n");
    return body + "\n";
  };
}
