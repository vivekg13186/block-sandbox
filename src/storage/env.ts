// Global environment variables — named sets (e.g. dev / test / prod) of
// key/value pairs, plus the active selection. Persisted in the Tauri app-data
// directory, with a localStorage fallback for plain-browser use.

export interface Environment {
  name: string;
  vars: Record<string, string>;
}

export interface EnvStore {
  active: string; // active environment name ("" = none)
  environments: Environment[];
}

const FILE = "environments.json";
const LS_KEY = "block-sandbox/environments";

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const empty = (): EnvStore => ({ active: "", environments: [] });

export async function loadEnvStore(): Promise<EnvStore> {
  try {
    if (inTauri()) {
      const { exists, readTextFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
      const o = { baseDir: BaseDirectory.AppData };
      if (!(await exists(FILE, o))) return empty();
      return normalize(JSON.parse(await readTextFile(FILE, o)));
    }
    const raw = localStorage.getItem(LS_KEY);
    return raw ? normalize(JSON.parse(raw)) : empty();
  } catch {
    return empty();
  }
}

export async function saveEnvStore(store: EnvStore): Promise<void> {
  const text = JSON.stringify(store, null, 2);
  if (inTauri()) {
    const { writeTextFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(FILE, text, { baseDir: BaseDirectory.AppData });
    return;
  }
  localStorage.setItem(LS_KEY, text);
}

function normalize(s: Partial<EnvStore>): EnvStore {
  const environments = Array.isArray(s.environments)
    ? s.environments
        .filter((e) => e && typeof e.name === "string")
        .map((e) => ({ name: e.name, vars: e.vars && typeof e.vars === "object" ? e.vars : {} }))
    : [];
  const active = environments.some((e) => e.name === s.active) ? (s.active as string) : "";
  return { active, environments };
}

/** Variables of the active environment (empty if none selected). */
export function activeVars(store: EnvStore): Record<string, string> {
  const env = store.environments.find((e) => e.name === store.active);
  return env ? env.vars : {};
}
