// Mission bridge — converts the existing deterministic TodayPlan (+ engine
// inputs) into the autonomous 4-block mission WITHOUT re-scheduling.
// The existing engine remains the candidate source; this layer only:
//   1. attaches remaining-minutes atomicity (estimated − actual),
//   2. routes items into EASY_START → HARD_DEEP → EASY_APPLY → RECALL,
//   3. computes schedule risk, journey position, rebalance signals.
//
// Deterministic: block routing uses fixed kind/difficulty rules + stable
// priority order. No randomness, no LLM.

import {
  buildMission, classifyTrack, computeScheduleRisk, journeyDay,
  remainingMinutes, weeklyRebalance,
  type Mission, type PlannerContext, type ScheduleRisk, type Track, type WorkCandidate,
} from "./autonomous-planner";
import { diffDays, PROGRAM_END_STR } from "./date";
import type { EngineInput, PlanItem, TodayPlan } from "./today-plan";

export interface JourneyInfo {
  day: number;
  total: number;
  daysLeft: number;
  phase: string;
  targetMinutes: number;
  stretchMinutes: number;
  gateDeadline: string;
}

export interface MissionPayload {
  date: string;
  journey: JourneyInfo;
  carryOver: PlanItem[];
  easyStart: PlanItem[];
  hardDeepWork: PlanItem[];
  easyApply: PlanItem[];
  recall: PlanItem[];
  totalPlannedMinutes: number;
  /** Visible-but-not-capacity-fitted minutes (fallback overflow). Never
      presented as scheduled/required; informational only. */
  overflowMinutes: number;
  remainingCapacity: number;
  scheduleRisk: ScheduleRisk;
  rebalance: { gateShare: number; aiShare: number; sweShare: number; reason: string };
  deferred: PlanItem[];
  adaptation?: {
    plannedMinutes: number;
    actualMinutes: number;
    completionRate: number;
    carryOverMinutes: number;
    sustainablePerDay: number;
  };
}

function blockOf(item: PlanItem): PlanItem["block"] {
  if (item.block) return item.block;
  if (item.movedFrom) return "CARRY_OVER";
  if (item.kind === "REVISION") return item.tier === "MUST" ? "EASY_START" : "RECALL";
  if (item.kind === "PRACTICE") return "EASY_APPLY";
  if (item.kind === "PROJECT") return "EASY_APPLY";
  if (item.kind === "GATE") return item.difficulty === "Easy" ? "EASY_START" : "HARD_DEEP";
  // ROADMAP / BACKLOG / CUSTOM
  if (item.difficulty === "Hard") return "HARD_DEEP";
  if (item.difficulty === "Easy") return "EASY_START";
  return "EASY_APPLY";
}

function toCandidate(item: PlanItem, fallbackDate: string): WorkCandidate {
  const track: Track = item.track ?? classifyTrack(item.kind, `${item.detail ?? ""} ${item.title}`);
  const original = item.minutes;
  const actual = item.actualMinutes ?? 0;
  const mins = item.remainingMinutes ?? remainingMinutes(original, actual, null);
  return {
    refType: item.refType ?? "custom",
    refId: item.refId ?? item.id,
    title: item.title,
    detail: item.detail,
    kind: item.kind,
    track,
    minutes: Math.max(15, mins || original),
    originalMinutes: original,
    difficulty: item.difficulty ?? "Medium",
    priority: item.priority ?? (item.tier === "COULD" ? "OPTIONAL" : item.tier === "MUST" ? "CORE" : "IMPORTANT"),
    carryOverCount: item.carryOverCount ?? (item.movedFrom ? 1 : 0),
    sourceDate: item.sourceDate ?? item.movedFrom ?? null,
    overdueDays: 0,
    openErrors: 0,
    confidence: 3,
    dueDate: null,
    assignedDate: fallbackDate,
    revisionDue: item.kind === "REVISION",
    whyBase: item.why,
  };
}

