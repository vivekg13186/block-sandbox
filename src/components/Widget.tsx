import { useEffect, useRef, useState, type ReactNode } from "react";
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
  type: "table" | "metric" | "text" | "chart" | "json" | "html";
  title?: string;
  // table
  rows?: unknown;
  // metric
  value?: unknown;
  // text
  text?: unknown;
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

export default function Widget({ spec }: { spec: WidgetSpec }) {
  const title = spec.title || "";

  let body: ReactNode;
  switch (spec.type) {
    case "metric":
      body = <div className="w-metric">{cell(spec.value)}</div>;
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
      const cols = columns(rows);
      body = rows.length ? (
        <div className="w-table-wrap">
          <table className="w-table">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c}>{cell(r[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No rows.</p>
      );
    }
  }

  return (
    <div className={`widget widget-${spec.type}`}>
      {title && <div className="widget-title">{title}</div>}
      <div className="widget-body">{body}</div>
    </div>
  );
}
