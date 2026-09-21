// StudyForge V3.1 — deterministic daily study-plan engine.
// Syllabus → week → day → session → next action. No randomness, no clock
// times, no AI. Same inputs always produce the same plan; refresh-safe.
//
// Priority order (spec §23): GATE syllabus deadline > revision due >
// today's roadmap topic > GATE PYQs > project milestone > backlog >
// optional practice.

import { addDays, diffDays, PROGRAM_END_STR, getStudyPhase, formatCountdown, type StudyPhase } from "./date";
import type { FocusPriority } from "./study";

export type PlanTier = "MUST" | "SHOULD" | "COULD";
export type PlanItemKind = "GATE" | "ROADMAP" | "PRACTICE" | "REVISION" | "PROJECT" | "BACKLOG" | "CUSTOM";
export type PlanRefType = "gateTopic" | "roadmapTask" | "revisionItem" | "projectTask" | "backlogItem" | "session" | "pyqSet" | "custom" | "note";

export interface PlanItem {
  id: string;
  kind: PlanItemKind;
  tier: PlanTier;
  title: string;
  detail?: string;
  minutes: number;
  refType?: PlanRefType;
  refId?: string;
  subjectName?: string;
  topicName?: string;
  why: string;
  done: boolean;
  sessionId?: string | null;
  pyqTarget?: number;
  pyqDone?: number;
  movedFrom?: string;
}

export interface Doubt {
  id: string;
  text: string;
  status: "open" | "resolved";
  createdAt: string;
}

export interface NotebookData {
  goal: string;
  must: string[];
  notes: string;
  questions: Doubt[];
  learned: string;
}

export interface PaceInfo {
  gateTopicsRemaining: number;
  gatePyqsRemaining: number;
  daysToDeadline: number;
  requiredTopicsPerDay: number;
  requiredPyqsPerDay: number;
  requiredTopicsPerWeek: number;
  requiredPyqsPerWeek: number;
  currentTopicsPerDay: number;
  currentPyqsPerDay: number;
  projectedCompletionDate: string | null;
  onPace: boolean;
  driftTopicsPerDay: number;
  roadmapRemaining: number;
  roadmapDaysLeft: number;
  roadmapRequiredPerDay: number;
  roadmapCurrentPerDay: number;
  roadmapProjectedDate: string | null;
}

export interface WeekPlanDay {
  date: string;
  isToday: boolean;
  isPast: boolean;
  planned: number;
  actual: number;
}

export interface WeekPlan {
  weekStart: string;
  weekEnd: string;
  gateTopics: number;
  gatePyqs: number;
  roadmapTopics: number;
  practiceProblems: number;
  revisionItems: number;
  days: WeekPlanDay[];
}

export interface Horizons {
  phase: StudyPhase;
  buildDaysLeft: number;
  crackLabel: string;
  crackDays: number;
  syllabusDeadline: string;
  examWindowStart: string;
  examWindowEnd: string;
  paperDate: string | null;
  examCountdownLabel: string;
}

export interface TodayPlan {
  date: string;
  targetMinutes: number;
  goal: string;
  generatedAt: string;
  priorityMode: FocusPriority;
  locked: boolean;
  items: PlanItem[];
  calibration: Record<string, number>;
  logic: string[];
  pace: PaceInfo;
  week: WeekPlan;
  horizons: Horizons;
  tomorrowCandidates: PlanItem[];
  planFeedback?: string | null;
}

/* ---------------- input shapes (plain data, DB-agnostic) ---------------- */

export interface GateTopicInput {
  id: string;
  subjectId: string;
  subjectName: string;
  name: string;
  completed: boolean;
  confidence: number;
  estimatedMinutes: number;
  difficulty: string;
  pyqTarget: number;
  lastStudied: string | null;
  pyqsSolved: number;
  openErrors: number;
}

export interface RoadmapTaskInput {
  id: string;
  title: string;
  category: string;
  assignedDate: string;
  status: string;
  estimatedTimeMinutes: number;
  practiceReq: string;
  weekTitle?: string;
  actualMinutes: number;
}

export interface RevisionInput {
  id: string;
  title: string;
  category: string;
}

export interface BacklogInput {
  id: string;
  title: string;
  category: string;
  priority: string;
  estimatedMinutes: number;
  overdueDays: number;
}

export interface ProjectInput {
  id: string;
  name: string;
  tasks: { id: string; title: string; completed: boolean; milestoneStage: string }[];
}

