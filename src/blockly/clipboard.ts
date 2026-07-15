// A shared block clipboard that works across diagrams. Blockly's native
// copy/paste lives in one workspace instance; because each editor tab has its
// own (and inactive tabs are unmounted), we serialize the selection to
// localStorage and paste it into whichever workspace is active. Unknown block
// types (e.g. another module's input getters) are pruned on paste.

import * as Blockly from "blockly";
import { pruneBlockState } from "./sanitize";

const KEY = "bs_block_clipboard";

/** Copy a block (and the stack below it) to the shared clipboard. */
export function copyBlocks(block: Blockly.Block): void {
  const state = Blockly.serialization.blocks.save(block, { addNextBlocks: true });
  if (state) localStorage.setItem(KEY, JSON.stringify(state));
}

export function hasClipboard(): boolean {
  return !!localStorage.getItem(KEY);
}

/** Paste the shared clipboard into a workspace, near the current view. */
export function pasteBlocks(ws: Blockly.WorkspaceSvg): Blockly.BlockSvg | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  let state: unknown;
  try {
    state = JSON.parse(raw);
  } catch {
    return null;
  }
  const pruned = pruneBlockState(state);
  if (!pruned) return null;

  const block = Blockly.serialization.blocks.append(pruned, ws, {
    recordUndo: true,
  }) as Blockly.BlockSvg;

  // Drop it near the middle of the current viewport so it's visible.
  try {
    const m = ws.getMetricsManager().getViewMetrics(true);
    block.moveTo(new Blockly.utils.Coordinate(m.left + m.width / 2 - 40, m.top + m.height / 3));
  } catch {
    /* positioning is best-effort */
  }
  (block as unknown as { select?: () => void }).select?.();
  return block;
}

let registered = false;

/** Register right-click menu items for the shared clipboard (idempotent). */
export function registerClipboardMenus(): void {
  if (registered) return;
  registered = true;
  const reg = Blockly.ContextMenuRegistry.registry;

  reg.register({
    id: "bs_copy_shared",
    scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    displayText: "Copy block(s) — shared",
    weight: 1,
    preconditionFn: (scope) =>
      scope.block && scope.block.isMovable() ? "enabled" : "hidden",
    callback: (scope) => {
      if (scope.block) copyBlocks(scope.block);
    },
  });

  reg.register({
    id: "bs_paste_shared",
    scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    displayText: "Paste block(s) — shared",
    weight: 1,
    preconditionFn: () => (hasClipboard() ? "enabled" : "disabled"),
    callback: (scope) => {
      if (scope.workspace) pasteBlocks(scope.workspace);
    },
  });
}
