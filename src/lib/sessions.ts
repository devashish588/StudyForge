// Session time-splitting (client-safe, no prisma).
// Application timezone: device-local. Day boundaries at local midnight.
import { toDateStr } from "./date";

export interface DateAllocation {
  date: string; // YYYY-MM-DD
  minutes: number;
}

function startOfDayMs(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/**
 * Split a wall-clock interval [startMs, endMs) across local calendar dates.
 * Minute-granular; rounding drift is absorbed by the final date so the
 * total always equals round((endMs - startMs) / 60000).
 *
 * - Same timestamp → [{ date, minutes: 0 }]
 * - End before start → treated as zero-length (defensive, never negative)
 */
export function splitSessionByDate(startMs: number, endMs: number): DateAllocation[] {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    const ref = Number.isFinite(startMs) ? startMs : Date.now();
    return [{ date: toDateStr(new Date(ref)), minutes: 0 }];
  }
  const totalMinutes = Math.round((endMs - startMs) / 60000);
  const out: DateAllocation[] = [];
  let cursor = startMs;
  let assigned = 0;
  while (cursor < endMs) {
    const dayEnd = startOfDayMs(new Date(cursor)).getTime() + 86400000;
    const sliceEnd = Math.min(dayEnd, endMs);
    const isLast = sliceEnd >= endMs;
    const mins = isLast
      ? totalMinutes - assigned
      : Math.round((sliceEnd - cursor) / 60000);
    out.push({ date: toDateStr(new Date(cursor)), minutes: Math.max(0, mins) });
    assigned += Math.max(0, mins);
    cursor = sliceEnd;
  }
  return out.filter((a) => a.minutes > 0 || out.length === 1);
}

/** Merge allocations from multiple running segments (pause-aware). */
export function mergeAllocations(segments: { startMs: number; endMs: number }[]): DateAllocation[] {
  const byDate = new Map<string, number>();
  for (const s of segments) {
    for (const a of splitSessionByDate(s.startMs, s.endMs)) {
      byDate.set(a.date, (byDate.get(a.date) ?? 0) + a.minutes);
    }
  }
  return [...byDate.entries()]
    .map(([date, minutes]) => ({ date, minutes }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
