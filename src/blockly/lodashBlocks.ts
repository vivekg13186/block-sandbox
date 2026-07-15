// Lodash-flavored utility blocks that generate plain Python (no runtime
// dependency). Kept to simple, single-expression operations.

import * as Blockly from "blockly";
import { pythonGenerator, Order } from "blockly/python";

const ARRAY = "260";
const COLL = "180";
const NUMBER = "230";
const STRING = "160";
const OBJECT = "300";

type ShadowVal = string | number | undefined;
interface Arg {
  name: string;
  shadow?: ShadowVal;
  def: string; // fallback code when the input is empty
}
interface Field {
  name: string;
  options: [string, string][]; // [label, value]
}
interface Spec {
  type: string;
  msg: string;
  args: Arg[];
  /** Dropdown fields, appended after the value inputs in message order. */
  fields?: Field[];
  colour: string;
  tip: string;
  // Returns a Python expression. `v` reads value inputs, `f` reads dropdowns.
  gen: (v: (name: string) => string, f: (name: string) => string) => string;
}

const A = (name: string, def: string, shadow?: ShadowVal): Arg => ({ name, def, shadow });

// ---- specs ---------------------------------------------------------------

const ARRAY_SPECS: Spec[] = [
  {
    type: "lo_chunk",
    msg: "chunk %1 into size %2",
    args: [A("L", "[]"), A("N", "1", 2)],
    colour: ARRAY,
    tip: "Split a list into groups of size N",
    gen: (v) => `[(${v("L")})[i:i+max(1,int(${v("N")}))] for i in range(0, len(${v("L")}), max(1,int(${v("N")})))]`,
  },
  {
    type: "lo_compact",
    msg: "compact %1",
    args: [A("L", "[]")],
    colour: ARRAY,
    tip: "Remove falsy values from a list",
    gen: (v) => `[x for x in (${v("L")}) if x]`,
  },
  {
    type: "lo_flatten",
    msg: "flatten %1",
    args: [A("L", "[]")],
    colour: ARRAY,
    tip: "Flatten a list one level deep",
    gen: (v) => `[y for x in (${v("L")}) for y in (x if isinstance(x, list) else [x])]`,
  },
  {
    type: "lo_uniq",
    msg: "uniq %1",
    args: [A("L", "[]")],
    colour: ARRAY,
    tip: "Remove duplicates (keeps order)",
    gen: (v) => `list(dict.fromkeys(${v("L")}))`,
  },
  {
    type: "lo_reverse",
    msg: "reverse %1",
    args: [A("L", "[]")],
    colour: ARRAY,
    tip: "Reversed list",
    gen: (v) => `list(reversed(${v("L")}))`,
  },
  {
    type: "lo_sort",
    msg: "sort %1",
    args: [A("L", "[]")],
    colour: ARRAY,
    tip: "Sorted list",
    gen: (v) => `sorted(${v("L")})`,
  },
  {
    type: "lo_includes",
    msg: "%1 includes %2",
    args: [A("L", "[]"), A("X", "None")],
    colour: ARRAY,
    tip: "True if the list contains the value",
    gen: (v) => `(${v("X")} in (${v("L")}))`,
  },
  {
    type: "lo_index_of",
    msg: "index of %1 in %2",
    args: [A("X", "None"), A("L", "[]")],
    colour: ARRAY,
    tip: "Index of value (-1 if absent)",
    gen: (v) => `((${v("L")}).index(${v("X")}) if ${v("X")} in (${v("L")}) else -1)`,
  },
  {
    type: "lo_concat",
    msg: "concat %1 and %2",
    args: [A("A", "[]"), A("B", "[]")],
    colour: ARRAY,
    tip: "Concatenate two lists",
    gen: (v) => `list(${v("A")}) + list(${v("B")})`,
  },
  {
    type: "lo_difference",
    msg: "difference %1 minus %2",
    args: [A("A", "[]"), A("B", "[]")],
    colour: ARRAY,
    tip: "Items in A not in B",
    gen: (v) => `[x for x in (${v("A")}) if x not in (${v("B")})]`,
  },
  {
    type: "lo_intersection",
    msg: "intersection %1 and %2",
    args: [A("A", "[]"), A("B", "[]")],
    colour: ARRAY,
    tip: "Items in both lists",
    gen: (v) => `[x for x in (${v("A")}) if x in (${v("B")})]`,
  },
  {
    type: "lo_range",
    msg: "range %1",
    args: [A("N", "0", 10)],
    colour: ARRAY,
    tip: "List of integers 0..N-1",
    gen: (v) => `list(range(int(${v("N")})))`,
  },
  // ---- list-of-objects helpers ----
  {
    type: "lo_sort_by",
    msg: "sort %1 by key %2 %3",
    args: [A("L", "[]"), A("K", "''", "name")],
    fields: [
      {
        name: "DIR",
        options: [
          ["ascending", "asc"],
          ["descending", "desc"],
        ],
      },
    ],
    colour: ARRAY,
    tip: "Sort a list of objects by an object key (missing values last)",
    gen: (v, f) =>
      `sorted((${v("L")}), key=lambda o: (o.get(${v("K")}) is None, o.get(${v("K")})), reverse=${
        f("DIR") === "desc" ? "True" : "False"
      })`,
  },
  {
    type: "lo_take",
    msg: "take first %1 of %2",
    args: [A("N", "1", 5), A("L", "[]")],
    colour: ARRAY,
    tip: "First N elements of a list",
    gen: (v) => `list(${v("L")})[: int(${v("N")})]`,
  },
  {
    type: "lo_slice",
    msg: "slice %1 from %2 to %3",
    args: [A("L", "[]"), A("A", "0", 0), A("B", "0", 5)],
    colour: ARRAY,
    tip: "Elements from index A up to (not including) B",
    gen: (v) => `list(${v("L")})[int(${v("A")}) : int(${v("B")})]`,
  },
];

