"""Cron matching + a background thread that fires a callback each minute."""

import threading
from datetime import datetime
from typing import Callable

MACROS = {
    "@hourly": "0 * * * *",
    "@daily": "0 0 * * *",
    "@midnight": "0 0 * * *",
    "@weekly": "0 0 * * 0",
    "@monthly": "0 0 1 * *",
    "@yearly": "0 0 1 1 *",
    "@annually": "0 0 1 1 *",
}


def _parse_field(field: str, lo: int, hi: int) -> set[int]:
    out: set[int] = set()
    for part in field.split(","):
        rng, _, step_s = part.partition("/")
        step = int(step_s) if step_s else 1
        if step < 1:
            continue
        if rng in ("*", ""):
            a, b = lo, hi
        elif "-" in rng:
            sa, sb = rng.split("-", 1)
            a, b = int(sa), int(sb)
        else:
            a = b = int(rng)
        v = a
        while v <= b:
            if lo <= v <= hi:
                out.add(v)
            v += step
    return out


def cron_matches(expr: str, dt: datetime) -> bool:
    expr = MACROS.get((expr or "").strip(), (expr or "").strip())
    parts = expr.split()
    if len(parts) != 5:
        return False
    min_f, hour_f, dom_f, mon_f, dow_f = parts
    try:
        minutes = _parse_field(min_f, 0, 59)
        hours = _parse_field(hour_f, 0, 23)
        doms = _parse_field(dom_f, 1, 31)
        months = _parse_field(mon_f, 1, 12)
        dows = {0 if d == 7 else d for d in _parse_field(dow_f, 0, 7)}
    except ValueError:
        return False

    if dt.minute not in minutes:
        return False
    if dt.hour not in hours:
        return False
    if (dt.month) not in months:
        return False

    # Python weekday(): Mon=0..Sun=6; cron: Sun=0..Sat=6
    cron_dow = (dt.weekday() + 1) % 7
    dom_restricted = dom_f.strip() != "*"
    dow_restricted = dow_f.strip() != "*"
    dom_ok = dt.day in doms
    dow_ok = cron_dow in dows
    if dom_restricted and dow_restricted:
        return dom_ok or dow_ok
    if dom_restricted:
        return dom_ok
    if dow_restricted:
        return dow_ok
    return True


class MinuteTimer(threading.Thread):
    """Calls `callback(datetime)` at most once per wall-clock minute."""

    def __init__(self, callback: Callable[[datetime], None]):
        super().__init__(daemon=True)
        self.callback = callback
        self._stop = threading.Event()
        self._last: tuple | None = None

    def run(self) -> None:
        while not self._stop.is_set():
            now = datetime.now()
            key = (now.year, now.month, now.day, now.hour, now.minute)
            if key != self._last:
                self._last = key
                try:
                    self.callback(now)
                except Exception as e:  # never let the loop die
                    print(f"[scheduler] error: {e}")
            self._stop.wait(20)

    def stop(self) -> None:
        self._stop.set()
