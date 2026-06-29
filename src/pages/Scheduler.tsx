import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Play,
  Pencil,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import type { Module } from "../types/module";
import { listModules } from "../storage/modules";
import {
  type Schedule,
  newSchedule,
  loadSchedules,
  upsertSchedule,
  deleteSchedule,
} from "../storage/schedules";
import { loadEnvStore, type EnvStore } from "../storage/env";
import { CRON_PRESETS, isValidCron, nextFire } from "../scheduler/cron";
import { runSchedule } from "../scheduler/runner";
import { ConfirmDialog } from "../components/Dialog";

export default function Scheduler({ onClose }: { onClose: () => void }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [envStore, setEnvStore] = useState<EnvStore>({ active: "", environments: [] });
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [confirmDel, setConfirmDel] = useState<Schedule | null>(null);
  const [busy, setBusy] = useState<string>("");

  const refresh = async () => setSchedules(await loadSchedules());

  useEffect(() => {
    (async () => {
      setSchedules(await loadSchedules());
      setModules(await listModules());
      setEnvStore(await loadEnvStore());
    })();
  }, []);

  const moduleName = (id: string) => modules.find((m) => m.id === id)?.name ?? "(missing)";

  const runNow = async (s: Schedule) => {
    setBusy(s.id);
    try {
      await runSchedule(s, modules);
      await refresh();
    } finally {
      setBusy("");
    }
  };

  const toggle = async (s: Schedule) => {
    await upsertSchedule({ ...s, enabled: !s.enabled });
    refresh();
  };

  return (
    <div className="scheduler">
      <header className="editor-head">
        <button className="icon-btn" title="Close" onClick={onClose}>
          <ArrowLeft size={18} />
        </button>
        <h2 className="editor-title">Scheduler</h2>
        <button className="btn primary" style={{ marginLeft: "auto" }} onClick={() => setEditing(newSchedule())}>
          <Plus size={16} /> New schedule
        </button>
      </header>

      <div className="sched-list">
        {schedules.length === 0 ? (
          <div className="empty">
            <Clock size={40} />
            <p>No schedules yet.</p>
            <button className="btn primary" onClick={() => setEditing(newSchedule())}>
              <Plus size={16} /> New schedule
            </button>
          </div>
        ) : (
          schedules.map((s) => {
            const next = nextFire(s.cron);
            return (
              <div key={s.id} className="sched-row">
                <label className="switch" title={s.enabled ? "Enabled" : "Disabled"}>
                  <input type="checkbox" checked={s.enabled} onChange={() => toggle(s)} />
                  <span className="slider" />
                </label>
                <div className="sched-main">
                  <div className="sched-title">{s.name}</div>
                  <div className="sched-meta muted">
                    <code>{s.cron}</code> · {s.moduleIds.length} module
                    {s.moduleIds.length === 1 ? "" : "s"}
                    {s.env && ` · env: ${s.env}`}
                    {s.enabled && next && ` · next ${next.toLocaleString()}`}
                  </div>
                  <div className="sched-mods muted">
                    {s.moduleIds.map((id) => moduleName(id)).join(", ") || "no modules"}
                  </div>
                </div>
                <div className="sched-result">
                  {s.lastRun &&
                    (s.lastRun.ok ? (
                      <span className="ok-text">
                        <CheckCircle2 size={14} /> {s.lastRun.passed}/{s.lastRun.passed + s.lastRun.failed}
                      </span>
                    ) : (
                      <span className="err-text">
                        <XCircle size={14} /> {s.lastRun.failed} failed
                      </span>
                    ))}
                </div>
                <div className="sched-actions">
                  <button className="icon-btn" title="Run now" disabled={busy === s.id} onClick={() => runNow(s)}>
                    {busy === s.id ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
                  </button>
                  <button className="icon-btn" title="Edit" onClick={() => setEditing(s)}>
                    <Pencil size={15} />
                  </button>
                  <button className="icon-btn danger" title="Delete" onClick={() => setConfirmDel(s)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {editing && (
        <ScheduleEditor
          initial={editing}
          modules={modules}
          envStore={envStore}
          onClose={() => setEditing(null)}
          onSave={async (s) => {
            await upsertSchedule(s);
            setEditing(null);
            refresh();
          }}
        />
      )}
      {confirmDel && (
        <ConfirmDialog
          title="Delete schedule"
          message={`Delete "${confirmDel.name}"?`}
          onConfirm={async () => {
            await deleteSchedule(confirmDel.id);
            setConfirmDel(null);
            refresh();
          }}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}

function ScheduleEditor({
  initial,
  modules,
  envStore,
  onClose,
  onSave,
}: {
  initial: Schedule;
  modules: Module[];
  envStore: EnvStore;
  onClose: () => void;
  onSave: (s: Schedule) => void;
}) {
  const [s, setS] = useState<Schedule>(initial);
  const patch = (p: Partial<Schedule>) => setS((prev) => ({ ...prev, ...p }));
  const cronOk = useMemo(() => isValidCron(s.cron), [s.cron]);

  const toggleModule = (id: string) =>
    patch({
      moduleIds: s.moduleIds.includes(id)
        ? s.moduleIds.filter((x) => x !== id)
        : [...s.moduleIds, id],
    });

  const sortedModules = [...modules].sort((a, b) =>
    `${a.folder}/${a.name}`.localeCompare(`${b.folder}/${b.name}`)
  );

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal sched-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{initial.name === "New schedule" ? "New schedule" : "Edit schedule"}</h3>

        <label className="field">
          <span>Name</span>
          <input value={s.name} onChange={(e) => patch({ name: e.target.value })} />
        </label>

        <label className="field">
          <span>Cadence (cron)</span>
          <div className="cron-row">
            <input
              className={cronOk ? "" : "invalid"}
              value={s.cron}
              onChange={(e) => patch({ cron: e.target.value })}
            />
            <select value="" onChange={(e) => e.target.value && patch({ cron: e.target.value })}>
              <option value="">presets…</option>
              {CRON_PRESETS.map((p) => (
                <option key={p.cron} value={p.cron}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          {!cronOk && <span className="err-text">Invalid cron expression</span>}
        </label>

        <div className="field">
          <span>Modules to run (in order)</span>
          <div className="mod-picker">
            {sortedModules.length === 0 && <p className="muted">No modules yet.</p>}
            {sortedModules.map((m) => (
              <label key={m.id} className="mod-check">
                <input
                  type="checkbox"
                  checked={s.moduleIds.includes(m.id)}
                  onChange={() => toggleModule(m.id)}
                />
                <span className="mod-check-name">{m.name || "Untitled module"}</span>
                {m.folder && <span className="muted mod-check-folder">{m.folder}</span>}
              </label>
            ))}
          </div>
        </div>

        <div className="sched-form-row">
          <label className="field">
            <span>Environment</span>
            <select value={s.env} onChange={(e) => patch({ env: e.target.value })}>
              <option value="">(none)</option>
              {envStore.environments.map((env) => (
                <option key={env.name} value={env.name}>
                  {env.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Notify</span>
            <select
              value={s.notify}
              onChange={(e) => patch({ notify: e.target.value as Schedule["notify"] })}
            >
              <option value="always">Always</option>
              <option value="on-failure">On failure</option>
              <option value="never">Never</option>
            </select>
          </label>
        </div>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={s.stopOnError}
            onChange={(e) => patch({ stopOnError: e.target.checked })}
          />
          Stop on first failing module
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={s.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          Enabled
        </label>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!cronOk || !s.name.trim()}
            onClick={() => onSave({ ...s, name: s.name.trim() })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