const COLL_SPECS: Spec[] = [
  {
    type: "lo_to_list",
    msg: "to list %1",
    args: [A("C", "[]")],
    colour: COLL,
    tip: "Values as a list (dict → its values)",
    gen: (v) => `(list((${v("C")}).values()) if isinstance(${v("C")}, dict) else list(${v("C")}))`,
  },
  {
    type: "lo_size",
    msg: "size of %1",
    args: [A("C", "[]")],
    colour: COLL,
    tip: "Number of items",
    gen: (v) => `len(${v("C")})`,
  },
  {
    type: "lo_sum",
    msg: "sum of %1",
    args: [A("C", "[]")],
    colour: COLL,
    tip: "Sum of a list of numbers",
    gen: (v) => `sum(${v("C")})`,
  },
  {
    type: "lo_min",
    msg: "min of %1",
    args: [A("C", "[]")],
    colour: COLL,
    tip: "Minimum (None if empty)",
    gen: (v) => `(min(${v("C")}) if ${v("C")} else None)`,
  },
  {
    type: "lo_max",
    msg: "max of %1",
    args: [A("C", "[]")],
    colour: COLL,
    tip: "Maximum (None if empty)",
    gen: (v) => `(max(${v("C")}) if ${v("C")} else None)`,
  },
  {
    type: "lo_mean",
    msg: "mean of %1",
    args: [A("C", "[]")],
    colour: COLL,
    tip: "Average (0 if empty)",
    gen: (v) => `(sum(${v("C")})/len(${v("C")}) if ${v("C")} else 0)`,
  },
];

