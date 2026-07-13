import { useCallback, useEffect, useState } from "react";
import { Boxes, Clock, X } from "lucide-react";
import Home from "./pages/Home";
import Editor from "./pages/Editor";
import Scheduler from "./pages/Scheduler";

type TabKind = "explorer" | "scheduler" | "module";
interface Tab {
  key: string;
  kind: TabKind;
  id?: string;
  title: string;
}

const EXPLORER: Tab = { key: "explorer", kind: "explorer", title: "Explorer" };

export default function AppShell() {
  const [tabs, setTabs] = useState<Tab[]>([EXPLORER]);
  const [active, setActive] = useState("explorer");

  // When a hidden pane becomes active, nudge a resize so embedded editors
  // (Blockly / CodeMirror) lay out to the now-visible size.
  useEffect(() => {
    const raf = requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const openModule = useCallback((id: string, title: string) => {
    const key = `m:${id}`;
    setTabs((prev) =>
      prev.some((t) => t.key === key) ? prev : [...prev, { key, kind: "module", id, title }]
    );
    setActive(key);
  }, []);

  const openScheduler = useCallback(() => {
    setTabs((prev) =>
      prev.some((t) => t.key === "scheduler")
        ? prev
        : [...prev, { key: "scheduler", kind: "scheduler", title: "Scheduler" }]
    );
    setActive("scheduler");
  }, []);

  const setTitle = useCallback((id: string, title: string) => {
    setTabs((prev) => prev.map((t) => (t.key === `m:${id}` ? { ...t, title } : t)));
  }, []);

  const close = useCallback((key: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.key === key);
      const next = prev.filter((t) => t.key !== key);
      setActive((a) => (a !== key ? a : (next[idx - 1] ?? next[idx] ?? EXPLORER).key));
      return next;
    });
  }, []);

  return (
    <div className="shell">
      <div className="tabbar">
        {tabs.map((t) => (
          <div
            key={t.key}
            className={`apptab ${active === t.key ? "active" : ""}`}
            onClick={() => setActive(t.key)}
            title={t.title}
          >
            {t.kind === "explorer" && <Boxes size={14} />}
            {t.kind === "scheduler" && <Clock size={14} />}
            <span className="apptab-label">{t.title}</span>
            {t.kind !== "explorer" && (
              <button
                className="apptab-close"
                title="Close"
                onClick={(e) => {
                  e.stopPropagation();
                  close(t.key);
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="shell-body">
        {/* Explorer stays mounted so its state survives tab switches. */}
        <div className="shell-pane" style={{ display: active === "explorer" ? "flex" : "none" }}>
          <Home onOpenModule={openModule} onOpenScheduler={openScheduler} />
        </div>

        {tabs
          .filter((t) => t.kind === "module" && t.id)
          .map((t) => (
            <div
              key={t.key}
              className="shell-pane"
              style={{ display: active === t.key ? "flex" : "none" }}
            >
              <Editor
                moduleId={t.id!}
                active={active === t.key}
                onClose={() => close(t.key)}
                onTitleChange={setTitle}
              />
            </div>
          ))}

        {tabs.some((t) => t.key === "scheduler") && (
          <div className="shell-pane" style={{ display: active === "scheduler" ? "flex" : "none" }}>
            <Scheduler onClose={() => close("scheduler")} />
          </div>
        )}
      </div>
    </div>
  );
}
