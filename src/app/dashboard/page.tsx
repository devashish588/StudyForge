"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Flame, Play, CheckCircle2, BookOpen, ChevronRight, MoonStar, CalendarCheck, Map as MapIcon,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PlainSection } from "@/components/study/ui";
import GenerateDayModal from "@/components/ui/GenerateDayModal";
import CheckInModal from "@/components/study/CheckInModal";
import WrapUpModal from "@/components/study/WrapUpModal";
import TimerModal from "@/components/ui/TimerModal";
import { ContributionCalendar } from "@/components/study/Heatmap";
import {
  greeting, formatDisplay, minutesToHM,
  getDaysUntilStart, MILESTONE_DAYS,
} from "@/lib/date";

interface DashboardPayload {
  user: { name: string; dailyTargetHours: number; currentStreak: number; longestStreak: number };
  studyDay: {
    date: string; actualMinutes: number; targetMinutes: number; availableMinutes: number;
    gateMinutes: number; roadmapMinutes: number; practiceMinutes: number; revisionMinutes: number;
    focusPriority: string; coreDayCompleted: boolean;
  };
  window: { start: string; end: string; totalDays: number; dayNumber: number; daysLeft: number; status: "pre" | "active" | "done" };
  streak: { current: number; longest: number; thisMonth: number };
  gateSubject: { name: string } | null;
  gate: { totalPyqs: number; solved: number; percent: number; accuracy: number; weekPyqs: number };
  revisionQueue: { id: string; title: string; category: string }[];
  last7: { date: string; minutes: number }[];
  heatmap: { date: string; minutes: number; gate: number; roadmap: number; revision: number }[];
  plan: { gateMinutes: number; roadmapMinutes: number; practiceMinutes: number; revisionMinutes: number };
  nextCandidates: { id: string; title: string; kind: string; category: string; minutes: number }[];
  program: {
    phase: { title: string; weekNumber: number; focusArea: string } | null;
    upNext: { id: string; title: string; category: string; assignedDate: string; estimatedTimeMinutes: number }[];
  };
  horizons: {
    phase: "build" | "consolidation" | "final";
    buildDaysLeft: number; crackLabel: string; crackDays: number;
    syllabusDeadline: string; examWindowStart: string; examWindowEnd: string;
    paperDate: string | null; examCountdownLabel: string;
  };
  monthly: { roadmapPercent: number; roadmapByCategory: Record<string, { total: number; done: number }> };
  coreDayComplete: boolean;
}

