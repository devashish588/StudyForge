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
  const items = plan.items.filter((i) => !i.done);

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
  const ctx: PlannerContext = {
    date,
    capacity,
    stretch: stretchMinutes,
    daysToRoadmapEnd: Math.max(1, diffDays(date, PROGRAM_END_STR) + 1),
    daysToGateDeadline: daysToGate,
    gateBehind: (plan.pace.driftTopicsPerDay ?? 0) < 0,
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
      return { ...(orig ?? b), ...b, block, tier: b.tier, minutes: b.minutes };
    });

  const carryOver = asItems(mission.carryOver, "CARRY_OVER");
  const easyStart = asItems(mission.easyStart, "EASY_START");
  const hardDeepWork = asItems(mission.hardDeepWork, "HARD_DEEP");
  const easyApply = asItems(mission.easyApply, "EASY_APPLY");
  const recall = asItems(mission.recall, "RECALL");

  // Schedule risk from real remaining workload vs remaining capacity.
  const remainingByTrack: Record<Track, number> = { GATE: 0, AI_ENGINEERING: 0, SOFTWARE_ENGINEERING: 0 };
  for (const t of input.gateTopics.filter((t) => !t.completed)) {
    remainingByTrack.GATE += remainingMinutes(t.estimatedMinutes, 0, t.remainingMinutes);
  }
  for (const t of input.roadmapTasks.filter((t) => t.status !== "COMPLETED" && t.status !== "PRACTICE")) {
    const track = classifyTrack("ROADMAP", `${t.category} ${t.title}`);
    remainingByTrack[track] += remainingMinutes(t.estimatedTimeMinutes, t.actualMinutes, t.remainingMinutes);
  }
  const recentActual = input.days.slice(-7).filter((d) => d.actualMinutes > 0).map((d) => d.actualMinutes);
  const sustainable = recentActual.length ? Math.round(recentActual.reduce((a, b) => a + b, 0) / recentActual.length) : capacity;
  const scheduleRisk = computeScheduleRisk({
    remainingByTrack,
    daysLeft: ctx.daysToRoadmapEnd,
    sustainablePerDay: sustainable,
    capacityPerDay: capacity,
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
  const scheduledIds = new Set([...carryOver, ...easyStart, ...hardDeepWork, ...easyApply, ...recall].map((i) => i.refId ?? i.id));
  const leftover = items.filter((i) => !scheduledIds.has(i.refId ?? i.id) && !i.done);
  for (const l of leftover) {
    const b = blockOf(l);
    const withBlock: PlanItem = { ...l, block: b };
    if (b === "CARRY_OVER") carryOver.push(withBlock);
    else if (b === "EASY_START") easyStart.push(withBlock);
    else if (b === "HARD_DEEP") hardDeepWork.push(withBlock);
    else if (b === "RECALL") recall.push(withBlock);
    else easyApply.push(withBlock);
  }

  const totalPlanned = [...carryOver, ...easyStart, ...hardDeepWork, ...easyApply, ...recall].reduce((a, i) => a + i.minutes, 0);

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
    remainingCapacity: Math.max(0, capacity - totalPlanned),
    scheduleRisk,
    rebalance,
    deferred: mission.deferred,
    adaptation: input.adaptation,
  };
}
