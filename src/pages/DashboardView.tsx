import { useEffect, useState } from "react";
import { Loader2, LayoutDashboard } from "lucide-react";
import type { Module } from "../types/module";
import { getModule, listModules } from "../storage/modules";
import DashboardTab from "../components/DashboardTab";

/** Chrome-less, full-screen dashboard — opened in its own browser tab via the
 *  #/dashboard/<id> hash route (see main.tsx). */
export default function DashboardView({ moduleId }: { moduleId: string }) {
  const [module, setModule] = useState<Module | null>(null);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const all = await listModules();
      setAllModules(all);
      const m = all.find((x) => x.id === moduleId) ?? (await getModule(moduleId));
      if (!m) {
        setNotFound(true);
        return;
      }
      setModule(m);
      document.title = `${m.name || "Dashboard"} — Block Sandbox`;
    })();
  }, [moduleId]);

  if (notFound) {
    return <div className="centered">Dashboard not found.</div>;
  }
  if (!module) {
    return (
      <div className="centered">
        <Loader2 className="spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="dash-standalone">
      <header className="dash-standalone-head">
        <LayoutDashboard size={16} />
        <span className="dash-standalone-title">{module.name || "Dashboard"}</span>
      </header>
      <div className="dash-standalone-body">
        <DashboardTab module={module} allModules={allModules} active standalone />
      </div>
    </div>
  );
}
