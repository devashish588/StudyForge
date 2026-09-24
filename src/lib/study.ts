// StudyForge V2 — core study logic: streaks, core-day, planning, next-task.
// Pure functions (testable) + shared constants. No `new Date()` scattering:
// callers pass date strings; "today" comes from lib/date.

import { addDays, todayStr } from "./date";

export const CORE_DAY_MIN_MINUTES = 180; // 3h focused default
export const DAILY_TARGET_MINUTES_DEFAULT = 360; // 6h normal floor
export const DAILY_STRETCH_MINUTES_DEFAULT = 480; // 8h stretch

export type FocusPriority = "Balanced" | "GATE" | "Roadmap" | "Project" | "Revision";

export interface DayLike {
  date: string;
  actualMinutes: number;
  gateMinutes: number;
  roadmapMinutes: number;
  practiceMinutes: number;
  revisionMinutes: number;
  coreDayCompleted: boolean;
  restDay?: boolean;
}

/** Pure core-day derivation from minutes only — the stored flag is a cache, never an input. */
export function computeCoreDayPure(
  day: Pick<DayLike, "actualMinutes" | "gateMinutes" | "roadmapMinutes" | "practiceMinutes" | "revisionMinutes" | "restDay">,
  threshold = CORE_DAY_MIN_MINUTES
): boolean {
  if (day.restDay) return false;
  const hasGate = day.gateMinutes >= 30;
  const hasRoadmap = day.roadmapMinutes >= 30;
  const hasRevision = day.revisionMinutes >= 15;
  const balancedCore = hasGate && hasRoadmap && hasRevision;
  const hoursCore = day.actualMinutes >= threshold && (hasGate || hasRoadmap);
  return balancedCore || hoursCore;
}

export function isCoreDayComplete(day: DayLike, threshold = CORE_DAY_MIN_MINUTES): boolean {
  if (day.coreDayCompleted) return true; // cached flag (display fast-path)
  return computeCoreDayPure(day, threshold);
}

/** Intensity 0-5 for heatmap based on actual focused minutes. */
export function intensityLevel(minutes: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (minutes <= 0) return 0;
  if (minutes < 120) return 1;
  if (minutes < 240) return 2;
  if (minutes < 360) return 3;
  if (minutes < 480) return 4;
  return 5;
}

export function intensityColor(level: number): string {
  switch (level) {
    case 0: return "bg-border/30 border-border/40";
    case 1: return "bg-indigo-950 border-indigo-800";
    case 2: return "bg-indigo-800 border-indigo-600";
    case 3: return "bg-indigo-600 border-indigo-400";
    case 4: return "bg-emerald-600 border-emerald-400";
    case 5: return "bg-emerald-400 border-emerald-200";
    default: return "bg-border/30";
  }
}

/**
 * Calculate streak from StudyDay history (source of truth).
 * A day counts only on pure minute-derived core completion — never on a cached flag.
 * Consecutive calendar days ending today (or yesterday if today incomplete).
 * Pass minDate (e.g. program start) so pre-program days never count.
 */
export function calculateStreak(days: DayLike[], threshold = CORE_DAY_MIN_MINUTES, minDate?: string): {
  current: number; longest: number; thisMonth: number;
} {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const complete = (date: string): boolean => {
    if (minDate && date < minDate) return false;
    const d = byDate.get(date);
    if (!d || d.restDay) return false;
    if (d.actualMinutes >= threshold) {
      // Hours rule still needs at least one real focus area (prevents junk logging)
      if (d.gateMinutes >= 30 || d.roadmapMinutes >= 30) return true;
    }
    return computeCoreDayPure(d, threshold);
  };

  const today = todayStr();
  let cursor = complete(today) ? today : addDays(today, -1);
  let current = 0;
  // If neither today nor yesterday complete, current = 0 (but still compute longest)
  if (complete(cursor)) {
    while (complete(cursor)) {
      current++;
      cursor = addDays(cursor, -1);
      if (current > 1000) break;
    }
  } else {
    current = 0;
  }

  // Longest streak across all history (sorted)
  const sorted = [...days].map((d) => d.date).sort();
  let longest = 0, run = 0, prev: string | null = null;
  for (const ds of sorted) {
    if (!complete(ds)) { run = 0; prev = null; continue; }
    if (prev && addDays(prev, 1) === ds) run++;
    else run = 1;
    prev = ds;
    longest = Math.max(longest, run);
  }

  const monthPrefix = today.slice(0, 7);
  const thisMonth = days.filter((d) => d.date.startsWith(monthPrefix) && complete(d.date)).length;

  return { current, longest, thisMonth };
}

export interface PlanInput {
  availableMinutes: number;
  priority: FocusPriority;
  revisionDueCount: number;
}

export interface PlanOutput {
  gateMinutes: number;
  roadmapMinutes: number;
  practiceMinutes: number;
  revisionMinutes: number;
}

/** Flexible daily plan generator — 8h default, 10h stretch. No fixed clock times. */
export function generatePlan(input: PlanInput): PlanOutput {
  const total = Math.max(60, Math.min(720, Math.round(input.availableMinutes)));
  // Base allocation: GATE 37.5%, Roadmap 37.5%, Practice 12.5%, Revision 12.5%
  let gate = 0.375, roadmap = 0.375, practice = 0.125, revision = 0.125;
  switch (input.priority) {
    case "GATE": gate = 0.5; roadmap = 0.25; practice = 0.125; revision = 0.125; break;
    case "Roadmap": gate = 0.25; roadmap = 0.5; practice = 0.125; revision = 0.125; break;
    case "Project": gate = 0.3; roadmap = 0.45; practice = 0.15; revision = 0.1; break;
    case "Revision": gate = 0.3; roadmap = 0.3; practice = 0.1; revision = 0.3; break;
    default: break;
  }
  // If heavy revision backlog, shift 5% from practice to revision
  if (input.revisionDueCount >= 7) {
    const shift = 0.05;
    revision += shift;
    practice = Math.max(0.05, practice - shift);
  }
  const round15 = (m: number) => Math.round(m / 15) * 15;
  let g = round15(total * gate);
  let r = round15(total * roadmap);
  let p = round15(total * practice);
  let v = total - g - r - p; // remainder to revision (keeps sum exact)
  if (v < 15) { v = 15; p = Math.max(0, total - g - r - v); }
  return { gateMinutes: g, roadmapMinutes: r, practiceMinutes: p, revisionMinutes: v };
}

export interface NextTaskCandidate {
  id: string;
  title: string;
  kind: "GATE" | "Revision" | "Roadmap" | "Project" | "Backlog" | "Practice";
  overdueDays?: number;
  dueDate?: string;
  importance?: number; // 1-5
}

/** Priority engine: GATE scheduled > revision due > roadmap practice > project deadlines > backlog > optional. */
export function rankNextTasks(cands: NextTaskCandidate[]): NextTaskCandidate[] {
  const kindRank: Record<string, number> = {
    GATE: 1, Revision: 2, Roadmap: 3, Project: 4, Backlog: 5, Practice: 6,
  };
  return [...cands].sort((a, b) => {
    const overdueA = a.overdueDays ?? 0, overdueB = b.overdueDays ?? 0;
    if (overdueA >= 3 && overdueB < 3) return -1;
    if (overdueB >= 3 && overdueA < 3) return 1;
    const ka = kindRank[a.kind] ?? 9, kb = kindRank[b.kind] ?? 9;
    if (ka !== kb) return ka - kb;
    return (b.importance ?? 3) - (a.importance ?? 3);
  });
}