const NUMBER_SPECS: Spec[] = [
  {
    type: "lo_clamp",
    msg: "clamp %1 between %2 and %3",
    args: [A("N", "0", 0), A("LO", "0", 0), A("HI", "0", 100)],
    colour: NUMBER,
    tip: "Constrain a number to a range",
    gen: (v) => `max(${v("LO")}, min(${v("N")}, ${v("HI")}))`,
  },
  {
    type: "lo_in_range",
    msg: "%1 in range %2 to %3",
    args: [A("N", "0", 0), A("LO", "0", 0), A("HI", "0", 100)],
    colour: NUMBER,
    tip: "True if LO <= N < HI",
    gen: (v) => `((${v("LO")}) <= (${v("N")}) < (${v("HI")}))`,
  },
  {
    type: "lo_abs",
    msg: "abs %1",
    args: [A("N", "0", 0)],
    colour: NUMBER,
    tip: "Absolute value",
    gen: (v) => `abs(${v("N")})`,
  },
  {
    type: "lo_ceil",
    msg: "ceil %1",
    args: [A("N", "0", 0)],
    colour: NUMBER,
    tip: "Round up",
    gen: (v) => `__import__('math').ceil(${v("N")})`,
  },
  {
    type: "lo_floor",
    msg: "floor %1",
    args: [A("N", "0", 0)],
    colour: NUMBER,
    tip: "Round down",
    gen: (v) => `__import__('math').floor(${v("N")})`,
  },
  {
    type: "lo_parse_int",
    msg: "parse int %1",
    args: [A("S", "'0'", "0")],
    colour: NUMBER,
    tip: "Parse a string to an integer",
    gen: (v) => `int(str(${v("S")}).strip())`,
  },
];

const STRING_SPECS: Spec[] = [
  {
    type: "lo_capitalize",
    msg: "capitalize %1",
    args: [A("S", "''", "text")],
    colour: STRING,
    tip: "Capitalize the first letter",
    gen: (v) => `str(${v("S")}).capitalize()`,
  },
  {
    type: "lo_starts_with",
    msg: "%1 starts with %2",
    args: [A("S", "''", "text"), A("P", "''", "te")],
    colour: STRING,
    tip: "True if string starts with prefix",
    gen: (v) => `str(${v("S")}).startswith(str(${v("P")}))`,
  },
  {
    type: "lo_ends_with",
    msg: "%1 ends with %2",
    args: [A("S", "''", "text"), A("P", "''", "xt")],
    colour: STRING,
    tip: "True if string ends with suffix",
    gen: (v) => `str(${v("S")}).endswith(str(${v("P")}))`,
  },
  {
    type: "lo_str_includes",
    msg: "%1 contains %2",
    args: [A("S", "''", "text"), A("SUB", "''", "ex")],
    colour: STRING,
    tip: "True if string contains substring",
    gen: (v) => `(str(${v("SUB")}) in str(${v("S")}))`,
  },
  {
    type: "lo_split",
    msg: "split %1 by %2",
    args: [A("S", "''", "a,b,c"), A("SEP", "''", ",")],
    colour: STRING,
    tip: "Split a string into a list",
    gen: (v) => `str(${v("S")}).split(str(${v("SEP")}))`,
  },
  {
    type: "lo_repeat",
    msg: "repeat %1 times %2",
    args: [A("S", "''", "ab"), A("N", "1", 3)],
    colour: STRING,
    tip: "Repeat a string N times",
    gen: (v) => `(str(${v("S")}) * int(${v("N")}))`,
  },
  {
    type: "lo_pad_start",
    msg: "pad start %1 to %2 with %3",
    args: [A("S", "''", "7"), A("LEN", "0", 3), A("CH", "'0'", "0")],
    colour: STRING,
    tip: "Left-pad to a length",
    gen: (v) => `str(${v("S")}).rjust(int(${v("LEN")}), str(${v("CH")})[:1] or ' ')`,
  },
  {
    type: "lo_pad_end",
    msg: "pad end %1 to %2 with %3",
    args: [A("S", "''", "7"), A("LEN", "0", 3), A("CH", "' '", " ")],
    colour: STRING,
    tip: "Right-pad to a length",
    gen: (v) => `str(${v("S")}).ljust(int(${v("LEN")}), str(${v("CH")})[:1] or ' ')`,
  },
  {
    type: "lo_snake_case",
    msg: "snake case %1",
    args: [A("S", "''", "Hello World")],
    colour: STRING,
    tip: "Convert to snake_case",
    gen: (v) => `str(${v("S")}).strip().lower().replace(' ', '_').replace('-', '_')`,
  },
  {
    type: "lo_kebab_case",
    msg: "kebab case %1",
    args: [A("S", "''", "Hello World")],
    colour: STRING,
    tip: "Convert to kebab-case",
    gen: (v) => `str(${v("S")}).strip().lower().replace(' ', '-').replace('_', '-')`,
  },
];

