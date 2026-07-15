// Drop blocks whose type isn't registered from a serialized workspace, so a
// saved graph still loads after a block type is removed/renamed. Used both when
// loading into the editor and when generating code headlessly.

import * as Blockly from "blockly";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const isKnown = (type?: string): boolean =>
  !!type && !!(Blockly.Blocks as Record<string, unknown>)[type];

/** Recursively drop blocks/shadows whose type isn't registered. Returns null if
 *  the block itself is unknown. Exported for reuse (e.g. cross-diagram paste). */
export function pruneBlockState(node: Json): Json | null {
  return pruneBlock(node);
}

/** Recursively drop blocks/shadows whose type isn't registered. */
function pruneBlock(node: Json): Json | null {
  if (!node || !isKnown(node.type)) return null;
  if (node.inputs) {
    for (const key of Object.keys(node.inputs)) {
      const input = node.inputs[key];
      if (input.block) {
        const kept = pruneBlock(input.block);
        if (kept) input.block = kept;
        else delete input.block;
      }
      if (input.shadow && !isKnown(input.shadow.type)) delete input.shadow;
      if (!input.block && !input.shadow) delete node.inputs[key];
    }
  }
  if (node.next?.block) {
    const kept = pruneBlock(node.next.block);
    if (kept) node.next.block = kept;
    else delete node.next;
  }
  return node;
}

/** Return a copy of the serialized workspace with unknown block types removed. */
export function sanitizeState(state: object): object {
  try {
    const copy: Json = JSON.parse(JSON.stringify(state));
    if (copy?.blocks?.blocks) {
      copy.blocks.blocks = copy.blocks.blocks.map(pruneBlock).filter(Boolean);
    }
    return copy;
  } catch {
    return state;
  }
}
