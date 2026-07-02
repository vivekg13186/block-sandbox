import { useEffect, useMemo, useState } from "react";
import { Play, Loader2, Code2, AlertTriangle, Terminal } from "lucide-react";
import type { Module, PortType } from "../types/module";
import { portIdent } from "../types/module";
import { generateProgram, previewFunction, collectRequirements } from "../blockly/codegen";
import { canRun, runPython, ensurePackages } from "../runtime/python";
import { loadEnvStore, saveEnvStore, activeVars, type EnvStore } from "../storage/env";

interface Props {
  module: Module;
  allModules: Module[];
}

type ResultTab = "output" | "error" | "code";

function coerce(value: string, type: PortType): unknown {
  if (type === "number") {
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
  }
  if (type === "boolean") return value === "true";
  return value;
}

export default function RunTab({ module, allModules }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [resultTab, setResultTab] = useState<ResultTab>("output");
  const [envStore, setEnvStore] = useState<EnvStore>({ active: "", environments: [] });

  useEffect(() => {
    loadEnvStore().then(setEnvStore);
  }, []);

  const program = useMemo(() => {
    try {
      return { code: generateProgram(module, allModules), error: "" };
    } catch (e) {
      return { code: "", error: e instanceof Error ? e.message : String(e) };
    }
  }, [module, allModules]);

  const requirements = useMemo(() => {
    const declared = collectRequirements(module, allModules);
    // Auto-add packages inferred from the generated code (e.g. Excel blocks).
    const auto = program.code.includes("import openpyxl") ? ["openpyxl"] : [];
    return [...new Set([...declared, ...auto])];
  }, [module, allModules, program.code]);

  const preview = useMemo(() => {
    try {
      return previewFunction(module, allModules);
    } catch (e) {
      return `# Could not generate code: ${e instanceof Error ? e.message : String(e)}`;
    }
  }, [module, allModules]);

  const fail = (msg: string) => {
    setError(msg);
    setExitCode(null);
    setResultTab("error");
  };

  const run = async () => {
    if (program.error) {
      fail(`Code generation failed: ${program.error}`);
      return;
    }
    setRunning(true);
    setError("");
    setOutput("");
    setExitCode(null);
    setStatus("");
    try {
      if (requirements.length) {
        setStatus(`Installing ${requirements.join(", ")}…`);
        const dep = await ensurePackages(requirements);
        if (dep.code !== 0) {
          fail(`Dependency install failed:\n${dep.stderr || dep.stdout}`);
          return;
        }
      }
      setStatus("Running…");
      const inputs: Record<string, unknown> = {};
      for (const p of module.inputs) {
        inputs[portIdent(p)] = coerce(values[p.id] ?? "", p.type);
      }
      const env = activeVars(envStore);
      const res = await runPython(program.code, JSON.stringify({ inputs, env }));
      setExitCode(res.code);
      setError(res.stderr || "");
      setOutput(res.stdout || "");
      setResultTab(res.stderr || res.code !== 0 ? "error" : "output");
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      setStatus("");
    }
  };

  const tabs: { id: ResultTab; label: string; icon: typeof Terminal }[] = [
    { id: "output", label: "Output", icon: Terminal },
    { id: "error", label: "Error", icon: AlertTriangle },
    { id: "code", label: "Code", icon: Code2 },
  ];

  return (
    <div className="run">
      <div className="run-bar">
        <button className="btn primary" onClick={run} disabled={running || !canRun()}>
          {running ? <Loader2 size={15} className="spin" /> : <Play size={15} />} Run
        </button>
        <label className="env-pick">
          env:
          <select
            value={envStore.active}
            onChange={(e) => {
              const next = { ...envStore, active: e.target.value };
              setEnvStore(next);
              saveEnvStore(next);
            }}
          >
            <option value="">(none)</option>
            {envStore.environments.map((env) => (
              <option key={env.name} value={env.name}>
                {env.name}
              </option>
            ))}
          </select>
        </label>
        {status && <span className="muted">{status}</span>}
        {!status && requirements.length > 0 && (
          <span className="muted">requires: {requirements.join(", ")}</span>
        )}
        {!canRun() && <span className="muted">Execution requires the desktop app.</span>}
      </div>

      <div className="run-body">
        <section className="run-inputs">
          <h3>Inputs</h3>
          {module.inputs.length === 0 && <p className="muted">No inputs declared.</p>}
          {module.inputs.map((p) => (
            <label className="field" key={p.id}>
              <span>
                {p.name || "(unnamed)"} <em className="muted">{p.type}</em>
              </span>
              {p.type === "boolean" ? (
                <select
                  value={values[p.id] ?? "false"}
                  onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
                >
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              ) : (
                <input
                  type={p.type === "number" ? "number" : "text"}
                  value={values[p.id] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
                />
              )}
            </label>
          ))}
        </section>

        <section className="run-output">
          <div className="result-tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`result-tab ${resultTab === t.id ? "active" : ""}`}
                onClick={() => setResultTab(t.id)}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
            {exitCode !== null && (
              <span className={`exit-badge ${exitCode === 0 ? "ok" : "err"}`}>exit {exitCode}</span>
            )}
          </div>

          <div className="result-body">
            {resultTab === "output" &&
              (output ? (
                <pre className="code-preview">{output}</pre>
              ) : (
                <p className="muted">Run the module to see output here.</p>
              ))}
            {resultTab === "error" &&
              (error ? (
                <pre className="code-preview err">{error}</pre>
              ) : (
                <p className="muted">No errors.</p>
              ))}
            {resultTab === "code" && <pre className="code-preview">{preview}</pre>}
          </div>
        </section>
      </div>
    </div>
  );
}