const OBJECT_SPECS: Spec[] = [
  {
    type: "lo_has",
    msg: "%1 has key %2",
    args: [A("O", "{}"), A("K", "''", "key")],
    colour: OBJECT,
    tip: "True if object has the key",
    gen: (v) => `(${v("K")} in (${v("O")}))`,
  },
  {
    type: "lo_merge",
    msg: "merge %1 and %2",
    args: [A("A", "{}"), A("B", "{}")],
    colour: OBJECT,
    tip: "Merge two objects (B wins)",
    gen: (v) => `{**(${v("A")}), **(${v("B")})}`,
  },
  {
    type: "lo_invert",
    msg: "invert %1",
    args: [A("O", "{}")],
    colour: OBJECT,
    tip: "Swap keys and values",
    gen: (v) => `{val: k for k, val in (${v("O")}).items()}`,
  },
  {
    type: "lo_entries",
    msg: "entries of %1",
    args: [A("O", "{}")],
    colour: OBJECT,
    tip: "List of [key, value] pairs",
    gen: (v) => `[list(t) for t in (${v("O")}).items()]`,
  },
];

const ALL: { name: string; colour: string; specs: Spec[] }[] = [
  { name: "Array", colour: ARRAY, specs: ARRAY_SPECS },
  { name: "Collection", colour: COLL, specs: COLL_SPECS },
  { name: "Number", colour: NUMBER, specs: NUMBER_SPECS },
  { name: "String", colour: STRING, specs: STRING_SPECS },
  { name: "Object", colour: OBJECT, specs: OBJECT_SPECS },
];

// ---- registration --------------------------------------------------------

let registered = false;

export function registerLodashBlocks(): void {
  if (registered) return;
  registered = true;

  const defs: object[] = [];
  for (const group of ALL) {
    for (const s of group.specs) {
      defs.push({
        type: s.type,
        message0: s.msg,
        args0: [
          ...s.args.map((a) => ({ type: "input_value", name: a.name })),
          ...(s.fields ?? []).map((fl) => ({
            type: "field_dropdown",
            name: fl.name,
            options: fl.options,
          })),
        ],
        output: null,
        inputsInline: true,
        colour: s.colour,
        tooltip: s.tip,
      });
      pythonGenerator.forBlock[s.type] = (block) => {
        const v = (name: string) => {
          const arg = s.args.find((a) => a.name === name)!;
          return pythonGenerator.valueToCode(block, name, Order.NONE) || arg.def;
        };
        const f = (name: string) => block.getFieldValue(name) as string;
        return [s.gen(v, f), Order.ATOMIC];
      };
    }
  }
  Blockly.common.defineBlocksWithJsonArray(defs);
}

function entryFor(s: Spec): object {
  const inputs: Record<string, object> = {};
  for (const a of s.args) {
    if (a.shadow === undefined) continue;
    inputs[a.name] =
      typeof a.shadow === "number"
        ? { shadow: { type: "math_number", fields: { NUM: a.shadow } } }
        : { shadow: { type: "text", fields: { TEXT: a.shadow } } };
  }
  return Object.keys(inputs).length
    ? { kind: "block", type: s.type, inputs }
    : { kind: "block", type: s.type };
}

const FOLDED = new Set(["Array", "Collection", "Object", "String"]);

/** Standalone categories (Number); the rest fold into existing categories. */
export function lodashCategories(): object[] {
  return ALL.filter((g) => !FOLDED.has(g.name)).map((group) => ({
    kind: "category",
    name: group.name,
    colour: group.colour,
    contents: group.specs.map(entryFor),
  }));
}

function extrasFor(...names: string[]): object[] {
  return ALL.filter((g) => names.includes(g.name)).flatMap((g) => g.specs.map(entryFor));
}

/** Block entries for Array + Collection helpers, folded into the Lists category. */
export function listCategoryExtras(): object[] {
  return extrasFor("Array", "Collection");
}

/** Block entries for Object helpers, folded into the Objects category. */
export function objectCategoryExtras(): object[] {
  return extrasFor("Object");
}

/** Block entries for String helpers, folded into the Text category. */
export function textCategoryExtras(): object[] {
  return extrasFor("String");
}
