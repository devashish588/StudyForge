"use client";

// Today — daily execution checklist (StudyForge decides, user executes).
// Structure: header progress → planner-generated goals with checkable
// subtopics → one "+ Add extra" action. No timers, no notebook, no
// must/should tiers, no duplicated presentations.
//
// Data flow (single source of truth):
//   planner (fitted canonical items) → goal grouping → checklist
//     → existing progress/completion APIs → canonical backend state
//     → planner recalculation excludes completed work.

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { todayStr, formatDisplay, minutesToHM } from "@/lib/date";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { whyChips } from "@/components/tracks/HubBits";

interface PlanItem {
  id: string; kind: string; tier: "MUST" | "SHOULD" | "COULD";
  title: string; detail?: string; minutes: number;
  refType?: string; refId?: string; subjectName?: string; topicName?: string;
  why: string; done: boolean;
  pyqTarget?: number; pyqDone?: number; movedFrom?: string;
  block?: string; track?: string; priority?: string; difficulty?: string;
  actualMinutes?: number; remainingMinutes?: number; completionPercent?: number;
  carryOverCount?: number; sourceDate?: string | null;
  fitted?: boolean; extra?: boolean;
}

interface Goal {
  key: string;
  eyebrow: string;
  title: string;
  reason: string | null;
  subs: PlanItem[];
}

const MIRRORABLE = ["roadmapTask", "gateTopic", "projectTask"];

/** Canonical refs are source-of-truth-driven: unchecking would snap back on
    refresh, so done canonical subtopics stay checked (with explanation). */
function isCanonicalRef(item: PlanItem): boolean {
  return !!item.refId && (MIRRORABLE.includes(item.refType ?? "") || item.refType === "revisionItem");
}

function splitDetail(detail?: string): { category: string; rest: string } {
  if (!detail) return { category: "", rest: "" };
  const dot = detail.indexOf("·");
  if (dot < 0) return { category: "", rest: detail };
  return { category: detail.slice(0, dot).trim(), rest: detail.slice(dot + 1).trim() };
}

function goalKey(item: PlanItem): string {
  if (item.kind === "GATE" && item.subjectName) return `GATE:${item.subjectName}`;
  if (item.kind === "ROADMAP") {
    const { category } = splitDetail(item.detail);
    return `ROADMAP:${category || "Roadmap"}`;
  }
  if (item.kind === "PROJECT") {
    const { category } = splitDetail(item.detail);
    return `PROJECT:${category || "Project"}`;
  }
  if (item.kind === "REVISION") return "REVISION:Revision";
  if (item.kind === "PRACTICE") return "PRACTICE:Practice set";
  if (item.kind === "BACKLOG") return "BACKLOG:Backlog";
  return "CUSTOM:Extra";
}

function goalMeta(key: string, first: PlanItem): { eyebrow: string; title: string } {
  const [kind, name] = [key.split(":")[0], key.slice(key.indexOf(":") + 1)];
  if (kind === "GATE") return { eyebrow: "GATE", title: name };
  if (kind === "ROADMAP") {
    const { rest } = splitDetail(first.detail);
    const week = rest.split("—")[0]?.trim();
    return { eyebrow: name.toUpperCase() || "ROADMAP", title: week || name || "Roadmap" };
  }
  if (kind === "PROJECT") return { eyebrow: "PROJECT", title: name };
  if (kind === "REVISION") return { eyebrow: "REVISION", title: "Revision" };
  if (kind === "PRACTICE") return { eyebrow: "PRACTICE", title: "Practice set" };
  if (kind === "BACKLOG") return { eyebrow: "BACKLOG", title: "Backlog" };
  return { eyebrow: "EXTRA", title: "Extra" };
}

function goalReason(subs: PlanItem[]): string | null {
  for (const s of subs) {
    const chips = whyChips({
      carryOverCount: s.carryOverCount, movedFrom: s.movedFrom,
      priority: s.priority, kind: s.kind, why: s.why,
    }).filter((c) => c !== "High-priority core topic");
    if (chips.length > 0) return chips[0];
  }
  return null;
}

