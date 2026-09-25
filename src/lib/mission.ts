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
import {
  buildCurriculumOutlook, daysToDeadline, AI_PROJECT_RE,
  type CurriculumOutlook,
} from "./curriculum";
import { diffDays, PROGRAM_END_STR, CURRICULUM_DEADLINE_DEFAULT } from "./date";
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
  /** Curriculum-completion outlook (required pace vs target date, per track).
      Powers the Today curriculum header and stays consistent with Learn. */
  curriculum?: CurriculumOutlook;
  adaptation?: {
    plannedMinutes: number;
    actualMinutes: number;
    completionRate: number;
    carryOverMinutes: number;
    sustainablePerDay: number | null;
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

  // ---- curriculum-completion pacing (single source for selection pressure,
  // risk math, and the Today/Learn outlook). Required work = CORE + IMPORTANT
  // only; OPTIONAL is spare-capacity-only. Same rows the risk math uses below.
  const curriculumDeadline = input.settings.curriculumDeadline || CURRICULUM_DEADLINE_DEFAULT;
  const syllabusDeadline = input.settings.syllabusDeadline;

  const gateOpenRows = input.gateTopics.filter((t) => !t.completed);
  const gateDoneCount = input.gateTopics.length - gateOpenRows.length;
  let gateRemaining = 0;
  let gatePrepRemaining = 0;
  let currOptional = 0;
  for (const t of gateOpenRows) {
    const mins = remainingMinutes(t.estimatedMinutes, 0, t.remainingMinutes);
    if (t.priority === "OPTIONAL") currOptional += mins;
    else gateRemaining += mins;
  }
  let aiRemaining = 0, sweRemaining = 0;
  let aiDone = 0, aiTotal = 0, sweDone = 0, sweTotal = 0;
  for (const t of input.roadmapTasks) {
    const bucket = t.track === "AI_ENGINEERING" ? "AI"
      : t.track === "SOFTWARE_ENGINEERING" ? "SWE"
      : t.track === "GATE_PREP" ? "GATEPREP"
      : (classifyTrack("ROADMAP", `${t.category} ${t.title}`) === "AI_ENGINEERING" ? "AI" : "SWE");
    const isDone = t.status === "COMPLETED" || t.status === "PRACTICE";
    if (bucket === "AI") { aiTotal++; if (isDone) aiDone++; }
    else if (bucket === "SWE") { sweTotal++; if (isDone) sweDone++; }
    if (isDone) continue;
    const mins = remainingMinutes(t.estimatedTimeMinutes, t.actualMinutes, t.remainingMinutes);
    if (t.priority === "OPTIONAL") { currOptional += mins; continue; }
    if (bucket === "AI") aiRemaining += mins;
    else if (bucket === "SWE") sweRemaining += mins;
    else gatePrepRemaining += mins; // exam-prep tasks pace against the GATE track
  }
  let aiProjRemaining = 0, sweProjRemaining = 0, projOptional = 0;
  for (const p of input.projects) {
    for (const t of p.tasks.filter((t) => !t.completed)) {
      const mins = Math.max(0, (t.estimatedMinutes ?? 60));
      if ((t.priority ?? "IMPORTANT") === "OPTIONAL") { projOptional += mins; continue; }
      if (AI_PROJECT_RE.test(`${p.name} ${t.title}`)) aiProjRemaining += mins;
      else sweProjRemaining += mins;
    }
  }
  const practiceSolved = input.practiceSolved ?? 0;
  const practiceTotal = input.practiceTotal ?? 0;
  const practiceRemaining = Math.max(0, input.practiceRemainingMinutes ?? 0);

  const recentActual = input.days.slice(-7).filter((d) => d.actualMinutes > 0).map((d) => d.actualMinutes);
  // No history → unknown (null), never 0. A zero would fake evidence and
  // force OVERLOAD on day one.
  const sustainable = recentActual.length ? Math.round(recentActual.reduce((a, b) => a + b, 0) / recentActual.length) : null;

  const curriculum = buildCurriculumOutlook(
    date,
    curriculumDeadline,
    [
      { key: "gate", label: "GATE", done: gateDoneCount, total: input.gateTopics.length, remainingMinutes: gateRemaining + gatePrepRemaining, deadline: syllabusDeadline },
      { key: "ai", label: "AI Engineering", done: aiDone, total: aiTotal, remainingMinutes: aiRemaining + aiProjRemaining, deadline: curriculumDeadline },
      { key: "swe", label: "Software Engineering", done: sweDone, total: sweTotal, remainingMinutes: sweRemaining + sweProjRemaining, deadline: curriculumDeadline },
      { key: "dsa", label: "DSA", done: practiceSolved, total: practiceTotal, remainingMinutes: practiceRemaining, deadline: curriculumDeadline },
    ],
    sustainable, capacity,
    { gate: 0.375, ai: 0.375, swe: 0.25, dsa: 0.25 },
    hasHistory,
    stretchMinutes
  );
  const behindByKey = new Map(curriculum.tracks.map((t) => [t.key, t.behind]));

  const ctx: PlannerContext = {
    date,
    capacity,
    stretch: stretchMinutes,
    daysToRoadmapEnd: daysToDeadline(date, curriculumDeadline),
    daysToGateDeadline: daysToGate,
    gateBehind: hasHistory && (plan.pace.driftTopicsPerDay ?? 0) < 0,
    // Real deadline-pressure signals (required pace vs pro-rata proven pace).
    // Previously hardcoded false, so behind tracks never got selection pressure.
    aiBehind: behindByKey.get("ai") ?? false,
    sweBehind: behindByKey.get("swe") ?? false,
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
  // Bucket split reuses the curriculum computation above (exam-prep tasks pace
  // with GATE; totals are identical to the previous inline computation).
  const remainingByTrack: Record<Track, number> = {
    GATE: gateRemaining + gatePrepRemaining,
    AI_ENGINEERING: aiRemaining + aiProjRemaining,
    SOFTWARE_ENGINEERING: sweRemaining + sweProjRemaining + practiceRemaining,
  };
  const optionalMinutes = currOptional + projOptional;
  // Overall horizon = Jan-15 syllabus deadline (114-day window); the Dec-31
  // roadmap milestone stays visible via pace/phase UI.
  const daysToHorizon = Math.max(1, diffDays(date, input.settings.syllabusDeadline) + (date <= input.settings.syllabusDeadline ? 1 : 0));
  const scheduleRisk = computeScheduleRisk({
    remainingByTrack,
    daysLeft: daysToHorizon,
    sustainablePerDay: sustainable,
    capacityPerDay: capacity,
    stretchPerDay: stretchMinutes,
    optionalMinutes,
    horizonDate: input.settings.syllabusDeadline,
  });

  const rebalance = weeklyRebalance({
    gateProgress: 0, aiProgress: 0, sweProgress: 0,
    gateBehind: ctx.gateBehind,
    aiBehind: ctx.aiBehind,
    sweBehind: ctx.sweBehind,
    baseShares: { gate: 0.375, ai: 0.375, swe: 0.25 },
  });

  // Fallback routing: if the mission builder left items unscheduled (e.g. all
  // blocked), route leftovers by the fixed block rules so /today always shows
  // exactly what to study in Easy → Hard → Easy → Recall order.  // These leftovers are VISIBLE but NOT capacity-fitted: their minutes count
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
  curriculum,
  deferred: mission.deferred,
  adaptation: input.adaptation,
  };
}
