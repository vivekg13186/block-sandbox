import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { portIdent } from "../types/module";
import type { Module } from "../types/module";

interface Props {
  module: Module;
  onChange: (patch: Partial<Module>) => void;
}

/**
 * Editor for script modules: a CodeMirror Python editor. Inputs are available
 * as variables; assign declared outputs to return them. The module still
 * appears as a callable block elsewhere.
 */
export default function ScriptTab({ module, onChange }: Props) {
  const inNames = module.inputs.map(portIdent);
  const outNames = module.outputs.map(portIdent);

  const placeholder =
    "# Python body for this module.\n" +
    (inNames.length ? `# inputs: ${inNames.join(", ")}\n` : "") +
    (outNames.length ? `${outNames[0]} = ...` : "result = 42");

  return (
    <div className="script">
      <div className="script-hint">
        <span className="muted">
          Available inputs:{" "}
          {inNames.length ? <code>{inNames.join(", ")}</code> : <em>none</em>}
        </span>
        <span className="muted">
          Assign outputs:{" "}
          {outNames.length ? <code>{outNames.join(", ")}</code> : <em>none</em>}
        </span>
        <span className="muted">
          Env vars: <code>env("KEY")</code> or <code>os.getenv("KEY")</code>
        </span>
      </div>
      <div className="script-editor-wrap">
        <CodeMirror
          value={module.script}
          height="100%"
          theme={oneDark}
          extensions={[python()]}
          placeholder={placeholder}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            bracketMatching: true,
            closeBrackets: true,
            indentOnInput: true,
            autocompletion: true,
            tabSize: 4,
          }}
          onChange={(value) => onChange({ script: value })}
        />
      </div>
    </div>
  );
}
