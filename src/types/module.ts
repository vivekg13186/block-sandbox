// Core data model for a Block Sandbox module/project.

export type PortType = "string" | "number" | "boolean";

export interface ModulePort {
  /** Stable id, used to build block + variable names. */
  id: string;
  /** Variable name used in generated code (e.g. "url"). */
  name: string;
  type: PortType;
  description?: string;
}

/** "blocks" = Blockly editor; "script" = raw Python editor;
 *  "dashboard" = Blockly editor whose widget blocks emit a dashboard. */
export type ModuleKind = "blocks" | "script" | "dashboard";

export interface Module {
  id: string;
  name: string;
  description: string;
  kind: ModuleKind;
  /** Project folder path, slash-separated, "" for root (e.g. "prj2/subprj2"). */
  folder: string;
  /** pip package specs this module needs, e.g. ["requests", "httpx>=0.27"]. */
  requirements: string[];
  inputs: ModulePort[];
  outputs: ModulePort[];
  /** Serialized Blockly workspace state (Blockly.serialization.workspaces.save). */
  workspace: object | null;
  /** Raw Python body for script modules. */
  script: string;
  /** Cached full runnable program (generated on save) so the server can run
   *  this module headlessly for scheduled jobs. */
  program?: string;
  createdAt: string;
  updatedAt: string;
}

/** Normalize a slash-separated folder path: trim, collapse, strip leading/trailing slashes. */
export function normalizeFolder(folder: string): string {
  return (folder || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("/");
}

export function newModule(name: string, kind: ModuleKind = "blocks", folder = ""): Module {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: name.trim() || "Untitled module",
    description: "",
    kind,
    folder: normalizeFolder(folder),
    requirements: [],
    inputs: [],
    outputs: [],
    workspace: null,
    script: "",
    createdAt: now,
    updatedAt: now,
  };
}

/** Parse a newline/comma list of pip specs into a clean array. */
export function parseRequirements(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("#"));
}

/** Normalize a loaded/imported module so older or partial records are valid. */
export function normalizeModule(m: Partial<Module> & { id: string; name: string }): Module {
  const now = new Date().toISOString();
  return {
    id: m.id,
    name: m.name,
    description: m.description ?? "",
    kind: m.kind === "script" ? "script" : m.kind === "dashboard" ? "dashboard" : "blocks",
    folder: normalizeFolder(m.folder ?? ""),
    requirements: m.requirements ?? [],
    inputs: m.inputs ?? [],
    outputs: m.outputs ?? [],
    workspace: m.workspace ?? null,
    script: m.script ?? "",
    program: m.program,
    createdAt: m.createdAt ?? now,
    updatedAt: m.updatedAt ?? now,
  };
}

export function newPort(type: PortType = "string"): ModulePort {
  return { id: crypto.randomUUID().slice(0, 8), name: "", type };
}

/** Safe Python identifier derived from a port name (fallback to its id). */
export function portIdent(p: ModulePort): string {
  const cleaned = (p.name || "")
    .trim()
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/^([0-9])/, "_$1");
  return cleaned || `p_${p.id}`;
}
