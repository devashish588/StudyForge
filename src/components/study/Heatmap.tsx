"use client";

import React, { useMemo } from "react";
import { PROGRAM_START_STR, PROGRAM_END_STR, parseDateStr, toDateStr, minutesToHM } from "@/lib/date";
import { intensityLevel } from "@/lib/study";

export interface HeatDay {
  date: string;
  minutes: number;
  gate?: number;
  roadmap?: number;
  revision?: number;
}

const LEVEL_BG = [
  "bg-border/30 border-border/40",
  "bg-indigo-950 border-indigo-900",
  "bg-indigo-800 border-indigo-700",
  "bg-indigo-600 border-indigo-500",
  "bg-emerald-600 border-emerald-500",
  "bg-emerald-400 border-emerald-300",
];

export function ContributionCalendar({ days, onSelect, start, end }: { days: HeatDay[]; onSelect?: (d: HeatDay) => void; start?: string; end?: string }) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const rangeStart = start ?? PROGRAM_START_STR;
  const rangeEnd = end ?? PROGRAM_END_STR;

  const weeks = useMemo(() => {
    const out: string[][] = [];
    let cursor = parseDateStr(rangeStart);
    // align to Monday
    const dow = (cursor.getDay() + 6) % 7;
    cursor.setDate(cursor.getDate() - dow);
    const end = parseDateStr(rangeEnd);
    while (cursor <= end) {
      const week: string[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(toDateStr(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      out.push(week);
      if (out.length > 22) break;
    }
    return out;
  }, [rangeStart, rangeEnd]);

  const [hover, setHover] = React.useState<HeatDay | null>(null);

  return (
    <div className="relative">
      <div className="flex gap-1 overflow-x-auto pb-2">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1 shrink-0">
            {week.map((ds) => {
              const inWindow = ds >= rangeStart && ds <= rangeEnd;
              const d = byDate.get(ds);
              const mins = d?.minutes ?? 0;
              const lvl = intensityLevel(mins);
              return (
                <button
                  key={ds}
                  disabled={!inWindow}
                  onMouseEnter={() => d && setHover(d)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => d && setHover(d)}
                  onClick={() => d && onSelect?.(d)}
                  title={inWindow ? `${ds}: ${minutesToHM(mins)}` : ds}
                  className={`w-3.5 h-3.5 rounded-[4px] border transition hover:scale-110 ${inWindow ? LEVEL_BG[lvl] : "opacity-0"}`}
                  aria-label={`${ds} ${minutesToHM(mins)} studied`}
                />
              );
            })}
          </div>
        ))}
      </div>
      {hover && (
        <div className="mt-2 p-3 rounded-xl bg-card border border-border text-xs space-y-1 shadow-lg">
          <p className="font-bold text-card-foreground">{hover.date}</p>
          <p className="text-gray-300">Study: <span className="font-bold text-emerald-400">{minutesToHM(hover.minutes)}</span></p>
          <p className="text-gray-400">GATE: {minutesToHM(hover.gate ?? 0)} • Roadmap: {minutesToHM(hover.roadmap ?? 0)} • Revision: {minutesToHM(hover.revision ?? 0)}</p>
        </div>
      )}
      <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-500">
        <span>Less</span>
        {LEVEL_BG.map((c, i) => <span key={i} className={`w-3 h-3 rounded-[3px] border ${c}`} />)}
        <span>8h+ target</span>
      </div>
    </div>
  );
}
