import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, LayoutGrid, Play, FileText, Code } from "lucide-react";
import type { Module } from "../types/module";
import { getModule, listModules, saveModule } from "../storage/modules";
import { generateProgram } from "../blockly/codegen";
import OverviewTab from "../components/OverviewTab";
import DiagramTab from "../components/DiagramTab";
import ScriptTab from "../components/ScriptTab";
import RunTab from "../components/RunTab";

type Tab = "overview" | "diagram" | "run";
type SaveState = "idle" | "saving" | "saved";

interface Props {
  moduleId: string;
  onClose: () => void;
  onTitleChange?: (id: string, title: string) => void;
}

export default function Editor({ moduleId, onClose, onTitleChange }: Props) {
  const id = moduleId;
  const [module, setModule] = useState<Module | null>(null);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [notFound, setNotFound] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const allModulesRef = useRef<Module[]>([]);
  allModulesRef.current = allModules;

  useEffect(() => {
    if (!id) return;
    (async () => {
      const m = await getModule(id);
      if (!m) {
        setNotFound(true);
        return;
      }
      setModule(m);
      setAllModules(await listModules());
    })();
  }, [id]);

  // Keep the tab label in sync with the module name.
  useEffect(() => {
    if (module) onTitleChange?.(id, module.name || "Untitled module");
  }, [module?.name, id, onTitleChange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced persistence whenever the module changes.
  const persist = useCallback((m: Module) => {
    setSaveState("saving");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      // Cache the generated program so the server can run this module headlessly
      // (e.g. for scheduled jobs) without needing Blockly.
      let toSave = m;
      try {
        toSave = { ...m, program: generateProgram(m, allModulesRef.current) };
      } catch {
        /* keep previous program if generation fails */
      }
      await saveModule(toSave);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1200);
    }, 500);
  }, []);

  const applyPatch = useCallback(
    (patch: Partial<Module>) => {
      setModule((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  if (notFound) {
    return (
      <div className="centered">
        <p>Module not found.</p>
        <button className="btn" onClick={onClose}>
          Close tab
        </button>
      </div>
    );
  }
  if (!module) {
    return (
      <div className="centered">
        <Loader2 className="spin" /> Loading…
      </div>
    );
  }

  const isScript = module.kind === "script";
  const tabs: { id: Tab; label: string; icon: typeof FileText }[] = [
    { id: "overview", label: "Overview", icon: FileText },
    isScript
      ? { id: "diagram", label: "Script", icon: Code }
      : { id: "diagram", label: "Diagram", icon: LayoutGrid },
    { id: "run", label: "Run", icon: Play },
  ];

  return (
    <div className="editor">
      <header className="editor-head">
        <h2 className="editor-title">{module.name || "Untitled module"}</h2>
        <div className="save-indicator">
          {saveState === "saving" && (
            <>
              <Loader2 size={14} className="spin" /> Saving…
            </>
          )}
          {saveState === "saved" && (
            <>
              <Check size={14} /> Saved
            </>
          )}
        </div>
        <nav className="tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="editor-body">
        {tab === "overview" && <OverviewTab module={module} onChange={applyPatch} />}
        {tab === "diagram" &&
          (isScript ? (
            <ScriptTab module={module} onChange={applyPatch} />
          ) : (
            <DiagramTab
              module={module}
              allModules={allModules}
              onWorkspaceChange={(workspace) => applyPatch({ workspace })}
            />
          ))}
        {tab === "run" && <RunTab module={module} allModules={allModules} />}
      </main>
    </div>
  );
}
