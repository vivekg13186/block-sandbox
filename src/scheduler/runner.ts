// Runs a schedule's modules (independent batch) and reports results.

import type { Module } from "../types/module";
import type { Schedule, ScheduleRun } from "../storage/schedules";
import { recordRun } from "../storage/schedules";
import { generateProgram, collectRequirements } from "../blockly/codegen";
import { canRun, runPython, ensurePackages } from "../runtime/python";
import { loadEnvStore, type EnvStore } from "../storage/env";
import { notify } from "../runtime/notify";

export interface ModuleRunResult {
  moduleId: string;
  name: string;
  ok: boolean;
  detail: string;
}

export interface BatchResult {
  passed: number;
  failed: number;
  ok: boolean;
  results: ModuleRunResult[];
}

function envVars(store: EnvStore, name: string): Record<string, string> {
  const env = store.environments.find((e) => e.name === name);
  return env ? env.vars : {};
}

/** Run one module; pass = process exited 0. Inputs default to None. */
async function runModule(
  module: Module,
  all: Module[],
  env: Record<string, string>
): Promise<ModuleRunResult> {
  const base = { moduleId: module.id, name: module.name };
  try {
    const program = generateProgram(module, all);
    const reqs = collectRequirements(module, all);
    if (reqs.length) {
      const dep = await ensurePackages(reqs);
      if (dep.code !== 0) {
        return { ...base, ok: false, detail: `Dependency install failed: ${dep.stderr || dep.stdout}` };
      }
    }
    const res = await runPython(program, JSON.stringify({ inputs: {}, env }));
    const ok = res.code === 0;
    return { ...base, ok, detail: ok ? res.stdout.trim() || "ok" : res.stderr.trim() || "failed" };
  } catch (e) {
    return { ...base, ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

/** Run all modules in a schedule, record the result, and notify. */
export async function runSchedule(schedule: Schedule, allModules: Module[]): Promise<BatchResult> {
  const byId = new Map(allModules.map((m) => [m.id, m]));
  const envStore = await loadEnvStore();
  const env = envVars(envStore, schedule.env);

  const results: ModuleRunResult[] = [];
  for (const id of schedule.moduleIds) {
    const module = byId.get(id);
    if (!module) {
      results.push({ moduleId: id, name: "(missing module)", ok: false, detail: "Module not found" });
      if (schedule.stopOnError) break;
      continue;
    }
    if (!canRun()) {
      results.push({ moduleId: id, name: module.name, ok: false, detail: "Execution requires the desktop app" });
      break;
    }
    const r = await runModule(module, allModules, env);
    results.push(r);
    if (!r.ok && schedule.stopOnError) break;
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const ok = failed === 0 && results.length > 0;

  const run: ScheduleRun = { at: new Date().toISOString(), passed, failed, ok };
  await recordRun(schedule.id, run);

  const shouldNotify =
    schedule.notify === "always" || (schedule.notify === "on-failure" && !ok);
  if (shouldNotify) {
    const title = `${schedule.name}: ${ok ? "passed" : "failed"}`;
    await notify(title, `${passed} passed, ${failed} failed`);
  }

  return { passed, failed, ok, results };
}
