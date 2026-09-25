// StudyForge Autonomous Orchestrator — deterministic scheduling kernel.
//
// DESIGN: pure functions, no I/O, no randomness, no LLM, no `new Date()`.
// Same inputs → same mission, always. The LLM may *explain* a choice, but
// this module is the sole source of truth for WHAT is scheduled.
//
// Pipeline:
//   unfinished work (with remaining minutes)
//     → priority-scored candidate pool (deadline > prereq > carry > weakness…)
//     → prerequisite gate (never schedule advanced before foundations)
//     → capacity fit with CORE > IMPORTANT > OPTIONAL protection order
//     → 4 cognitive blocks: EASY_START → HARD_DEEP → EASY_APPLY → RECALL
//     → schedule-risk math (required pace vs sustainable pace)

import type { PlanItem, PlanItemKind } from "./today-plan";

export type CognitiveBlock = "CARRY_OVER" | "EASY_START" | "HARD_DEEP" | "EASY_APPLY" | "RECALL";
export type Track = "GATE" | "AI_ENGINEERING" | "SOFTWARE_ENGINEERING" | "DSA";
export type CorePriority = "CORE" | "IMPORTANT" | "OPTIONAL";

export interface WorkCandidate {
  refType: string;
  refId: string;
  title: string;
  detail?: string;
  kind: PlanItemKind;
  track: Track;
  /** Remaining minutes to schedule (atomic — never the full estimate when partially done). */
  minutes: number;
  originalMinutes: number;
  difficulty: string; // Easy | Medium | Hard
  priority: CorePriority;
  carryOverCount: number;
  sourceDate: string | null;
  overdueDays: number;
  openErrors: number;
  confidence: number; // 1-5, low = weak
  dueDate: string | null;
  assignedDate: string;
  revisionDue: boolean;
  whyBase: string;
}

export interface PlannerContext {
  date: string;
  capacity: number; // target minutes
  stretch: number;
  daysToRoadmapEnd: number;
  daysToGateDeadline: number;
  gateBehind: boolean; // current pace < required pace
  aiBehind: boolean;
  sweBehind: boolean;
  projectDueSoon: boolean;
  completedTitles: Set<string>; // lowercase titles of completed work (prereq gate)
}

export interface Mission {
  carryOver: PlanItem[];
  easyStart: PlanItem[];
  hardDeepWork: PlanItem[];
  easyApply: PlanItem[];
  recall: PlanItem[];
  totalPlannedMinutes: number;
  remainingCapacity: number;
  deferred: PlanItem[]; // OPTIONAL work pushed for capacity (never deleted)
}

export interface ScheduleRisk {
  status: "ON_TRACK" | "AT_RISK" | "OVERLOAD";
  totalRemainingMinutes: number;
  availableMinutes: number;
  requiredPerDay: number;
  /** Measured pace, or null when no history exists yet (unknown, never 0). */
  sustainablePerDay: number | null;
  /** Null when sustainable pace is unknown (no gap can be computed). */
  gapPerDay: number | null;
  message: string;
  recovery: string[];
  /** OPTIONAL-tier remainder: spare-capacity only, never in the required pace. */
  optionalMinutes?: number;
  /** Horizon the math was computed against (Jan-15 feasibility window). */
  horizonDate?: string;
}

export interface RebalanceSignal {
  gateShare: number;
  aiShare: number;
  sweShare: number;
  reason: string;
}

// ---- track classification (deterministic, keyword-based) ----

export function classifyTrack(kind: PlanItemKind, categoryOrTitle: string): Track {
  if (kind === "GATE") return "GATE";
  const s = (categoryOrTitle || "").toLowerCase();
  if (kind === "PRACTICE" || /(dsa|core 100|leetcode|striver|neetcode)/.test(s)) return "DSA";
  if (/(ml|generative|rag|agent|llm|transformer|embedding|prompt|genai)/.test(s)) return "AI_ENGINEERING";
  return "SOFTWARE_ENGINEERING";
}

// Track progression chains (spec §4). A topic or PYQ/revision item whose title
// matches a later stage is BLOCKED while any earlier foundational stage topic is
// still in the incomplete set. Keyword-based so it works on existing data.
interface ProgressionChainItem {
  stage: number;
  re: RegExp;
  label: string;
}

