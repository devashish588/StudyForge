"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Clock, CheckCircle2, Circle, AlertTriangle, Calendar, Target, Layers } from "lucide-react";
import { PageShell, PageHeader, PlainSection, Tabs, ErrorState, PageSkeleton } from "@/components/study/ui";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { todayStr, addDays, diffDays, minutesToHM, formatDisplay } from "@/lib/date";
import { cn } from "@/lib/cn";

type Mode = "day" | "week" | "month";

interface PlannerDay {
  date: string;
  windows: { label: string; start: string; end: string; minutes: number }[];
  mission: {
    carryOver: { title: string; minutes: number }[];
    easyStart: { title: string; minutes: number; fitted?: boolean }[];
    hardDeepWork: { title: string; minutes: number; fitted?: boolean }[];
    easyApply: { title: string; minutes: number; fitted?: boolean }[];
    recall: { title: string; minutes: number; fitted?: boolean }[];
    totalPlannedMinutes: number; overflowMinutes: number;
    curriculum?: { targetDate: string; daysLeft: number; overall: { done: number; total: number; percent: number; remainingMinutes: number; requiredPerDay: number; status: string } };
  } | null;
  sessions: {
    id: string; label: string; start: string; end: string; duration: number;
    track: string; subject: string; topic: string; purpose: string;
    items: { id: string; title: string; minutes: number; done: boolean }[]; doneCount: number; totalCount: number;
  }[];
}

const TAB_LABELS = ["Day", "Week", "Month"] as const;

