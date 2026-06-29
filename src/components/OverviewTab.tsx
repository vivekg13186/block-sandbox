import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Module, ModulePort, PortType } from "../types/module";
import { newPort, parseRequirements } from "../types/module";

interface Props {
  module: Module;
  onChange: (patch: Partial<Module>) => void;
}

const TYPES: PortType[] = ["string", "number", "boolean"];

function PortList({
  title,
  ports,
  onChange,
}: {
  title: string;
  ports: ModulePort[];
  onChange: (ports: ModulePort[]) => void;
}) {
  const update = (i: number, patch: Partial<ModulePort>) =>
    onChange(ports.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const remove = (i: number) => onChange(ports.filter((_, idx) => idx !== i));
  const add = () => onChange([...ports, newPort()]);

  return (
    <section className="port-list">
      <div className="port-list-head">
        <h3>{title}</h3>
        <button className="btn-sm" onClick={add}>
          <Plus size={14} /> Add
        </button>
      </div>
      {ports.length === 0 && <p className="muted">None declared.</p>}
      {ports.map((p, i) => (
        <div className="port-row" key={p.id}>
          <input
            className="port-name"
            placeholder="name"
            value={p.name}
            onChange={(e) => update(i, { name: e.target.value })}
          />
          <select value={p.type} onChange={(e) => update(i, { type: e.target.value as PortType })}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            className="port-desc"
            placeholder="description (optional)"
            value={p.description ?? ""}
            onChange={(e) => update(i, { description: e.target.value })}
          />
          <button className="icon-btn danger" title="Remove" onClick={() => remove(i)}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </section>
  );
}

/** Requirements editor with its own text buffer (so trailing newlines work). */
function RequirementsField({
  moduleId,
  requirements,
  onChange,
}: {
  moduleId: string;
  requirements: string[];
  onChange: (reqs: string[]) => void;
}) {
  const [text, setText] = useState(requirements.join("\n"));
  // Reset the buffer when switching to a different module.
  useEffect(() => setText(requirements.join("\n")), [moduleId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <label className="field">
      <span>Requirements (pip packages — one per line)</span>
      <textarea
        className="req-editor"
        spellCheck={false}
        value={text}
        placeholder={"requests\nhttpx>=0.27"}
        rows={3}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseRequirements(e.target.value));
        }}
      />
    </label>
  );
}

export default function OverviewTab({ module, onChange }: Props) {
  return (
    <div className="overview">
      <label className="field">
        <span>Name</span>
        <input
          value={module.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Module name"
        />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea
          value={module.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What does this module do?"
          rows={3}
        />
      </label>
      <PortList title="Inputs" ports={module.inputs} onChange={(inputs) => onChange({ inputs })} />
      <PortList
        title="Outputs"
        ports={module.outputs}
        onChange={(outputs) => onChange({ outputs })}
      />
      <RequirementsField
        moduleId={module.id}
        requirements={module.requirements}
        onChange={(requirements) => onChange({ requirements })}
      />
    </div>
  );
}