const AI_CHAIN: ProgressionChainItem[] = [
  { stage: 0, re: /(python for ai|ml workflow|preprocessing|feature engineering|model selection|evaluation foundations)/i, label: "AI Foundations" },
  { stage: 1, re: /\btoken|context window/i, label: "Tokens & Context" },
  { stage: 2, re: /transformer|attention/i, label: "Transformers" },
  { stage: 3, re: /prompt/i, label: "Prompt Engineering" },
  { stage: 4, re: /embedding/i, label: "Embeddings" },
  { stage: 5, re: /vector|semantic search|chromadb|pinecone|chunking/i, label: "Vector Search" },
  { stage: 6, re: /\brag\b|retrieval|rerank|bm25|hybrid/i, label: "RAG" },
  { stage: 7, re: /evals?|evaluation|benchmark|grounding|citation/i, label: "RAG Evaluation" },
  { stage: 8, re: /agent|react loop|tool|langgraph|orchestrat|memory/i, label: "Agents" },
  { stage: 9, re: /production|deploy|docker|ci\/cd|k8s|kubernetes|observability|tracing|monitor|fastapi|redis/i, label: "Production AI" },
];

const DSA_CHAIN: ProgressionChainItem[] = [
  { stage: 0, re: /(dsa introduction|big-?o|complexity|asymptotic|dsa foundations)/i, label: "DSA Foundations & Big-O" },
  { stage: 1, re: /(array|vector)/i, label: "Arrays Fundamentals" },
  { stage: 2, re: /(string|pattern matching)/i, label: "Strings" },
  { stage: 3, re: /(linked list)/i, label: "Linked Lists" },
  { stage: 4, re: /(stack|queue)/i, label: "Stacks & Queues" },
  { stage: 5, re: /(binary search|two pointers|sliding window)/i, label: "Binary Search & Pointers" },
  { stage: 6, re: /(tree|binary tree|bst)/i, label: "Trees & BST" },
  { stage: 7, re: /(heap|priority queue)/i, label: "Heaps" },
  { stage: 8, re: /(graph|bfs|dfs)/i, label: "Graphs" },
  { stage: 9, re: /(backtracking|trie)/i, label: "Backtracking & Trie" },
  { stage: 10, re: /(\bdp\b|dynamic programming|greedy)/i, label: "DP & Greedy" },
];

const SWE_CHAIN: ProgressionChainItem[] = [
  { stage: 0, re: /(backend|http|rest|api|express)/i, label: "Backend & API Fundamentals" },
  { stage: 1, re: /(postgresql|sql|database|prisma|schema)/i, label: "Databases" },
  { stage: 2, re: /(redis|cache|queue|worker)/i, label: "Caching & Queues" },
  { stage: 3, re: /(testing|docker|ci\/cd|container)/i, label: "Testing & DevOps" },
  { stage: 4, re: /(system design|architecture)/i, label: "System Design" },
];

const GATE_CHAIN: ProgressionChainItem[] = [
  { stage: 0, re: /(discrete|logic|proposition|set theory|boolean)/i, label: "Discrete Math & Logic" },
  { stage: 1, re: /(c programming|data structure|algorithm)/i, label: "CS Fundamentals & Algorithms" },
  { stage: 2, re: /(operating system|dbms|computer network)/i, label: "Core CS Systems" },
  { stage: 3, re: /(compiler|theory of computation|digital logic)/i, label: "Theoretical CS" },
];

function getChainForTrack(track: Track): ProgressionChainItem[] {
  switch (track) {
    case "AI_ENGINEERING": return AI_CHAIN;
    case "DSA": return DSA_CHAIN;
    case "SOFTWARE_ENGINEERING": return SWE_CHAIN;
    case "GATE": return GATE_CHAIN;
  }
}

function getTopicStage(title: string, track: Track): number {
  const chain = getChainForTrack(track);
  const t = title.toLowerCase();
  let stage = -1;
  for (const c of chain) if (c.re.test(t)) stage = Math.max(stage, c.stage);
  return stage;
}

