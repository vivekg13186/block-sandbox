import { useEffect, useState } from "react";
import { Plus, Trash2, Check, X } from "lucide-react";
import type { EnvStore, Environment } from "../storage/env";
import { loadEnvStore, saveEnvStore } from "../storage/env";

interface Props {
  onClose: () => void;
  onSaved?: (store: EnvStore) => void;
}

/** Manage named environments (dev / test / …) and their key/value variables. */
export default function EnvManager({ onClose, onSaved }: Props) {
  const [store, setStore] = useState<EnvStore>({ active: "", environments: [] });
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    (async () => {
      const s = await loadEnvStore();
      setStore(s);
      setSelected(s.active || s.environments[0]?.name || "");
    })();
  }, []);

  const persist = async (next: EnvStore) => {
    setStore(next);
    await saveEnvStore(next);
    onSaved?.(next);
  };

  const env = store.environments.find((e) => e.name === selected);

  const addEnv = () => {
    let n = 1;
    let name = "dev";
    const names = new Set(store.environments.map((e) => e.name));
    if (names.has(name)) while (names.has(`env${n}`)) n++;
    if (names.has("dev")) name = `env${n}`;
    const next = { ...store, environments: [...store.environments, { name, vars: {} }] };
    persist(next);
    setSelected(name);
  };

  const renameEnv = (oldName: string, newName: string) => {
    const name = newName.trim();
    if (!name || store.environments.some((e) => e.name === name && e.name !== oldName)) return;
    const next: EnvStore = {
      active: store.active === oldName ? name : store.active,
      environments: store.environments.map((e) => (e.name === oldName ? { ...e, name } : e)),
    };
    persist(next);
    setSelected(name);
  };

  const deleteEnv = (name: string) => {
    const environments = store.environments.filter((e) => e.name !== name);
    const next: EnvStore = {
      active: store.active === name ? "" : store.active,
      environments,
    };
    persist(next);
    if (selected === name) setSelected(environments[0]?.name || "");
  };

  const setActive = (name: string) =>
    persist({ ...store, active: store.active === name ? "" : name });

  const updateVars = (name: string, vars: Record<string, string>) =>
    persist({
      ...store,
      environments: store.environments.map((e) => (e.name === name ? { ...e, vars } : e)),
    });

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal env-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="env-modal-head">
          <h3 className="modal-title">Environments</h3>
          <button className="icon-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="env-body">
          <aside className="env-list">
            {store.environments.map((e) => (
              <div
                key={e.name}
                className={`env-item ${selected === e.name ? "active" : ""}`}
                onClick={() => setSelected(e.name)}
              >
                <button
                  className={`env-active-dot ${store.active === e.name ? "on" : ""}`}
                  title={store.active === e.name ? "Active environment" : "Set active"}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setActive(e.name);
                  }}
                >
                  {store.active === e.name && <Check size={12} />}
                </button>
                <span className="env-name">{e.name}</span>
              </div>
            ))}
            <button className="btn-sm env-add" onClick={addEnv}>
              <Plus size={14} /> Add environment
            </button>
          </aside>

          <section className="env-detail">
            {!env ? (
              <p className="muted">Create an environment to add variables.</p>
            ) : (
              <EnvEditor
                env={env}
                isActive={store.active === env.name}
                onRename={(n) => renameEnv(env.name, n)}
                onDelete={() => deleteEnv(env.name)}
                onSetActive={() => setActive(env.name)}
                onVars={(vars) => updateVars(env.name, vars)}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function EnvEditor({
  env,
  isActive,
  onRename,
  onDelete,
  onSetActive,
  onVars,
}: {
  env: Environment;
  isActive: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onSetActive: () => void;
  onVars: (vars: Record<string, string>) => void;
}) {
  const [name, setName] = useState(env.name);
  // rows kept as ordered pairs so editing keys doesn't reorder/lose focus
  const [rows, setRows] = useState<[string, string][]>(Object.entries(env.vars));

  useEffect(() => {
    setName(env.name);
    setRows(Object.entries(env.vars));
  }, [env.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitRows = (next: [string, string][]) => {
    setRows(next);
    const vars: Record<string, string> = {};
    for (const [k, v] of next) if (k.trim()) vars[k.trim()] = v;
    onVars(vars);
  };

  return (
    <div className="env-editor">
      <div className="env-editor-head">
        <input
          className="env-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() !== env.name && onRename(name)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        <button className={`btn-sm ${isActive ? "active" : ""}`} onClick={onSetActive}>
          {isActive ? "Active" : "Set active"}
        </button>
        <button className="icon-btn danger" title="Delete environment" onClick={onDelete}>
          <Trash2 size={15} />
        </button>
      </div>

      <div className="env-vars">
        {rows.length === 0 && <p className="muted">No variables yet.</p>}
        {rows.map(([k, v], i) => (
          <div className="env-var-row" key={i}>
            <input
              placeholder="KEY"
              value={k}
              onChange={(e) =>
                commitRows(rows.map((r, idx) => (idx === i ? [e.target.value, r[1]] : r)))
              }
            />
            <input
              placeholder="value"
              value={v}
              onChange={(e) =>
                commitRows(rows.map((r, idx) => (idx === i ? [r[0], e.target.value] : r)))
              }
            />
            <button
              className="icon-btn danger"
              title="Remove"
              onClick={() => commitRows(rows.filter((_, idx) => idx !== i))}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <button className="btn-sm" onClick={() => setRows([...rows, ["", ""]])}>
          <Plus size={14} /> Add variable
        </button>
      </div>
    </div>
  );
}
