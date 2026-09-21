"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Clock, CheckCircle2, Plus, Play, Trash2, MoonStar, AlertTriangle,
  Sparkles, ChevronDown, Flame, NotebookPen, HelpCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PlainSection } from "@/components/study/ui";
import TimerModal from "@/components/ui/TimerModal";
import CheckInModal from "@/components/study/CheckInModal";
import WrapUpModal from "@/components/study/WrapUpModal";
import RecoveryModal from "@/components/ui/RecoveryModal";
import { todayStr, formatDisplay, minutesToHM, getProgramDay, getDaysRemaining } from "@/lib/date";
import { type FocusPriority } from "@/lib/study";

interface Block {
  id: string;
  title: string;
  category: string;
  plannedMinutes: number;
  actualMinutes: number;
  blockLabel: string;
  clockStart?: string | null;
  clockEnd?: string | null;
  completed: boolean;
  notes?: string | null;
}

interface DayData {
  date: string;
  targetMinutes: number;
  availableMinutes: number;
  actualMinutes: number;
  gateMinutes: number;
  roadmapMinutes: number;
  practiceMinutes: number;
  revisionMinutes: number;
  focusPriority: string;
  coreDayCompleted: boolean;
  planJson?: string;
  tomorrowPriority?: string | null;
  sessions: Block[];
}

interface BacklogItem {
  id: string;
  title: string;
  category: string;
  priority: string;
  estimatedMinutes: number;
  overdueDays: number;
}

interface PlanItem {
  id: string; kind: string; tier: "MUST" | "SHOULD" | "COULD";
  title: string; detail?: string; minutes: number;
  refType?: string; refId?: string; subjectName?: string; topicName?: string;
  why: string; done: boolean; sessionId?: string | null;
  pyqTarget?: number; pyqDone?: number; movedFrom?: string;
}

interface Notebook {
  goal: string; must: string[]; notes: string;
  questions: { id: string; text: string; status: string }[];
  learned: string;
}

interface PlanPayload {
  date: string;
  status: string;
  plan: {
    date: string; targetMinutes: number; goal: string; generatedAt: string;
    priorityMode: string; locked: boolean;
    items: PlanItem[]; calibration: Record<string, number>; logic: string[];
    pace: any; week: any; horizons: any; tomorrowCandidates: PlanItem[];
  };
  notebook: Notebook;
  doubts: { id: string; text: string; status: string }[];
  yesterday: any;
  nextAction: PlanItem | null;
  streak: { current: number; longest: number };
  studyDay: { actualMinutes: number; targetMinutes: number; coreDayCompleted: boolean };
  planFeedback: string | null;
}

const KIND_CATEGORY: Record<string, string> = {
  GATE: "GATE", ROADMAP: "Roadmap", PRACTICE: "Practice",
  REVISION: "Revision", PROJECT: "Project", BACKLOG: "Roadmap", CUSTOM: "Roadmap",
};