const PHASE_ORDER = ["DSA", "Full Stack", "ML", "Generative AI", "RAG", "AI Agents", "DevOps", "Projects"];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [wrapUpOpen, setWrapUpOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [nextSession, setNextSession] = useState<{ title: string; category: string; minutes: number } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Dashboard failed to load");
      setData(await res.json());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) {
    if (loadError) {
      return (
        <div className="mx-auto max-w-3xl space-y-4 pt-10">
          <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
          <p className="text-center text-sm text-gray-400">{loadError}</p>
          <button onClick={fetchData} className="mx-auto block rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white">Retry</button>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-3xl space-y-4 pt-10">
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-48 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    );
  }

  // Pre-start: program hasn't begun — no Day numbers, no streak.
  if (data.window.status === "pre") {
    const days = getDaysUntilStart(data.studyDay.date);
    return <PreStart name={data.user.name} days={days} onCheckIn={() => setCheckInOpen(true)} checkInOpen={checkInOpen} setCheckInOpen={setCheckInOpen} available={data.studyDay.availableMinutes} priority={data.studyDay.focusPriority} onDone={fetchData} />;
  }

  const { studyDay, window, streak, plan } = data;
  const target = studyDay.targetMinutes || 480;
  const actual = studyDay.actualMinutes;
  const dayPct = Math.round((actual / Math.max(1, target)) * 100);
  const maxLast7 = Math.max(1, ...data.last7.map((d) => d.minutes));
  const programDay = Math.max(1, Math.min(99, window.dayNumber));

  const mission = [
    { label: "GATE", mins: plan.gateMinutes, done: studyDay.gateMinutes >= plan.gateMinutes * 0.8 || studyDay.gateMinutes >= 60 },
    { label: "Roadmap", mins: plan.roadmapMinutes, done: studyDay.roadmapMinutes >= plan.roadmapMinutes * 0.8 || studyDay.roadmapMinutes >= 60 },
    { label: "Practice", mins: plan.practiceMinutes, done: studyDay.practiceMinutes >= plan.practiceMinutes * 0.8 || studyDay.practiceMinutes >= 30 },
    { label: "Revision", mins: plan.revisionMinutes, done: studyDay.revisionMinutes >= plan.revisionMinutes * 0.7 || studyDay.revisionMinutes >= 15 },
  ];

  const startNext = () => {
    const c = data.nextCandidates[0];
    if (c) setNextSession({ title: c.title, category: c.category, minutes: c.minutes });
    else setNextSession({ title: "GATE revision block", category: "GATE", minutes: 60 });
    setTimerOpen(true);
  };

  // Data-driven motivation (no quotes)
  const totalStudied = data.heatmap.reduce((a, h) => a + h.minutes, 0);
  const activeDays = data.heatmap.filter((h) => h.minutes >= 180).length;
  const recentDays = data.heatmap.slice(-18);
  const recentActive = recentDays.filter((h) => h.minutes >= 180).length;

  const milestone = MILESTONE_DAYS.includes(programDay) ? programDay : null;

  const phaseList = PHASE_ORDER.map((name) => {
    const match = Object.entries(data.monthly.roadmapByCategory).find(
      ([k]) => k.toLowerCase().split(" ")[0] === name.toLowerCase().split(" ")[0]
    );
    const pct = match ? Math.round((match[1].done / Math.max(1, match[1].total)) * 100) : 0;
    return { name, pct, state: pct >= 100 ? "done" : pct > 0 ? "active" : "todo" as "done" | "active" | "todo" };
  });

  const upNext = data.program.upNext;
  const nextRevision = data.revisionQueue[0];

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-16 md:space-y-12">
      {/* 1 — HERO */}
      <header className="pt-4 md:pt-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">
          {greeting()}, {data.user.name}
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
          {formatDisplay(studyDay.date)}
        </h1>
        <p className="mt-2 text-lg text-gray-400">
          Day {programDay} / 99 &nbsp;·&nbsp; {window.daysLeft} days to December 31
        </p>
        <div className="mt-5 max-w-md">
          <ProgressBar value={Math.round((programDay / 99) * 100)} color="bg-gradient-to-r from-indigo-500 to-emerald-400" heightClass="h-2" />
        </div>
        <div className="mt-8 flex items-end gap-4">
          <span className="text-6xl leading-none" role="img" aria-label="streak flame">🔥</span>
          <div>
            <div className="metric-xl text-white">{streak.current}</div>
            <p className="mt-1 text-sm font-bold uppercase tracking-widest text-gray-400">Day streak</p>
            <p className="mt-0.5 text-[13px] text-gray-500">Longest {Math.max(streak.longest, data.user.longestStreak)} days</p>
          </div>
        </div>
        {data.coreDayComplete && (
          <div className="core-glow mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-300 animate-popIn">
            <CheckCircle2 className="h-4 w-4" /> Core day complete — streak preserved
          </div>
        )}
      </header>

      {milestone !== null && (
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-6 text-center animate-fadeIn md:p-8">
          <p className="text-sm font-extrabold uppercase tracking-widest text-indigo-300">Day {milestone}</p>
          <p className="mt-1 text-lg text-gray-200">{milestone} days completed. You have studied {minutesToHM(totalStudied)}. Keep building.</p>
        </div>
      )}

      {/* Two timelines: BUILD (skills → Dec 31) + CRACK (GATE → Feb 2027) */}
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <p className="text-[13px] font-extrabold uppercase tracking-widest text-blue-300">Build</p>
          <p className="metric-xl mt-1 text-white">{data.horizons.buildDaysLeft}<span className="text-base font-semibold text-gray-500"> days</span></p>
          <p className="mt-1 text-[13px] text-gray-500">Skills roadmap → Dec 31</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <p className="text-[13px] font-extrabold uppercase tracking-widest text-purple-300">Crack</p>
          <p className="metric-xl mt-1 text-white">{data.horizons.crackLabel}</p>
          <p className="mt-1 text-[13px] text-gray-500">{data.horizons.examCountdownLabel}</p>
        </div>
      </section>

      {data.horizons.phase !== "build" && (
        <section className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-6 animate-fadeIn md:p-8">
          <p className="text-sm font-extrabold uppercase tracking-widest text-purple-300">
            {data.horizons.phase === "final" ? "GATE final preparation mode" : "GATE consolidation"}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-gray-200">
            {data.horizons.phase === "final"
              ? "The build track is done. From here it is revision, PYQs, mocks and weak-area repair until your paper."
              : `Syllabus first-pass deadline: ${data.horizons.syllabusDeadline}. Finish remaining topics, then consolidate.`}
          </p>
        </section>
      )}

      {/* 2 — TODAY'S MISSION */}
      <section>
        <h2 className="text-2xl font-bold tracking-tight text-white md:text-[1.7rem]">Today&apos;s mission</h2>
        <p className="mt-1 text-3xl font-extrabold text-white md:text-4xl">
          {minutesToHM(actual)} <span className="text-lg font-semibold text-gray-500">/ {minutesToHM(target)}</span>
        </p>
        <div className="mt-4">
          <ProgressBar value={Math.min(100, dayPct)} color="bg-gradient-to-r from-indigo-500 to-emerald-400" heightClass="h-3" />
        </div>
        {dayPct > 100 && <p className="mt-1 text-[13px] font-bold text-emerald-400">{dayPct}% — stretch achieved.</p>}
        <ul className="mt-6 divide-y divide-border/60">
          {mission.map((m) => (
            <li key={m.label} className="flex items-center justify-between py-3">
              <span className="text-[15px] font-semibold text-gray-200">
                <span className={m.done ? "text-emerald-400" : "text-gray-500"}>{m.done ? "✓ " : "○ "}</span>
                {m.label}
              </span>
              <span className="font-mono text-sm text-gray-400">{minutesToHM(m.mins)}</span>
            </li>
          ))}
        </ul>
        <button onClick={startNext} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-base font-bold text-white shadow-md transition hover:bg-accent-hover">
          <Play className="h-5 w-5" /> Start next session
        </button>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setCheckInOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-border bg-border/30 px-4 py-2.5 text-[13px] font-bold text-gray-200 hover:bg-border/60">
            <CalendarCheck className="h-4 w-4" /> Check-in
          </button>
          <button onClick={() => setWrapUpOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-border bg-border/30 px-4 py-2.5 text-[13px] font-bold text-gray-200 hover:bg-border/60">
            <MoonStar className="h-4 w-4" /> Wrap-up
          </button>
          <button onClick={() => setGenerateOpen(true)} className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-[13px] font-bold text-accent hover:bg-accent/20">
            Generate my day
          </button>
        </div>
        {nextSession && (
          <p className="mt-3 text-sm text-indigo-200">
            Next up: <span className="font-bold text-white">{nextSession.title}</span> ({nextSession.category} • {nextSession.minutes} min)
          </p>
        )}
      </section>

      {/* 3 — NEXT SESSION + UP NEXT + GATE */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
        <section>
          <h2 className="text-2xl font-bold tracking-tight text-white">Next session</h2>
          {data.nextCandidates[0] ? (
            <div className="mt-3">
              <p className="text-lg font-bold text-white">{data.nextCandidates[0].title}</p>
              <p className="mt-1 text-[15px] text-gray-400">{data.nextCandidates[0].category} • {data.nextCandidates[0].minutes} minutes</p>
              <button onClick={startNext} className="mt-4 rounded-xl bg-accent px-8 py-3 text-sm font-bold text-white shadow-md transition hover:bg-accent-hover">
                Start
              </button>
            </div>
          ) : (
            <p className="mt-3 text-[15px] text-gray-400">Nothing scheduled. Generate your day to fill it.</p>
          )}
          <div className="mt-8">
            <h3 className="text-[13px] font-extrabold uppercase tracking-widest text-gray-500">Up next</h3>
            <ul className="mt-2 space-y-2">
              {upNext.slice(0, 3).map((t, i) => (
                <li key={t.id}>
                  <Link href={`/roadmap/task/${t.id}`} className="group flex items-baseline gap-2 text-[15px] hover:underline">
                    <span className="font-mono text-gray-500">{i + 1}.</span>
                    <span className="font-semibold text-gray-200 group-hover:text-white">{t.title}</span>
                  </Link>
                </li>
              ))}
              {upNext.length === 0 && <li className="text-[15px] text-gray-500">Roadmap clear.</li>}
              {nextRevision && (
                <li>
                  <Link href="/revision" className="group flex items-baseline gap-2 text-[15px] hover:underline">
                    <span className="font-mono text-gray-500">↻</span>
                    <span className="font-semibold text-gray-200 group-hover:text-white">Revise: {nextRevision.title}</span>
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-white">GATE 2027</h2>
            <Link href="/gate" className="text-sm font-bold text-purple-300 hover:underline">Open →</Link>
          </div>
          <p className="metric-xl mt-3 text-white">{data.gate.solved} <span className="text-lg font-semibold text-gray-500">PYQs</span></p>
          <p className="mt-1 text-[15px] text-gray-400">{data.gate.accuracy}% accuracy • +{data.gate.weekPyqs} this week</p>
          <div className="mt-4">
            <ProgressBar value={data.gate.percent} color="bg-purple-500" heightClass="h-2.5" />
          </div>
          <p className="mt-2 text-sm text-gray-500">Focus: {data.gateSubject?.name ?? "—"}</p>
        </section>
      </div>

      {/* 4 — LAST 7 DAYS (max 2 graphs on dashboard: this + heatmap) */}
      <PlainSection title="Last 7 days" action={<Link href="/analytics" className="text-sm font-bold text-indigo-300 hover:underline">Analytics →</Link>}>
        <div className="space-y-2.5">
          {data.last7.map((d) => (
            <Link key={d.date} href="/calendar" className="group flex items-center gap-3">
              <span className="w-16 shrink-0 font-mono text-[13px] text-gray-400">{d.date.slice(5)}</span>
              <div className="h-5 flex-1 overflow-hidden rounded-md bg-border/30">
                <div className="h-5 rounded-md bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all group-hover:brightness-125" style={{ width: `${Math.round((d.minutes / maxLast7) * 100)}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right text-sm font-semibold text-gray-300">{minutesToHM(d.minutes)}</span>
            </Link>
          ))}
        </div>
      </PlainSection>

      {/* 5 — CONSISTENCY + JOURNEY */}
      <PlainSection title="Study consistency">
        <ContributionCalendar days={data.heatmap} />
        <div className="mt-8">
          <p className="font-mono text-[13px] text-gray-500">SEP 24 ─────────────────── DEC 31</p>
          <ul className="mt-3 space-y-2">
            {phaseList.map((p) => (
              <li key={p.name} className="flex items-center gap-3 text-[15px]">
                <span className={`text-lg leading-none ${p.state === "done" ? "text-emerald-400" : p.state === "active" ? "text-amber-400" : "text-gray-600"}`}>
                  {p.state === "done" ? "●" : p.state === "active" ? "◐" : "○"}
                </span>
                <span className="font-semibold text-gray-200">{p.name}</span>
                <span className="font-mono text-[13px] text-gray-500">{p.pct}%</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[15px] font-bold text-white">
            {data.program.phase ? `Current phase: ${data.program.phase.title}` : "Final ship"}
          </p>
        </div>
      </PlainSection>

      {/* Motivation line (data, not quotes) */}
      <p className="border-t border-border/60 pt-6 text-center text-[15px] leading-relaxed text-gray-400">
        You are on Day {programDay} of 99. You have studied {minutesToHM(totalStudied)}.
        You completed {recentActive} of the last {recentDays.length} days.
        Your current streak is {streak.current} {streak.current === 1 ? "day" : "days"}.
      </p>

      <GenerateDayModal isOpen={generateOpen} onClose={() => setGenerateOpen(false)} revisionDue={data.revisionQueue.length} onApply={() => fetchData()} />
      <CheckInModal
        isOpen={checkInOpen} onClose={() => setCheckInOpen(false)} onDone={fetchData}
        initialAvailable={studyDay.availableMinutes}
        initialPriority={(studyDay.focusPriority as "Balanced" | "GATE" | "Roadmap" | "Project" | "Revision") ?? "Balanced"}
      />
      <WrapUpModal isOpen={wrapUpOpen} onClose={() => setWrapUpOpen(false)} onDone={fetchData} actualMinutes={actual} />
      <TimerModal
        isOpen={timerOpen} onClose={() => { setTimerOpen(false); fetchData(); }}
        defaultTitle={nextSession?.title} defaultCategory={nextSession?.category} onSaved={fetchData}
      />
    </div>
  );
}

function PreStart({ name, days, onCheckIn, checkInOpen, setCheckInOpen, available, priority, onDone }: {
  name: string; days: number; onCheckIn: () => void;
  checkInOpen: boolean; setCheckInOpen: (b: boolean) => void;
  available: number; priority: string; onDone: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-16 pt-10 text-center md:pt-16">
      <p className="text-sm font-bold uppercase tracking-[0.25em] text-indigo-300">StudyForge</p>
      <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">Your program starts September 24, 2026</h1>
      <p className="metric-xl text-white">{days} {days === 1 ? "day" : "days"}</p>
      <p className="text-lg text-gray-400">Your system is ready. 99 days · 8h daily target · no fixed schedule.</p>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/roadmap" className="rounded-2xl border border-border bg-border/30 px-8 py-4 text-base font-bold text-gray-100 transition hover:bg-border/60">
          Preview roadmap
        </Link>
        <button onClick={onCheckIn} className="rounded-2xl bg-accent px-8 py-4 text-base font-bold text-white shadow-md transition hover:bg-accent-hover">
          Configure study target
        </button>
      </div>
      <p className="text-sm text-gray-500">{greeting()}, {name} — see you on Day 1.</p>
      <CheckInModal
        isOpen={checkInOpen} onClose={() => setCheckInOpen(false)} onDone={onDone}
        initialAvailable={available}
        initialPriority={(priority as "Balanced" | "GATE" | "Roadmap" | "Project" | "Revision") ?? "Balanced"}
      />
    </div>
  );
}