/** True when an earlier-chain topic is still incomplete → hold this item. */
export function prereqBlocked(candidate: WorkCandidate, incompleteTitles: string[]): string | null {
  const chain = getChainForTrack(candidate.track);
  const st = getTopicStage(candidate.title, candidate.track);
  const lowerIncomplete = incompleteTitles.map((t) => t.toLowerCase());

  // Prerequisite correctness > deadline priority > weakness > revision
  // Beginner protection rule: PYQs or revision items for a track are BLOCKED if foundational
  // (stage 0) roadmap/curriculum items for that track are still incomplete.
  const isPyqOrRevision = candidate.revisionDue || candidate.kind === "REVISION" || /(pyq|10 pyqs)/i.test(candidate.title);

  if (isPyqOrRevision && chain.length > 0) {
    const stage0 = chain[0];
    const hit = lowerIncomplete.find((t) => stage0.re.test(t));
    if (hit) {
      return `Prerequisite foundational topic “${stage0.label}” still incomplete — protected before PYQs or revision.`;
    }
  }

  if (st > 0) {
    for (const c of chain) {
      if (c.stage >= st) break;
      const hit = lowerIncomplete.find((t) => c.re.test(t));
      if (hit) return `Prerequisite “${c.label}” still incomplete — protected before advanced work.`;
    }
  }

  return null;
}

// ---- deterministic priority score (spec §9) ----
// Lower = scheduled earlier. Tuple compared lexicographically; final tiebreak
// is refId (stable) so output is fully deterministic.

export function priorityScore(c: WorkCandidate, ctx: PlannerContext): [number, number, number, number, number, string] {
  // Tier 0: overdue carry-over (spec §9.1) — but NOT above hard deadline math.
  const isCarry = c.carryOverCount > 0 ? 0 : 1;

  // Prerequisite correctness > deadline priority:
  // Foundations (stage 0) sort before advanced work or PYQs when foundations are present.
  const st = getTopicStage(c.title, c.track);
  const foundationBonus = st === 0 ? -20 : 0;

  // Tier 1: deadline risk — GATE items escalate as Jan 15 nears; overdue grows.
  let deadline = 50;
  if (c.track === "GATE") {
    deadline = ctx.daysToGateDeadline <= 7 ? 2 : ctx.daysToGateDeadline <= 21 ? 5 : 10;
    if (ctx.gateBehind) deadline -= 3;
  } else if (c.dueDate && c.dueDate <= ctx.date) {
    deadline = 3; // project milestone due
  } else if (c.overdueDays >= 3) {
    deadline = 8;
  } else if (c.track === "AI_ENGINEERING" && ctx.aiBehind) {
    deadline = 12;
  } else if (c.track === "SOFTWARE_ENGINEERING" && ctx.sweBehind) {
    deadline = 12;
  }
  // Tier 2: weakness — open errors and low confidence sort earlier.
  const weakness = Math.max(0, 20 - c.openErrors * 4 - (5 - c.confidence) * 2);
  // Tier 3: revision due / PYQ repair sorts before fresh optional work.
  const repair = c.revisionDue ? 0 : c.kind === "GATE" && c.openErrors > 0 ? 1 : 5;
  // Tier 4: CORE > IMPORTANT > OPTIONAL (optional never crowds critical).
  const tier = c.priority === "CORE" ? 0 : c.priority === "IMPORTANT" ? 10 : 30;
  return [tier, deadline + foundationBonus, isCarry === 0 ? -10 : 0, weakness + repair, c.overdueDays > 0 ? -c.overdueDays : 0, c.refId];
}

export function compareCandidates(a: WorkCandidate, b: WorkCandidate, ctx: PlannerContext): number {
  const pa = priorityScore(a, ctx);
  const pb = priorityScore(b, ctx);
  for (let i = 0; i < 5; i++) {
    if (pa[i] !== pb[i]) return (pa[i] as number) - (pb[i] as number);
  }
  return pa[5] < pb[5] ? -1 : pa[5] > pb[5] ? 1 : 0;
}

// ---- remaining-minutes atomicity (spec §10) ----

export function remainingMinutes(estimated: number, actual: number, storedRemaining?: number | null): number {
  if (storedRemaining !== null && storedRemaining !== undefined && storedRemaining >= 0) {
    return Math.max(0, Math.round(storedRemaining));
  }
  return Math.max(0, Math.round(estimated - Math.max(0, actual)));
}

// ---- mission builder (spec §7, §8, §13) ----
// Jan-15 curriculum rhythm (6h day): EASY START 45–60m, HARD DEEP 2–2.5h,
// EASY APPLY 1.5–2h, RECALL 45–60m. Extra capacity pulls the next priority.

const EASY_START_MIN = 45;
const EASY_START_MAX = 60;
const HARD_MIN = 120;
const HARD_MAX = 150;
const APPLY_MIN = 90;
const APPLY_MAX = 120;
const RECALL_MIN = 45;
const RECALL_MAX = 60;

