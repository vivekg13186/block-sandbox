// Module persistence. Uses the Tauri filesystem when running inside the
// desktop app, and falls back to localStorage so the UI also works in a
// plain browser (`npm run dev`).

import type { Module } from "../types/module";
import { normalizeModule } from "../types/module";

const DIR = "modules";
const LS_PREFIX = "block-sandbox/module/";

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// ---- Tauri filesystem backend -------------------------------------------
//
// Each module is a single JSON file stored under a nested path that mirrors its
// project folder, e.g.:
//   modules/mod1.json
//   modules/prj2/subprj2/mode2.json
// The on-disk folder is authoritative for a module's `folder` field, and the
// file is named after the (sanitized) module name.

import { normalizeFolder } from "../types/module";

async function fs() {
  const mod = await import("@tauri-apps/plugin-fs");
  return mod;
}

async function ensureDir() {
  const { exists, mkdir, BaseDirectory } = await fs();
  if (!(await exists(DIR, { baseDir: BaseDirectory.AppData }))) {
    await mkdir(DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  }
}

/** Sanitize a module name into a file basename (no extension). */
function safeBase(name: string): string {
  return (name.trim() || "module").replace(/[/\\:*?"<>|]+/g, "_");
}

/** Relative path (under AppData) for a module file given folder + name. */
function modulePath(folder: string, name: string): string {
  const f = normalizeFolder(folder);
  return `${DIR}/${f ? f + "/" : ""}${safeBase(name)}.json`;
}

interface FoundModule {
  path: string;
  module: Module;
}

/** Recursively read every module .json under `rel` (relative to AppData). */
async function walk(rel: string): Promise<FoundModule[]> {
  const { readDir, readTextFile, BaseDirectory } = await fs();
  const o = { baseDir: BaseDirectory.AppData };
  const out: FoundModule[] = [];
  let entries;
  try {
    entries = await readDir(rel, o);
  } catch {
    return out;
  }
  for (const e of entries) {
    const childRel = `${rel}/${e.name}`;
    if (e.isDirectory) {
      out.push(...(await walk(childRel)));
    } else if (e.isFile && e.name.endsWith(".json")) {
      try {
        const m = JSON.parse(await readTextFile(childRel, o)) as Module;
        // Derive folder from on-disk location (strip "modules/" and "/<file>").
        const inner = childRel.slice(DIR.length + 1);
        const slash = inner.lastIndexOf("/");
        m.folder = slash >= 0 ? inner.slice(0, slash) : "";
        out.push({ path: childRel, module: m });
      } catch {
        /* skip unreadable/invalid file */
      }
    }
  }
  return out;
}

async function tauriList(): Promise<Module[]> {
  await ensureDir();
  return (await walk(DIR)).map((f) => f.module);
}

async function tauriGet(id: string): Promise<Module | null> {
  await ensureDir();
  const found = (await walk(DIR)).find((f) => f.module.id === id);
  return found ? found.module : null;
}

async function tauriSave(m: Module): Promise<void> {
  const { writeTextFile, mkdir, remove, BaseDirectory } = await fs();
  const o = { baseDir: BaseDirectory.AppData };
  await ensureDir();

  const all = await walk(DIR);
  const existing = all.find((f) => f.module.id === m.id);

  // Resolve the target path, avoiding clobbering a *different* module that
  // already occupies the same folder/name.
  let target = modulePath(m.folder, m.name);
  const collision = all.find((f) => f.path === target && f.module.id !== m.id);
  if (collision) {
    target = modulePath(m.folder, `${m.name}-${m.id.slice(0, 6)}`);
  }

  // Make sure the parent folder exists.
  const parent = target.slice(0, target.lastIndexOf("/"));
  if (parent && parent !== DIR) {
    await mkdir(parent, { baseDir: BaseDirectory.AppData, recursive: true });
  }

  await writeTextFile(target, JSON.stringify(m, null, 2), o);

  // If the module moved (folder/name changed), remove the old file.
  if (existing && existing.path !== target) {
    await remove(existing.path, o).catch(() => {});
  }
}

async function tauriDelete(id: string): Promise<void> {
  const { remove, BaseDirectory } = await fs();
  const o = { baseDir: BaseDirectory.AppData };
  const found = (await walk(DIR)).find((f) => f.module.id === id);
  if (found) await remove(found.path, o).catch(() => {});
}

// ---- localStorage fallback ----------------------------------------------

function lsList(): Module[] {
  const out: Module[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LS_PREFIX)) {
      try {
        out.push(JSON.parse(localStorage.getItem(key)!) as Module);
      } catch {
        /* skip */
      }
    }
  }
  return out;
}

// ---- public API ----------------------------------------------------------

export async function listModules(): Promise<Module[]> {
  const mods = (inTauri() ? await tauriList() : lsList()).map(normalizeModule);
  mods.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return mods;
}

export async function getModule(id: string): Promise<Module | null> {
  const raw = inTauri()
    ? await tauriGet(id)
    : ((): Module | null => {
        const r = localStorage.getItem(LS_PREFIX + id);
        return r ? (JSON.parse(r) as Module) : null;
      })();
  return raw ? normalizeModule(raw) : null;
}

export async function saveModule(m: Module): Promise<void> {
  m.updatedAt = new Date().toISOString();
  if (inTauri()) return tauriSave(m);
  localStorage.setItem(LS_PREFIX + m.id, JSON.stringify(m));
}

export async function deleteModule(id: string): Promise<void> {
  if (inTauri()) return tauriDelete(id);
  localStorage.removeItem(LS_PREFIX + id);
}
