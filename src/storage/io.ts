// Import / export modules as human-friendly YAML files (browser download /
// file input). JSON is also accepted on import (YAML is a JSON superset).

import { dump as yamlDump, load as yamlLoad } from "js-yaml";
import type { Module } from "../types/module";
import { normalizeModule } from "../types/module";
import { saveModule } from "./modules";

const FORMAT_TAG = "block-sandbox.module";

function serialize(m: Module): string {
  return yamlDump({ format: FORMAT_TAG, version: 1, module: m }, { lineWidth: -1, noRefs: true });
}

/** Parse an exported module file (YAML or JSON; envelope or bare module). */
export function parseModule(text: string): Module {
  const data = yamlLoad(text) as Record<string, unknown> | null;
  const raw = (data && (data as { format?: string }).format === FORMAT_TAG
    ? (data as { module: unknown }).module
    : data) as (Partial<Module> & { name?: string }) | null;
  if (!raw || typeof raw.name !== "string") {
    throw new Error("Not a valid Block Sandbox module file.");
  }
  // Assign a fresh id so imports never overwrite an existing module.
  return normalizeModule({ ...raw, id: crypto.randomUUID(), name: raw.name });
}

function safeFileName(name: string): string {
  return (name.trim() || "module").replace(/[^A-Za-z0-9._-]+/g, "_");
}

// ---- Export --------------------------------------------------------------

export async function exportModule(m: Module): Promise<boolean> {
  const text = serialize(m);
  const fileName = `${safeFileName(m.name)}.yml`;
  const blob = new Blob([text], { type: "application/x-yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

/** Export several modules as a single .zip, preserving the folder tree. */
export async function exportModules(modules: Module[]): Promise<boolean> {
  if (modules.length === 0) return false;
  if (modules.length === 1) return exportModule(modules[0]);

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const used = new Set<string>();
  for (const m of modules) {
    const folder = (m.folder || "").trim();
    let path = `${folder ? folder + "/" : ""}${safeFileName(m.name)}.yml`;
    if (used.has(path)) {
      path = `${folder ? folder + "/" : ""}${safeFileName(m.name)}-${m.id.slice(0, 6)}.yml`;
    }
    used.add(path);
    zip.file(path, serialize(m));
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "block-sandbox-modules.zip";
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

// ---- Import --------------------------------------------------------------

/** Import one or more modules via a file picker. Returns the new module ids. */
export async function importModulesViaPicker(): Promise<string[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".yml,.yaml,.json,application/x-yaml,application/json";
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
