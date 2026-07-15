// A mutator block that maps fields of an object (or list of objects) onto a new
// object. You add "from → to" rows; the block builds { to: obj[from], ... } for
// a dict, or a list of those when the source is a list.

import * as Blockly from "blockly";
import { pythonGenerator, Order } from "blockly/python";

const OBJ_COLOUR = 300;

interface Row {
  from: string;
  to: string;
}
interface TransformBlock extends Blockly.Block {
  itemCount_: number;
  rows_(): Row[];
  updateShape_(): void;
}

const TRANSFORM_MIXIN = {
  itemCount_: 2,

  saveExtraState(this: TransformBlock) {
    return { items: this.rows_() };
  },

  loadExtraState(this: TransformBlock, state: { items?: Row[] }) {
    const items = state.items ?? [];
    this.itemCount_ = items.length;
    this.updateShape_();
    items.forEach((it, i) => {
      this.setFieldValue(it.from ?? "", "FROM" + i);
      this.setFieldValue(it.to ?? "", "TO" + i);
    });
  },

  rows_(this: TransformBlock): Row[] {
    const out: Row[] = [];
    for (let i = 0; i < this.itemCount_; i++) {
      out.push({
        from: (this.getFieldValue("FROM" + i) as string) || "",
        to: (this.getFieldValue("TO" + i) as string) || "",
      });
    }
    return out;
  },

  decompose(this: TransformBlock, workspace: Blockly.WorkspaceSvg) {
    const container = workspace.newBlock("object_transform_container");
    (container as Blockly.BlockSvg).initSvg();
    let conn = container.getInput("STACK")!.connection!;
    for (let i = 0; i < this.itemCount_; i++) {
      const item = workspace.newBlock("object_transform_item");
      (item as Blockly.BlockSvg).initSvg();
      conn.connect(item.previousConnection!);
      conn = item.nextConnection!;
    }
    return container as Blockly.BlockSvg;
  },

  compose(this: TransformBlock, container: Blockly.Block) {
    const existing = this.rows_();
    let item = container.getInputTargetBlock("STACK");
    let count = 0;
    while (item) {
      count++;
      item = item.getNextBlock();
    }
    this.itemCount_ = count;
    this.updateShape_();
    existing.forEach((it, i) => {
      if (i < this.itemCount_) {
        this.setFieldValue(it.from, "FROM" + i);
        this.setFieldValue(it.to, "TO" + i);
      }
    });
  },

  updateShape_(this: TransformBlock) {
    let i = 0;
    while (this.getInput("ROW" + i)) {
      this.removeInput("ROW" + i);
      i++;
    }
    if (this.getInput("EMPTY")) this.removeInput("EMPTY");
    if (this.itemCount_ === 0) {
      this.appendDummyInput("EMPTY").appendField("(no fields — edit ⚙)");
      return;
    }
    for (let j = 0; j < this.itemCount_; j++) {
      this.appendDummyInput("ROW" + j)
        .appendField("from")
        .appendField(new Blockly.FieldTextInput(""), "FROM" + j)
        .appendField("→ to")
        .appendField(new Blockly.FieldTextInput(""), "TO" + j);
    }
  },
};

function initMain(this: TransformBlock) {
  this.appendValueInput("SOURCE").appendField("transform");
  this.setOutput(true, null);
  this.setColour(OBJ_COLOUR);
  this.setInputsInline(false);
  this.setTooltip(
    "Map fields of an object (or list of objects) to a new object. Add rows " +
      "with the gear icon: from source-key → to output-key. In 'from', use a " +
      "plain key, or start with = for an expression over the current item a, " +
      "e.g. =a.num1 + a.num2 or =len(a.items)."
  );
  this.itemCount_ = 2;
  this.updateShape_();
  this.setFieldValue("id", "FROM0");
  this.setFieldValue("id", "TO0");
  // The mutator UI is only meaningful on a rendered workspace; skip it in the
  // headless workspace used for code generation.
  if ((this.workspace as { rendered?: boolean }).rendered) {
    this.setMutator(
      new Blockly.icons.MutatorIcon(
        ["object_transform_item"],
        this as unknown as Blockly.BlockSvg
      )
    );
  }
}

let registered = false;

export function registerTransformBlock(): void {
  if (registered) return;
  registered = true;

  Blockly.Blocks["object_transform"] = { ...TRANSFORM_MIXIN, init: initMain };

  Blockly.Blocks["object_transform_container"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("fields");
      this.appendStatementInput("STACK");
      this.setColour(OBJ_COLOUR);
      this.setTooltip("Add a field-mapping row for each output key you want");
      (this as { contextMenu?: boolean }).contextMenu = false;
    },
  };

  Blockly.Blocks["object_transform_item"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("field");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(OBJ_COLOUR);
      this.setTooltip("One output field");
      (this as { contextMenu?: boolean }).contextMenu = false;
    },
  };

  pythonGenerator.forBlock["object_transform"] = (block) => {
    const source = pythonGenerator.valueToCode(block, "SOURCE", Order.NONE) || "{}";
    const count = (block as unknown as TransformBlock).itemCount_ ?? 0;
    const entries: string[] = [];
    for (let i = 0; i < count; i++) {
      const to = ((block.getFieldValue("TO" + i) as string) || "").trim();
      const from = ((block.getFieldValue("FROM" + i) as string) || "").trim();
      if (!to && !from) continue;
      const outKey = to || from;
      const src = from || to;
      // "=expr" → a Python expression over the current item `a`; otherwise a
      // plain key lookup (bracket access so keys named like dict methods work).
      const valExpr = src.startsWith("=")
        ? src.slice(1).trim() || "None"
        : `a[${JSON.stringify(src)}]`;
      entries.push(`${JSON.stringify(outKey)}: ${valExpr}`);
    }
    const bodyDict = `{${entries.join(", ")}}`;
    // bs_map applies the mapping to each item of a list, or to a single object.
    // The item is wrapped so `a.field`, `a.nested.field`, `a["field"]`,
    // `a.items[0].x`, and len(a.items) all work. Field keys win over dict
    // methods (so a.items is the "items" field), missing keys → None, and the
    // wrappers subclass dict/list so results stay JSON-serializable.
    const fn = pythonGenerator.provideFunction_("bs_map", [
      `def ${pythonGenerator.FUNCTION_NAME_PLACEHOLDER_}(src, fn):`,
      "    class _O(dict):",
      "        def __getattribute__(self, k):",
      "            if not k.startswith('__') and dict.__contains__(self, k):",
      "                return _w(dict.__getitem__(self, k))",
      "            return dict.__getattribute__(self, k)",
      "        def __getattr__(self, k):",
      "            return None",
      "        def __getitem__(self, k):",
      "            return _w(dict.__getitem__(self, k)) if dict.__contains__(self, k) else None",
      "    class _L(list):",
      "        def __getitem__(self, i):",
      "            return _w(list.__getitem__(self, i))",
      "    def _w(v):",
      "        if isinstance(v, dict): return _O(v)",
      "        if isinstance(v, list): return _L(v)",
      "        return v",
      "    return [fn(_w(o)) for o in src] if isinstance(src, list) else fn(_w(src))",
    ]);
    return [`${fn}(${source}, lambda a: ${bodyDict})`, Order.FUNCTION_CALL];
  };
}