export default function TodayPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [mission, setMission] = useState<any>(null);
  const [studyDay, setStudyDay] = useState<{ actualMinutes: number; targetMinutes: number }>({ actualMinutes: 0, targetMinutes: 360 });
  const [notice, setNotice] = useState<{ text: string; key: number } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [extraOpen, setExtraOpen] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const date = todayStr();

  const showNotice = useCallback((text: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ text, key: Date.now() });
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }, []);

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch(`/api/today-plan?date=${todayStr()}`);
      if (!res.ok) throw new Error("Today's plan could not be loaded.");
      const data = await res.json();
      const items: PlanItem[] = [
        ...(data.plan?.items ?? []),
      ];
      setPlanItems(items);
      setMission(data.mission ?? null);
      setStudyDay({
        actualMinutes: data.studyDay?.actualMinutes ?? 0,
        targetMinutes: data.mission?.journey?.targetMinutes ?? data.studyDay?.targetMinutes ?? 360,
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Today's plan could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const patchPlan = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/today-plan", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: todayStr(), ...body }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || "Plan update failed");
    }
    return res.json().catch(() => ({}));
  }, []);

  // Goals from FITTED mission items only (scheduled work) + checked items
  // already recorded (done bucket items that are not extras). Overflow
  // (fitted !== true, undone) never renders as scheduled work.
  const goals: Goal[] = useMemo(() => {
    const fitted = (mission
      ? [...(mission.carryOver ?? []), ...(mission.easyStart ?? []), ...(mission.hardDeepWork ?? []), ...(mission.easyApply ?? []), ...(mission.recall ?? [])]
      : []).filter((i: PlanItem) => i.fitted === true);
    const fittedIds = new Set(fitted.map((i: PlanItem) => i.refId ?? i.id));
    const doneRecorded = planItems.filter(
      (i) => i.done && !i.extra && !fittedIds.has(i.refId ?? i.id)
    );
    const subs = [...fitted, ...doneRecorded];
    const order: string[] = [];
    const byKey = new Map<string, PlanItem[]>();
    for (const s of subs) {
      const k = goalKey(s);
      if (!byKey.has(k)) { byKey.set(k, []); order.push(k); }
      byKey.get(k)!.push(s);
    }
    return order.map((k) => {
      const list = byKey.get(k)!;
      const undoneFirst = [...list].sort((a, b) => Number(a.done) - Number(b.done));
      const meta = goalMeta(k, list[0]);
      return { key: k, eyebrow: meta.eyebrow, title: meta.title, reason: goalReason(list), subs: undoneFirst };
    });
  }, [mission, planItems]);

  const extras = useMemo(() => planItems.filter((i) => i.extra === true), [planItems]);

  const goalsDone = goals.filter((g) => g.subs.length > 0 && g.subs.every((s) => s.done)).length;
  const target = studyDay.targetMinutes || 360;
  const completedPct = Math.min(999, Math.round((studyDay.actualMinutes / Math.max(1, target)) * 100));

  const completeSubtopic = useCallback(async (sub: PlanItem) => {
    if (sub.done || pendingId) return;
    // PYQ sets complete only through logged PYQs (backend truth); a manual
    // check would snap back on refresh, so guide instead of faking it.
    if (sub.refType === "pyqSet" && (sub.pyqDone ?? 0) < (sub.pyqTarget ?? 10)) {
      showNotice(`Log ${(sub.pyqTarget ?? 10) - (sub.pyqDone ?? 0)} more PYQs on the GATE page — ${sub.pyqDone ?? 0}/${sub.pyqTarget ?? 10} so far.`);
      return;
    }
    setPendingId(sub.id);
    try {
      if (MIRRORABLE.includes(sub.refType ?? "") && sub.refId) {
        // Canonical completion: report the remaining allocation with an
        // explicit done flag (backend forces remaining 0 / pct 100 and marks
        // the source row complete, even with stale atomic residue).
        await patchPlan({
          action: "log-progress", itemId: sub.id,
          actualMinutes: sub.remainingMinutes ?? sub.minutes,
          stopped: true, carry: false, done: true,
        });
        showNotice(`Recorded — ${sub.title} complete`);
      } else if (sub.refType === "revisionItem" && sub.refId) {
        // Canonical revision flow (spaced-repetition state advances).
        const rr = await fetch("/api/revision", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: sub.refId, confidence: 3, recallResult: "Yes" }),
        });
        if (!rr.ok) throw new Error("Revision could not be recorded.");
        await patchPlan({ action: "toggle-item", itemId: sub.id, done: true });
        showNotice(`Revision recorded — ${sub.title}`);
      } else {
        // Plan-scoped items (practice sets, customs): plan truth only.
        await patchPlan({ action: "toggle-item", itemId: sub.id, done: true });
        showNotice(`Marked done — ${sub.title}`);
      }
      await fetchAll();
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "Could not record completion.");
    } finally {
      setPendingId(null);
    }
  }, [patchPlan, fetchAll, pendingId, showNotice]);

  const uncheckSubtopic = useCallback(async (sub: PlanItem) => {
    if (!sub.done || pendingId) return;
    if (isCanonicalRef(sub)) return; // source of truth lives in backend tables
    setPendingId(sub.id);
    try {
      await patchPlan({ action: "toggle-item", itemId: sub.id, done: false });
      await fetchAll();
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "Could not reopen.");
    } finally {
      setPendingId(null);
    }
  }, [patchPlan, fetchAll, pendingId, showNotice]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 pt-10" aria-label="Loading today's goals">
        <div className="h-20 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    );
  }

  if (loadError || !mission) {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-8 text-center">
          <p className="text-base font-bold text-rose-300">Today&apos;s plan could not be loaded</p>
          <p className="mt-1 text-sm text-gray-400">{loadError ?? "The planner did not return a mission. Check your connection and try again."}</p>
          <button onClick={() => { setLoading(true); fetchAll(); }} className="mt-4 min-h-[44px] rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white transition-colors duration-200 motion-reduce:transition-none hover:bg-accent-hover">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-24 md:space-y-10">
      {/* header: TODAY + compact progress */}
      <header className="pt-2">
        <p className="type-label">Today</p>
        <h1 className="type-h1 mt-1">{formatDisplay(date)}</h1>
        <p className="mt-2 text-[15px] font-semibold text-gray-300">
          {minutesToHM(target)} target · {minutesToHM(studyDay.actualMinutes)} completed
        </p>
        <div className="mt-3 max-w-md">
          <ProgressBar value={completedPct} label="Today's completed share of target" heightClass="h-2" />
        </div>
        <p className="type-metadata mt-2">Goals: {goalsDone} / {goals.length} complete</p>
        {mission?.curriculum && (
          <div className="mt-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3" aria-label="Curriculum progress">
            <p className="type-label">Curriculum target — finish by {mission.curriculum.targetDate}</p>
            <p className="mt-1 text-[13px] text-gray-300">
              {mission.curriculum.daysLeft} days left · {mission.curriculum.overall.percent}% complete
              ({minutesToHM(mission.curriculum.overall.remainingMinutes)} remaining)
            </p>
            <p className="mt-0.5 text-[13px] text-gray-300">
              Required pace: <b className="text-white">{minutesToHM(mission.curriculum.overall.requiredPerDay)}/day</b>
              {mission.curriculum.overall.status !== "ON_TRACK" && (
                <span className={mission.curriculum.overall.status === "OVERLOAD" ? "font-bold text-rose-300" : "font-bold text-amber-300"}>
                  {" "}· {mission.curriculum.overall.status === "OVERLOAD" ? "Overload" : "At risk"}
                </span>
              )}
            </p>
            {(() => {
              const normal = mission.journey?.targetMinutes ?? 360;
              const stretch = mission.journey?.stretchMinutes ?? 480;
              const good = Math.round((normal + stretch) / 2);
              return (
                <p className="type-metadata mt-1">
                  {minutesToHM(normal)} normal · {minutesToHM(good)} good pace · {minutesToHM(stretch)} stretch
                </p>
              );
            })()}
          </div>
        )}
      </header>

      {notice && (
        <div key={notice.key} role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-2.5 text-[13px] font-semibold text-emerald-200 animate-fadeIn">
          {notice.text}
        </div>
      )}

      {/* goals */}
      {goals.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="text-sm font-bold text-gray-200">No goals fitted for today yet</p>
          <p className="mt-1 text-[13px] text-gray-500">The planner hasn&apos;t scheduled work for this day, or everything overflowed to the queue. Open Today again after planning runs.</p>
          <button onClick={() => { setLoading(true); fetchAll(); }} className="mt-4 min-h-[44px] rounded-xl border border-border bg-border/30 px-5 py-2.5 text-sm font-bold text-gray-200 transition-colors duration-200 motion-reduce:transition-none hover:bg-border/60">Retry</button>
        </section>
      ) : (
        goals.map((g) => {
          const doneCount = g.subs.filter((s) => s.done).length;
          const complete = g.subs.length > 0 && doneCount === g.subs.length;
          return (
            <section key={g.key} aria-label={`${g.eyebrow} ${g.title}`} className={`rounded-2xl border p-5 transition-colors duration-200 ${complete ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card"}`}>
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="type-label">{g.eyebrow}</p>
                  <h2 className={`type-h2 mt-1 ${complete ? "text-gray-400 line-through" : ""}`}>{g.title}</h2>
                  {g.reason && !complete && <p className="mt-1 text-xs text-gray-500">{g.reason}</p>}
                </div>
                <p className="shrink-0 font-mono text-xs text-gray-400" aria-label={`${doneCount} of ${g.subs.length} subtopics complete`}>
                  {complete ? <span className="font-bold text-emerald-300">Complete ✓</span> : `${doneCount} / ${g.subs.length}`}
                </p>
              </div>
              <ul className="mt-3 space-y-1">
                {g.subs.map((s) => {
                  const locked = s.done && isCanonicalRef(s);
                  const pyqPending = s.kind === "GATE" && s.refType === "pyqSet" && !s.done && (s.pyqDone ?? 0) < (s.pyqTarget ?? 10);
                  return (
                    <li key={s.id}>
                      <label className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 transition-colors duration-200 motion-reduce:transition-none hover:bg-border/20 ${pendingId === s.id ? "opacity-60" : ""}`}>
                        <input
                          type="checkbox"
                          checked={s.done}
                          disabled={locked || pendingId === s.id || pyqPending}
                          onChange={() => { if (s.done) void uncheckSubtopic(s); else void completeSubtopic(s); }}
                          aria-label={`${s.title}${s.done ? ", completed" : ""}`}
                          title={locked ? "Recorded as complete in backend" : pyqPending ? `Log PYQs to complete (${s.pyqDone ?? 0}/${s.pyqTarget ?? 10})` : `Mark ${s.done ? "not done" : "done"}`}
                          className="h-6 w-6 shrink-0 cursor-pointer accent-emerald-500 disabled:cursor-default"
                        />
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[15px] font-semibold ${s.done ? "text-gray-500 line-through" : "text-gray-100"}`}>
                            {s.topicName ?? s.title}
                            {s.done && <span className="sr-only"> (completed)</span>}
                          </span>
                          <span className="type-metadata block">
                            {s.minutes}m
                            {s.refType === "pyqSet" ? ` · ${s.pyqDone ?? 0}/${s.pyqTarget ?? 10} PYQs` : ""}
                            {pyqPending ? (
                              <> · <Link href="/gate/questions" className="font-bold text-accent hover:underline">log PYQs</Link></>
                            ) : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      {/* extras */}
      {extras.length > 0 && (
        <section aria-label="Extras">
          <h2 className="type-h2">Extras</h2>
          <p className="type-metadata mt-1">Recorded beyond the plan — never scheduled minutes.</p>
          <ul className="mt-3 space-y-1 rounded-2xl border border-border bg-card p-3">
            {extras.map((s) => (
              <li key={s.id}>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-border/20">
                  <input
                    type="checkbox"
                    checked={s.done}
                    disabled={(s.done && isCanonicalRef(s)) || pendingId === s.id}
                    onChange={() => { if (s.done) void uncheckSubtopic(s); else void completeSubtopic(s); }}
                    aria-label={`${s.title}${s.done ? ", completed" : ""}`}
                    className="h-6 w-6 shrink-0 cursor-pointer accent-emerald-500 disabled:cursor-default"
                  />
                  <span className={`min-w-0 flex-1 truncate text-[15px] font-semibold ${s.done ? "text-gray-500 line-through" : "text-gray-100"}`}>
                    {s.title}
                    {s.done && <span className="sr-only"> (completed)</span>}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-gray-500">{s.minutes}m extra</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* one secondary action */}
      <section>
        <button
          onClick={() => setExtraOpen(true)}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-6 py-3 text-sm font-bold text-gray-300 transition-colors duration-200 motion-reduce:transition-none hover:border-accent/40 hover:text-white"
        >
          <span aria-hidden className="text-lg leading-none">+</span> Add extra
        </button>
      </section>

      {extraOpen && (
        <AddExtraModal
          date={date}
          planItems={planItems}
          onClose={() => setExtraOpen(false)}
          onDone={async () => { setExtraOpen(false); await fetchAll(); }}
          onNotice={showNotice}
        />
      )}
    </div>
  );
}

/* ---------------- + Add extra (one small modal, two modes) ---------------- */

function AddExtraModal({ date, planItems, onClose, onDone, onNotice }: {
  date: string;
  planItems: PlanItem[];
  onClose: () => void;
  onDone: () => Promise<void>;
  onNotice: (t: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [roadmap, setRoadmap] = useState<any[]>([]);
  const [gateTopics, setGateTopics] = useState<any[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [customMins, setCustomMins] = useState("30");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tasks").then((r) => r.json()).then((d) => setRoadmap(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/gate").then((r) => r.json()).then((d) => {
      const subs: any[] = d?.subjects || [];
      setGateTopics(subs.flatMap((s: any) => (s.topics || []).map((t: any) => ({ ...t, subjectName: s.name }))));
    }).catch(() => {});
  }, []);

  const knownRefIds = useMemo(() => new Set(planItems.map((i) => i.refId).filter(Boolean) as string[]), [planItems]);

  const q = query.trim().toLowerCase();
  const roadHits = (q ? roadmap.filter((t) => t.title.toLowerCase().includes(q) && t.status !== "COMPLETED") : []).slice(0, 6);
  const gateHits = (q ? gateTopics.filter((t) => t.name.toLowerCase().includes(q) && !t.completed) : []).slice(0, 6);

  const addCanonical = async (refType: string, ref: any, title: string, minutes: number, extra: Record<string, unknown>) => {
    // Duplicate prevention by canonical id (source of truth, not strings).
    const existing = planItems.find((i) => i.refId === ref.id);
    if (existing) {
      if (!existing.done) {
        // Complete the existing canonical presentation instead of duplicating.
        if (existing.refType === "pyqSet") {
          const need = Math.max(0, (existing.pyqTarget ?? 10) - (existing.pyqDone ?? 0));
          onNotice(need > 0 ? `Log ${need} more PYQs on the GATE page — ${existing.pyqDone ?? 0}/${existing.pyqTarget ?? 10} so far.` : `Marked complete — ${existing.title} (already on your plan, no duplicate)`);
          if (need <= 0) {
            await fetch("/api/today-plan", {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date, action: "toggle-item", itemId: existing.id, done: true }),
            });
          }
        } else if (existing.refType === "backlogItem") {
          onNotice("Backlog items resolve from their source — left unchanged, no duplicate created.");
        } else if ((["roadmapTask", "gateTopic", "projectTask"] as string[]).includes(existing.refType ?? "") && existing.refId) {
          await fetch("/api/today-plan", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date, action: "log-progress", itemId: existing.id, actualMinutes: existing.remainingMinutes ?? existing.minutes, stopped: true, carry: false, done: true }),
          });
          onNotice(`Marked complete — ${existing.title} (already on your plan, no duplicate)`);
        } else if (existing.refType === "revisionItem" && existing.refId) {
          const rr = await fetch("/api/revision", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: existing.refId, confidence: 3, recallResult: "Yes" }),
          });
          if (!rr.ok) throw new Error("Revision could not be recorded.");
          await fetch("/api/today-plan", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date, action: "toggle-item", itemId: existing.id, done: true }),
          });
          onNotice(`Marked complete — ${existing.title} (already on your plan, no duplicate)`);
        } else {
          await fetch("/api/today-plan", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date, action: "toggle-item", itemId: existing.id, done: true }),
          });
          onNotice(`Marked complete — ${existing.title} (already on your plan, no duplicate)`);
        }
      } else {
        onNotice(`Already complete — ${existing.title}`);
      }
      await onDone();
      return;
    }
    setBusyId(ref.id);
    try {
      const res = await fetch("/api/today-plan", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date, action: "add-item",
          item: { title, minutes, refType, refId: ref.id, ...extra },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Could not add extra.");
      if ((data as { duplicate?: boolean }).duplicate) {
        onNotice("Already on your plan — marked complete instead.");
      } else {
        // Immediately record it as done canonical work (user did it as extra).
        const added = (data.plan?.items ?? []).find((i: PlanItem) => i.refId === ref.id && !i.done);
        if (added && (["roadmapTask", "gateTopic", "projectTask"] as string[]).includes(refType)) {
          await fetch("/api/today-plan", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date, action: "log-progress", itemId: added.id, actualMinutes: added.remainingMinutes ?? added.minutes, stopped: true, carry: false, done: true }),
          });
        } else if (added) {
          await fetch("/api/today-plan", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date, action: "toggle-item", itemId: added.id, done: true }),
          });
        }
        onNotice(`Extra recorded — ${title}`);
      }
      await onDone();
    } catch (e) {
      onNotice(e instanceof Error ? e.message : "Could not add extra.");
    } finally {
      setBusyId(null);
    }
  };

  const addCustom = async () => {
    if (!customTitle.trim() || busyId) return;
    const dupe = planItems.some((i) => i.title.trim().toLowerCase() === customTitle.trim().toLowerCase());
    if (dupe) {
      onNotice("An item with that title is already on today's plan.");
      return;
    }
    setBusyId("custom");
    try {
      const res = await fetch("/api/today-plan", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, action: "add-item", item: { title: customTitle.trim(), minutes: Math.max(5, Math.min(480, Number(customMins) || 30)) } }),
      });
      if (!res.ok) throw new Error("Could not add extra.");
      onNotice(`Extra added — ${customTitle.trim()}`);
      setCustomTitle("");
      await onDone();
    } catch (e) {
      onNotice(e instanceof Error ? e.message : "Could not add extra.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Add extra">
      <div className="w-full max-w-md rounded-t-2xl border border-border bg-card p-5 shadow-2xl animate-fadeIn sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="type-h2">Add extra</h2>
          <button onClick={onClose} aria-label="Close add extra" className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 hover:bg-border/40">✕</button>
        </div>
        <label htmlFor="extra-search" className="type-label mt-4 block">Find existing task or topic</label>
        <input
          id="extra-search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Transactions, Arrays, Normalization…"
          className="mt-1.5 min-h-[44px] w-full rounded-xl border border-border bg-border/30 px-4 text-[15px] text-card-foreground placeholder:text-gray-500 focus:border-accent focus:outline-none"
        />
        {q && (
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {roadHits.map((t) => (
              <li key={t.id}>
                <button
                  disabled={busyId === t.id}
                  onClick={() => void addCanonical("roadmapTask", t, t.title, t.estimatedTimeMinutes ?? 60, {})}
                  className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2 text-left transition-colors duration-200 hover:bg-border/20 disabled:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-100">{t.title}</span>
                    <span className="type-metadata block">Roadmap{knownRefIds.has(t.id) ? " · already on plan" : ""}</span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-accent">{knownRefIds.has(t.id) ? "Complete" : "Add"}</span>
                </button>
              </li>
            ))}
            {gateHits.map((t) => (
              <li key={t.id}>
                <button
                  disabled={busyId === t.id}
                  onClick={() => void addCanonical("gateTopic", t, `${t.subjectName} — ${t.name}`, t.estimatedMinutes ?? 90, { subjectName: t.subjectName, topicName: t.name })}
                  className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2 text-left transition-colors duration-200 hover:bg-border/20 disabled:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-100">{t.subjectName} — {t.name}</span>
                    <span className="type-metadata block">GATE topic{knownRefIds.has(t.id) ? " · already on plan" : ""}</span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-accent">{knownRefIds.has(t.id) ? "Complete" : "Add"}</span>
                </button>
              </li>
            ))}
            {roadHits.length === 0 && gateHits.length === 0 && (
              <li className="px-1 py-2 text-[13px] text-gray-500">No matching open tasks or topics — add it as a custom extra below.</li>
            )}
          </ul>
        )}
        <div className="mt-4 border-t border-border/60 pt-4">
          <label htmlFor="extra-custom" className="type-label block">Custom one-off extra</label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="extra-custom" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Read 20 pages of system design notes"
              className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-border bg-border/30 px-4 text-[15px] text-card-foreground placeholder:text-gray-500 focus:border-accent focus:outline-none"
            />
            <input
              value={customMins} onChange={(e) => setCustomMins(e.target.value)} inputMode="numeric" aria-label="Minutes"
              className="min-h-[44px] w-20 shrink-0 rounded-xl border border-border bg-border/30 px-3 text-[15px] text-card-foreground focus:border-accent focus:outline-none"
            />
          </div>
          <button
            onClick={() => void addCustom()} disabled={!customTitle.trim() || !!busyId}
            className="mt-2 min-h-[44px] w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white transition-colors duration-200 motion-reduce:transition-none hover:bg-accent-hover disabled:opacity-50"
          >
            Add custom extra
          </button>
          <p className="type-metadata mt-2">Custom extras never mark curriculum complete. Extra time stays out of scheduled minutes.</p>
        </div>
      </div>
    </div>
  );
}
