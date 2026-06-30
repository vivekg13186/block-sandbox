// Import / export modules as JSON files using browser download / file input.

import type { Module } from "../types/module";
import { normalizeModule } from "../types/module";
import { saveModule } from "./modules";

const FORMAT_TAG = "block-sandbox.module";

interface ExportEnvelope {
  format: typeof FORMAT_TAG;
  version: 1;
  module: Module;
}

function serialize(m: Module): string {
  const env: ExportEnvelope = { format: FORMAT_TAG, version: 1, module: m };
  return JSON.stringify(env, null, 2);
}

/** Parse exported JSON (envelope or a bare module) into a normalized module. */
export function parseModule(text: string): Module {
  const data = JSON.parse(text);
  const raw = data && data.format === FORMAT_TAG ? data.module : data;
  if (!raw || typeof raw.name !== "string") {
    throw new Error("Not a valid Block Sandbox module file.");
  }
  // Assign a fresh id so imports never overwrite an existing module.
  return normalizeModule({ ...raw, id: crypto.randomUUID() });
}

function safeFileName(name: string): string {
  return (name.trim() || "module").replace(/[^A-Za-z0-9._-]+/g, "_");
}

// ---- Export --------------------------------------------------------------

export async function exportModule(m: Module): Promise<boolean> {
  const text = serialize(m);
  const fileName = `${safeFileName(m.name)}.json`;
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

/** Export several modules at once (one download each). */
export async function exportModules(modules: Module[]): Promise<boolean> {
  if (modules.length === 0) return false;
  for (const m of modules) {
    await exportModule(m);
  }
  return true;
}

// ---- Import --------------------------------------------------------------

/** Import one or more modules via a file picker. Returns the new module ids. */
export async function importModulesViaPicker(): Promise<string[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      const ids: string[] = [];
      for (const file of files) {
        try {
          ids.push(await importModuleFromText(await file.text()));
        } catch (e) {
          console.error("Import failed for", file.name, e);
        }
      }
      resolve(ids);
    };
    input.click();
  });
}

/** Import from raw JSON text (used by picker + drag-and-drop). */
export async function importModuleFromText(text: string): Promise<string> {
  const m = parseModule(text);
  await saveModule(m);
  return m.id;
}