function toPlanItem(c: WorkCandidate, block: CognitiveBlock, why: string, date: string): PlanItem {
  return {
    id: `${date}:${block.toLowerCase()}:${c.refType}:${c.refId}`,
    kind: c.kind,
    tier: c.priority === "OPTIONAL" ? "COULD" : block === "RECALL" ? "SHOULD" : "MUST",
    title: c.title,
    detail: c.detail,
    minutes: c.minutes,
    refType: c.refType as PlanItem["refType"],
    refId: c.refId,
    why,
    done: false,
    learningStage: c.revisionDue || c.kind === "REVISION" ? "REVISED" : c.kind === "PRACTICE" ? "PRACTICED" : c.minutes < c.originalMinutes ? "LEARNING" : "NOT_STARTED",
    ...(c.sourceDate ? { movedFrom: c.sourceDate } : {}),
  };
}

function isEasyCandidate(c: WorkCandidate): boolean {
  if (c.revisionDue || c.kind === "REVISION") return true;
  if (c.difficulty === "Easy") return true;
  if (c.kind === "PRACTICE") return true;
  if (c.openErrors > 0 && c.minutes <= 60) return true;
  return false;
}

function isHardCandidate(c: WorkCandidate): boolean {
  if (c.kind === "REVISION") return false;
  if (c.kind === "PRACTICE" && c.minutes < 60) return false;
  if (c.difficulty === "Hard") return true;
  if (c.track === "AI_ENGINEERING" && c.priority === "CORE") return true;
  if (c.track === "GATE" && c.difficulty !== "Easy") return true;
  return c.minutes >= 90;
}

