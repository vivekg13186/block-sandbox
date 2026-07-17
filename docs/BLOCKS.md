# Block Sandbox — Block Guide

This guide covers the blocks Block Sandbox adds on top of the standard Blockly
categories (Logic, Loops, Math, Text, Lists, Variables, Functions). Every block
compiles to Python; where useful the generated shape is shown.

Two conventions used below:

- **value block** — has a left/right plug; produces a value you plug into another
  block's socket.
- **statement block** — stacks vertically in the flow (has top/bottom
  connectors); runs an action.

---

## Module structure blocks

These come from your module's own definition (Overview tab) and from the other
modules in your project.

**Inputs** — one getter (value) block per declared input. Drop it wherever you
need that input's value. A module input named `url` becomes a `url` block.

**Outputs** — one setter (statement) block per declared output: `set output
result = …`. Assigning an output is how a module returns data.

**Modules** — every *other* module appears as a callable **value block**. Its
sockets are that module's inputs; the block's value is that module's output. This
is how flows compose: build small modules and call them from bigger ones. Nested
folders become nested sub-categories so the list stays manageable.

---

## Script

**`python`** *(statement)* — write raw Python statements that are injected into
the module's generated function at that point in the flow. Click the block to
open the code editor.

Inside it you can read inputs by name, set outputs by assigning them, and use
variables from surrounding blocks:

```python
total = sum(item["price"] for item in data)
result = {"count": len(data), "total": total}
```

It's statements, not an expression, so you can't plug it into a socket — hand
values onward by setting an output or a variable. Indentation is normalized:
write at the left margin and it's re-indented for wherever the block sits.

Use the script block for a small code escape inside an otherwise visual flow;
use a whole **script module** when the entire unit is better as code.

---

## Objects

**`object`** *(value, mutator)* — build a dict from `name : value` rows. Click the
gear icon to add/remove rows; each row is a key (text) and a value socket.

```
object { q: term, page: 2 }   ->   {"q": term, "page": 2}
```

Great for HTTP query params, headers, or a JSON body. Empty keys are skipped.

**`transform`** *(value, mutator)* — map an object, or a list of objects, to a new
shape. Each row is `from → to`. It auto-detects: a single object in → a single
object out; a list in → a list out (one transform per item).

- In the **from** field, a plain key looks that field up.
- Prefix **from** with `=` to write an expression over the current item `a`:
  `=a.num1 + a.num2`, `=len(a.arr)`, `=a.addr.city`, `=a.items[0].x`. Field access
  wins over dict methods, and missing fields yield `None`.

```
transform data:  userId → id,  =a.first + " " + a.last → name
```

**`empty object`** — a literal `{}`.

**`get path … of …` / `set path … of … to …`** — read or write a nested value by
dotted path, e.g. `address.line1`. `set path` creates intermediate objects as
needed.

**`keys of` / `values of`** — the object's keys or values as a list.

**`has key`, `merge A and B`, `invert`, `entries of`** — membership test, shallow
merge (B wins), swap keys/values, and a list of `[key, value]` pairs.

---

## Lists

Standard list blocks (`create list with`, `length of`, `is empty`, `in list get
/ set`) plus:

**Reshape** — `sort` (scalars), `sort … by key … ascending/descending` (list of
objects), `reverse`, `uniq`, `take first N`, `slice from A to B`, `chunk`,
`compact` (drop falsy), `flatten`, `concat`, `difference`, `intersection`,
`range`.

**Search** —

- **`filter <list> where key <k> <op> <value>`** — all matching items.
- **`find in <list> where key <k> <op> <value>`** — first match (or `None`).

The operator is a dropdown: `is`, `is not`, `contains`, `>`, `<`, `≥`, `≤`. For a
list of objects, put the field name in `key`; leave `key` empty to test each item
directly. `contains` is substring match on text, membership on lists/dicts.

**Aggregates** — `sum`, `min`, `max`, `mean`, each with an optional **by key**:

```
sum of orders by key "price"     # fold a field across a list of objects
sum of [3, 1, 4] by key ""       # plain number list (key empty)
```

`sum`/`mean` ignore non-numeric and missing values; `min`/`max` skip `None`.

---

## Numbers

`clamp`, `in range`, `abs`, `ceil`, `floor`, `parse int`. (Rounding and random
integers use the standard **Math** category.)

---

## Text

Standard text blocks plus: **`code`** (a value edited in a syntax-highlighted
editor — JSON / XML / Python / JS / text), **`new uuid`**, **`base64 encode` /
`base64 decode`**, **`join url … / …`** and **`join path … / …`** (safe URL/path
joins), and string helpers **`capitalize`, `starts with`, `ends with`,
`contains`, `split by`, `repeat`, `pad start/end`, `snake case`, `kebab case`**.

---

## JSON

**`parse JSON`** (`json.loads`) and **`JSON of`** (`json.dumps`). To read a field,
use the Objects **`get path`** block.

---

## Files

**`read file` / `write … to file` / `append … to file`** (text), **`read JSON
file` / `write JSON to file`**, **`file exists`, `list dir`, `delete file`**.

For tabular data: **`read rows from`** loads a CSV or `.xlsx` into a list of row
objects keyed by header; **`write excel`** writes a list of rows (with optional
headers and sheet name); **`for each row … in file … do`** iterates a table file's
rows. (For an in-memory list, use the standard **`for each item in list`** loop.)

Excel/CSV blocks pull in `openpyxl` automatically when you run them.

---

## HTTP

**`HTTP <method> <url>`** *(value)* — the main request block. Rows:

- **query params** — an object like `{q: "term", page: 2}` (URL-encoded onto the
  query string).
- **headers** / **body** — objects; a dict/list body is sent as JSON, otherwise
  as raw data.
- **auth** — plug the **`basic auth user … password …`** block, or a token.
- **verify ssl** — checkbox (off by default; warnings are suppressed).

It returns `{status, ok, data, text}`. Pull fields out with **`status of`**,
**`body of`** (parsed JSON, or text if not JSON), and **`ok of`** (2xx).

`requests` is installed automatically on run. Combine with the **`object`** block
to build params/headers/body cleanly.

---

## XML / HTML

Extract or set values by selector, for both XML and HTML:

- **XPath** — `get … from XML`, `get all … from XML`, `set … in XML`.
- **CSS selector** — `get … `, `get all …`, `attr … of …`, `set …`.

These use `lxml` (+ `cssselect` for the CSS variants), installed automatically.

---

## Environment, Assert, Debug

**`env var <name>`** — read a variable from the active environment (managed in the
Environments dialog; pick the active one in the Run/Dashboard bar).

**`assert true`, `assert … equals …`** — fail the run with a message if a
condition doesn't hold; handy for tests.

**`log …` / `log <label> = …`** — print to the Run output for debugging.

---

## Widgets (dashboards)

Only shown for **dashboard** modules. Each widget block appends a tile to the
dashboard; data comes from ordinary blocks (module calls, HTTP, read rows, …).

- **`table widget`** — a list of objects → a sortable, reorderable table with CSV
  export.
- **`metric widget`** — a single value as a big number.
- **`text widget`** / **`json widget`** / **`html widget`** — text, pretty JSON,
  or rendered HTML.
- **`<bar|line|area|pie> chart widget`** — a list of `{label, value}` (or a plain
  object) → a chart.

Running the dashboard produces the tiles; the Dashboard tab renders them and can
refresh on demand or on an interval.

---

## Handy extras (not blocks)

- **Copy/paste across diagrams** — right-click a block → *Copy block(s) —
  shared*; right-click another diagram's canvas → *Paste block(s) — shared*.
  Backed by a shared clipboard, so it works across tabs.
- **Export blocks as an image** — the image button in the Diagram toolbar saves a
  PNG of the canvas.
- **Export a table** — the CSV button on any table widget.
