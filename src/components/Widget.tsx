import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/** A render-spec emitted by a dashboard flow's widget blocks. */
export interface WidgetSpec {
  type:
    | "table"
    | "metric"
    | "stat"
    | "status"
    | "progress"
    | "list"
    | "text"
    | "alert"
    | "link"
    | "chart"
    | "json"
    | "html"
    | "section";
  title?: string;
  /** "" (auto) | "wide" (2 cols) | "full" (all cols). */
  size?: string;
  // table
  rows?: unknown;
  // metric / stat / status / progress
  value?: unknown;
  delta?: unknown;
  status?: string;
  max?: unknown;
  // list
  items?: unknown;
  // text / alert
  text?: unknown;
  level?: string;
  // link
  url?: unknown;
  // chart
  chart?: "bar" | "line" | "area" | "pie";
  data?: unknown;
  // html
  html?: unknown;
}

const PALETTE = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#a855f7",
  "#ef4444",
  "#84cc16",
];

/** Values from a flow may arrive already-parsed, or as a JSON string when they
 *  came through a text/code block. Coerce strings that look like JSON. */
function coerceJson(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s || !/^[[{]/.test(s)) return v;
  try {
    return JSON.parse(s);
  } catch {
    return v;
  }
}

function asRows(input: unknown): Record<string, unknown>[] {
  const v = coerceJson(input);
  if (!Array.isArray(v)) return [];
  return v.map((r) =>
    r && typeof r === "object" && !Array.isArray(r)
      ? (r as Record<string, unknown>)
      : { value: r }
  );
}

function columns(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  for (const r of rows.slice(0, 50)) for (const k of Object.keys(r)) seen.add(k);
  return [...seen];
}

function cell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function chartData(input: unknown): { name: string; value: number }[] {
  const v = coerceJson(input);
  // A plain object { Electronics: 1250, Books: 850 } → one bar per entry.
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return Object.entries(v as Record<string, unknown>).map(([name, raw]) => ({
      name: String(name),
      value: Number(raw) || 0,
    }));
  }
  if (!Array.isArray(v)) return [];
  return v.map((d, i) => {
    if (d && typeof d === "object" && !Array.isArray(d)) {
      const o = d as Record<string, unknown>;
      const name = o.label ?? o.name ?? o.x ?? o.key ?? String(i);
      const raw = o.value ?? o.y ?? o.count ?? 0;
      return { name: String(name), value: Number(raw) || 0 };
    }
    return { name: String(i), value: Number(d) || 0 };
  });
}

const CHART_H = 240;

/** Track the pixel width of an element (recharts needs explicit dimensions;
 *  ResponsiveContainer's observer can measure 0 inside hidden/flex panes). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width: w };
}

function Chart({ kind, data }: { kind: string; data: { name: string; value: number }[] }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const axis = { stroke: "var(--muted)", fontSize: 11 };
  const grid = <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />;
  const dims = { width, height: CHART_H };

  let chart: ReactNode = null;
  if (width > 0) {
    if (kind === "line") {
      chart = (
        <LineChart {...dims} data={data}>
          {grid}
          <XAxis dataKey="name" {...axis} />
          <YAxis {...axis} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke={PALETTE[0]} strokeWidth={2} dot={false} />
        </LineChart>
      );
    } else if (kind === "area") {
      chart = (
        <AreaChart {...dims} data={data}>
          {grid}
          <XAxis dataKey="name" {...axis} />
          <YAxis {...axis} />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke={PALETTE[0]} fill={PALETTE[0]} fillOpacity={0.25} />
        </AreaChart>
      );
    } else if (kind === "pie") {
      chart = (
        <PieChart {...dims}>
          <Tooltip />
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={CHART_H / 2 - 20} label>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
        </PieChart>
      );
    } else {
      chart = (
        <BarChart {...dims} data={data}>
          {grid}
          <XAxis dataKey="name" {...axis} />
          <YAxis {...axis} />
          <Tooltip />
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      );
    }
  }

  return (
    <div ref={ref} style={{ width: "100%", height: CHART_H }}>
      {chart}
    </div>
  );
}

/** Compare two cell values: numeric when both look like numbers, else text. */
function compareCells(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  const na = typeof a === "number" ? a : Number(a);
  const nb = typeof b === "number" ? b : Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && a !== "" && b !== "") return na - nb;
  return String(a).localeCompare(String(b));
}