export default function PlannerPage() {
  const [mode, setMode] = useState<Mode>("day");
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoadError(null);
      setLoading(true);
      const res = await fetch(`/api/planner?mode=${mode}&date=${date}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Planner failed to load — retry.");
      setData(await res.json());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load planner");
    } finally { setLoading(false); }
  }, [mode, date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const goDay = (d: number) => setDate((prev) => addDays(prev, d));
  const goToday = () => setDate(todayStr());

  if (loading) return <PageSkeleton />;
  if (loadError) return <PageShell><ErrorState message={loadError} onRetry={fetchData} /></PageShell>;

  return (
    <PageShell>
      <PageHeader
        icon={<Layers className="w-7 h-7 text-accent" />}
        title="Planner"
        sub="Month → Week → Day → Session → subtopic. All from the same curriculum plan. Target: finish on time."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={goToday} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-gray-300">Today</button>
          </div>
        }
      />

      <div className="flex items-center justify-between gap-2">
        <Tabs tabs={TAB_LABELS as unknown as Mode[]} value={mode as unknown as Mode} onChange={(v) => setMode(v as unknown as Mode)} label="Planner view" />
        <div className="flex items-center gap-1">
          <button onClick={() => goDay(mode === "month" ? -30 : mode === "week" ? -7 : -1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-gray-400 hover:bg-border/40" aria-label="Previous">‹</button>
          <span className="min-w-[90px] text-center font-mono text-xs text-gray-400">{date}</span>
          <button onClick={() => goDay(mode === "month" ? 30 : mode === "week" ? 7 : 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-gray-400 hover:bg-border/40" aria-label="Next">›</button>
        </div>
      </div>

      {mode === "day" && <DayView data={data} date={date} />}
      {mode === "week" && <WeekView data={data} />}
      {mode === "month" && <MonthView data={data} />}
    </PageShell>
  );
}

function DayView({ data, date }: { data: PlannerDay & { mission?: PlannerDay["mission"]; curriculum?: PlannerDay["mission"] extends { curriculum?: infer C } ? C : never }; date: string }) {
  const mission = data.mission as PlannerDay["mission"] | null;
  const sessions = (data.sessions ?? []) as PlannerDay["sessions"];
  const curriculum = (mission as { curriculum?: { targetDate: string; overall: { done: number; total: number; percent: number; remainingMinutes: number; requiredPerDay: number; status: string } } } | null)?.curriculum ?? null;
  const fittedMin = (mission as { totalPlannedMinutes?: number } | null)?.totalPlannedMinutes ?? 0;
  const spare = Math.max(0, (data as { capacity?: number }).capacity ?? 360 - fittedMin);
  // Derive goals from fitted mission for the header summary
  const goals = (() => {
    if (!mission) return [];
    const fittedAll = [...((mission as { carryOver: { fitted?: boolean; kind?: string; track?: string; subjectName?: string }[] }).carryOver ?? []),
      ...((mission as { easyStart: { fitted?: boolean; kind?: string; track?: string; subjectName?: string }[] }).easyStart ?? []),
      ...((mission as { hardDeepWork: { fitted?: boolean; kind?: string; track?: string; subjectName?: string }[] }).hardDeepWork ?? []),
      ...((mission as { easyApply: { fitted?: boolean; kind?: string; track?: string; subjectName?: string }[] }).easyApply ?? []),
      ...((mission as { recall: { fitted?: boolean; kind?: string; track?: string; subjectName?: string }[] }).recall ?? [])] as { fitted?: boolean; kind?: string; track?: string; subjectName?: string }[];
    const fitted = fittedAll.filter((i) => i.fitted === true);
    const byKey = new Map<string, number>();
    for (const it of fitted) {
      const k = it.subjectName || it.track || it.kind || "Roadmap";
      byKey.set(k, (byKey.get(k) ?? 0) + 1);
    }
    return Array.from(byKey.entries()).map(([k, n]) => ({ key: k, count: n }));
  })();

  return (
    <div className="space-y-6">
      {/* Day header */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="type-label">Today — {formatDisplay(date)}</p>
        <p className="mt-2 text-sm text-gray-300">
          <span className="font-bold text-white">{minutesToHM((data as { capacity?: number }).capacity ?? 360)} target</span>
          {" · "}
          <span className="font-mono text-xs text-gray-400">{minutesToHM(fittedMin)} planned{spare > 0 ? ` · ${minutesToHM(spare)} spare` : ""} {mission?.overflowMinutes ? ` · ${minutesToHM(mission.overflowMinutes)} queued` : ""}</span>
        </p>
        {curriculum && (
          <p className="mt-1 text-xs text-gray-500">
            Curriculum {curriculum.overall.percent}% · {minutesToHM(curriculum.overall.remainingMinutes)} remaining · {minutesToHM(curriculum.overall.requiredPerDay)}/day required
            {" "}· target {curriculum.targetDate}
            {curriculum.overall.status !== "ON_TRACK" ? <span className={curriculum.overall.status === "OVERLOAD" ? " font-bold text-rose-400" : " font-bold text-amber-400"}> · {curriculum.overall.status.toLowerCase()}</span> : null}
          </p>
        )}
      </section>

      {/* Goals (checklist — reuses Today's goal logic, no duplication) */}
      <PlainSection title={`Today's goals · ${Math.min(5, Math.max(1, Math.ceil(fittedMin / 90)))} focus areas`}>
        {(() => {
          if (!mission) return <p className="text-sm text-gray-500">No mission planned for this day.</p>;
          const allFittedRaw = [...((mission as { carryOver: { fitted?: boolean }[] }).carryOver ?? []),
            ...((mission as { easyStart: { fitted?: boolean }[] }).easyStart ?? []),
            ...((mission as { hardDeepWork: { fitted?: boolean }[] }).hardDeepWork ?? []),
            ...((mission as { easyApply: { fitted?: boolean }[] }).easyApply ?? []),
            ...((mission as { recall: { fitted?: boolean }[] }).recall ?? [])] as { fitted?: boolean; kind: string; subjectName?: string; detail?: string; id: string; title: string; minutes: number; done: boolean }[];
          const allFitted = allFittedRaw.filter((i) => i.fitted === true);
          if (allFitted.length === 0) return <p className="text-sm text-gray-500">Nothing fitted — capacity is reserved or this day is outside the plan.</p>;
          const grouped = new Map<string, typeof allFitted>();
          for (const it of allFitted) {
            const k = it.subjectName || (it.detail?.split("·")[0]?.trim()) || it.kind;
            if (!grouped.has(k)) grouped.set(k, []);
            grouped.get(k)!.push(it);
          }
          return (
            <div className="space-y-3">
              {Array.from(grouped.entries()).map(([k, items]) => (
                <div key={k} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{k}</p>
                  <ul className="mt-2 space-y-1">
                    {items.map((it: { id: string; title: string; minutes: number; done: boolean }) => (
                      <li key={it.id} className="flex items-center gap-2 text-sm">
                        <span className={it.done ? "text-emerald-400" : "text-gray-600"}>{it.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</span>
                        <span className={`flex-1 truncate ${it.done ? "text-gray-500 line-through" : "text-gray-200"}`}>{it.title}</span>
                        <span className="font-mono text-xs text-gray-500">{it.minutes}m</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          );
        })()}
        <p className="mt-3 text-xs text-gray-500">Same fitted work as <Link href="/today" className="font-bold text-accent hover:underline">Today</Link> — checking here updates the same canonical progress. <Link href={`/calendar?date=${date}`} className="text-gray-400 hover:text-gray-200">Calendar →</Link></p>
      </PlainSection>

      {/* Session schedule (clock times from study windows) */}
      <PlainSection title="Session schedule" action={<Link href="/settings" className="text-xs font-bold text-gray-400 hover:text-gray-200">Study windows →</Link>}>
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-500">No sessions — this day has no configured study windows or no fitted work.</p>
        ) : (
          <ol className="space-y-3">
            {sessions.map((s) => (
              <li key={s.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-xs font-bold text-accent">{s.start}–{s.end} · {s.label}</p>
                  <StatusBadge tone={s.doneCount === s.totalCount && s.totalCount > 0 ? "green" : s.doneCount > 0 ? "amber" : "gray"}>
                    {s.doneCount}/{s.totalCount} {s.purpose.toLowerCase()}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-sm font-bold text-white">{s.track} — {s.subject}</p>
                <p className="text-xs text-gray-400">{s.topic}</p>
                <ul className="mt-2 space-y-1">
                  {s.items.map((it) => (
                    <li key={it.id} className="flex items-center gap-2 text-xs">
                      <span className={it.done ? "text-emerald-400" : "text-gray-600"}>{it.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}</span>
                      <span className={`flex-1 truncate ${it.done ? "text-gray-500 line-through" : "text-gray-300"}`}>{it.title}</span>
                      <span className="font-mono text-[11px] text-gray-500">{it.minutes}m</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-[11px] text-gray-500">Windows come from Settings → Study windows. Hard topics keep long contiguous blocks; light topics are packed. Capacity: 6h normal / 7h good / 8h stretch.</p>
      </PlainSection>

      <div className="flex flex-wrap gap-2">
        <Link href="/today" className="rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-white hover:bg-accent-hover">Open Today checklist</Link>
        <Link href="/print" className="rounded-xl border border-border bg-border/30 px-5 py-2.5 text-xs font-bold text-gray-300">Print this day</Link>
      </div>
    </div>
  );
}

function WeekView({ data }: { data: { weeks: { weekLabel: string; weekStart: string; weekEnd: string; days: { date: string; isToday: boolean; isPast: boolean; targetMinutes: number; plannedMinutes: number; actualMinutes?: number; completionPercent?: number; goals?: { eyebrow: string; title: string; subs: { title: string; done: boolean }[]; doneCount: number; totalCount: number }[] }[]; targetMinutes: number; trackMinutes: Record<string, number>; milestone: string; status: string }[] } }) {
  const weeks = data.weeks ?? [];
  const current = weeks[0];
  if (!current) return <p className="text-sm text-gray-500">No weekly plan available.</p>;
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="type-label">Week of {current.weekLabel}</p>
        <p className="mt-1 text-sm text-gray-300">{minutesToHM(current.targetMinutes)} weekly target · {current.milestone}</p>
        <p className="mt-1 font-mono text-xs text-gray-500">{current.weekStart} → {current.weekEnd} · {current.status.toLowerCase()}</p>
        {(current as { curriculum?: { overall: { remainingMinutes: number; requiredPerDay: number; status: string } } }).curriculum && (
          <p className="mt-1 text-xs text-gray-500">Curriculum { (current as unknown as { curriculum: { overall: { percent: number } } }).curriculum.overall.percent}% · {minutesToHM((current as unknown as { curriculum: { overall: { remainingMinutes: number } } }).curriculum.overall.remainingMinutes)} remaining · {minutesToHM((current as unknown as { curriculum: { overall: { requiredPerDay: number } } }).curriculum.overall.requiredPerDay)}/day required</p>
        )}
      </section>
      <PlainSection title="7-day schedule — actual goals per day">
        <div className="space-y-3">
          {current.days.map((d) => {
            const dayGoals = (d as { goals?: { eyebrow: string; title: string; subs: { title: string; done: boolean }[] }[] }).goals ?? [];
            const isPast = (d as { isPast?: boolean }).isPast;
            const isToday = (d as { isToday?: boolean }).isToday;
            return (
              <div key={d.date} className={cn("rounded-xl border p-4", isToday ? "border-accent bg-accent/5" : isPast ? "border-border/50 bg-card/50 opacity-80" : "border-border bg-card")}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-white">{new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} {isToday && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">TODAY</span>}</p>
                  <p className="font-mono text-xs text-gray-500">{minutesToHM(d.plannedMinutes)} planned{(d as { actualMinutes?: number }).actualMinutes ? ` · ${minutesToHM((d as { actualMinutes?: number }).actualMinutes as number)} actual` : ""}</p>
                </div>
                {dayGoals.length === 0 ? (
                  <p className="mt-2 text-xs text-gray-500">{isPast ? "Rest / no plan — completion counted." : "No fitted goals — capacity reserved."}</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {dayGoals.slice(0, 4).map((g) => (
                      <li key={g.eyebrow + g.title} className="rounded-lg border border-border/50 bg-border/10 px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{g.eyebrow} — {g.title}</p>
                        <ul className="mt-1 space-y-0.5">
                          {g.subs.slice(0, 3).map((s) => (
                            <li key={s.title} className="flex items-center gap-1.5 text-xs">
                              <span className={s.done ? "text-emerald-400" : "text-gray-600"}>{s.done ? "☑" : "☐"}</span>
                              <span className={s.done ? "text-gray-500 line-through" : "text-gray-300"}>{s.title}</span>
                            </li>
                          ))}
                          {g.subs.length > 3 && <li className="text-[11px] text-gray-500">+{g.subs.length - 3} more</li>}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href={`/planner?date=${d.date}`} className="mt-2 inline-block text-xs font-bold text-accent hover:underline">Open day →</Link>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">Past days show actual completion; future days show generated plan. All derive from the same curriculum hierarchy.</p>
      </PlainSection>
      <PlainSection title="Track allocation this week">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(current.trackMinutes).map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-card p-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{k}</p>
              <p className="mt-1 font-mono text-sm font-bold text-white">{minutesToHM(v as number)}</p>
            </div>
          ))}
        </div>
      </PlainSection>
      {weeks.slice(1, 3).map((w) => (
        <PlainSection key={w.weekStart} title={`Week of ${w.weekLabel}`} action={<span className="font-mono text-xs text-gray-500">{minutesToHM(w.targetMinutes)}</span>}>
          <p className="text-sm text-gray-400">{w.milestone}</p>
          <div className="mt-2 flex gap-1">
            {w.days.map((d) => (
              <span key={d.date} className="h-2 flex-1 rounded-full bg-border/40" title={d.date} />
            ))}
          </div>
        </PlainSection>
      ))}
    </div>
  );
}

function MonthView({ data }: { data: { months: { key: string; label: string; monthStart: string; monthEnd: string; daysInWindow: number; targetMinutes: number; plannedMinutes: number; percent: number; majorModules: { track: string; label: string; minutes: number }[]; milestone: string; status: string; weeks?: { weekLabel: string; weekStart: string; weekEnd: string; milestone: string; targetMinutes: number }[] }[] } }) {
  const months = data.months ?? [];
  if (months.length === 0) return <p className="text-sm text-gray-500">No monthly plan — check your curriculum deadline in Settings.</p>;
  return (
    <div className="space-y-4">
      {months.map((m) => (
        <section key={m.key} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-base font-bold text-white">{m.label}</h3>
            <StatusBadge tone={m.status === "ON_TRACK" ? "green" : m.status === "AT_RISK" ? "amber" : "rose"}>{m.status.toLowerCase()}</StatusBadge>
          </div>
          <p className="mt-1 font-mono text-xs text-gray-500">{m.monthStart} → {m.monthEnd} · {m.daysInWindow} study days · {minutesToHM(m.targetMinutes)} target</p>
          <ProgressBar value={m.percent} label={`${m.label} progress`} heightClass="h-2" />
          <p className="mt-2 text-sm font-semibold text-gray-200">{m.milestone}</p>
          <ul className="mt-2 space-y-1">
            {m.majorModules.map((mod, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-gray-300">{mod.track} · {mod.label}</span>
                <span className="shrink-0 font-mono text-gray-500">{minutesToHM(mod.minutes)}</span>
              </li>
            ))}
          </ul>
          {(m as { weeks?: { weekLabel: string; weekStart: string; milestone: string }[] }).weeks && (m as { weeks?: { weekLabel: string; weekStart: string; milestone: string }[] }).weeks!.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-border/40 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Weeks in {m.label}</p>
              {(m as { weeks: { weekLabel: string; weekStart: string; milestone: string }[] }).weeks.map((w) => (
                <div key={w.weekStart} className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-gray-400">{w.weekLabel}</span>
                  <span className="truncate text-gray-400">{w.milestone}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Link href={`/planner?date=${m.monthStart}`} className="text-xs font-bold text-accent hover:underline">Open month →</Link>
            <Link href="/print" className="text-xs text-gray-500 hover:text-gray-300">Print →</Link>
          </div>
        </section>
      ))}
    </div>
  );
}

function StatusBadge({ tone, children }: { tone: "green" | "amber" | "rose" | "gray"; children: React.ReactNode }) {
  const cls = tone === "green" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : tone === "amber" ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
    : tone === "rose" ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
    : "border-border bg-border/20 text-gray-400";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${cls}`}>{children}</span>;
}
