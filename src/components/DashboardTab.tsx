import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import type { Module } from "../types/module";
import { generateProgram, collectRequirements } from "../blockly/codegen";
import { canRun, runPython, ensurePackages } from "../runtime/python";
import { loadEnvStore, saveEnvStore, activeVars, type EnvStore } from "../storage/env";
import Widget, { type WidgetSpec } from "./Widget";

interface Props {
  module: Module;
  allModules: Module[];
  /** Only auto-refresh while the editor tab is active. */
  active?: boolean;
}

const INTERVALS: { label: string; ms: number }[] = [
  { label: "off", ms: 0 },
  { label: "10s", ms: 10_000 },
  { label: "30s", ms: 30_000 },
  { label: "1m", ms: 60_000 },
  { label: "5m", ms: 300_000 },
];

export default function DashboardTab({ module, allModules, active = true }: Props) {
  const [widgets, setWidgets] = useState<WidgetSpec[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [ranAt, setRanAt] = useState<Date | null>(null);
  const [intervalMs, setIntervalMs] = useState(0);
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
    const auto: string[] = [];
    if (program.code.includes("import openpyxl")) auto.push("openpyxl");
    if (program.code.includes("import requests")) auto.push("requests");
    if (program.code.includes("from lxml")) auto.push("lxml");
    if (program.code.includes(".cssselect(")) auto.push("cssselect");
    return [...new Set([...declared, ...auto])];
  }, [module, allModules, program.code]);

  const run = useCallback(async () => {
    if (program.error) {
      setError(`Code generation failed: ${program.error}`);
      return;
    }
    setRunning(true);
    setError("");
    try {
      if (requirements.length) {
        setStatus(`Installing ${requirements.join(", ")}…`);
        const dep = await ensurePackages(requirements);
        if (dep.code !== 0) {
          setError(`Dependency install failed:\n${dep.stderr || dep.stdout}`);
          return;
        }
      }
      setStatus("Running…");
      const env = activeVars(envStore);
      const res = await runPython(program.code, JSON.stringify({ inputs: {}, env }));
      if (res.code !== 0) {
        setError(res.stderr || `Exited with code ${res.code}`);
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(res.stdout || "{}");
      } catch {
        setError(`Flow did not return dashboard JSON.\n\n${res.stdout}`);
        return;
      }
      const list = (parsed as { widgets?: unknown })?.widgets;
      setWidgets(Array.isArray(list) ? (list as WidgetSpec[]) : []);
      setRanAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      setStatus("");
    }
  }, [program, requirements, envStore]);

  // Note: the dashboard does not run automatically on tab switch — the user
  // triggers it with Refresh (or the auto-refresh interval below).

  // Auto-refresh on the chosen interval, only while active.
  useEffect(() => {
    if (!active || !intervalMs || !canRun()) return;
    const id = window.setInterval(() => {
      run();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs, run]);

  return (
    <div className="dashboard">
      <div className="dash-bar">
        <button className="btn primary" onClick={run} disabled={running || !canRun()}>
          {running ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />} Refresh
        </button>
        <label className="env-pick">
          auto:
          <select value={intervalMs} onChange={(e) => setIntervalMs(Number(e.target.value))}>
            {INTERVALS.map((i) => (
              <option key={i.ms} value={i.ms}>
                {i.label}
              </option>
            ))}
          </select>
        </label>
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
        {!status && ranAt && (
          <span className="muted">updated {ranAt.toLocaleTimeString()}</span>
        )}
        {!canRun() && <span className="muted">Execution requires the desktop app.</span>}
      </div>

      <div className="dash-body">
        {error && (
          <div className="dash-error">
            <AlertTriangle size={15} />
            <pre>{error}</pre>
          </div>
        )}
        {!error && widgets.length === 0 && !running && (
          <p className="muted dash-empty">
            No widgets yet. Add widget blocks in the Diagram tab, then Refresh.
          </p>
        )}
        <div className="widget-grid">
          {widgets.map((w, i) => (
            <Widget key={i} spec={w} />
          ))}
        </div>
      </div>
    </div>
  );
}