export function buildMission(candidates: WorkCandidate[], ctx: PlannerContext): Mission {
  const incompleteTitles = candidates.map((c) => c.title);
  // Prerequisite gate first — blocked items wait, never scheduled prematurely.
  const ready = candidates.filter((c) => !prereqBlocked(c, incompleteTitles.filter((t) => t !== c.title)));
  const blocked = candidates.filter((c) => prereqBlocked(c, incompleteTitles.filter((t) => t !== c.title)));
  const sorted = [...ready].sort((a, b) => compareCandidates(a, b, ctx));

  const carryOver: PlanItem[] = [];
  const easyStart: PlanItem[] = [];
  const hardDeepWork: PlanItem[] = [];
  const easyApply: PlanItem[] = [];
  const recall: PlanItem[] = [];
  const deferred: PlanItem[] = [];
  let used = 0;
  const cap = ctx.capacity;
  const take = (c: WorkCandidate, block: CognitiveBlock, why: string): boolean => {
    if (used + c.minutes > cap + 20 && block !== "CARRY_OVER") return false;
    const item = toPlanItem(c, block, why, ctx.date);
    if (block === "CARRY_OVER") carryOver.push(item);
    else if (block === "EASY_START") easyStart.push(item);
    else if (block === "HARD_DEEP") hardDeepWork.push(item);
    else if (block === "EASY_APPLY") easyApply.push(item);
    else recall.push(item);
    used += c.minutes;
    return true;
  };

  // 0. Carry-over protection (spec §12/§13): deadline-critical + prereq
  // carry first, capped so one bad day can't eat the whole mission.
  const carry = sorted.filter((c) => c.carryOverCount > 0);
  const carryCap = Math.round(cap * 0.35);
  let carryUsed = 0;
  for (const c of carry) {
    if (carryUsed + c.minutes > carryCap) break;
    if (take(c, "CARRY_OVER", `Unfinished ${c.sourceDate ? `from ${c.sourceDate}` : "earlier"} — StudyForge carried the remaining ${c.minutes}m forward.`)) {
      carryUsed += c.minutes;
    }
  }
  const rest = sorted.filter((c) => c.carryOverCount === 0);

  // 1. EASY START — warm-up: revision / recall / easy GATE / errors.
  let easyBudget = Math.min(EASY_START_MAX, Math.round(cap * 0.22));
  for (const c of rest.filter(isEasyCandidate)) {
    if (easyStart.reduce((a, i) => a + i.minutes, 0) >= easyBudget) break;
    if (easyStart.reduce((a, i) => a + i.minutes, 0) + c.minutes > EASY_START_MAX + 30) continue;
    take(c, "EASY_START", `${c.whyBase} Scheduled as warm-up: low activation energy first.`);
  }
  if (easyStart.length === 0) {
    const fallback = rest.find((c) => !isHardCandidate(c));
    if (fallback) take(fallback, "EASY_START", `${fallback.whyBase} Scheduled as warm-up.`);
  }

  // 2. HARD DEEP WORK — single highest-priority unresolved deep topic.
  const hardPool = rest.filter((c) => !easyStart.some((e) => e.refId === c.refId) && isHardCandidate(c));
  const hard = hardPool[0];
  if (hard) {
    const mins = Math.min(Math.max(hard.minutes, HARD_MIN), HARD_MAX);
    take({ ...hard, minutes: mins }, "HARD_DEEP", `${hard.whyBase} Deep-work slot: largest cognitive effort goes here.`);
  }

  // 3. EASY APPLY — convert understanding into execution.
  let applyBudget = Math.min(APPLY_MAX, Math.round(cap * 0.35));
  void applyBudget;
  for (const c of rest) {
    if (easyStart.some((e) => e.refId === c.refId) || hardDeepWork.some((e) => e.refId === c.refId)) continue;
    if (c.kind !== "PRACTICE" && c.kind !== "PROJECT" && c.kind !== "ROADMAP" && c.kind !== "GATE") continue;
    if (easyApply.reduce((a, i) => a + i.minutes, 0) >= APPLY_MAX) break;
    if (used + c.minutes > cap) {
      // Overload protection (spec §13): OPTIONAL defers first.
      if (c.priority === "OPTIONAL") {
        deferred.push(toPlanItem(c, "EASY_APPLY", `${c.whyBase} Deferred: capacity protected for critical work.`, ctx.date));
        continue;
      }
      if (used + c.minutes > cap + 20) continue;
    }
    take(c, "EASY_APPLY", `${c.whyBase} Apply slot: execution locks in the deep work.`);
    if (easyApply.reduce((a, i) => a + i.minutes, 0) >= APPLY_MIN) break;
  }

  // 4. RECALL — retention, fits remaining capacity.
  const recallPool = rest.filter(
    (c) =>
      !easyStart.some((e) => e.refId === c.refId) &&
      !hardDeepWork.some((e) => e.refId === c.refId) &&
      !easyApply.some((e) => e.refId === c.refId) &&
      (c.revisionDue || c.kind === "REVISION" || c.minutes <= RECALL_MAX)
  );
  const rec = recallPool[0] ?? rest.find((c) => ![...easyStart, ...hardDeepWork, ...easyApply].some((e) => e.refId === c.refId));
  if (rec && used + RECALL_MIN <= cap + 10) {
    const mins = Math.min(rec.minutes || RECALL_MIN, RECALL_MAX, Math.max(RECALL_MIN, cap - used));
    take({ ...rec, minutes: Math.max(15, mins) }, "RECALL", `${rec.whyBase} Recall slot: retention before the day closes.`);
  }

  // Anything CORE/IMPORTANT that didn't fit is NOT deleted — it becomes
  // tomorrow's candidate pool (route persists via tomorrowCandidates).
  for (const c of [...blocked, ...rest]) {
    const scheduled = [...carryOver, ...easyStart, ...hardDeepWork, ...easyApply, ...recall].some((e) => e.refId === c.refId);
    if (!scheduled && c.priority !== "OPTIONAL") {
      // keep list small & deterministic: top 3 unscheduled non-optional
      if (deferred.filter((d) => d.tier !== "COULD").length >= 3) break;
      deferred.push({ ...toPlanItem(c, "EASY_APPLY", `${c.whyBase} Didn't fit today — first candidate for tomorrow.`, ctx.date), tier: "SHOULD" });
    }
  }

  void EASY_START_MIN;
  return {
    carryOver, easyStart, hardDeepWork, easyApply, recall,
    totalPlannedMinutes: used,
    remainingCapacity: Math.max(0, cap - used),
    deferred,
  };
}

// ---- schedule-risk math (spec §14, §28) ----