export default function TodayPage() {
  const [day, setDay] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PlanPayload | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerCtx, setTimerCtx] = useState<{ title?: string; category?: string; sessionId?: string | null }>({});
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [wrapUpOpen, setWrapUpOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCat, setNewCat] = useState("Roadmap");
  const [newMins, setNewMins] = useState("60");
  const [newClock, setNewClock] = useState("");
  const [backlog, setBacklog] = useState<BacklogItem[]>([]);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [revisionDue, setRevisionDue] = useState<{ id: string; title: string }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Plan UI state
  const [compact, setCompact] = useState(false);
  const [showLogic, setShowLogic] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [tomorrowOpen, setTomorrowOpen] = useState(false);
  const [tomorrowPlan, setTomorrowPlan] = useState<any>(null);
  const [tomorrowLoading, setTomorrowLoading] = useState(false);
  const [handoff, setHandoff] = useState<{ doneTitle: string; next: PlanItem } | null>(null);
  const [goalEditing, setGoalEditing] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [expandedDoubts, setExpandedDoubts] = useState(false);
  const [expandedLearned, setExpandedLearned] = useState(false);
  const [expandedTomorrow, setExpandedTomorrow] = useState(false);
  const [doubtText, setDoubtText] = useState("");
  const planItemSession = useRef<Record<string, string>>({}); // planItemId -> sessionId

  const date = todayStr();

  const fetchDay = useCallback(async () => {
    try {
      setLoadError(null);
      const today = todayStr();
      const res = await fetch(`/api/study-day?date=${today}`);
      if (!res.ok) throw new Error("Today's data failed to load");
      setDay(await res.json());
      const bRes = await fetch("/api/backlog");
      if (bRes.ok) setBacklog(await bRes.json());
      const rRes = await fetch("/api/revision");
      if (rRes.ok) {
        const items = await rRes.json();
        setRevisionDue(items.filter((r: any) => r.nextRevisionDate <= today).slice(0, 3));
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load today");
    } finally { setLoading(false); }
  }, []);

  const reconcilePlanSessions = useCallback(async (planDate: string) => {
    // Link completed timer sessions (marked plan:<date>:<itemId>) back to plan items.
    try {
      const res = await fetch(`/api/sessions?date=${planDate}`);
      if (!res.ok) return false;
      const sessions = await res.json();
      let changed = false;
      for (const s of sessions) {
        if (!s.completed || typeof s.notes !== "string") continue;
        const m = s.notes.match(new RegExp(`^plan:${planDate}:(.+)$`));
        if (!m) continue;
        const itemId = m[1];
        const t = await fetch("/api/today-plan", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: planDate, action: "toggle-item", itemId, done: true }),
        });
        if (t.ok) changed = true;
      }
      return changed;
    } catch { return false; }
  }, []);

  const fetchPlan = useCallback(async () => {
    try {
      const today = todayStr();
      await reconcilePlanSessions(today);
      const res = await fetch(`/api/today-plan?date=${today}`);
      if (!res.ok) throw new Error("Plan failed to load");
      setPlan(await res.json());
    } catch (e) {
      console.error(e);
    } finally { setPlanLoading(false); }
  }, [reconcilePlanSessions]);

  const refreshAll = useCallback(() => { fetchDay(); fetchPlan(); }, [fetchDay, fetchPlan]);

  useEffect(() => { fetchDay(); fetchPlan(); }, [fetchDay, fetchPlan]);

  /* ---------- blocks (legacy session flow, kept) ---------- */

  const addBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const [cs, ce] = newClock.includes("-") ? newClock.split("-").map((s) => s.trim()) : [undefined, undefined];
    await fetch("/api/sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle, category: newCat,
        plannedMinutes: Number(newMins) || 60,
        clockStart: cs || null, clockEnd: ce || null,
      }),
    });
    setNewTitle(""); setNewClock(""); setShowAddForm(false);
    fetchDay();
  };

  const toggleBlock = async (b: Block) => {
    const nextCompleted = !b.completed;
    const patch: Record<string, unknown> = { id: b.id, completed: nextCompleted };
    if (nextCompleted && b.actualMinutes === 0) patch.actualMinutes = b.plannedMinutes;
    if (!nextCompleted) patch.actualMinutes = 0;
    await fetch("/api/sessions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    fetchDay();
  };

  const deleteBlock = async (id: string) => {
    await fetch(`/api/sessions?id=${id}`, { method: "DELETE" });
    fetchDay();
  };

  const openTimerFor = (b: Block) => {
    setTimerCtx({ title: b.title, category: b.category, sessionId: b.id });
    setTimerOpen(true);
  };

  const handleBacklog = async (id: string, status: "RESOLVED" | "SKIPPED") => {
    const prev = backlog;
    setBacklog((bs) => bs.filter((b) => b.id !== id));
    try {
      const res = await fetch("/api/backlog", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("persist failed");
    } catch (e) {
      console.error(e);
      setBacklog(prev);
    }
  };

  /* ---------- plan actions ---------- */

  const patchPlan = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/today-plan", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, ...body }),
    });
    if (!res.ok) throw new Error("Plan update failed");
    await fetchPlan();
  };

  const togglePlanItem = async (item: PlanItem) => {
    const prev = plan;
    if (plan) {
      const items = plan.plan.items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i));
      setPlan({ ...plan, plan: { ...plan.plan, items } });
    }
    try {
      await patchPlan({ action: "toggle-item", itemId: item.id, done: !item.done });
    } catch {
      if (prev) setPlan(prev);
    }
  };

  const startPlanItem = async (item: PlanItem) => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          title: item.topicName ? `${item.subjectName ?? ""} — ${item.topicName}`.replace(/^ — /, "") : item.title,
          category: KIND_CATEGORY[item.kind] ?? "Roadmap",
          plannedMinutes: item.minutes,
          taskId: item.refType === "roadmapTask" ? item.refId : null,
          notes: `plan:${date}:${item.id}`,
        }),
      });
      if (!res.ok) throw new Error("Could not create session");
      const session = await res.json();
      planItemSession.current[item.id] = session.id;
      setTimerCtx({ title: session.title, category: session.category, sessionId: session.id });
      setTimerOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const onTimerClose = async () => {
    setTimerOpen(false);
    // Mark plan items whose linked session just completed, then show handoff.
    let justDone: string | null = null;
    try {
      const res = await fetch(`/api/sessions?date=${date}`);
      if (res.ok) {
        const sessions = await res.json();
        for (const [itemId, sessionId] of Object.entries(planItemSession.current)) {
          const s = sessions.find((x: any) => x.id === sessionId);
          if (s?.completed) {
            await fetch("/api/today-plan", {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date, action: "toggle-item", itemId, done: true }),
            });
            const it = plan?.plan.items.find((i) => i.id === itemId);
            if (it) justDone = it.title;
            delete planItemSession.current[itemId];
          }
        }
      }
    } catch { /* non-fatal */ }
    await refreshAll();
    if (justDone) {
      try {
        const res = await fetch(`/api/today-plan?date=${date}`);
        if (res.ok) {
          const fresh = await res.json();
          const nxt = fresh.nextAction;
          if (nxt) setHandoff({ doneTitle: justDone, next: nxt });
        }
      } catch { /* non-fatal */ }
    }
  };

  const loadTomorrow = async () => {
    if (tomorrowOpen) { setTomorrowOpen(false); return; }
    setTomorrowOpen(true);
    if (tomorrowPlan) return;
    setTomorrowLoading(true);
    try {
      const tmr = await (await fetch(`/api/today-plan?date=${dateOffset(1)}&preview=1`)).json();
      setTomorrowPlan(tmr);
    } catch { setTomorrowPlan({ error: true }); }
    finally { setTomorrowLoading(false); }
  };

  const dateOffset = (n: number) => {
    const [y, m, d] = date.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + n);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  };

  if (loading || !day) {
    if (loadError) {
      return (
        <div className="mx-auto max-w-3xl pt-10">
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-8 text-center">
            <p className="text-base font-bold text-rose-300">Today couldn&apos;t load</p>
            <p className="mt-1 text-sm text-gray-400">{loadError}</p>
            <button onClick={fetchDay} className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-6 py-3 text-sm font-bold text-rose-300">Retry</button>
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-3xl space-y-4 pt-10">
        <div className="h-32 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    );
  }

  const target = day.targetMinutes || 480;
  const pct = Math.round((day.actualMinutes / Math.max(1, target)) * 100);
  const core = day.coreDayCompleted || day.actualMinutes >= 180;
  const programDay = Math.max(1, getProgramDay(date));
  const daysLeft = getDaysRemaining(date);
  const streak = plan?.streak;

  const items = plan?.plan.items ?? [];
  const must = items.filter((i) => i.tier === "MUST");
  const should = items.filter((i) => i.tier === "SHOULD");
  const could = items.filter((i) => i.tier === "COULD");
  const doneCount = items.filter((i) => i.done).length;
  const objPct = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  const next = day.sessions.find((s) => !s.completed) ?? null;
  const remaining = day.sessions.filter((s) => !s.completed).length;

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-16 md:space-y-12">
      {/* 1 — header: date, day, target, streak */}
      <header className="pt-4 md:pt-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">Today</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-white md:text-5xl">{formatDisplay(day.date)}</h1>
        <p className="mt-2 text-lg text-gray-400">Day {programDay} / 99 &nbsp;·&nbsp; {daysLeft} days left in roadmap</p>
        <div className="mt-5 flex flex-wrap items-end gap-x-10 gap-y-4">
          <p className="text-3xl font-extrabold text-white md:text-4xl">
            {minutesToHM(day.actualMinutes)} <span className="text-lg font-semibold text-gray-500">/ {minutesToHM(target)} target</span>
          </p>
          {streak && (
            <p className="flex items-center gap-1.5 text-lg font-extrabold text-orange-300" title={`${streak.current} day streak`}>
              <Flame className="h-5 w-5" /> {streak.current} <span className="text-sm font-bold text-gray-500">day streak</span>
            </p>
          )}
        </div>
        <div className="mt-4">
          <ProgressBar value={Math.min(100, pct)} color="bg-gradient-to-r from-indigo-500 to-emerald-400" heightClass="h-3" />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px] font-semibold text-gray-400">
          <span>Time: {Math.min(999, pct)}%</span>
          <span>Objectives: {doneCount}/{items.length} ({objPct}%)</span>
        </div>
        {core && <p className="mt-3 flex items-center gap-1.5 text-[15px] font-bold text-emerald-300"><CheckCircle2 className="h-5 w-5" /> Core day complete — streak preserved</p>}
      </header>

      {/* 2 — TODAY'S GOAL (editable) */}
      <section>
        <h2 className="text-2xl font-bold tracking-tight text-white md:text-[1.7rem]">Today&apos;s goal</h2>
        {goalEditing ? (
          <div className="mt-3">
            <textarea value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)} rows={2}
              className="w-full rounded-2xl border border-border bg-card p-4 text-[15px] text-white placeholder-gray-500 focus:border-accent focus:outline-none"
              placeholder="e.g. Finish DBMS Transactions today." />
            <div className="mt-2 flex gap-2">
              <button onClick={async () => { try { await patchPlan({ action: "set-goal", goal: goalDraft }); } catch {} setGoalEditing(false); }}
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white">Save goal</button>
              <button onClick={() => setGoalEditing(false)} className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-gray-300">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="text-lg leading-relaxed text-gray-100">{plan?.plan.goal || "Steady study day."}</p>
            <button onClick={() => { setGoalDraft(plan?.plan.goal || ""); setGoalEditing(true); }}
              className="shrink-0 rounded-xl border border-border bg-border/30 px-4 py-2 text-[13px] font-bold text-gray-300 hover:bg-border/60">Edit</button>
          </div>
        )}
      </section>

      {/* 3 — MUST DO */}
      <PlanTierSection
        title="Must do" items={must} compact={compact}
        empty="Nothing mandatory — steady day."
        onToggle={togglePlanItem} onStart={startPlanItem} onMove={async (id) => { try { await patchPlan({ action: "move-tomorrow", itemId: id }); } catch {} }}
      />

      {/* 4 — NEXT ACTION */}
      {plan?.nextAction ? (
        <section className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-6 md:p-8">
          <p className="text-[13px] font-extrabold uppercase tracking-widest text-indigo-300">What should I do now?</p>
          <p className="mt-2 text-2xl font-bold text-white md:text-[1.7rem]">{plan.nextAction.title}</p>
          <p className="mt-1 text-[15px] text-gray-400">{plan.nextAction.kind} • {plan.nextAction.minutes} minutes</p>
          <p className="mt-2 text-sm italic text-gray-500">Why: {plan.nextAction.why}</p>
          <button onClick={() => startPlanItem(plan.nextAction!)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-base font-bold text-white shadow-md transition hover:bg-accent-hover">
            <Play className="h-5 w-5" /> Start
          </button>
        </section>
      ) : items.length > 0 ? (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center md:p-8">
          <p className="text-lg font-bold text-emerald-300">Today complete ✓</p>
          <p className="mt-1 text-sm text-gray-400">Every planned objective is done.</p>
        </section>
      ) : null}

      {/* session handoff */}
      {handoff && (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 animate-fadeIn md:p-8">
          <p className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-widest text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> Complete ✓ {handoff.doneTitle}
          </p>
          <p className="mt-2 text-xl font-bold text-white">Next: {handoff.next.title}</p>
          <p className="mt-1 text-[15px] text-gray-400">{handoff.next.kind} • {handoff.next.minutes} minutes</p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => { const n = handoff.next; setHandoff(null); startPlanItem(n); }}
              className="flex-1 rounded-2xl bg-accent px-6 py-3.5 text-base font-bold text-white">Start next</button>
            <button onClick={() => setHandoff(null)} className="rounded-2xl border border-border px-6 py-3.5 text-sm font-bold text-gray-300">Later</button>
          </div>
        </section>
      )}

      {/* 5 — NOTEBOOK */}
      <NotebookSection
        notebook={plan?.notebook ?? { goal: "", must: [], notes: "", questions: [], learned: "" }}
        mustItems={must}
        onToggle={togglePlanItem}
        expandedDoubts={expandedDoubts} setExpandedDoubts={setExpandedDoubts}
        expandedLearned={expandedLearned} setExpandedLearned={setExpandedLearned}
        expandedTomorrow={expandedTomorrow} setExpandedTomorrow={setExpandedTomorrow}
        doubtText={doubtText} setDoubtText={setDoubtText}
        tomorrowDefault={day.tomorrowPriority ?? ""}
        onSave={async (patch) => { try { await patchPlan({ action: "notebook", notebook: patch }); } catch {} }}
        onDoubt={async (op, arg) => {
          try {
            if (op === "add") await patchPlan({ action: "doubt-add", text: arg });
            else if (op === "status") await patchPlan({ action: "doubt-status", id: arg.id, status: arg.status });
            else if (op === "to-revision") await patchPlan({ action: "doubt-to-revision", id: arg });
          } catch {}
        }}
        onTomorrow={async (text) => {
          await fetch("/api/study-day", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, tomorrowPriority: text }) });
          fetchDay();
        }}
      />

      {/* 6 — SHOULD / COULD */}
      <PlanTierSection
        title="Should do" items={should} compact={compact}
        empty="Nothing queued here."
        onToggle={togglePlanItem} onStart={startPlanItem} onMove={async (id) => { try { await patchPlan({ action: "move-tomorrow", itemId: id }); } catch {} }}
      />
      {could.length > 0 && (
        <PlanTierSection
          title="Could do" items={could} compact={compact}
          empty=""
          onToggle={togglePlanItem} onStart={startPlanItem} onMove={async (id) => { try { await patchPlan({ action: "move-tomorrow", itemId: id }); } catch {} }}
          subtitle="Optional — only if extra time opens up."
        />
      )}

      {/* plan tools: compact, logic, regenerate, pace */}
      <section className="flex flex-wrap items-center gap-2">
        <button onClick={() => setCompact((v) => !v)} className="rounded-xl border border-border bg-border/30 px-4 py-2.5 text-[13px] font-bold text-gray-200 hover:bg-border/60">
          {compact ? "Detailed view" : "Checklist-only mode"}
        </button>
        <button onClick={() => setShowLogic((v) => !v)} className="flex items-center gap-1.5 rounded-xl border border-border bg-border/30 px-4 py-2.5 text-[13px] font-bold text-gray-200 hover:bg-border/60">
          Plan logic
        </button>
        <button onClick={() => setPlanModalOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-bold text-white hover:bg-accent-hover">
          <Sparkles className="h-4 w-4" /> Plan my day
        </button>
        <button onClick={() => { setShowAddForm((v) => !v); }} className="flex items-center gap-1.5 rounded-xl border border-border bg-border/30 px-4 py-2.5 text-[13px] font-bold text-gray-200 hover:bg-border/60">
          <Plus className="h-4 w-4" /> Add today&apos;s task
        </button>
      </section>

      {showLogic && plan && (
        <section className="rounded-2xl border border-border bg-card p-5 animate-fadeIn md:p-6">
          <p className="text-[13px] font-extrabold uppercase tracking-widest text-gray-400">Plan logic</p>
          <ul className="mt-2 space-y-1.5 text-sm text-gray-300">
            {plan.plan.logic.map((l, i) => <li key={i}>• {l}</li>)}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[13px] md:grid-cols-4">
            <span className="text-gray-400">GATE pace: <b className="text-gray-200">{plan.plan.pace.requiredTopicsPerDay}/day</b> (now {plan.plan.pace.currentTopicsPerDay})</span>
            <span className="text-gray-400">PYQs: <b className="text-gray-200">{plan.plan.pace.requiredPyqsPerDay}/day</b> (now {plan.plan.pace.currentPyqsPerDay})</span>
            <span className="text-gray-400">Syllabus projection: <b className="text-gray-200">{plan.plan.pace.projectedCompletionDate ?? "—"}</b></span>
            <span className={plan.plan.pace.onPace ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>{plan.plan.pace.onPace ? "On pace" : `Behind by ${Math.abs(plan.plan.pace.driftTopicsPerDay)}/day`}</span>
          </div>
        </section>
      )}

      {/* custom task form */}
      {showAddForm && (
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!newTitle.trim()) return;
          const [cs, ce] = newClock.includes("-") ? newClock.split("-").map((s) => s.trim()) : [undefined, undefined];
          try {
            // Custom plan task (linked category) + legacy block row for the timer.
            await patchPlan({ action: "add-item", item: { title: newTitle, minutes: Number(newMins) || 30, tier: "SHOULD", detail: newCat } });
            await fetch("/api/sessions", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: newTitle, category: newCat, plannedMinutes: Number(newMins) || 30, clockStart: cs || null, clockEnd: ce || null }),
            });
          } catch {}
          setNewTitle(""); setNewClock(""); setShowAddForm(false);
          fetchDay();
        }} className="grid grid-cols-1 gap-2 rounded-2xl border border-border bg-card p-5 animate-fadeIn md:grid-cols-12">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Task title" aria-label="Task title"
            className="bg-border/30 border border-border rounded-xl px-3 py-3 text-sm text-card-foreground placeholder-gray-500 focus:outline-none focus:border-accent md:col-span-5" />
          <select value={newCat} onChange={(e) => setNewCat(e.target.value)} aria-label="Category"
            className="bg-border/30 border border-border rounded-xl px-3 py-3 text-sm text-card-foreground focus:outline-none focus:border-accent md:col-span-2">
            <option>Roadmap</option><option>GATE</option><option>Practice</option><option>Revision</option><option>Project</option>
          </select>
          <input value={newMins} onChange={(e) => setNewMins(e.target.value)} inputMode="numeric" placeholder="mins" aria-label="Minutes"
            className="bg-border/30 border border-border rounded-xl px-3 py-3 text-sm text-card-foreground focus:outline-none focus:border-accent md:col-span-2" />
          <input value={newClock} onChange={(e) => setNewClock(e.target.value)} placeholder="Clock (optional)" aria-label="Clock time"
            className="bg-border/30 border border-border rounded-xl px-3 py-3 text-sm text-card-foreground placeholder-gray-500 focus:outline-none focus:border-accent md:col-span-2" />
          <button type="submit" className="rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white md:col-span-1">Add</button>
        </form>
      )}

      {/* study blocks (timer-linked execution units) */}
      <PlainSection title="Study blocks">
        {day.sessions.length === 0 && (
          <p className="text-[15px] text-gray-500">Sessions you start appear here with live minutes.</p>
        )}
        <ul className="space-y-4">
          {day.sessions.map((b, i) => (
            <li key={b.id} className={`flex flex-col gap-3 rounded-2xl border p-5 transition md:flex-row md:items-center md:justify-between ${b.completed ? "border-emerald-500/25 bg-emerald-500/5 opacity-80" : "border-border bg-card"}`}>
              <div className="flex flex-1 items-start gap-3">
                <input type="checkbox" checked={b.completed} onChange={() => toggleBlock(b)} className="mt-1.5 h-5 w-5 shrink-0 cursor-pointer accent-emerald-500" aria-label={`Complete ${b.title}`} />
                <div>
                  <p className={`text-[15px] font-bold ${b.completed ? "text-gray-400 line-through" : "text-white"}`}>
                    <span className="mr-2 font-mono text-[13px] text-gray-500">Block {i + 1}</span>{b.title}
                  </p>
                  <p className="mt-1 font-mono text-[13px] text-gray-400">
                    {b.category} • {b.actualMinutes}/{b.plannedMinutes} min{(b.clockStart || b.clockEnd) ? ` • ${b.clockStart ?? ""}${b.clockEnd ? `–${b.clockEnd}` : ""}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-end md:self-auto">
                <button onClick={() => openTimerFor(b)} className="flex items-center gap-1.5 rounded-xl border border-accent/20 bg-accent/10 px-4 py-2.5 text-[13px] font-bold text-accent transition hover:bg-accent/20">
                  <Play className="h-4 w-4" /> Focus
                </button>
                <button onClick={() => deleteBlock(b.id)} className="rounded-xl border border-border p-2.5 text-gray-500 transition hover:border-rose-500/40 hover:text-rose-400" aria-label={`Delete ${b.title}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </PlainSection>

      {/* revision due */}
      <PlainSection title="Revision due" action={<Link href="/revision" className="text-sm font-bold text-emerald-300 hover:underline">Open →</Link>}>
        {revisionDue.length === 0 ? (
          <p className="text-[15px] text-gray-500">You&apos;re clear. Nothing is due today.</p>
        ) : (
          <ul className="space-y-3">
            {revisionDue.map((r) => (
              <li key={r.id}>
                <Link href="/revision" className="group flex items-center justify-between gap-3">
                  <span className="text-[15px] font-semibold text-gray-200 group-hover:text-white group-hover:underline">{r.title}</span>
                  <span className="shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[13px] font-bold text-emerald-300">Recall</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PlainSection>

      {/* tomorrow preview */}
      <PlainSection
        title="Tomorrow"
        action={<button onClick={loadTomorrow} className="rounded-xl border border-border bg-border/30 px-4 py-2 text-[13px] font-bold text-gray-200 hover:bg-border/60">{tomorrowOpen ? "Hide" : "Preview tomorrow"}</button>}
      >
        {tomorrowOpen && (
          tomorrowLoading ? <p className="text-sm text-gray-500">Previewing…</p>
          : tomorrowPlan?.error ? <p className="text-sm text-gray-500">Preview unavailable.</p>
          : tomorrowPlan ? (
            <div className="animate-fadeIn">
              <p className="text-[15px] text-gray-300">Goal: <span className="font-semibold text-white">{tomorrowPlan.plan.goal}</span></p>
              <ul className="mt-2 space-y-1.5">
                {tomorrowPlan.plan.items.filter((i: PlanItem) => i.tier === "MUST").slice(0, 5).map((i: PlanItem) => (
                  <li key={i.id} className="text-sm text-gray-400">○ {i.title} <span className="font-mono text-xs">· {i.minutes}m</span></li>
                ))}
              </ul>
            </div>
          ) : null
        )}
      </PlainSection>

      {/* yesterday */}
      {plan?.yesterday && plan.yesterday.objectivesTotal > 0 && (
        <PlainSection title={`Yesterday (${plan.yesterday.date.slice(5)})`}>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-[15px]">
            <span className="font-bold text-white">{minutesToHM(plan.yesterday.actualMinutes)} <span className="font-normal text-gray-500">/ {minutesToHM(plan.yesterday.targetMinutes)}</span></span>
            <span className="text-gray-300">{plan.yesterday.objectivesDone}/{plan.yesterday.objectivesTotal} objectives</span>
            <span className="text-gray-300">{plan.yesterday.pyqs} PYQs</span>
            <span className="text-gray-300">{plan.yesterday.topicsDone} topics</span>
            <span className="text-gray-300">{plan.yesterday.revisions} revisions</span>
          </div>
          {plan.yesterday.reflection && <p className="mt-2 text-sm italic text-gray-500">“{plan.yesterday.reflection}”</p>}
        </PlainSection>
      )}

      {/* wrap-up + backlog */}
      <section className="flex flex-col gap-3 sm:flex-row">
        <button onClick={() => setWrapUpOpen(true)} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-base font-bold text-white transition hover:bg-emerald-500">
          <MoonStar className="h-5 w-5" /> Daily wrap-up
        </button>
        {backlog.length > 0 && (
          <button onClick={() => setRecoveryOpen(true)} className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-6 py-4 text-base font-bold text-amber-300 transition hover:bg-amber-500/20">
            <AlertTriangle className="h-5 w-5" /> {backlog.length} missed — recover
          </button>
        )}
      </section>
      {backlog.length > 0 && (
        <ul className="space-y-2">
          {backlog.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-semibold text-gray-300">{b.title} <span className="font-mono font-normal text-amber-400/80">· {b.overdueDays}d overdue</span></span>
              <span className="flex shrink-0 gap-1.5">
                <button onClick={() => handleBacklog(b.id, "RESOLVED")} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300">Done</button>
                <button onClick={() => handleBacklog(b.id, "SKIPPED")} className="rounded-lg border border-border bg-border/20 px-3 py-1.5 text-xs font-bold text-gray-400">Skip</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <TimerModal
        isOpen={timerOpen}
        onClose={onTimerClose}
        defaultTitle={timerCtx.title} defaultCategory={timerCtx.category} sessionId={timerCtx.sessionId ?? null}
        onSaved={refreshAll}
      />
      <CheckInModal isOpen={checkInOpen} onClose={() => setCheckInOpen(false)} onDone={refreshAll}
        initialAvailable={day.availableMinutes} initialPriority={(day.focusPriority as FocusPriority) ?? "Balanced"} />
      <WrapUpModal
        isOpen={wrapUpOpen} onClose={() => setWrapUpOpen(false)} onDone={refreshAll}
        actualMinutes={day.actualMinutes} gateMinutes={day.gateMinutes} roadmapMinutes={day.roadmapMinutes}
        practiceMinutes={day.practiceMinutes} revisionMinutes={day.revisionMinutes} coreComplete={core}
        unfinished={mustUnfinished()} onCarry={carryToTomorrow} planFeedback={plan?.planFeedback ?? null}
        onFeedback={async (f) => { try { await patchPlan({ action: "feedback", feedback: f }); } catch {} }}
      />
      <RecoveryModal isOpen={recoveryOpen} onClose={() => setRecoveryOpen(false)} items={backlog} onApplied={refreshAll} />
      <PlanDayModal
        isOpen={planModalOpen} onClose={() => setPlanModalOpen(false)}
        available={day.availableMinutes} priority={(day.focusPriority as FocusPriority) ?? "Balanced"}
        pace={plan?.plan.pace} horizons={plan?.plan.horizons}
        onGenerate={async (avail, prio, goal) => {
          await fetch("/api/study-day", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, availableMinutes: avail, targetMinutes: avail, focusPriority: prio }) });
          const res = await fetch("/api/today-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, availableMinutes: avail, priorityMode: prio, manualGoal: goal || undefined }) });
          if (!res.ok) throw new Error("Generation failed");
          setPlanModalOpen(false);
          refreshAll();
        }}
      />
    </div>
  );

  function mustUnfinished() {
    return (plan?.plan.items ?? []).filter((i) => i.tier === "MUST" && !i.done).map((i) => ({ id: i.id, title: i.title }));
  }

  async function carryToTomorrow(id: string) {
    try { await patchPlan({ action: "move-tomorrow", itemId: id }); } catch {}
  }
}

/* ---------------- tier list ---------------- */

function PlanTierSection({ title, items, compact, empty, subtitle, onToggle, onStart, onMove }: {
  title: string; items: PlanItem[]; compact: boolean; empty: string; subtitle?: string;
  onToggle: (i: PlanItem) => void; onStart: (i: PlanItem) => void; onMove: (id: string) => void;
}) {
  if (items.length === 0 && !empty) return null;
  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight text-white md:text-[1.7rem]">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      {items.length === 0 ? (
        <p className="mt-2 text-[15px] text-gray-500">{empty}</p>
      ) : (
        <ul className={compact ? "mt-3 space-y-1" : "mt-4 space-y-3"}>
          {items.map((it) => (
            <li key={it.id} className={compact ? "flex items-center gap-3" : "rounded-2xl border border-border bg-card p-5"}>
              <input type="checkbox" checked={it.done} onChange={() => onToggle(it)}
                className="h-6 w-6 shrink-0 cursor-pointer accent-emerald-500" aria-label={`Done: ${it.title}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-[15px] font-bold ${it.done ? "text-gray-500 line-through" : "text-white"}`}>
                  {it.title}
                  <span className="ml-2 whitespace-nowrap font-mono text-[13px] font-normal text-gray-500">{it.minutes}m</span>
                </p>
                {!compact && (
                  <>
                    {(it.detail || it.subjectName) && (
                      <p className="mt-0.5 truncate text-[13px] text-gray-500">{it.detail || it.subjectName}{it.pyqTarget ? ` · ${it.pyqDone ?? 0}/${it.pyqTarget} PYQs` : ""}</p>
                    )}
                    <p className="mt-0.5 text-[13px] italic text-gray-600">Why today? {it.why}{it.movedFrom ? ` (from ${it.movedFrom.slice(5)})` : ""}</p>
                  </>
                )}
              </div>
              {!compact && !it.done && (
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => onStart(it)} className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-accent-hover" aria-label={`Start ${it.title}`}>
                    <Play className="h-4 w-4" /> Start
                  </button>
                  <button onClick={() => onMove(it.id)} title="Move to tomorrow's candidates" aria-label={`Move ${it.title} to tomorrow`}
                    className="min-h-[44px] rounded-xl border border-border px-3 py-2.5 text-[13px] font-bold text-gray-400 transition hover:bg-border/60">
                    →Tmrw
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- notebook ---------------- */

function NotebookSection({ notebook, mustItems, onToggle, expandedDoubts, setExpandedDoubts, expandedLearned, setExpandedLearned, expandedTomorrow, setExpandedTomorrow, doubtText, setDoubtText, tomorrowDefault, onSave, onDoubt, onTomorrow }: {
  notebook: Notebook;
  mustItems: PlanItem[];
  onToggle: (i: PlanItem) => void;
  expandedDoubts: boolean; setExpandedDoubts: (b: boolean) => void;
  expandedLearned: boolean; setExpandedLearned: (b: boolean) => void;
  expandedTomorrow: boolean; setExpandedTomorrow: (b: boolean) => void;
  doubtText: string; setDoubtText: (s: string) => void;
  tomorrowDefault: string;
  onSave: (patch: Partial<{ goal: string; notes: string; learned: string }>) => Promise<void>;
  onDoubt: (op: "add" | "status" | "to-revision", arg?: any) => Promise<void>;
  onTomorrow: (text: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState(notebook.notes);
  const [goal, setGoal] = useState(notebook.goal);
  const [learned, setLearned] = useState(notebook.learned);
  const [tomorrow, setTomorrow] = useState(tomorrowDefault);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pristine = useRef(true);

  // Local inputs initialize empty each mount; the server is the source of
  // truth and is only overwritten by explicit debounced saves — typing is
  // never clobbered by refetches.

  // One-time hydration: when server notebook first arrives with content and
  // the user hasn't typed yet, fill the fields. After that, local wins.
  useEffect(() => {
    if (!pristine.current) return;
    const hasServer = notebook.goal || notebook.notes || notebook.learned;
    if (hasServer && !goal && !notes && !learned) {
      setGoal(notebook.goal);
      setNotes(notebook.notes);
      setLearned(notebook.learned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebook]);

  const queueSave = (patch: Partial<{ goal: string; notes: string; learned: string }>) => {
    pristine.current = false;
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { await onSave(patch); setSaveState("saved"); setTimeout(() => setSaveState("idle"), 1500); }
      catch { setSaveState("idle"); }
    }, 900);
  };

  // Local draft safety: keep a copy so refresh/route change never loses words.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("sf-notebook-draft");
      if (raw) {
        const d = JSON.parse(raw);
        if (typeof d.notes === "string" && d.notes && !notes) setNotes(d.notes);
      }
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try { localStorage.setItem("sf-notebook-draft", JSON.stringify({ notes })); } catch { /* noop */ }
  }, [notes]);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
          <NotebookPen className="h-6 w-6 text-indigo-300" /> Today&apos;s notebook
        </h2>
        <span className="text-xs font-semibold text-gray-500" aria-live="polite">
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Auto-save on"}
        </span>
      </div>

      <label className="mb-1 mt-5 block text-sm font-bold text-gray-200">Goal</label>
      <textarea value={goal} rows={2}
        onChange={(e) => { setGoal(e.target.value); queueSave({ goal: e.target.value }); }}
        placeholder="Finish Arrays + Big-O…"
        className="w-full rounded-xl border border-border bg-border/30 p-4 text-[15px] leading-relaxed text-white placeholder-gray-500 focus:border-accent focus:outline-none" />

      <p className="mb-1 mt-5 text-sm font-bold text-gray-200">Must finish</p>
      {mustItems.length === 0 ? (
        <p className="text-sm text-gray-500">No must-do items — enjoy the open day.</p>
      ) : (
        <ul className="space-y-2">
          {mustItems.map((it) => (
            <li key={it.id} className="flex items-center gap-3">
              <input type="checkbox" checked={it.done} onChange={() => onToggle(it)}
                className="h-6 w-6 shrink-0 cursor-pointer accent-emerald-500" aria-label={it.title} />
              <span className={`text-[15px] font-semibold ${it.done ? "text-gray-500 line-through" : "text-gray-100"}`}>{it.title}</span>
            </li>
          ))}
        </ul>
      )}

      <label className="mb-1 mt-5 block text-sm font-bold text-gray-200">Notes</label>
      <textarea value={notes} rows={5}
        onChange={(e) => { setNotes(e.target.value); queueSave({ notes: e.target.value }); }}
        placeholder="Important notes, formulas, reminders…"
        className="min-h-[140px] w-full rounded-xl border border-border bg-border/30 p-4 text-[15px] leading-relaxed text-white placeholder-gray-500 focus:border-accent focus:outline-none" />

      <div className="mt-4 space-y-2">
        <Expander open={expandedDoubts} onToggle={() => setExpandedDoubts(!expandedDoubts)} icon={<HelpCircle className="h-4 w-4" />} title={`Questions / doubts (${notebook.questions.filter((q) => q.status === "open").length} open)`}>
          <div className="space-y-2 pt-1">
            {notebook.questions.length === 0 && <p className="text-sm text-gray-500">No doubts logged. Capture anything confusing the moment it appears.</p>}
            {notebook.questions.map((q) => (
              <div key={q.id} className="rounded-xl border border-border/60 bg-border/20 p-3">
                <p className={`text-sm ${q.status === "resolved" ? "text-gray-500 line-through" : "text-gray-100"}`}>{q.text}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {q.status === "open" ? (
                    <>
                      <button onClick={() => onDoubt("status", { id: q.id, status: "resolved" })} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300">Resolve</button>
                      <button onClick={() => onDoubt("to-revision", q.id)} className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-gray-300 hover:bg-border/40">Add to revision</button>
                    </>
                  ) : (
                    <button onClick={() => onDoubt("status", { id: q.id, status: "open" })} className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-gray-400">Reopen</button>
                  )}
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <input value={doubtText} onChange={(e) => setDoubtText(e.target.value)} placeholder="e.g. Why does 3NF allow…?" aria-label="New doubt"
                className="flex-1 rounded-xl border border-border bg-border/30 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none"
                onKeyDown={(e) => { if (e.key === "Enter") { onDoubt("add", doubtText); setDoubtText(""); } }} />
              <button onClick={() => { onDoubt("add", doubtText); setDoubtText(""); }} disabled={!doubtText.trim()}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Add</button>
            </div>
          </div>
        </Expander>

        <Expander open={expandedLearned} onToggle={() => setExpandedLearned(!expandedLearned)} icon={<Sparkles className="h-4 w-4" />} title="What I learned">
          <textarea value={learned} rows={3}
            onChange={(e) => { setLearned(e.target.value); queueSave({ learned: e.target.value }); }}
            placeholder="One or two lines…"
            className="mt-1 w-full rounded-xl border border-border bg-border/30 p-3 text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
        </Expander>

        <Expander open={expandedTomorrow} onToggle={() => setExpandedTomorrow(!expandedTomorrow)} icon={<MoonStar className="h-4 w-4" />} title="Tomorrow">
          <TomorrowBox defaultText={tomorrowDefault} value={tomorrow} setValue={setTomorrow} onSave={onTomorrow} />
        </Expander>
      </div>
    </section>
  );
}

function TomorrowBox({ defaultText, value, setValue, onSave }: { defaultText: string; value: string; setValue: (s: string) => void; onSave: (s: string) => Promise<void> }) {
  const [init, setInit] = useState(false);
  useEffect(() => { if (!init && defaultText && !value) { setValue(defaultText); setInit(true); } }, [defaultText, value, init, setValue]);
  const [savedTick, setSavedTick] = useState(false);
  return (
    <div className="pt-1">
      <textarea value={value} rows={2} onChange={(e) => setValue(e.target.value)} placeholder="What should tomorrow start with?"
        className="w-full rounded-xl border border-border bg-border/30 p-3 text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
      <button onClick={async () => { await onSave(value); setSavedTick(true); setTimeout(() => setSavedTick(false), 1500); }}
        className="mt-2 rounded-xl border border-border bg-border/30 px-4 py-2 text-[13px] font-bold text-gray-200 hover:bg-border/60">
        {savedTick ? "Saved ✓" : "Save"}
      </button>
    </div>
  );
}

function Expander({ open, onToggle, icon, title, children }: { open: boolean; onToggle: () => void; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60">
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between p-3.5 text-left">
        <span className="flex items-center gap-2 text-sm font-bold text-gray-200">{icon} {title}</span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-3.5 pb-3.5 animate-fadeIn">{children}</div>}
    </div>
  );
}

/* ---------------- plan-my-day modal ---------------- */

function PlanDayModal({ isOpen, onClose, available, priority, pace, horizons, onGenerate }: {
  isOpen: boolean; onClose: () => void;
  available: number; priority: FocusPriority;
  pace: any; horizons: any;
  onGenerate: (avail: number, prio: FocusPriority, goal: string) => Promise<void>;
}) {
  const [hours, setHours] = useState(available >= 600 ? 10 : available >= 540 ? 9 : 8);
  const [custom, setCustom] = useState("");
  const [prio, setPrio] = useState<FocusPriority>(priority);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!isOpen) return null;
  const avail = custom ? Math.max(60, Math.min(720, Math.round(Number(custom) * 60) || 0)) : hours * 60;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="relative max-h-[92vh] w-full max-w-md animate-fadeIn overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <button onClick={onClose} className="absolute right-4 top-4 p-2 text-gray-400 hover:text-white" aria-label="Close">✕</button>
        <h2 className="text-xl font-bold text-white">Plan my day</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
          <div className="rounded-xl bg-border/20 p-2.5"><p className="text-gray-500">Available</p><p className="text-base font-black text-white">{Math.round(avail / 60 * 10) / 10}h</p></div>
          <div className="rounded-xl bg-border/20 p-2.5"><p className="text-gray-500">GATE pace</p><p className="text-base font-black text-white">{pace?.requiredTopicsPerDay ?? "—"}/day</p></div>
          <div className="rounded-xl bg-border/20 p-2.5"><p className="text-gray-500">Deadline</p><p className="text-base font-black text-white">{horizons?.syllabusDeadline?.slice(2) ?? "—"}</p></div>
          <div className="rounded-xl bg-border/20 p-2.5"><p className="text-gray-500">Phase</p><p className="text-base font-black capitalize text-white">{horizons?.phase ?? "—"}</p></div>
        </div>
        <p className="mb-2 mt-5 text-xs font-bold text-gray-300">TIME AVAILABLE</p>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {[8, 9, 10].map((h) => (
            <button key={h} onClick={() => { setHours(h); setCustom(""); }}
              className={`rounded-xl border py-2.5 text-sm font-bold transition ${!custom && hours === h ? "border-accent bg-accent text-white" : "border-border bg-border/30 text-gray-400"}`}>{h}h</button>
          ))}
        </div>
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Custom hours" inputMode="decimal"
          className="mb-5 w-full rounded-xl border border-border bg-border/30 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
        <p className="mb-2 text-xs font-bold text-gray-300">PRIORITY</p>
        <div className="mb-5 flex flex-wrap gap-2">
          {(["Balanced", "GATE", "Roadmap", "Project", "Revision"] as FocusPriority[]).map((p) => (
            <button key={p} onClick={() => setPrio(p)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${prio === p ? "border-accent bg-accent text-white" : "border-border bg-border/30 text-gray-400"}`}>{p}</button>
          ))}
        </div>
        <p className="mb-2 text-xs font-bold text-gray-300">MUST FINISH TODAY? <span className="font-normal text-gray-500">(optional — reshapes the plan around it)</span></p>
        <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Finish DBMS Transactions"
          className="mb-5 w-full rounded-xl border border-border bg-border/30 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-accent focus:outline-none" />
        {err && <p className="mb-2 text-center text-xs font-semibold text-rose-400">{err}</p>}
        <button disabled={busy || avail < 60} onClick={async () => {
          setBusy(true); setErr(null);
          try { await onGenerate(avail, prio, goal.trim()); }
          catch { setErr("Generation failed — your current plan is untouched. Retry."); }
          finally { setBusy(false); }
        }} className="w-full rounded-xl bg-accent py-3 text-xs font-bold text-white shadow-md transition hover:bg-accent-hover disabled:opacity-50">
          {busy ? "Generating…" : "Generate"}
        </button>
      </div>
    </div>
  );
}
