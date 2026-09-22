"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Map as MapIcon, ChevronDown, Play, CheckCircle2, Clock, Circle, AlertTriangle } from "lucide-react";
import { PageShell, PageHeader, ErrorState, PageSkeleton, PlainSection } from "@/components/study/ui";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { getProgramDay, getDaysRemaining, todayStr, addDays } from "@/lib/date";
import { cn } from "@/lib/cn";

interface Task {
  id: string; title: string; category: string; status: string; practiceReq: string;
  assignedDate: string; estimatedTimeMinutes: number; confidence: number;
  week?: { weekNumber: number; title: string; startDate: string; endDate: string; focusArea: string } | null;
}

const PHASES = ["DSA", "Full Stack", "ML", "Generative AI", "RAG", "AI Agents", "DevOps", "Projects"];

const done = (s: string) => s === "COMPLETED" || s === "PRACTICE";

export default function RoadmapPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openPhase, setOpenPhase] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<"current" | "upcoming" | "completed">("current");

  const fetchTasks = async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Roadmap tasks failed to load");
      setTasks(await res.json());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load roadmap");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pt-10">
        <div className="h-44 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    );
  }
  if (loadError) {
    return (
      <PageShell>
        <ErrorState message={loadError} onRetry={fetchTasks} />
      </PageShell>
    );
  }

  const today = todayStr();
  const dn = Math.max(1, Math.min(99, getProgramDay(today)));
  const left = getDaysRemaining(today);
  const total = tasks.length;
  const doneCount = tasks.filter((t) => done(t.status)).length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const current = tasks.filter((t) => !done(t.status) && t.assignedDate <= today).sort((a, b) => a.assignedDate.localeCompare(b.assignedDate));
  const upcoming = tasks.filter((t) => !done(t.status) && t.assignedDate > today).sort((a, b) => a.assignedDate.localeCompare(b.assignedDate));
  const completed = tasks.filter((t) => done(t.status));

  const phases = PHASES.map((name) => {
    const list = tasks.filter((t) => t.category === name);
    const d = list.filter((t) => done(t.status)).length;
    const p = list.length ? Math.round((d / list.length) * 100) : 0;
    return { name, total: list.length, done: d, pct: p, state: p >= 100 ? "done" : p > 0 ? "active" : "todo" as "done" | "active" | "todo", list };
  }).filter((p) => p.total > 0);

  const currentPhase = phases.find((p) => p.state === "active") ?? phases.find((p) => p.state === "todo") ?? null;

  // Current week: Monday–Sunday containing today
  const getMonday = (d: string) => {
    const [y, m, dd] = d.split("-").map(Number);
    const dt = new Date(y, m - 1, dd, 12, 0, 0, 0);
    const dow = (dt.getDay() + 6) % 7;
    dt.setDate(dt.getDate() - dow);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  };
  const weekStart = getMonday(today);
  const weekEnd = addDays(weekStart, 6);
  const currentWeekTasks = tasks.filter((t) => t.assignedDate >= weekStart && t.assignedDate <= weekEnd);
  const currentTask = current.length > 0 ? current[0] : upcoming[0] ?? null;

  // Pace: ahead/behind — expected vs actual (simple linear expectation)
  const expectedPct = Math.round((Math.min(99, Math.max(1, dn)) / 99) * 100);
  const paceDiff = pct - expectedPct;
  const paceLabel = paceDiff > 5 ? "Ahead of pace" : paceDiff < -5 ? "Behind pace" : "On pace";

  const sections = [
    { key: "current" as const, title: `Current (${current.length})`, list: current, empty: "Nothing overdue. Upcoming work is below." },
    { key: "upcoming" as const, title: `Upcoming (${upcoming.length})`, list: upcoming.slice(0, 12), empty: "Nothing scheduled ahead." },
    { key: "completed" as const, title: `Completed (${completed.length})`, list: completed.slice(-12).reverse(), empty: "No completions yet — your first check-off lands here." },
  ];

  return (
    <PageShell>
      {/* 1 — hero */}
      <header className="pt-4 md:pt-8">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-blue-300">
          <MapIcon className="h-4 w-4" /> Roadmap
        </p>
        <p className="mt-2 text-[13px] font-extrabold uppercase tracking-widest text-gray-500">Current phase</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-white md:text-5xl">{currentPhase?.name ?? "Complete"}</h1>
        <div className="mt-5 flex items-end gap-3">
          <span className="metric-xl text-white">{pct}%</span>
          <span className="mb-1.5 text-[15px] text-gray-500">overall • {doneCount}/{total} tasks • Day {dn}/99, {left} left</span>
        </div>
        <div className="mt-3 max-w-md">
          <ProgressBar value={pct} color="bg-gradient-to-r from-blue-500 to-indigo-400" heightClass="h-2.5" />
        </div>
        <Link href="/today" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-accent px-8 py-3.5 text-base font-bold text-white shadow-md transition hover:bg-accent-hover">
          <Play className="h-5 w-5" /> Study next
        </Link>
      </header>

      {/* Pace indicator */}
      <div className="flex items-center gap-2 text-xs">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${paceDiff > 5 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : paceDiff < -5 ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-border bg-card text-gray-400"}`}>
          {paceDiff > 5 ? <CheckCircle2 className="h-3 w-3" /> : paceDiff < -5 ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          {paceLabel} · {pct}% done · {expectedPct}% expected
        </span>
        <span className="text-xs text-gray-500">Week {weekStart.slice(5)} → {weekEnd.slice(5)}</span>
      </div>

      {/* Current week */}
      <PlainSection title="Current week" action={<span className="text-xs font-semibold text-gray-500">{currentWeekTasks.length} tasks</span>}>
        {currentWeekTasks.length === 0 ? (
          <p className="text-sm text-gray-500">No tasks scheduled for this week — check upcoming.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {currentWeekTasks.slice(0, 5).map((t) => {
              const isOverdue = t.assignedDate < today && !done(t.status);
              const isCompleted = done(t.status);
              return (
                <li key={t.id} className="flex items-center justify-between py-2.5">
                  <Link href={`/roadmap/task/${t.id}`} className="group flex items-center gap-2 min-w-0">
                    <span className={isCompleted ? "text-emerald-400" : isOverdue ? "text-amber-400" : "text-gray-500"}>
                      {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : isOverdue ? <AlertTriangle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                    </span>
                    <span className={`truncate text-sm font-semibold ${isCompleted ? "text-gray-500 line-through" : isOverdue ? "text-amber-300" : "text-gray-200 group-hover:text-white"}`}>{t.title}</span>
                  </Link>
                  <span className="shrink-0 font-mono text-xs text-gray-500">{t.assignedDate}</span>
                </li>
              );
            })}
          </ul>
        )}
      </PlainSection>

      {/* Current task — the single most urgent */}
      {currentTask && (
        <section className="rounded-2xl border border-accent/30 bg-accent/5 p-6">
          <p className="text-xs font-extrabold uppercase tracking-widest text-accent">Current task</p>
          <h3 className="mt-2 text-lg font-bold text-white">{currentTask.title}</h3>
          <p className="mt-1 text-sm text-gray-400">{currentTask.category} · {currentTask.assignedDate} {currentTask.assignedDate < today ? "· overdue" : ""}</p>
          <p className="mt-2 text-xs text-gray-500">Why now? {currentTask.assignedDate < today ? "Overdue — clearing it keeps the week on track." : "Scheduled for today — highest priority."}</p>
          <Link href={`/roadmap/task/${currentTask.id}`} className="mt-4 inline-flex rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-accent-hover">Open task →</Link>
        </section>
      )}

      {/* 2 — up next */}
      <PlainSection title="Up next">
        {upcoming.length === 0 ? (
          <p className="text-[15px] text-gray-500">Nothing scheduled ahead.</p>
        ) : (
          <ol className="space-y-3">
            {upcoming.slice(0, 3).map((t, i) => (
              <li key={t.id}>
                <Link href={`/roadmap/task/${t.id}`} className="group flex items-baseline gap-3 hover:underline">
                  <span className="font-mono text-[15px] text-gray-500">{i + 1}.</span>
                  <span>
                    <span className="block text-[15px] font-bold text-gray-100 group-hover:text-white">{t.title}</span>
                    <span className="font-mono text-[13px] text-gray-500">{t.category} • {t.assignedDate}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </PlainSection>

      {/* 3 — phases */}
      <PlainSection title="Phases">
        <ul className="divide-y divide-border/60">
          {phases.map((p) => {
            const open = openPhase === p.name;
            return (
              <li key={p.name}>
                <button onClick={() => setOpenPhase(open ? null : p.name)} aria-expanded={open}
                  className="flex w-full items-center gap-3 py-3.5 text-left">
                  <span className={p.state === "done" ? "text-emerald-400" : p.state === "active" ? "text-amber-400" : "text-gray-600"}>
                    {p.state === "done" ? <CheckCircle2 className="h-5 w-5" /> : p.state === "active" ? <Clock className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                  </span>
                  <span className="flex-1 text-[15px] font-bold text-gray-100">{p.name}</span>
                  <span className="font-mono text-[13px] text-gray-500">{p.done}/{p.total}</span>
                  <ChevronDown className={cn("h-4 w-4 text-gray-500 transition", open && "rotate-180")} />
                </button>
                {open && (
                  <ul className="space-y-2 pb-4 pl-8 animate-fadeIn">
                    {p.list.map((t) => (
                      <li key={t.id}>
                        <Link href={`/roadmap/task/${t.id}`} className="group flex items-baseline gap-2 text-sm hover:underline">
                          <span className={done(t.status) ? "text-emerald-400" : "text-gray-500"}>{done(t.status) ? "✓" : "○"}</span>
                          <span className={`font-semibold ${done(t.status) ? "text-gray-500 line-through" : "text-gray-200 group-hover:text-white"}`}>{t.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </PlainSection>

      {/* 4 — current / upcoming / completed */}
      <PlainSection title="All tasks">
        <div className="space-y-2">
          {sections.map((s) => {
            const open = openSection === s.key;
            return (
              <div key={s.key} className="overflow-hidden rounded-2xl border border-border bg-card">
                <button onClick={() => setOpenSection(s.key)}
                  className="flex w-full items-center justify-between p-5 text-left" aria-expanded={open}>
                  <span className="text-base font-bold text-white">{s.title}</span>
                  <ChevronDown className={cn("h-5 w-5 text-gray-400 transition", open && "rotate-180")} />
                </button>
                {open && (
                  <ul className="space-y-1 px-5 pb-5 animate-fadeIn">
                    {s.list.length === 0 && <li className="py-2 text-sm text-gray-500">{s.empty}</li>}
                    {s.list.map((t) => (
                      <li key={t.id}>
                        <Link href={`/roadmap/task/${t.id}`} className="group flex items-center justify-between gap-3 py-2">
                          <span className={`truncate text-sm font-semibold ${done(t.status) ? "text-gray-500 line-through" : "text-gray-200 group-hover:text-white group-hover:underline"}`}>
                            {t.title}
                          </span>
                          <span className="shrink-0 font-mono text-xs text-gray-500">{t.category} • {t.assignedDate}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </PlainSection>
    </PageShell>
  );
}
