// Module persistence via the server API. The server stores each module as a
// JSON file in a folder tree (one file per module).

import type { Module } from "../types/module";
import { normalizeModule } from "../types/module";
import { apiGet, apiSend } from "../api";

export async function listModules(): Promise<Module[]> {
  const mods = (await apiGet<Module[]>("/modules")).map(normalizeModule);
  mods.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return mods;
}

export async function getModule(id: string): Promise<Module | null> {
  try {
    return normalizeModule(await apiGet<Module>(`/modules/${id}`));
  } catch {
    return null;
  }
}

export async function saveModule(m: Module): Promise<void> {
  m.updatedAt = new Date().toISOString();
  await apiSend("PUT", `/modules/${m.id}`, m);
}

export async function deleteModule(id: string): Promise<void> {
  await apiSend("DELETE", `/modules/${id}`);
}
