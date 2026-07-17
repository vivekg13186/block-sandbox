// A mutator block that builds an object from name : value pairs, e.g.
// { "q": term, "page": 2 }. Handy for HTTP query params, headers, and JSON
// bodies. Add rows with the gear icon; each row is a key field + a value input.

import * as Blockly from "blockly";
import { pythonGenerator, Order } from "blockly/python";

const OBJ_COLOUR = 300;

interface ObjBlock extends Blockly.Block {
  itemCount_: number;
  updateShape_(): void;
}

const MIXIN = {
  itemCount_: 2,

  saveExtraState(this: ObjBlock) {
    return { itemCount: this.itemCount_ };
  },

  loadExtraState(this: ObjBlock, state: { itemCount?: number }) {
    this.itemCount_ = state.itemCount ?? 0;
    this.updateShape_();
  },

  decompose(this: ObjBlock, workspace: Blockly.WorkspaceSvg) {
    const container = workspace.newBlock("object_create_container");
    (container as Blockly.BlockSvg).initSvg();
    let conn = container.getInput("STACK")!.connection!;
    for (let i = 0; i < this.itemCount_; i++) {
      const item = workspace.newBlock("object_create_item");
      (item as Blockly.BlockSvg).initSvg();
      conn.connect(item.previousConnection!);
      conn = item.nextConnection!;
    }
    return container as Blockly.BlockSvg;
  },

  // Remember which value block is attached to each row so re-composing keeps it.
  saveConnections(this: ObjBlock, container: Blockly.Block) {
    let item = container.getInputTargetBlock("STACK");
    let i = 0;
    while (item) {
      const input = this.getInput("VAL" + i);
      (item as unknown as { valueConnection_?: Blockly.Connection | null }).valueConnection_ =
        input?.connection?.targetConnection ?? null;
      i++;
      item = item.getNextBlock();
    }
  },

  compose(this: ObjBlock, container: Blockly.Block) {
    let item = container.getInputTargetBlock("STACK");
    const connections: (Blockly.Connection | null)[] = [];
    while (item) {
      connections.push(
        (item as unknown as { valueConnection_?: Blockly.Connection }).valueConnection_ ?? null
      );
      item = item.getNextBlock();
    }
    // Preserve current key text by row index.
    const keys: string[] = [];
    for (let i = 0; i < this.itemCount_; i++) keys.push((this.getFieldValue("KEY" + i) as string) || "");
    // Disconnect any child that is no longer part of the stack.
    for (let i = 0; i < this.itemCount_; i++) {
      const target = this.getInput("VAL" + i)?.connection?.targetConnection;
      if (target && connections.indexOf(target) === -1) target.disconnect();
    }
    this.itemCount_ = connections.length;
    this.updateShape_();
    for (let i = 0; i < this.itemCount_; i++) {
      const c = connections[i];
      if (c) {
        try {
          this.getInput("VAL" + i)!.connection!.connect(c);
        } catch {
          /* value no longer connectable */
        }
      }
      if (i < keys.length) this.setFieldValue(keys[i] || "key", "KEY" + i);
    }
  },

  updateShape_(this: ObjBlock) {
    let i = 0;
    while (this.getInput("VAL" + i)) {
      this.removeInput("VAL" + i);
      i++;
    }
    if (this.getInput("EMPTY")) this.removeInput("EMPTY");
    if (this.itemCount_ === 0) {
      this.appendDummyInput("EMPTY").appendField("empty object {}");
      return;
    }
    for (let j = 0; j < this.itemCount_; j++) {
      this.appendValueInput("VAL" + j)
        .appendField(new Blockly.FieldTextInput("key"), "KEY" + j)
        .appendField(":");
    }
  },
};

function initMain(this: ObjBlock) {
  this.appendDummyInput().appendField("object");
  this.setOutput(true, null);
  this.setColour(OBJ_COLOUR);
  this.setInputsInline(false);
  this.setTooltip(
    "Build an object from name : value pairs. Add rows with the gear icon. " +
      "Use it for HTTP query params, headers, or a JSON body."
  );
  this.itemCount_ = 2;
  this.updateShape_();
  if ((this.workspace as { rendered?: boolean }).rendered) {
    this.setMutator(
      new Blockly.icons.MutatorIcon(["object_create_item"], this as unknown as Blockly.BlockSvg)
    );
  }
}

let registered = false;

export function registerObjectCreateBlock(): void {
  if (registered) return;
  registered = true;

  Blockly.Blocks["object_create"] = { ...MIXIN, init: initMain };

  Blockly.Blocks["object_create_container"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("object");
      this.appendStatementInput("STACK");
      this.setColour(OBJ_COLOUR);
      this.setTooltip("Add a field for each key you want in the object");
      (this as { contextMenu?: boolean }).contextMenu = false;
    },
  };

  Blockly.Blocks["object_create_item"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("field");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(OBJ_COLOUR);
      this.setTooltip("One key/value pair");
      (this as { contextMenu?: boolean }).contextMenu = false;
    },
  };

  pythonGenerator.forBlock["object_create"] = (block) => {
    const count = (block as unknown as ObjBlock).itemCount_ ?? 0;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const key = (block.getFieldValue("KEY" + i) as string) || "";
      if (!key) continue;
      const val = pythonGenerator.valueToCode(block, "VAL" + i, Order.NONE) || "None";
      parts.push(`${JSON.stringify(key)}: ${val}`);
    }
    return [`{${parts.join(", ")}}`, Order.ATOMIC];
  };
}
