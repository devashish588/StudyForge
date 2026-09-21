"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar as CalendarIcon, X, Flame, CheckCircle2 } from "lucide-react";
import { PageShell, PageHeader, StatusBadge, ErrorState, PageSkeleton } from "@/components/study/ui";
import { PROGRAM_START_STR, PROGRAM_END_STR, todayStr, minutesToHM, formatDisplay, getProgramDay, getProgramStatus } from "@/lib/date";
import { intensityLevel } from "@/lib/study";
import { cn } from "@/lib/cn";

interface Task { id: string; title: string; category: string; assignedDate: string; status: string }
interface Heat { date: string; minutes: number; gate: number; roadmap: number; revision: number }
interface DayDetail {
  date: string; actualMinutes: number; gateMinutes: number; roadmapMinutes: number;
  practiceMinutes: number; revisionMinutes: number; problemsSolved: number;
  coreDayCompleted: boolean; restDay: boolean;
  notes?: string | null; dailyReflection?: string | null;
}

const MONTHS = ["August", "September", "October", "November", "December"];

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [heat, setHeat] = useState<Heat[]>([]);
  const [month, setMonth] = useState(8);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const today = todayStr();

  const fetchAll = async () => {
    try {
      setLoadError(null);
      const [tRes, aRes] = await Promise.all([fetch("/api/tasks"), fetch("/api/analytics")]);
      if (!tRes.ok) throw new Error("Calendar data failed to load");
      setTasks(await tRes.json() || []);
      if (aRes.ok) {
        const a = await aRes.json();
        setHeat(a.heatmap || []);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openDay = async (dateStr: string) => {
    setSelected(dateStr);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/study-day?date=${dateStr}`);
      if (res.ok) setDetail(await res.json());
    } catch (e) { console.error(e); } finally { setDetailLoading(false); }
  };

  if (loading) return <PageSkeleton />;
  if (loadError) return <PageShell wide><ErrorState message={loadError} onRetry={fetchAll} /></PageShell>;

  const heatByDate = new Map(heat.map((h) => [h.date, h]));
  const year = 2026;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const selTasks = selected ? tasks.filter((t) => t.assignedDate === selected) : [];

  return (
    <PageShell wide>
      <PageHeader
        icon={<CalendarIcon className="w-7 h-7 text-accent" />}
        title="Study Calendar"
        sub="Sep 24 → Dec 31 • Day 1 = Sep 24 • intensity = actual focused minutes • select any day for detail."
        actions={
          <div className="flex flex-wrap gap-2">
            {MONTHS.map((m, i) => (
              <button key={m} onClick={() => setMonth(7 + i)}
                className={cn("rounded-lg border px-3 py-1.5 text-xs font-bold transition",
                  month === 7 + i ? "border-accent bg-accent text-white" : "border-border bg-card text-gray-400")}>
                {m.slice(0, 3)}
              </button>
            ))}
          </div>
        }
      />

      <div className={cn("grid grid-cols-1 gap-6", selected && "lg:grid-cols-3")}>
        <div className={cn("overflow-hidden rounded-xl border border-border bg-card", selected && "lg:col-span-2")}>
          <div className="grid grid-cols-7 border-b border-border bg-border/20 py-3 text-center text-xs font-bold text-gray-400">
            <div>MON</div><div>TUE</div><div>WED</div><div>THU</div><div>FRI</div><div>SAT</div><div>SUN</div>
          </div>
          <div className="grid grid-cols-7 border-collapse">
            {cells.map((dayNum, idx) => {
              if (!dayNum) return <div key={idx} className="min-h-[84px] bg-background/40 md:min-h-[110px]" />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
              const outOfRange = dateStr < PROGRAM_START_STR || dateStr > PROGRAM_END_STR;
              const isDayOne = dateStr === PROGRAM_START_STR;
              const dayTasks = tasks.filter((t) => t.assignedDate === dateStr);
              const mins = heatByDate.get(dateStr)?.minutes ?? 0;
              const lvl = intensityLevel(mins);
              const lvlBg = ["", "ring-1 ring-inset ring-indigo-800", "ring-1 ring-inset ring-indigo-600 bg-indigo-950/40", "ring-1 ring-inset ring-indigo-500 bg-indigo-900/40", "ring-1 ring-inset ring-emerald-500 bg-emerald-950/40", "ring-1 ring-inset ring-emerald-300 bg-emerald-900/50"][lvl];
              const isToday = dateStr === today;
              const isSel = dateStr === selected;
              return (
                <button key={idx} onClick={() => openDay(dateStr)} disabled={outOfRange}
                  className={cn("flex min-h-[84px] flex-col justify-between border border-border/40 p-1.5 text-left transition md:min-h-[110px] md:p-2",
                    isToday ? "border-accent bg-accent/10" : "hover:bg-border/20",
                    outOfRange && "opacity-25", lvlBg, isSel && "outline outline-2 outline-accent")}>
                  <span className="flex items-center justify-between">
                    <span className={cn("text-xs font-bold", isToday ? "text-accent" : "text-gray-400")}>{dayNum}</span>
                    {isToday && <span className="rounded bg-accent px-1 text-[9px] font-extrabold text-white">TODAY</span>}
                    {!isToday && isDayOne && <span className="rounded bg-emerald-500/20 border border-emerald-500/40 px-1 text-[9px] font-extrabold text-emerald-300">DAY 1</span>}
                  </span>
                  <span className="mt-2 flex items-center gap-1.5">
                    {mins > 0 ? (
                      <>
                        <span className={`h-2 w-2 shrink-0 rounded-full ${lvl >= 4 ? "bg-emerald-400" : "bg-indigo-400"}`} aria-hidden />
                        <span className="truncate font-mono text-[11px] text-gray-300">{minutesToHM(mins)}</span>
                      </>
                    ) : dayTasks.length > 0 ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-gray-600" aria-hidden />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selected && (
          <div className="rounded-xl border border-border bg-card p-5 animate-fadeIn lg:sticky lg:top-4 lg:self-start">
            <div className="mb-3 flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-card-foreground">{formatDisplay(selected)}</h2>
                {getProgramStatus(selected) === "active" && (
                  <p className="mt-0.5 font-mono text-[11px] text-gray-500">Day {getProgramDay(selected)} / 99</p>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg border border-border p-1.5 text-gray-400 hover:text-white" aria-label="Close day detail">
                <X className="h-4 w-4" />
              </button>
            </div>
            {detailLoading ? (
              <div className="h-40 animate-pulse rounded-xl bg-border/30" />
            ) : detail ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2">
                  {detail.coreDayCompleted
                    ? <span className="flex items-center gap-1.5 font-bold text-emerald-400"><Flame className="h-4 w-4" /> STREAK DAY</span>
                    : detail.restDay
                    ? <StatusBadge tone="gray">rest day</StatusBadge>
                    : detail.actualMinutes > 0
                    ? <StatusBadge tone="amber">partial day</StatusBadge>
                    : <StatusBadge tone="gray">no activity</StatusBadge>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border/40 bg-border/20 p-2.5"><p className="text-[10px] text-gray-500">Study</p><p className="text-base font-black text-white">{minutesToHM(detail.actualMinutes)}</p></div>
                  <div className="rounded-lg border border-border/40 bg-border/20 p-2.5"><p className="text-[10px] text-gray-500">Problems</p><p className="text-base font-black text-white">{detail.problemsSolved}</p></div>
                  <div className="rounded-lg border border-border/40 bg-border/20 p-2.5"><p className="text-[10px] text-gray-500">GATE</p><p className="text-base font-black text-purple-300">{minutesToHM(detail.gateMinutes)}</p></div>
                  <div className="rounded-lg border border-border/40 bg-border/20 p-2.5"><p className="text-[10px] text-gray-500">Roadmap</p><p className="text-base font-black text-blue-300">{minutesToHM(detail.roadmapMinutes)}</p></div>
                  <div className="rounded-lg border border-border/40 bg-border/20 p-2.5"><p className="text-[10px] text-gray-500">Revision</p><p className="text-base font-black text-emerald-300">{minutesToHM(detail.revisionMinutes)}</p></div>
                  <div className="rounded-lg border border-border/40 bg-border/20 p-2.5"><p className="text-[10px] text-gray-500">Core day</p><p className="flex items-center gap-1 text-base font-black text-white">{detail.coreDayCompleted ? <><CheckCircle2 className="h-4 w-4 text-emerald-400" /> ✓</> : "—"}</p></div>
                </div>
                <div className="rounded-lg border border-border/40 bg-border/20 p-2.5"><p className="text-[10px] text-gray-500">Practice</p><p className="text-base font-black text-amber-300">{minutesToHM(detail.practiceMinutes)}</p></div>
                {(detail.notes || detail.dailyReflection) && (
                  <p className="rounded-lg bg-border/20 p-2 text-[11px] italic text-gray-400">
                    {detail.notes}{detail.dailyReflection ? ` — “${detail.dailyReflection}”` : ""}
                  </p>
                )}
                {selTasks.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Roadmap tasks</p>
                    <div className="space-y-1">
                      {selTasks.map((t) => (
                        <Link key={t.id} href={`/roadmap/task/${t.id}`} className="block truncate rounded-lg border border-border/40 bg-border/20 p-2 font-semibold text-gray-200 hover:border-blue-500/40">
                          {t.title} <span className="font-normal text-gray-500">• {t.status.toLowerCase()}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {selected === today && (
                  <Link href="/today" className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-xs font-bold text-white hover:bg-accent-hover">
                    Open Today →
                  </Link>
                )}
              </div>
            ) : (
              <p className="py-6 text-center text-xs text-gray-500">No data for this day yet.</p>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
