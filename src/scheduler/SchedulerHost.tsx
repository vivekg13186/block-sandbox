import { useEffect, useRef } from "react";
import { loadSchedules } from "../storage/schedules";
import { listModules } from "../storage/modules";
import { cronMatches } from "./cron";
import { runSchedule } from "./runner";

/**
 * Headless component mounted at the app root. While the app is open it checks
 * every minute for due (enabled) schedules and runs them, guarding against
 * overlapping runs of the same schedule.
 */
export default function SchedulerHost() {
  const running = useRef<Set<string>>(new Set());
  const lastMinute = useRef<string>("");

  useEffect(() => {
    let stopped = false;

    const tick = async () => {
      const now = new Date();
      const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
      if (minuteKey === lastMinute.current) return; // once per wall-clock minute
      lastMinute.current = minuteKey;

      const schedules = await loadSchedules();
      const due = schedules.filter(
        (s) => s.enabled && s.moduleIds.length > 0 && !running.current.has(s.id) && cronMatches(s.cron, now)
      );
      if (!due.length) return;

      const modules = await listModules();
      for (const s of due) {
        if (stopped) break;
        running.current.add(s.id);
        runSchedule(s, modules).finally(() => running.current.delete(s.id));
      }
    };

    // Check frequently but act at most once per minute (handles sleep/wake drift).
    const interval = window.setInterval(tick, 15000);
    tick();

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
