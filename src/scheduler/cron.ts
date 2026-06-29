// Minimal 5-field cron: "minute hour day-of-month month day-of-week".
// Supports *, lists (1,2), ranges (1-5), steps (*/5), and @macros.
// Day-of-week: 0-6 with Sunday=0 (7 also accepted). Standard cron dom/dow rule:
// when both are restricted, a tick matches if EITHER matches.

const MACROS: Record<string, string> = {
  "@hourly": "0 * * * *",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@weekly": "0 0 * * 0",
  "@monthly": "0 0 1 * *",
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
};

export const CRON_PRESETS: { label: string; cron: string }[] = [
  { label: "Every minute", cron: "* * * * *" },
  { label: "Every 5 minutes", cron: "*/5 * * * *" },
  { label: "Every 30 minutes", cron: "*/30 * * * *" },
  { label: "Hourly", cron: "0 * * * *" },
  { label: "Daily 09:00", cron: "0 9 * * *" },
  { label: "Weekdays 09:00", cron: "0 9 * * 1-5" },
  { label: "Weekly (Sun 09:00)", cron: "0 9 * * 0" },
  { label: "Monthly (1st 09:00)", cron: "0 9 1 * *" },
];

function expand(expr: string): string {
  return MACROS[expr.trim()] ?? expr.trim();
}

function parseField(field: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  for (const part of field.split(",")) {
    const [range, stepStr] = part.split("/");
    const step = stepStr ? parseInt(stepStr, 10) : 1;
    if (!Number.isFinite(step) || step < 1) continue;
    let lo: number;
    let hi: number;
    if (range === "*" || range === "") {
      lo = min;
      hi = max;
    } else if (range.includes("-")) {
      const [a, b] = range.split("-").map(Number);
      lo = a;
      hi = b;
    } else {
      lo = hi = Number(range);
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue;
    for (let v = lo; v <= hi; v += step) {
      if (v >= min && v <= max) out.add(v);
    }
  }
  return out;
}

export function isValidCron(expr: string): boolean {
  const parts = expand(expr).split(/\s+/);
  if (parts.length !== 5) return false;
  try {
    parseField(parts[0], 0, 59);
    return true;
  } catch {
    return false;
  }
}

export function cronMatches(expr: string, date: Date): boolean {
  const parts = expand(expr).split(/\s+/);
  if (parts.length !== 5) return false;
  const [minF, hourF, domF, monF, dowF] = parts;

  const minutes = parseField(minF, 0, 59);
  const hours = parseField(hourF, 0, 23);
  const doms = parseField(domF, 1, 31);
  const months = parseField(monF, 1, 12);
  // Normalize Sunday: accept 7 as 0.
  const dows = new Set([...parseField(dowF, 0, 7)].map((d) => (d === 7 ? 0 : d)));

  if (!minutes.has(date.getMinutes())) return false;
  if (!hours.has(date.getHours())) return false;
  if (!months.has(date.getMonth() + 1)) return false;

  const domRestricted = domF.trim() !== "*";
  const dowRestricted = dowF.trim() !== "*";
  const domOk = doms.has(date.getDate());
  const dowOk = dows.has(date.getDay());

  if (domRestricted && dowRestricted) return domOk || dowOk;
  if (domRestricted) return domOk;
  if (dowRestricted) return dowOk;
  return true;
}

/** Next time (after `from`) the expression fires, scanning minute by minute. */
export function nextFire(expr: string, from: Date = new Date()): Date | null {
  if (!isValidCron(expr)) return null;
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  const limit = 366 * 24 * 60; // up to a year of minutes
  for (let i = 0; i < limit; i++) {
    if (cronMatches(expr, d)) return new Date(d.getTime());
    d.setMinutes(d.getMinutes() + 1);
  }
  return null;
}