export function buildMissionPayload(plan: TodayPlan, input: EngineInput, stretchMinutes: number): MissionPayload {
  const date = plan.date;
  const capacity = plan.targetMinutes;
  // User extras (extra === true) are recorded work, never scheduled work:
  // they stay out of capacity-fit so planned minutes never inflate.
  const items = plan.items.filter((i) => !i.done && !i.extra);

  // Enrich candidates with engine-level signals (errors, confidence, overdue).
  const errByTopic = new Map<string, number>();
  const confByTopic = new Map<string, number>();
  for (const t of input.gateTopics) {
    errByTopic.set(t.id, t.openErrors);
    confByTopic.set(t.id, t.confidence);
  }
  const candidates: WorkCandidate[] = items.map((it) => {
    const c = toCandidate(it, date);
    if (it.refType === "gateTopic" && it.refId) {
      c.openErrors = errByTopic.get(it.refId) ?? 0;
      c.confidence = confByTopic.get(it.refId) ?? 3;
    }
    const road = input.roadmapTasks.find((t) => t.id === it.refId);
    if (road) {
      c.overdueDays = road.assignedDate < date ? Math.max(0, diffDays(road.assignedDate, date)) : 0;
      c.carryOverCount = road.carryOverCount ?? c.carryOverCount;
      if (road.priority === "CORE" || road.priority === "IMPORTANT" || road.priority === "OPTIONAL") c.priority = road.priority;
      if (road.difficulty) c.difficulty = road.difficulty;
      // Atomicity: prefer stored remaining minutes from the source row.
      c.minutes = Math.max(15, remainingMinutes(road.estimatedTimeMinutes, road.actualMinutes, road.remainingMinutes));
    }
    const gate = input.gateTopics.find((t) => t.id === it.refId);
    if (gate) {
      c.minutes = Math.max(15, remainingMinutes(gate.estimatedMinutes, 0, gate.remainingMinutes));
      if (gate.priority === "CORE" || gate.priority === "IMPORTANT" || gate.priority === "OPTIONAL") c.priority = gate.priority;
      c.difficulty = gate.difficulty;
    }
    return c;
  });

  const daysToGate = Math.max(1, diffDays(date, input.settings.syllabusDeadline) + (date <= input.settings.syllabusDeadline ? 1 : 0));
  // "Behind" signals require real history — Day-1 zero baselines must not cry wolf.
  const hasHistory = input.days.length >= 7 || (plan.pace.currentTopicsPerDay ?? 0) > 0;
  const ctx: PlannerContext = {
    date,
    capacity,
    stretch: stretchMinutes,
    daysToRoadmapEnd: Math.max(1, diffDays(date, PROGRAM_END_STR) + 1),
    daysToGateDeadline: daysToGate,
    gateBehind: hasHistory && (plan.pace.driftTopicsPerDay ?? 0) < 0,
    aiBehind: false,
    sweBehind: false,
    projectDueSoon: false,
    completedTitles: new Set(plan.items.filter((i) => i.done).map((i) => i.title.toLowerCase())),
  };

  const mission: Mission = buildMission(candidates, ctx);

  // Map back to PlanItems, preserving the original item identity (no duplicates:
  // mission references the same refId; ids are namespaced per block).
  const pick = (list: typeof mission.carryOver) => list;
  void pick;

  const asItems = (built: ReturnType<typeof buildMission>["carryOver"], block: NonNullable<PlanItem["block"]>): PlanItem[] =>
    built.map((b) => {
      const orig = items.find((i) => (i.refId ?? i.id) === b.refId) ?? items.find((i) => i.title === b.title);
      // fitted: this item passed the builder's capacity fit (scheduled work).
      return { ...(orig ?? b), ...b, block, tier: b.tier, minutes: b.minutes, fitted: true };
    });

  const carryOver = asItems(mission.carryOver, "CARRY_OVER");
  const easyStart = asItems(mission.easyStart, "EASY_START");
  const hardDeepWork = asItems(mission.hardDeepWork, "HARD_DEEP");
  const easyApply = asItems(mission.easyApply, "EASY_APPLY");
  const recall = asItems(mission.recall, "RECALL");

  // Schedule risk from real remaining workload vs remaining capacity.
  // Jan-15 feasibility: CORE + IMPORTANT count toward required pace; OPTIONAL
  // is spare-capacity-only by design (spec §29) and reported separately.
  // Project milestones carry estimates, so they count too — nothing hidden.
  const remainingByTrack: Record<Track, number> = { GATE: 0, AI_ENGINEERING: 0, SOFTWARE_ENGINEERING: 0 };
  let optionalMinutes = 0;
  for (const t of input.gateTopics.filter((t) => !t.completed)) {
    const mins = remainingMinutes(t.estimatedMinutes, 0, t.remainingMinutes);
    if (t.priority === "OPTIONAL") optionalMinutes += mins;
    else remainingByTrack.GATE += mins;
  }
  for (const t of input.roadmapTasks.filter((t) => t.status !== "COMPLETED" && t.status !== "PRACTICE")) {
    const track = classifyTrack("ROADMAP", `${t.category} ${t.title}`);
    const mins = remainingMinutes(t.estimatedTimeMinutes, t.actualMinutes, t.remainingMinutes);
    if (t.priority === "OPTIONAL") optionalMinutes += mins;
    else remainingByTrack[track] += mins;
  }
  for (const p of input.projects) {
    for (const t of p.tasks.filter((t) => !t.completed)) {
      const mins = Math.max(0, (t.estimatedMinutes ?? 60));
      const track = /RAG|Agent|Chatbot|ML Prediction|Containerized/i.test(`${p.name} ${t.title}`) ? "AI_ENGINEERING" : "SOFTWARE_ENGINEERING";
      if ((t.priority ?? "IMPORTANT") === "OPTIONAL") optionalMinutes += mins;
      else remainingByTrack[track] += mins;
    }
  }
  // Practice bank (Core 100): unsolved remainder counts toward feasibility —
  // excluding it would understate required pace by ~78h.
  remainingByTrack.SOFTWARE_ENGINEERING += Math.max(0, input.practiceRemainingMinutes ?? 0);
  const recentActual = input.days.slice(-7).filter((d) => d.actualMinutes > 0).map((d) => d.actualMinutes);
  const sustainable = recentActual.length ? Math.round(recentActual.reduce((a, b) => a + b, 0) / recentActual.length) : capacity;
  // Overall horizon = Jan-15 syllabus deadline (114-day window); the Dec-31
  // roadmap milestone stays visible via pace/phase UI.
  const daysToHorizon = Math.max(1, diffDays(date, input.settings.syllabusDeadline) + (date <= input.settings.syllabusDeadline ? 1 : 0));
  const scheduleRisk = computeScheduleRisk({
    remainingByTrack,
    daysLeft: daysToHorizon,
    sustainablePerDay: sustainable,
    capacityPerDay: capacity,
    optionalMinutes,
    horizonDate: input.settings.syllabusDeadline,
  });

  const aiRemaining = remainingByTrack.AI_ENGINEERING;
  const sweRemaining = remainingByTrack.SOFTWARE_ENGINEERING;
  const rebalance = weeklyRebalance({
    gateProgress: 0, aiProgress: 0, sweProgress: 0,
    gateBehind: ctx.gateBehind,
    aiBehind: aiRemaining > sweRemaining * 1.5 && aiRemaining > 600,
    sweBehind: sweRemaining > aiRemaining * 1.5 && sweRemaining > 600,
    baseShares: { gate: 0.375, ai: 0.375, swe: 0.25 },
  });

  // Fallback routing: if the mission builder left items unscheduled (e.g. all
  // blocked), route leftovers by the fixed block rules so /today always shows
  // exactly what to study in Easy → Hard → Easy → Recall order.
  // These leftovers are VISIBLE but NOT capacity-fitted: their minutes count
  // toward overflowMinutes, never toward totalPlannedMinutes.
  const scheduledIds = new Set([...carryOver, ...easyStart, ...hardDeepWork, ...easyApply, ...recall].map((i) => i.refId ?? i.id));
  const fittedTotal = [...carryOver, ...easyStart, ...hardDeepWork, ...easyApply, ...recall].reduce((a, i) => a + i.minutes, 0);
  let overflowTotal = 0;
  const leftover = items.filter((i) => !scheduledIds.has(i.refId ?? i.id) && !i.done);
  for (const l of leftover) {
    const b = blockOf(l);
    // fitted: false — visible queued overflow, explicitly NOT scheduled work.
    const withBlock: PlanItem = { ...l, block: b, fitted: false };
    if (b === "CARRY_OVER") carryOver.push(withBlock);
    else if (b === "EASY_START") easyStart.push(withBlock);
    else if (b === "HARD_DEEP") hardDeepWork.push(withBlock);
    else if (b === "RECALL") recall.push(withBlock);
    else easyApply.push(withBlock);
    overflowTotal += withBlock.minutes;
  }

  // Metric semantics (fixed): totalPlannedMinutes = capacity-fitted minutes
  // ONLY. Fallback overflow is reported separately and never scheduled.
  const totalPlanned = fittedTotal;

  return {
    date,
    journey: {
      day: journeyDay(date),
      total: 99,
      daysLeft: Math.max(0, diffDays(date, PROGRAM_END_STR)),
      phase: plan.horizons.phase,
      targetMinutes: capacity,
      stretchMinutes,
      gateDeadline: input.settings.syllabusDeadline,
    },
    carryOver, easyStart, hardDeepWork, easyApply, recall,
    totalPlannedMinutes: totalPlanned,
    overflowMinutes: overflowTotal,
    remainingCapacity: Math.max(0, capacity - totalPlanned),
    scheduleRisk,
    rebalance,
    deferred: mission.deferred,
    adaptation: input.adaptation,
  };
}
