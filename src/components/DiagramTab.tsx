import { useRef, useState } from "react";
import type * as Blockly from "blockly";
import { Undo2, Redo2, ZoomIn, ZoomOut, Maximize, WandSparkles, Search } from "lucide-react";
import BlocklyWorkspace from "./BlocklyWorkspace";
import type { Module } from "../types/module";

interface Props {
  module: Module;
  allModules: Module[];
  onWorkspaceChange: (workspace: object) => void;
}

export default function DiagramTab({ module, allModules, onWorkspaceChange }: Props) {
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [ready, setReady] = useState(false);

  const ws = () => wsRef.current;
  const act = (fn: (w: Blockly.WorkspaceSvg) => void) => {
    const w = ws();
    if (w) fn(w);
  };

  return (
    <div className="diagram">
      <div className="diagram-toolbar">
        <button className="icon-btn" title="Undo (⌘Z)" disabled={!ready} onClick={() => act((w) => w.undo(false))}>
          <Undo2 size={16} />
        </button>
        <button className="icon-btn" title="Redo (⌘⇧Z)" disabled={!ready} onClick={() => act((w) => w.undo(true))}>
          <Redo2 size={16} />
        </button>
        <span className="tb-sep" />
        <button className="icon-btn" title="Zoom in" disabled={!ready} onClick={() => act((w) => w.zoomCenter(1))}>
          <ZoomIn size={16} />
        </button>
        <button className="icon-btn" title="Zoom out" disabled={!ready} onClick={() => act((w) => w.zoomCenter(-1))}>
          <ZoomOut size={16} />
        </button>
        <button className="icon-btn" title="Zoom to fit" disabled={!ready} onClick={() => act((w) => w.zoomToFit())}>
          <Maximize size={16} />
        </button>
        <span className="tb-sep" />
        <button className="icon-btn" title="Clean up blocks" disabled={!ready} onClick={() => act((w) => w.cleanUp())}>
          <WandSparkles size={16} />
        </button>
        <span className="tb-hint muted">
          <Search size={13} /> ⌘F to search
        </span>
      </div>
      <div className="diagram-canvas">
        <BlocklyWorkspace
          key={module.id}
          module={module}
          allModules={allModules}
          onChange={onWorkspaceChange}
          onReady={(w) => {
            wsRef.current = w;
            setReady(!!w);
          }}
        />
      </div>
    </div>
  );
}