export interface PrevMustInput {
  title: string;
  kind: PlanItemKind;
  minutes: number;
  detail?: string;
  refType?: PlanRefType;
  refId?: string;
  subjectName?: string;
  topicName?: string;
}

export interface EngineSettings {
  gateAllocation: number;
  roadmapAllocation: number;
  practiceAllocation: number;
  revisionAllocation: number;
  syllabusDeadline: string;
  examWindowStart: string;
  examWindowEnd: string;
  paperDate: string | null;
}

export interface EngineInput {
  date: string;
  availableMinutes: number;
  priorityMode: FocusPriority;
  manualGoal?: string;
  generatedAt: string;
  settings: EngineSettings;
  gateTopics: GateTopicInput[];
  roadmapTasks: RoadmapTaskInput[];
  revisionDue: RevisionInput[];
  backlog: BacklogInput[];
  projects: ProjectInput[];
  prevUnfinishedMust: PrevMustInput[];
  prevDate: string | null;
  calibration: Record<string, number>;
  days: { date: string; targetMinutes: number; actualMinutes: number }[];
  /** Yesterday's plan realism vote ("easy"|"ok"|"hard"): hard → slimmer MUST, easy → fuller MUST. */
  prevFeedback?: string | null;
}

/* ---------------- helpers ---------------- */

const round5 = (m: number) => Math.max(15, Math.round(m / 5) * 5);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";
}

function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  const dow = (dt.getDay() + 6) % 7; // Monday = 0
  dt.setDate(dt.getDate() - dow);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Calibrated minutes for a category (transparent adaptation, clamped). */
function calMinutes(base: number, category: string, calibration: Record<string, number>): number {
  const f = clamp(calibration[category] ?? 1, 0.7, 1.5);
  return round5(base * f);
}

/* ---------------- main engine ---------------- */

