// Import / export modules as JSON files. Uses Tauri dialogs + Rust file
// commands in the desktop app, and Blob download / file input in a browser.

import type { Module } from "../types/module";
import { normalizeModule } from "../types/module";
import { saveModule } from "./modules";

const FORMAT_TAG = "block-sandbox.module";

interface ExportEnvelope {
  format: typeof FORMAT_TAG;
  version: 1;
  module: Module;
}

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
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

  if (inTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({
      defaultPath: fileName,
      filters: [{ name: "Module", extensions: ["json"] }],
    });
    if (!path) return false;
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("write_text_file_abs", { path, contents: text });
    return true;
  }

  // Browser fallback: trigger a download.
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

/** Export several modules at once into a chosen directory. */
export async function exportModules(modules: Module[]): Promise<boolean> {
  if (modules.length === 0) return false;

  if (inTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const dir = await open({ directory: true, multiple: false });
    if (!dir || typeof dir !== "string") return false;
    const { invoke } = await import("@tauri-apps/api/core");
    for (const m of modules) {
      await invoke("write_text_file_abs", {
        path: `${dir}/${safeFileName(m.name)}.json`,
        contents: serialize(m),
      });
    }
    return true;
  }

  // Browser fallback: download each file.
  for (const m of modules) {
    await exportModule(m);
  }
  return true;
}

// ---- Import --------------------------------------------------------------

/** Import one or more modules via a file picker. Returns the new module ids. */
export async function importModulesViaPicker(): Promise<string[]> {
  if (inTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const picked = await open({
      multiple: true,
      filters: [{ name: "Module", extensions: ["json"] }],
    });
    if (!picked) return [];
    const paths = Array.isArray(picked) ? picked : [picked];
    const { invoke } = await import("@tauri-apps/api/core");
    const ids: string[] = [];
    for (const path of paths) {
      try {
        const text = await invoke<string>("read_text_file_abs", { path });
        ids.push(await importModuleFromText(text));
      } catch (e) {
        console.error("Import failed for", path, e);
      }
    }
    return ids;
  }

  // Browser fallback: hidden multi-file input.
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