/** Escape a value for a CSV cell. */
function csvCell(v: unknown): string {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(cols: string[], rows: Record<string, unknown>[], name: string): void {
  const lines = [cols.map(csvCell).join(",")];
  for (const r of rows) lines.push(cols.map((c) => csvCell(r[c])).join(","));
  // Prepend a BOM so Excel reads UTF-8 correctly.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(name || "table").replace(/[^\w.-]+/g, "_")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** A table with click-to-sort columns and drag-to-reorder headers. */
function TableWidget({ rows, title }: { rows: Record<string, unknown>[]; title?: string }) {
  const cols = useMemo(() => columns(rows), [rows]);
  const [order, setOrder] = useState<string[]>(cols);
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragCol = useRef<string | null>(null);
  const didDrag = useRef(false);

  // Reconcile saved order with the current columns (data may change on refresh):
  // keep known columns in their chosen order, append any new ones.
  const displayCols = useMemo(() => {
    const known = order.filter((c) => cols.includes(c));
    const extra = cols.filter((c) => !known.includes(c));
    return [...known, ...extra];
  }, [order, cols]);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const { col, dir } = sort;
    return [...rows].sort((a, b) => dir * compareCells(a[col], b[col]));
  }, [rows, sort]);

  const clickSort = (c: string) => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    setSort((prev) =>
      !prev || prev.col !== c ? { col: c, dir: 1 } : prev.dir === 1 ? { col: c, dir: -1 } : null
    );
  };

  const onDrop = (target: string) => {
    const from = dragCol.current;
    setDragOver(null);
    dragCol.current = null;
    if (!from || from === target) return;
    didDrag.current = true;
    const next = [...displayCols];
    next.splice(next.indexOf(from), 1);
    next.splice(next.indexOf(target), 0, from);
    setOrder(next);
  };

  return (
    <div className="w-table-outer">
      <div className="w-table-toolbar">
        <button
          className="w-csv-btn"
          title="Export table to CSV"
          onClick={() => downloadCsv(displayCols, sorted, title || "table")}
        >
          <Download size={13} /> CSV
        </button>
      </div>
      <div className="w-table-wrap">
      <table className="w-table">
        <thead>
          <tr>
            {displayCols.map((c) => (
              <th
                key={c}
                draggable
                className={dragOver === c ? "drag-over" : ""}
                onClick={() => clickSort(c)}
                onDragStart={() => {
                  dragCol.current = c;
                  didDrag.current = false;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOver !== c) setDragOver(c);
                }}
                onDragLeave={() => setDragOver((d) => (d === c ? null : d))}
                onDrop={() => onDrop(c)}
                title="Click to sort · drag to reorder"
              >
                <span className="th-label">{c}</span>
                <span className="th-sort">
                  {sort?.col === c ? (sort.dir === 1 ? "▲" : "▼") : ""}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={i}>
              {displayCols.map((c) => (
                <td key={c}>{cell(r[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isNaN(n) ? 0 : n;
}

export default function Widget({ spec }: { spec: WidgetSpec }) {
  const title = spec.title || "";
  const sizeClass = spec.size === "wide" || spec.size === "full" ? ` size-${spec.size}` : "";

  // Section header is a full-width divider, not a card.
  if (spec.type === "section") {
    return <div className="widget-section size-full">{title}</div>;
  }

  let body: ReactNode;
  switch (spec.type) {
    case "metric":
      body = <div className="w-metric">{cell(spec.value)}</div>;
      break;
    case "stat": {
      const d = num(spec.delta);
      const cls = d > 0 ? "up" : d < 0 ? "down" : "flat";
      const arrow = d > 0 ? "▲" : d < 0 ? "▼" : "→";
      body = (
        <div className="w-stat">
          <div className="w-metric">{cell(spec.value)}</div>
          {spec.delta != null && spec.delta !== "" && (
            <div className={`w-delta ${cls}`}>
              {arrow} {cell(spec.delta)}
            </div>
          )}
        </div>
      );
      break;
    }
    case "status": {
      const s = spec.status || "neutral";
      body = <span className={`w-badge badge-${s}`}>{cell(spec.value)}</span>;
      break;
    }
    case "progress": {
      const max = num(spec.max) || 100;
      const val = num(spec.value);
      const pct = Math.max(0, Math.min(100, (val / max) * 100));
      body = (
        <div className="w-progress">
          <div className="w-progress-bar">
            <div className="w-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="w-progress-label muted">
            {cell(spec.value)} / {cell(spec.max ?? 100)} ({Math.round(pct)}%)
          </div>
        </div>
      );
      break;
    }
    case "list": {
      const items = coerceJson(spec.items);
      const arr = Array.isArray(items) ? items : [];
      body = arr.length ? (
        <ul className="w-list">
          {arr.map((it, i) => (
            <li key={i}>{cell(it)}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">No items.</p>
      );
      break;
    }
    case "alert":
      body = <div className={`w-alert alert-${spec.level || "info"}`}>{cell(spec.text)}</div>;
      break;
    case "link":
      body = (
        <a className="w-link" href={cell(spec.url)} target="_blank" rel="noreferrer noopener">
          {title || "Open"} ↗
        </a>
      );
      break;
    case "text":
      body = <div className="w-text">{cell(spec.text)}</div>;
      break;
    case "json":
      body = (
        <pre className="w-json">
          {(() => {
            try {
              return JSON.stringify(spec.value, null, 2);
            } catch {
              return cell(spec.value);
            }
          })()}
        </pre>
      );
      break;
    case "html":
      body = (
        <div className="w-html" dangerouslySetInnerHTML={{ __html: cell(spec.html) }} />
      );
      break;
    case "chart": {
      const data = chartData(spec.data);
      body = data.length ? (
        <div className="w-chart">
          <Chart kind={spec.chart || "bar"} data={data} />
        </div>
      ) : (
        <p className="muted">No chart data.</p>
      );
      break;
    }
    case "table":
    default: {
      const rows = asRows(spec.rows);
      body = rows.length ? (
        <TableWidget rows={rows} title={spec.title} />
      ) : (
        <p className="muted">No rows.</p>
      );
    }
  }

  const showTitle = title && spec.type !== "link";
  return (
    <div className={`widget widget-${spec.type}${sizeClass}`}>
      {showTitle && <div className="widget-title">{title}</div>}
      <div className="widget-body">{body}</div>
    </div>
  );
}