export function buildTodayPlan(input: EngineInput): TodayPlan {
  const {
    date, priorityMode, settings, gateTopics, roadmapTasks,
    revisionDue, backlog, projects, prevUnfinishedMust, prevDate,
    calibration, days, prevFeedback,
  } = input;
  const capacity = clamp(Math.round(input.availableMinutes), 60, 720);
  const phase = getStudyPhase(date, settings.syllabusDeadline);

  // ---- allocation weights (phase-aware, priority-adjusted) ----
  let w = {
    gate: settings.gateAllocation,
    roadmap: settings.roadmapAllocation,
    practice: settings.practiceAllocation,
    revision: settings.revisionAllocation,
  };
  if (phase === "consolidation") w = { gate: 0.4, roadmap: 0.15, practice: 0.15, revision: 0.3 };
  if (phase === "final") w = { gate: 0.45, roadmap: 0.05, practice: 0.15, revision: 0.35 };
  const boost: Record<FocusPriority, keyof typeof w | null> = {
    Balanced: null, GATE: "gate", Roadmap: "roadmap", Project: "roadmap", Revision: "revision",
  };
  const boosted = boost[priorityMode];
  if (boosted) {
    const extra = 0.1;
    const rest = (Object.keys(w) as (keyof typeof w)[]).filter((k) => k !== boosted);
    const restTotal = rest.reduce((a, k) => a + w[k], 0) || 1;
    w = { ...w, [boosted]: w[boosted] + extra };
    for (const k of rest) w[k] = Math.max(0.03, w[k] - extra * (w[k] / restTotal));
  }
  const budget = {
    gate: Math.round(capacity * w.gate),
    roadmap: Math.round(capacity * w.roadmap),
    practice: Math.round(capacity * w.practice),
    revision: Math.round(capacity * w.revision),
  };

  const logic: string[] = [
    `${Math.round(capacity / 60 * 10) / 10}h capacity → GATE ${budget.gate}m · Roadmap ${budget.roadmap}m · Practice ${budget.practice}m · Revision ${budget.revision}m`,
  ];
  if (phase !== "build") logic.push(`${phase === "final" ? "Final prep" : "Consolidation"} phase: roadmap work shrinks, revision + PYQs grow.`);
  if (boosted) logic.push(`Priority “${priorityMode}” boosts its share by ~10%.`);

  // ---- GATE pace ----
  const openTopics = gateTopics.filter((t) => !t.completed);
  const daysToDeadline = Math.max(1, diffDays(date, settings.syllabusDeadline) + (date <= settings.syllabusDeadline ? 1 : 0));
  const pyqRemaining = openTopics.reduce((a, t) => a + Math.max(0, t.pyqTarget - t.pyqsSolved), 0);
  const requiredTopicsPerDay = r1(openTopics.length / daysToDeadline);
  // PYQ pace measured against the exam window (PYQs continue past syllabus deadline)
  const daysToExam = Math.max(1, diffDays(date, settings.paperDate ?? settings.examWindowStart) + 1);
  const requiredPyqsPerDay = r1(pyqRemaining / daysToExam);
  const requiredTopicsPerWeek = r1((openTopics.length / daysToDeadline) * 7);
  // ---- candidate collectors (each returns items + minutes used) ----
  const must: PlanItem[] = [];
  const should: PlanItem[] = [];
  const could: PlanItem[] = [];
  const tomorrowCandidates: PlanItem[] = [];
  let mustUsed = 0, shouldUsed = 0;

  const topicPriority = (t: GateTopicInput): [number, number, string, string] => {
    // Documented rule (no invented scores): open errors first, then low
    // confidence, then stalest, then stable id order (deterministic).
    return [-t.openErrors, t.confidence, t.lastStudied ?? "0000-00-00", t.id];
  };
  const cmpTopic = (a: GateTopicInput, b: GateTopicInput) => {
    const pa = topicPriority(a), pb = topicPriority(b);
    if (pa[0] !== pb[0]) return pa[0] - pb[0];
    if (pa[1] !== pb[1]) return pa[1] - pb[1];
    if (pa[2] !== pb[2]) return pa[2] < pb[2] ? -1 : 1;
    return pa[3] < pb[3] ? -1 : pa[3] > pb[3] ? 1 : 0;
  };

  // ---- 1. carried-over unfinished MUST (candidate pool, never forced back to MUST) ----
  for (const p of prevUnfinishedMust.slice(0, 3)) {
    tomorrowCandidates.push({
      id: `${date}:carried:${slug(p.title)}`,
      kind: p.kind, tier: "SHOULD",
      title: p.title, detail: p.detail,
      minutes: p.minutes, refType: p.refType, refId: p.refId,
      subjectName: p.subjectName, topicName: p.topicName,
      why: `Carried over from ${prevDate ?? "yesterday"} — unfinished must-do, suggested not forced.`,
      done: false, movedFrom: prevDate ?? undefined,
    });
  }

  // ---- 2. GATE topics (priority 1) ----
  const gatePool = [...openTopics].sort(cmpTopic);
  const gateCount = Math.min(2, gatePool.length);
  const gateTopicItems: PlanItem[] = [];
  for (let i = 0; i < gateCount; i++) {
    const t = gatePool[i];
    const mins = calMinutes(t.estimatedMinutes || 90, "GATE", calibration);
    const reasons: string[] = [];
    if (t.openErrors > 0) reasons.push(`${t.openErrors} open error${t.openErrors === 1 ? "" : "s"} here`);
    if (t.confidence <= 2) reasons.push("low confidence");
    if (!t.completed) reasons.push("incomplete for the Jan 15 syllabus target");
    gateTopicItems.push({
      id: `${date}:gate:${t.id}`,
      kind: "GATE", tier: "MUST",
      title: `${t.subjectName} — ${t.name}`,
      detail: `${t.subjectName} → ${t.name}`,
      minutes: mins, refType: "gateTopic", refId: t.id,
      subjectName: t.subjectName, topicName: t.name,
      why: `Required for the GATE syllabus pace (${requiredTopicsPerDay}/day) — ${reasons.join(", ") || "scheduled next"}.`,
      done: false,
    });
  }

  // ---- 3. Roadmap today + overdue (priority 3) ----
  const incomplete = roadmapTasks.filter((t) => t.status !== "COMPLETED" && t.status !== "PRACTICE");
  const dueToday = incomplete.filter((t) => t.assignedDate === date).sort((a, b) => a.id.localeCompare(b.id));
  const overdue = incomplete.filter((t) => t.assignedDate < date).sort((a, b) => a.assignedDate.localeCompare(b.assignedDate) || a.id.localeCompare(b.id));
  const roadmapPool = [...dueToday, ...overdue.filter((t) => !dueToday.some((d) => d.id === t.id))];
  const roadmapItems: PlanItem[] = roadmapPool.slice(0, 3).map((t) => ({
    id: `${date}:roadmap:${t.id}`,
    kind: "ROADMAP", tier: "MUST",
    title: t.title,
    detail: `${t.category}${t.weekTitle ? ` · ${t.weekTitle}` : ""} — Learn → Practice → Recall`,
    minutes: calMinutes(t.estimatedTimeMinutes || 60, "Roadmap", calibration),
    refType: "roadmapTask", refId: t.id,
    why: t.assignedDate === date
      ? `Scheduled today${t.weekTitle ? ` in “${t.weekTitle}”` : ""}.`
      : `Overdue since ${t.assignedDate} — catching it keeps the week on track.`,
    done: false,
  }));

  // ---- 4. Revision due (priority 2, 10–15% of day) ----
  const revEach = 20;
  const revCount = Math.max(1, Math.min(revisionDue.length, Math.floor(budget.revision / revEach), 6));
  const revisionItems: PlanItem[] = revisionDue.slice(0, revCount).map((r) => ({
    id: `${date}:revision:${r.id}`,
    kind: "REVISION", tier: "MUST",
    title: r.title,
    detail: `${r.category} · ~${revEach}m recall`,
    minutes: revEach, refType: "revisionItem", refId: r.id,
    why: "Due today — spaced repetition only works on schedule.",
    done: false,
  }));

  // ---- 5. GATE PYQs (priority 4) ----
  // Weakest subject = most open errors, tiebreak lowest accuracy proxy (confidence).
  const bySubject = new Map<string, { name: string; openErrors: number; topics: number; solved: number; target: number }>();
  for (const t of gateTopics) {
    const s = bySubject.get(t.subjectName) ?? { name: t.subjectName, openErrors: 0, topics: 0, solved: 0, target: 0 };
    s.topics++;
    s.openErrors += t.openErrors;
    s.solved += t.pyqsSolved;
    s.target += t.pyqTarget;
    bySubject.set(t.subjectName, s);
  }
  const weakSubj = [...bySubject.values()].sort((a, b) => b.openErrors - a.openErrors || (a.solved / Math.max(1, a.target)) - (b.solved / Math.max(1, b.target)))[0];
  const pyqCount = 10;
  const pyqItem: PlanItem | null = weakSubj ? {
    id: `${date}:pyq:${slug(weakSubj.name)}`,
    kind: "GATE", tier: "MUST",
    title: `${weakSubj.name} — ${pyqCount} PYQs`,
    detail: `${weakSubj.name} → timed set`,
    minutes: 60, refType: "pyqSet", refId: weakSubj.name,
    subjectName: weakSubj.name,
    pyqTarget: pyqCount, pyqDone: 0,
    why: weakSubj.openErrors > 0
      ? `Weakest area right now (${weakSubj.openErrors} open errors) — targeted repair.`
      : `Steady PYQ pace (${requiredPyqsPerDay}/day) keeps the exam average up.`,
    done: false,
  } : null;

  // ---- 6. Project milestone (priority 5) ----
  const activeProject = projects.find((p) => p.tasks.some((t) => !t.completed));
  const nextMilestone = activeProject?.tasks.filter((t) => !t.completed).sort((a, b) => a.id.localeCompare(b.id))[0];
  const projectItem: PlanItem | null = (activeProject && nextMilestone) ? {
    id: `${date}:project:${nextMilestone.id}`,
    kind: "PROJECT", tier: priorityMode === "Project" ? "MUST" : "SHOULD",
    title: `${activeProject.name} — ${nextMilestone.title}`,
    detail: `${activeProject.name} · ${nextMilestone.milestoneStage}`,
    minutes: priorityMode === "Project" ? 90 : 60,
    refType: "projectTask", refId: nextMilestone.id,
    why: priorityMode === "Project" ? "Today's stated priority is project work." : "One steady milestone keeps the portfolio moving without eating study time.",
    done: false,
  } : null;

  // ---- 7. Backlog (priority 6 — important + overdue only, max 1) ----
  const backlogPick = backlog
    .filter((b) => b.priority === "High" && b.overdueDays >= 2)
    .sort((a, b) => b.overdueDays - a.overdueDays || a.id.localeCompare(b.id))[0];
  const backlogItem: PlanItem | null = backlogPick ? {
    id: `${date}:backlog:${backlogPick.id}`,
    kind: "BACKLOG", tier: "SHOULD",
    title: backlogPick.title,
    detail: `${backlogPick.category} · ${backlogPick.overdueDays}d overdue`,
    minutes: Math.min(45, backlogPick.estimatedMinutes),
    refType: "backlogItem", refId: backlogPick.id,
    why: `High priority and ${backlogPick.overdueDays} days overdue — small slice only, never a dump.`,
    done: false,
  } : null;

  // ---- 8. Practice remainder (priority 7) ----
  // Practice fills its budget with problem sets (~8 min/problem).
  const practiceProblems = Math.max(3, Math.round(budget.practice / 8));
  const practiceItem: PlanItem = {
    id: `${date}:practice:set`,
    kind: "PRACTICE", tier: "SHOULD",
    title: `${practiceProblems} practice problems`,
    detail: `Mixed set · ~${budget.practice}m`,
    minutes: budget.practice, refType: "custom",
    why: "Every learning topic ships with a practice requirement — Learn → Practice → Recall.",
    done: false,
  };

  // ---- tier assignment with capacity fitting (3–5 majors, 5–10 subtasks) ----
  const majors: PlanItem[] = [...gateTopicItems, ...roadmapItems, ...revisionItems];
  if (pyqItem) majors.push(pyqItem);
  // MUST = first items up to ~65% of capacity AND at most 5.
  // Yesterday's realism vote adjusts the MUST budget transparently.
  const mustBudgetFactor = prevFeedback === "hard" ? 0.55 : prevFeedback === "easy" ? 0.75 : 0.65;
  if (prevFeedback === "hard" || prevFeedback === "easy") {
    logic.push(`Yesterday's plan felt “${prevFeedback === "hard" ? "too much" : "too easy"}” — MUST budget ${prevFeedback === "hard" ? "slimmed" : "expanded"} accordingly.`);
  }
  let mustBudget = Math.round(capacity * mustBudgetFactor);
  for (const it of majors) {
    if (must.length >= 5) break;
    if (mustUsed + it.minutes <= mustBudget + 30 || must.length < 2) {
      it.tier = "MUST";
      must.push(it);
      mustUsed += it.minutes;
    } else break;
  }
  // SHOULD = remaining majors + project + backlog + practice, up to ~100%
  const restMajors = majors.slice(must.length);
  const shouldPool: PlanItem[] = [...restMajors];
  if (projectItem) {
    if (projectItem.tier === "MUST") { must.push(projectItem); mustUsed += projectItem.minutes; }
    else shouldPool.push(projectItem);
  }
  if (backlogItem) shouldPool.push(backlogItem);
  shouldPool.push(practiceItem);
  let shouldBudget = capacity - mustUsed;
  for (const it of shouldPool) {
    if (shouldUsed + it.minutes <= shouldBudget + 20) {
      it.tier = "SHOULD";
      should.push(it);
      shouldUsed += it.minutes;
    } else {
      it.tier = "COULD";
      could.push(it);
    }
  }
  // Overflow safety: leftover revision due beyond the cap becomes candidates
  for (const r of revisionDue.slice(revCount, revCount + 3)) {
    tomorrowCandidates.push({
      id: `${date}:candidate:revision:${r.id}`,
      kind: "REVISION", tier: "SHOULD",
      title: r.title, detail: `${r.category} · ~20m recall`,
      minutes: 20, refType: "revisionItem", refId: r.id,
      why: "Didn't fit today's revision budget — first candidate for tomorrow.",
      done: false,
    });
  }

  // ---- manual goal override (carve from COULD, never destroy the plan) ----
  let goal = "";
  const goalBits: string[] = [];
  if (gateTopicItems[0]) goalBits.push(gateTopicItems[0].title);
  if (roadmapItems[0]) goalBits.push(roadmapItems[0].title);
  if (pyqItem) goalBits.push(`${pyqItem.pyqTarget} GATE PYQs`);
  if (revisionItems[0]) goalBits.push("revision");
  goal = goalBits.slice(0, 3).join(" + ") || "Steady study day";
  if (input.manualGoal && input.manualGoal.trim()) {
    goal = input.manualGoal.trim();
    const custom: PlanItem = {
      id: `${date}:custom:goal`,
      kind: "CUSTOM", tier: "MUST",
      title: input.manualGoal.trim().slice(0, 120),
      detail: "Your stated must-finish",
      minutes: 60, refType: "custom",
      why: "You marked this must-finish today — the plan adapts around it.",
      done: false,
    };
    must.push(custom);
    mustUsed += 60;
    // Carve 60m back out of COULD (drop lowest-priority overflow first)
    let freed = 0;
    while (freed < 60 && could.length > 0) {
      const dropped = could.pop()!;
      freed += dropped.minutes;
      tomorrowCandidates.push({ ...dropped, tier: "SHOULD", why: `${dropped.why} Pushed to make room for your must-finish goal.` });
    }
  }

  const items = [...must, ...should, ...could];

  // ---- calibration transparency ----
  const calNotes = Object.entries(calibration)
    .filter(([, f]) => Math.abs(f - 1) >= 0.1)
    .map(([cat, f]) => `${cat} estimates ×${f.toFixed(2)} from your last 14 days`);
  if (calNotes.length) logic.push(`Adapted: ${calNotes.join("; ")}.`);
  logic.push(`Based on: ${phase === "build" ? "today's roadmap" : "phase focus"} + GATE pace (${requiredTopicsPerDay}/day) + ${revisionDue.length} due revisions + ${Math.round(capacity / 60 * 10) / 10}h available.`);
  if (tomorrowCandidates.length) logic.push(`${tomorrowCandidates.length} item${tomorrowCandidates.length === 1 ? "" : "s"} queued as tomorrow candidates (overflow + unfinished).`);

  // ---- pace block ----
  const recentTopics = 0; // filled by route (needs completion dates); engine stays pure
  void recentTopics;

  // ---- week plan (Mon–Sun containing date) ----
  const weekStart = mondayOf(date);
  const weekEnd = addDays(weekStart, 6);
  const weekDays: WeekPlanDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const found = days.find((x) => x.date === d);
    weekDays.push({
      date: d, isToday: d === date, isPast: d < date,
      planned: d === date ? capacity : 0,
      actual: found?.actualMinutes ?? 0,
    });
  }

  return {
    date,
    targetMinutes: capacity,
    goal,
    generatedAt: input.generatedAt,
    priorityMode,
    locked: false,
    items,
    calibration,
    logic,
    pace: {
      gateTopicsRemaining: openTopics.length,
      gatePyqsRemaining: pyqRemaining,
      daysToDeadline,
      requiredTopicsPerDay,
      requiredPyqsPerDay,
      requiredTopicsPerWeek,
      requiredPyqsPerWeek: Math.max(1, Math.ceil(requiredPyqsPerDay * 7)),
      currentTopicsPerDay: 0, // filled by route from completion timestamps
      currentPyqsPerDay: 0,   // filled by route
      projectedCompletionDate: null, // filled by route
      onPace: true,                  // filled by route
      driftTopicsPerDay: 0,          // filled by route
      roadmapRemaining: incomplete.length,
      roadmapDaysLeft: Math.max(1, diffDays(date, PROGRAM_END_STR) + 1),
      roadmapRequiredPerDay: 0, // filled by route (needs phase-aware denominator)
      roadmapCurrentPerDay: 0,  // filled by route
      roadmapProjectedDate: null,
    },
    week: {
      weekStart, weekEnd,
      gateTopics: Math.max(1, Math.ceil(requiredTopicsPerDay * 7)),
      gatePyqs: Math.max(10, Math.ceil(requiredPyqsPerDay * 7)),
      roadmapTopics: 0, // filled by route
      practiceProblems: Math.max(15, practiceProblems * 5),
      revisionItems: revisionDue.length,
      days: weekDays,
    },
    horizons: {
      phase,
      buildDaysLeft: Math.max(0, diffDays(date, PROGRAM_END_STR) + (date <= PROGRAM_END_STR ? 1 : 0)),
      crackLabel: formatCountdown(date, settings.paperDate ?? settings.examWindowStart),
      crackDays: Math.max(0, diffDays(date, settings.paperDate ?? settings.examWindowStart)),
      syllabusDeadline: settings.syllabusDeadline,
      examWindowStart: settings.examWindowStart,
      examWindowEnd: settings.examWindowEnd,
      paperDate: settings.paperDate,
      examCountdownLabel: settings.paperDate
        ? `Your paper: ${settings.paperDate}`
        : `GATE 2027 window: ${settings.examWindowStart} → ${settings.examWindowEnd}`,
    },
    tomorrowCandidates,
  };
}

/** Monday–Sunday week range label helper for UI. */
export function weekLabel(weekStart: string, weekEnd: string): string {
  const [, sm, sd] = weekStart.split("-").map(Number);
  const [, em, ed] = weekEnd.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[sm - 1]} ${sd}–${months[em - 1] === months[sm - 1] ? "" : months[em - 1] + " "}${ed}`;
}
