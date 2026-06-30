// Scheduled jobs: run a batch of modules on a cron cadence while the app is
// open in a browser tab, with optional desktop notification. Persisted on the
// server via the API.

import { apiGet, apiSend } from "../api";

export type NotifyMode = "always" | "on-failure" | "never";

export interface ScheduleRun {
  at: string; // ISO timestamp of last run
  passed: number;
  failed: number;
  ok: boolean;
}

export interface Schedule {
  id: string;
  name: string;
  /** Module ids to run, in order (independent batch). */
  moduleIds: string[];
  /** Active environment name to run under ("" = none). */
  env: string;
  /** 5-field cron expression (or @hourly/@daily/... macro). */
  cron: string;
  enabled: boolean;
  /** Stop the batch on the first failing module. */
  stopOnError: boolean;
  notify: NotifyMode;
  lastRun?: ScheduleRun;
}

export function newSchedule(name = "New schedule"): Schedule {
  return {
    id: crypto.randomUUID(),
    name,
    moduleIds: [],
    env: "",
    cron: "0 9 * * *",
    enabled: false,
    stopOnError: false,
    notify: "always",
  };
}

export async function loadSchedules(): Promise<Schedule[]> {
  try {
    return await apiGet<Schedule[]>("/schedules");
  } catch {
    return [];
  }
}

export async function saveSchedules(schedules: Schedule[]): Promise<void> {
  await apiSend("PUT", "/schedules", schedules);
}

export async function upsertSchedule(s: Schedule): Promise<Schedule[]> {
  const all = await loadSchedules();
  const idx = all.findIndex((x) => x.id === s.id);
  if (idx >= 0) all[idx] = s;
  else all.push(s);
  await saveSchedules(all);
  return all;
}

export async function deleteSchedule(id: string): Promise<Schedule[]> {
  const all = (await loadSchedules()).filter((s) => s.id !== id);
  await saveSchedules(all);
  return all;
}

/** Record the result of a run on a schedule (and persist). */
export async function recordRun(id: string, run: ScheduleRun): Promise<void> {
  const all = await loadSchedules();
  const s = all.find((x) => x.id === id);
  if (!s) return;
  s.lastRun = run;
  await saveSchedules(all);
}