export function computeScheduleRisk(args: {
  remainingByTrack: Record<Track, number>;
  daysLeft: number;
  /** Measured pace, or null when no history exists yet (unknown, never 0). */
  sustainablePerDay: number | null;
  capacityPerDay: number;
  /** Stretch pace for the no-history band rule (defaults to capacity). */
  stretchPerDay?: number;
  /** OPTIONAL-tier remainder (informational — excluded from required pace). */
  optionalMinutes?: number;
  horizonDate?: string;
}): ScheduleRisk {
  const total = Object.values(args.remainingByTrack).reduce((a, b) => a + b, 0);
  const denom = Math.max(1, args.daysLeft);
  const required = total / denom;
  const known = args.sustainablePerDay != null;
  const gap = known ? required - (args.sustainablePerDay as number) : null;
  const stretch = args.stretchPerDay ?? args.capacityPerDay;
  const good = Math.round((args.capacityPerDay + stretch) / 2);
  const status =
    gap == null
      ? required <= args.capacityPerDay ? "ON_TRACK" : required <= stretch ? "AT_RISK" : "OVERLOAD"
      : gap <= 0 ? "ON_TRACK" : required > args.capacityPerDay ? "OVERLOAD" : "AT_RISK";
  const fmt = (m: number) => `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
  const message =
    status === "ON_TRACK"
      ? `On track — ${fmt(total)} over ${denom}d needs ${fmt(required)}/day.`
      : gap == null
        ? `No history yet — ${fmt(required)}/day required · normal ${fmt(args.capacityPerDay)} · good pace ${fmt(good)} · stretch ${fmt(stretch)}.`
        : `Schedule risk detected — needs ${fmt(required)}/day, sustainable pace is ${fmt(args.sustainablePerDay as number)}/day (gap ${fmt(Math.abs(gap))}/day).`;
  const recovery =
    status === "ON_TRACK"
      ? []
      : [
          "Protect CORE work first; defer OPTIONAL until capacity opens.",
          "Hold GOOD pace (~7h) if keeping a weekly rest day; floor pace (6h) fits only with ≤10 rest days total.",
          "Reallocate track time toward the behind track (see rebalance signal).",
          "Prioritize high-value topics; move low-priority extensions past the deadline.",
        ];
  return {
    status, totalRemainingMinutes: Math.round(total), availableMinutes: Math.round(denom * args.capacityPerDay),
    requiredPerDay: Math.round(required),
    sustainablePerDay: known ? Math.round(args.sustainablePerDay as number) : null,
    gapPerDay: gap == null ? null : Math.round(gap), message, recovery,
    optionalMinutes: Math.round(args.optionalMinutes ?? 0),
    horizonDate: args.horizonDate,
  };
}

// ---- weekly rebalancing (spec §27) ----

export function weeklyRebalance(args: {
  gateProgress: number; aiProgress: number; sweProgress: number;
  gateBehind: boolean; aiBehind: boolean; sweBehind: boolean;
  baseShares: { gate: number; ai: number; swe: number };
}): RebalanceSignal {
  const s = { ...args.baseShares };
  const reasons: string[] = [];
  if (args.gateBehind) { s.gate = Math.min(0.6, s.gate + 0.1); s.swe = Math.max(0.05, s.swe - 0.05); reasons.push("GATE behind → +10% GATE"); }
  if (args.aiBehind) { s.ai = Math.min(0.55, s.ai + 0.1); s.swe = Math.max(0.05, s.swe - 0.05); reasons.push("AI roadmap behind → +10% AI Engineering"); }
  if (args.sweBehind) { s.swe = Math.min(0.55, s.swe + 0.08); s.ai = Math.max(0.05, s.ai - 0.04); reasons.push("Software track behind → +8% SWE"); }
  const total = s.gate + s.ai + s.swe || 1;
  return {
    gateShare: Math.round((s.gate / total) * 100) / 100,
    aiShare: Math.round((s.ai / total) * 100) / 100,
    sweShare: Math.round((s.swe / total) * 100) / 100,
    reason: reasons.join("; ") || "All tracks on pace — allocation unchanged.",
  };
}

// ---- pace adaptation (spec §25/§26): rolling history, never one-day spikes ----

export function adaptFactor(samples: { planned: number; actual: number }[]): number {
  const valid = samples.filter((s) => s.planned > 0 && s.actual > 0);
  if (valid.length < 3) return 1; // need a rolling window before adapting
  const ratios = valid.map((s) => s.actual / s.planned).sort((a, b) => a - b);
  // Trimmed mean (drop min/max) — robust against one unusual day.
  const trimmed = ratios.length > 4 ? ratios.slice(1, -1) : ratios;
  const mean = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  return Math.min(1.5, Math.max(0.7, Math.round(mean * 100) / 100));
}

export function journeyDay(dateStr: string, programStart = "2026-09-24"): number {
  const [y1, m1, d1] = programStart.split("-").map(Number);
  const [y2, m2, d2] = dateStr.split("-").map(Number);
  const a = new Date(y1, m1 - 1, d1, 12).getTime();
  const b = new Date(y2, m2 - 1, d2, 12).getTime();
  return Math.round((b - a) / 86400000) + 1;
}
