import { useEffect, useRef, useState, type MutableRefObject } from "react";
import * as Blockly from "blockly";
import { Undo2, Redo2, ZoomIn, ZoomOut, Maximize, WandSparkles, Search, Image } from "lucide-react";
import BlocklyWorkspace from "./BlocklyWorkspace";
import { saveWorkspacePng } from "../blockly/exportImage";
import type { Module } from "../types/module";

interface Props {
  module: Module;
  allModules: Module[];
  /** Only mount the (heavy) Blockly workspace while this editor tab is active. */
  active?: boolean;
  /** Editor sets this so Save can pull the live workspace state on demand. */
  flushRef?: MutableRefObject<(() => object | null) | null>;
  onWorkspaceChange: (workspace: object) => void;
}

export default function DiagramTab({
  module,
  allModules,
  active = true,
  flushRef,
  onWorkspaceChange,
}: Props) {
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [ready, setReady] = useState(false);

  // Expose a serializer so Editor's Save can capture the current graph even if
  // Blockly's debounced onChange hasn't fired yet.
  useEffect(() => {
    if (!flushRef) return;
    flushRef.current = () => {
      const w = wsRef.current;
      if (!w) return null;
      try {
        return Blockly.serialization.workspaces.save(w);
      } catch {
        return null;
      }
    };
    return () => {
      flushRef.current = null;
    };
  }, [flushRef]);

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
        <span className="tb-sep" />
        <button
          className="icon-btn"
          title="Save blocks as image (PNG)"
          disabled={!ready}
          onClick={() =>
            act((w) => {
              saveWorkspacePng(w, module.name).then((ok) => {
                if (!ok) Blockly.dialog.alert("Add some blocks first, then save the image.");
              });
            })
          }
        >
          <Image size={16} />
        </button>
        <span className="tb-hint muted">
          <Search size={13} /> ⌘F to search
        </span>
      </div>
      <div className="diagram-canvas">
        {active ? (
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
        ) : null}
      </div>
    </div>
  );
}
