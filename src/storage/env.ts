// Global environment variables (dev / test / ...), persisted via the API.

import { apiGet, apiSend } from "../api";

export interface Environment {
  name: string;
  vars: Record<string, string>;
}

export interface EnvStore {
  active: string;
  environments: Environment[];
}

const empty = (): EnvStore => ({ active: "", environments: [] });

function normalize(s: Partial<EnvStore>): EnvStore {
  const environments = Array.isArray(s.environments)
    ? s.environments
        .filter((e) => e && typeof e.name === "string")
        .map((e) => ({ name: e.name, vars: e.vars && typeof e.vars === "object" ? e.vars : {} }))
    : [];
  const active = environments.some((e) => e.name === s.active) ? (s.active as string) : "";
  return { active, environments };
}

export async function loadEnvStore(): Promise<EnvStore> {
  try {
    return normalize(await apiGet<EnvStore>("/environments"));
  } catch {
    return empty();
  }
}

export async function saveEnvStore(store: EnvStore): Promise<void> {
  await apiSend("PUT", "/environments", store);
}

/** Variables of the active environment (empty if none selected). */
export function activeVars(store: EnvStore): Record<string, string> {
  const env = store.environments.find((e) => e.name === store.active);
  return env ? env.vars : {};
}
