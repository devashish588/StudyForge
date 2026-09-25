// Centralized date handling for StudyForge V3.
// All business logic MUST use these helpers — do not scatter `new Date()`.
// Application timezone: local device timezone, day boundary at local midnight.
//
// Active program: 2026-09-24 (Day 1) → 2026-12-31 (Day 99).
// STUDY_* constants below describe the legacy data window (kept only so
// historical/demo rows stay readable); all ACTIVE calculations must use
// the PROGRAM_* constants and getProgramDay()/getDaysRemaining().

export const STUDY_START_STR = "2026-08-24";
export const STUDY_END_STR = "2026-12-31";
export const TOTAL_STUDY_DAYS = 130;

export const PROGRAM_START_STR = "2026-09-24";
export const PROGRAM_END_STR = "2026-12-31";
export const PROGRAM_TOTAL_DAYS = 99;

/** Milestone program-days that trigger a subtle celebration (no confetti). */
export const MILESTONE_DAYS = [7, 14, 30, 50, 75, 99];

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function diffDays(a: string, b: string): number {
  const da = parseDateStr(a);
  const db = parseDateStr(b);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

/** 1-indexed day number within study window. Clamps below 1, allows >130 after end. */
export function dayNumber(dateStr: string): number {
  return diffDays(STUDY_START_STR, dateStr) + 1;
}

export function daysLeft(fromDateStr: string): number {
  const d = diffDays(fromDateStr, STUDY_END_STR);
  return Math.max(0, d);
}

export function isWithinWindow(dateStr: string): boolean {
  return dateStr >= STUDY_START_STR && dateStr <= STUDY_END_STR;
}

export function formatDisplay(dateStr: string): string {
  const d = parseDateStr(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function formatShort(dateStr: string): string {
  const d = parseDateStr(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

export function minutesToHM(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

export function weekNumberFor(dateStr: string): number {
  const dn = dayNumber(dateStr);
  return Math.min(15, Math.max(1, Math.ceil(dn / 7)));
}

/* ---------------- Active program (Sep 24 → Dec 31, 99 days) ---------------- */

/** 1-indexed program day. Returns <= 0 before Sep 24, > 99 after Dec 31. */
export function getProgramDay(dateStr: string): number {
  return diffDays(PROGRAM_START_STR, dateStr) + 1;
}

/** Whole days remaining until Dec 31 (0 once the program is over). */
export function getDaysRemaining(fromDateStr: string): number {
  return Math.max(0, diffDays(fromDateStr, PROGRAM_END_STR));
}

/** 0–100 progress through the 99-day program. */
export function getProgramProgress(dateStr: string): number {
  const d = getProgramDay(dateStr);
  return Math.min(100, Math.max(0, Math.round((d / PROGRAM_TOTAL_DAYS) * 100)));
}

export type ProgramStatus = "pre" | "active" | "done";

/** Pre-start before Sep 24, active through Dec 31, done after. */
export function getProgramStatus(dateStr: string): ProgramStatus {
  if (dateStr < PROGRAM_START_STR) return "pre";
  if (dateStr > PROGRAM_END_STR) return "done";
  return "active";
}

/** Whole days until Sep 24 starts (0 once started). */
export function getDaysUntilStart(fromDateStr: string): number {
  return Math.max(0, diffDays(fromDateStr, PROGRAM_START_STR));
}

/** True for seeded demo rows (never counted in active metrics). */
export function isDemoDay(day: { notes?: string | null; title?: string | null }): boolean {
  const text = `${day.notes ?? ""} ${day.title ?? ""}`;
  return text.includes("[demo]");
}

/* ---------------- Two-timeline program config (V3.1) ---------------- */

/** User planning deadline for first-pass GATE syllabus (NOT an official date). */
export const GATE_SYLLABUS_DEADLINE_DEFAULT = "2027-01-15";
/** Single authoritative curriculum-completion target (skills curriculum must
    finish by this date). User-configurable via settings; default = Dec 31. */
export const CURRICULUM_DEADLINE_DEFAULT = "2026-12-31";
/** Official GATE 2027 examination window (IIT Madras), subject to change. */
export const GATE_EXAM_WINDOW_START_DEFAULT = "2027-02-06";
export const GATE_EXAM_WINDOW_END_DEFAULT = "2027-02-21";

export type StudyPhase = "build" | "consolidation" | "final";

/**
 * Master timeline phase for a date:
 * build (Sep 24 → Dec 31): skills + first-pass GATE syllabus.
 * consolidation (Jan 1 → Jan 15): finish remaining syllabus.
 * final (Jan 16 → exam): revision + PYQs + mocks + weak areas.
 */
export function getStudyPhase(dateStr: string, syllabusDeadline = GATE_SYLLABUS_DEADLINE_DEFAULT): StudyPhase {
  if (dateStr <= PROGRAM_END_STR) return "build";
  if (dateStr <= syllabusDeadline) return "consolidation";
  return "final";
}

/** Human countdown: "~4.5 months" for long horizons, "N days" when close. */
export function formatCountdown(fromDateStr: string, toDateStr: string): string {
  const days = Math.max(0, diffDays(fromDateStr, toDateStr));
  if (days >= 60) {
    const months = Math.round((days / 30.44) * 10) / 10;
    return `~${months} months`;
  }
  return `${days} days`;
}

/** Whole days from one date to another, floored at 0. */
export function daysUntil(fromDateStr: string, toDateStr: string): number {
  return Math.max(0, diffDays(fromDateStr, toDateStr));
}
