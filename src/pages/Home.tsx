import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Boxes,
  Download,
  Upload,
  Copy,
  Code,
  LayoutGrid,
  Folder,
  FolderPlus,
  FolderInput,
  House,
  ChevronRight,
  CheckSquare,
  Square,
  X,
  Variable,
  Clock,
  GitBranch,
} from "lucide-react";
import type { Module, ModuleKind } from "../types/module";
import { newModule, normalizeFolder } from "../types/module";
import { deleteModule, listModules, saveModule } from "../storage/modules";
import {
  exportModule,
  exportModules,
  importModulesViaPicker,
  importModuleFromText,
} from "../storage/io";
import { TextPrompt, ConfirmDialog } from "../components/Dialog";
import EnvManager from "../components/EnvManager";
import GitPanel from "../components/GitPanel";
import { gitStatus } from "../storage/git";

type PromptState = {
  title: string;
  initial: string;
  hint?: string;
  onSubmit: (v: string) => void;
} | null;
type ConfirmState = { title: string; message: string; onConfirm: () => void } | null;

const baseName = (p: string) => p.slice(p.lastIndexOf("/") + 1);
const parentOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");

interface Props {
  onOpenModule: (id: string, title: string) => void;
  onOpenScheduler: () => void;
}

export default function Home({ onOpenModule, onOpenScheduler }: Props) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const [path, setPath] = useState(""); // current folder
  const [envOpen, setEnvOpen] = useState(false);
  const [gitOpen, setGitOpen] = useState(false);
  const [hasGit, setHasGit] = useState(false);
  const [pendingFolders, setPendingFolders] = useState<Set<string>>(new Set());
  const [selMods, setSelMods] = useState<Set<string>>(new Set());
  const [selFolders, setSelFolders] = useState<Set<string>>(new Set());

  const refresh = async () => {
    setModules(await listModules());
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    gitStatus().then((s) => setHasGit(s.repo));
  }, []);

  const clearSelection = () => {
    setSelMods(new Set());
    setSelFolders(new Set());
  };

  const goTo = (p: string) => {
    setPath(p);
    clearSelection();
  };

  // Direct children (folders + modules) of the current path.
  const { folders, mods } = useMemo(() => {
    const prefix = path ? path + "/" : "";
    const folderSet = new Set<string>();
    const mods: Module[] = [];
    for (const m of modules) {
      const f = normalizeFolder(m.folder);
      if (f === path) {
        mods.push(m);
        continue;
      }
      if (path === "" || f.startsWith(prefix)) {
        const rest = path === "" ? f : f.slice(prefix.length);
        const seg = rest.split("/")[0];
        if (seg) folderSet.add(path ? `${path}/${seg}` : seg);
      }
    }
    for (const p of pendingFolders) if (parentOf(p) === path) folderSet.add(p);
    const folders = [...folderSet].sort((a, b) => baseName(a).localeCompare(baseName(b)));
    mods.sort((a, b) => a.name.localeCompare(b.name));
    return { folders, mods };
  }, [modules, pendingFolders, path]);

  // Modules affected by the current selection (folders include their subtree).
  const affected = useMemo(() => {
    const ids = new Set(selMods);
    for (const F of selFolders) {
      for (const m of modules) {
        if (m.folder === F || m.folder.startsWith(F + "/")) ids.add(m.id);
      }
    }
    return modules.filter((m) => ids.has(m.id));
  }, [selMods, selFolders, modules]);

  const selectionActive = selMods.size + selFolders.size > 0;

  // ---- actions -----------------------------------------------------------

  const toggleMod = (id: string) =>
    setSelMods((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleFolder = (p: string) =>
    setSelFolders((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });

  const create = (kind: ModuleKind) => {
    setPrompt({
      title: kind === "script" ? "New script module" : "New module",
      hint: 'Name it; use "/" to nest into sub-folders.',
      initial: "new-module",
      onSubmit: async (name) => {
        setPrompt(null);
        const folder = normalizeFolder([path, parentOf(name)].filter(Boolean).join("/"));
        const m = newModule(baseName(name), kind, folder);
        await saveModule(m);
        onOpenModule(m.id, m.name);
      },
    });
  };

  const newFolder = () => {
    setPrompt({
      title: "New folder",
      initial: "folder",
      onSubmit: (name) => {
        setPrompt(null);
        const full = normalizeFolder(path ? `${path}/${name}` : name);
        if (!full) return;
        setPendingFolders((prev) => new Set(prev).add(full));
        goTo(full);
      },
    });
  };

  const rename = (m: Module) => {
    setPrompt({
      title: "Rename module",
      initial: m.name,
      onSubmit: async (name) => {
        setPrompt(null);
        await saveModule({ ...m, name });
        refresh();
      },
    });
  };

  const duplicate = async (m: Module) => {
    const clone: Module = {
      ...m,
      id: crypto.randomUUID(),
      name: `${m.name} copy`,
      requirements: [...m.requirements],
      inputs: m.inputs.map((p) => ({ ...p })),
      outputs: m.outputs.map((p) => ({ ...p })),
      workspace: m.workspace ? JSON.parse(JSON.stringify(m.workspace)) : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveModule(clone);
    refresh();
  };

  const removeOne = (m: Module) => {
    setConfirmState({
      title: "Delete module",
      message: `Delete "${m.name}"? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmState(null);
        await deleteModule(m.id);
        refresh();
      },
    });
  };

  const importModule = async () => {
    const ids = await importModulesViaPicker();
    if (ids.length === 1) {
      refresh();
      onOpenModule(ids[0], "Module");
    } else if (ids.length > 1) refresh();
  };

  // Bulk: move selection to a destination folder, preserving sub-structure.
  const bulkMove = () => {
    setPrompt({
      title: `Move ${affected.length} module${affected.length === 1 ? "" : "s"}`,
      hint: "Destination folder path (blank = root).",
      initial: path,
      onSubmit: async (dest) => {
        setPrompt(null);
        const target = normalizeFolder(dest);
        const moves = new Map<string, string>();
        for (const F of selFolders) {
          const newRoot = target ? `${target}/${baseName(F)}` : baseName(F);
          for (const m of modules) {
            if (m.folder === F || m.folder.startsWith(F + "/")) {
              moves.set(m.id, normalizeFolder(newRoot + m.folder.slice(F.length)));
            }
          }
        }
        for (const id of selMods) if (!moves.has(id)) moves.set(id, target);
        for (const m of modules) {
          const nf = moves.get(m.id);
          if (nf !== undefined && nf !== m.folder) await saveModule({ ...m, folder: nf });
        }
        clearSelection();
        refresh();
      },
    });
  };

  const bulkDelete = () => {
    setConfirmState({
      title: "Delete selection",
      message: `Delete ${affected.length} module${affected.length === 1 ? "" : "s"}? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmState(null);
        for (const m of affected) await deleteModule(m.id);
        setPendingFolders((prev) => {
          const next = new Set(prev);
          for (const F of selFolders) next.delete(F);
          return next;
        });
        clearSelection();
        refresh();
      },
    });
  };

  const bulkExport = async () => {
    await exportModules(affected);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    for (const file of Array.from(e.dataTransfer.files)) {
      if (!/\.(ya?ml|json)$/i.test(file.name)) continue;
      try {
        await importModuleFromText(await file.text());
      } catch (err) {
        console.error("Import failed", err);
      }
    }
    refresh();
  };

  // ---- render ------------------------------------------------------------

  const crumbs = path ? path.split("/") : [];

  return (
    <div
      className={`home ${dragging ? "drag-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <header className="home-head">
        <div className="brand">
          <Boxes size={22} />
          <h1>Block Sandbox</h1>
        </div>
        <div className="head-actions">
          {hasGit && (
            <button className="btn" onClick={() => setGitOpen(true)} title="Version control">
              <GitBranch size={16} /> Git
            </button>
          )}
          <button className="btn" onClick={onOpenScheduler} title="Scheduler">
            <Clock size={16} /> Scheduler
          </button>
          <button className="btn" onClick={() => setEnvOpen(true)} title="Environment variables">
            <Variable size={16} /> Environments
          </button>
          <button className="btn" onClick={importModule} title="Import a module">
            <Upload size={16} /> Import
          </button>
          <button className="btn" onClick={newFolder} title="New folder">
            <FolderPlus size={16} /> Folder
          </button>
          <button className="btn" onClick={() => create("script")} title="New script module">
            <Code size={16} /> Script
          </button>
          <button className="btn primary" onClick={() => create("blocks")}>
            <Plus size={16} /> Module
          </button>
        </div>
      </header>

      {/* Breadcrumb */}
      <nav className="breadcrumb">
        <button className="crumb" onClick={() => goTo("")}>
          <House size={15} /> Home
        </button>
        {crumbs.map((seg, i) => {
          const p = crumbs.slice(0, i + 1).join("/");
          return (
            <span key={p} className="crumb-seg">
              <ChevronRight size={14} className="muted" />
              <button className="crumb" onClick={() => goTo(p)}>
                {seg}
              </button>
            </span>
          );
        })}
      </nav>

      {/* Bulk action bar */}
      {selectionActive && (
        <div className="bulk-bar">
          <span>
            {affected.length} module{affected.length === 1 ? "" : "s"} selected
          </span>
          <div className="bulk-actions">
            <button className="btn-sm" onClick={bulkMove}>
              <FolderInput size={14} /> Move
            </button>
            <button className="btn-sm" onClick={bulkExport}>
              <Download size={14} /> Export
            </button>
            <button className="btn-sm danger-btn" onClick={bulkDelete}>
              <Trash2 size={14} /> Delete
            </button>
            <button className="icon-btn" title="Clear selection" onClick={clearSelection}>
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : folders.length === 0 && mods.length === 0 ? (
        <div className="empty">
          <Folder size={40} />
          <p>This folder is empty.</p>
          <div className="head-actions">
            <button className="btn" onClick={newFolder}>
              <FolderPlus size={16} /> New folder
            </button>
            <button className="btn primary" onClick={() => create("blocks")}>
              <Plus size={16} /> New module
            </button>
          </div>
        </div>
      ) : (
        <div className="explorer">
          {folders.map((f) => {
            const selected = selFolders.has(f);
            return (
              <div key={f} className={`ex-row ${selected ? "selected" : ""}`}>
                <button
                  className="ex-check"
                  onClick={() => toggleFolder(f)}
                  title={selected ? "Deselect" : "Select"}
                >
                  {selected ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
                <button className="ex-main" onClick={() => goTo(f)}>
                  <Folder size={17} className="folder-ic" />
                  <span className="row-name">{baseName(f)}</span>
                </button>
                <span className="row-actions">
                  <button
                    className="icon-btn"
                    title="New module here"
                    onClick={() => {
                      goTo(f);
                      create("blocks");
                    }}
                  >
                    <Plus size={14} />
                  </button>
                </span>
              </div>
            );
          })}

          {mods.map((m) => {
            const selected = selMods.has(m.id);
            return (
              <div key={m.id} className={`ex-row ${selected ? "selected" : ""}`}>
                <button
                  className="ex-check"
                  onClick={() => toggleMod(m.id)}
                  title={selected ? "Deselect" : "Select"}
                >
                  {selected ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
                <button
                  className="ex-main"
                  onClick={() => onOpenModule(m.id, m.name || "Untitled module")}
                >
                  {m.kind === "script" ? (
                    <Code size={17} className="muted" />
                  ) : (
                    <LayoutGrid size={17} className="muted" />
                  )}
                  <span className="row-name">{m.name || "Untitled module"}</span>
                  <span className="row-meta muted">
                    {m.inputs.length} in · {m.outputs.length} out
                  </span>
                </button>
                <span className="row-actions">
                  <button className="icon-btn" title="Duplicate" onClick={() => duplicate(m)}>
                    <Copy size={14} />
                  </button>
                  <button className="icon-btn" title="Export" onClick={() => exportModule(m)}>
                    <Download size={14} />
                  </button>
                  <button className="icon-btn" title="Rename" onClick={() => rename(m)}>
                    <Pencil size={14} />
                  </button>
                  <button className="icon-btn danger" title="Delete" onClick={() => removeOne(m)}>
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {prompt && (
        <TextPrompt
          title={prompt.title}
          initial={prompt.initial}
          hint={prompt.hint}
          onSubmit={prompt.onSubmit}
          onCancel={() => setPrompt(null)}
        />
      )}
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
      {envOpen && <EnvManager onClose={() => setEnvOpen(false)} />}
      {gitOpen && <GitPanel onClose={() => setGitOpen(false)} onCommitted={refresh} />}
    </div>
  );
}
