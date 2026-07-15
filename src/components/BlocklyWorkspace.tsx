import { useEffect, useMemo, useRef } from "react";
import * as Blockly from "blockly";
import "blockly/blocks";
import { WorkspaceSearch } from "@blockly/plugin-workspace-search";
import { registerDynamicBlocks, buildToolbox } from "../blockly/blocks";
import { sanitizeState } from "../blockly/sanitize";
import { blockSandboxDark } from "../blockly/theme";
import { installBlocklyDialogs } from "../blockly/dialog";
import type { Module } from "../types/module";

interface Props {
  module: Module;
  allModules: Module[];
  /** Called (debounced) with the serialized workspace whenever it changes. */
  onChange: (workspace: object) => void;
  /** Receives the live workspace (and null on dispose) so parents can drive it. */
  onReady?: (ws: Blockly.WorkspaceSvg | null) => void;
}

/**
 * Embeds a Blockly workspace for one module. Rebuilds blocks + toolbox when the
 * module's id changes; loads the saved workspace state and reports edits.
 */
export default function BlocklyWorkspace({ module, allModules, onChange, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const loadingRef = useRef(false);
  const debounceRef = useRef<number | undefined>(undefined);
  const pendingRef = useRef(false);

  // Inject / re-inject when the open module changes.
  useEffect(() => {
    if (!containerRef.current) return;

    installBlocklyDialogs();
    registerDynamicBlocks(module, allModules);
    const toolbox = buildToolbox(module, allModules);

    const ws = Blockly.inject(containerRef.current, {
      toolbox: toolbox as Blockly.utils.toolbox.ToolboxDefinition,
      theme: blockSandboxDark,
      renderer: "thrasos",
      grid: { spacing: 24, length: 3, colour: "#2a2f3a", snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.9, minScale: 0.3, maxScale: 2.5 },
      trashcan: true,
      move: { scrollbars: true, drag: true, wheel: true },
    });
    wsRef.current = ws;

    // Ctrl/⌘+F search within the canvas.
    const search = new WorkspaceSearch(ws);
    search.init();

    onReadyRef.current?.(ws);

    // Load saved state. Prune blocks whose type isn't registered so an
    // unknown block (e.g. a call to a module that isn't present) doesn't make
    // the whole graph fail to load.
    loadingRef.current = true;
    try {
      if (module.workspace) {
        Blockly.serialization.workspaces.load(sanitizeState(module.workspace), ws);
      }
    } catch (e) {
      console.error("Failed to load workspace", e);
    }
    loadingRef.current = false;

    // Report edits (debounced), ignoring UI-only and programmatic-load events.
    const listener = (ev: Blockly.Events.Abstract) => {
      if (loadingRef.current || ev.isUiEvent) return;
      pendingRef.current = true;
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        pendingRef.current = false;
        const state = Blockly.serialization.workspaces.save(ws);
        onChangeRef.current(state);
      }, 400);
    };
    ws.addChangeListener(listener);

    const onResize = () => Blockly.svgResize(ws);
    window.addEventListener("resize", onResize);
    // Initial size pass after layout settles.
    const t = window.setTimeout(onResize, 0);

    return () => {
      window.clearTimeout(debounceRef.current);
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
      ws.removeChangeListener(listener);
      // Flush a pending (debounced) edit so unmounting on tab switch doesn't
      // drop the last change.
      if (pendingRef.current) {
        try {
          onChangeRef.current(Blockly.serialization.workspaces.save(ws));
        } catch {
          /* ignore */
        }
        pendingRef.current = false;
      }
      search.dispose();
      ws.dispose();
      wsRef.current = null;
      onReadyRef.current?.(null);
    };
    // Rebuild only when the module identity changes (not on every keystroke).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module.id]);

  // When this module's own inputs/outputs, or any other module's call-block
  // signature, changes, re-register the block definitions and refresh the
  // toolbox in place — so newly added blocks reflect the latest shape without
  // needing to close and reopen the tab.
  const sig = useMemo(() => {
    const ports = (ps: Module["inputs"]) => ps.map((p) => `${p.id}:${p.name}`).join(",");
    const mine = `${ports(module.inputs)}|${ports(module.outputs)}`;
    const others = allModules.map((m) => `${m.id}:${m.name}:${ports(m.inputs)}`).join(";");
    return `${mine}||${others}`;
  }, [module.inputs, module.outputs, module.name, allModules]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    registerDynamicBlocks(module, allModules);
    try {
      ws.updateToolbox(buildToolbox(module, allModules) as Blockly.utils.toolbox.ToolboxDefinition);
    } catch (e) {
      console.error("Failed to refresh toolbox", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return <div ref={containerRef} className="blockly-host" />;
}
