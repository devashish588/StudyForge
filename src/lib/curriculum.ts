// Curriculum-completion pacing — pure, deterministic helpers shared by the
// planner bridge, track/hub APIs, dashboard and Learn.
//
// The planner optimizes for CURRICULUM COMPLETION BY TARGET DATE:
//   requiredDailyPace = remainingWork / remainingStudyDays
//
// Study-day honesty: there is no rest-day configuration in settings, so
// remaining days are CALENDAR days and every consumer must label them as
// such. Rest days draw from the same buffer; the sustainable pace (measured
// from real sessions) is what keeps the math honest.
//
// Status thresholds mirror computeScheduleRisk exactly:
//   required <= sustainable → ON_TRACK
//   required <= capacity   → AT_RISK
//   otherwise              → OVERLOAD
//
// Only required work (CORE + IMPORTANT) counts toward completion deadlines;
// OPTIONAL is spare-capacity-only and reported separately, never in pace.

import { diffDays } from "./date";

export type PaceStatus = "ON_TRACK" | "AT_RISK" | "OVERLOAD";

export const STUDY_DAYS_NOTE =
  "Calendar days remaining — rest days draw from the same buffer; sustainable pace reflects actual study rhythm.";

/** Project-name test shared with the mission risk split (mission.ts):
    AI-matched milestones pace with AI Engineering, the rest with SWE. */
export const AI_PROJECT_RE = /RAG|Agent|Chatbot|ML Prediction|Containerized/i;

export function paceStatus(
  requiredPerDay: number,
  sustainablePerDay: number | null,
  capacityPerDay: number,
  stretchPerDay: number = capacityPerDay
): PaceStatus {
  if (sustainablePerDay == null) {
    // No proven pace: judge plan-fit against configured bands only.
    // Missing history is unknown, never zero — it must not force OVERLOAD.
    if (requiredPerDay <= capacityPerDay) return "ON_TRACK";
    if (requiredPerDay <= stretchPerDay) return "AT_RISK";
    return "OVERLOAD";
  }
  if (requiredPerDay <= sustainablePerDay) return "ON_TRACK";
  if (requiredPerDay <= capacityPerDay) return "AT_RISK";
  return "OVERLOAD";
}

/** Whole days from date (inclusive) to deadline, minimum 1. */
export function daysToDeadline(date: string, deadline: string): number {
  return Math.max(1, diffDays(date, deadline) + 1);
}

export interface TrackWorkInput {
  key: string;
  label: string;
  done: number;
  total: number;
  /** Required remainder in minutes (CORE + IMPORTANT only). */
  remainingMinutes: number;
  deadline: string;
}

export interface TrackOutlook {
  key: string;
  label: string;
  done: number;
  total: number;
  percent: number;
  remainingMinutes: number;
  deadline: string;
  daysLeft: number;
  requiredPerDay: number;
  /** Measured pace, or null when no history exists yet (unknown, never 0). */
  sustainablePerDay: number | null;
  capacityPerDay: number;
  status: PaceStatus;
  /** True when the track needs more than its pro-rata share of proven pace. */
  behind: boolean;
}

export function trackOutlook(
  date: string,
  t: TrackWorkInput,
  sustainablePerDay: number | null,
  capacityPerDay: number,
  opts: { share: number; historyOk: boolean; stretchPerDay?: number }
): TrackOutlook {
  const daysLeft = daysToDeadline(date, t.deadline);
  const requiredPerDay = Math.round(Math.max(0, t.remainingMinutes) / daysLeft);
  const behind =
    opts.historyOk && sustainablePerDay != null && sustainablePerDay > 0 && requiredPerDay > sustainablePerDay * opts.share;
  return {
    key: t.key,
    label: t.label,
    done: t.done,
    total: t.total,
    percent: t.total > 0 ? Math.round((t.done / t.total) * 100) : 0,
    remainingMinutes: Math.max(0, Math.round(t.remainingMinutes)),
    deadline: t.deadline,
    daysLeft,
    requiredPerDay,
    sustainablePerDay: sustainablePerDay == null ? null : Math.round(sustainablePerDay),
    capacityPerDay: Math.round(capacityPerDay),
    status: paceStatus(requiredPerDay, sustainablePerDay, capacityPerDay, opts.stretchPerDay ?? capacityPerDay),
    behind,
  };
}

export interface CurriculumOutlook {
  targetDate: string;
  daysLeft: number;
  studyDaysNote: string;
  overall: {
    done: number;
    total: number;
    percent: number;
    remainingMinutes: number;
    requiredPerDay: number;
    status: PaceStatus;
  };
  tracks: TrackOutlook[];
}

export function buildCurriculumOutlook(
  date: string,
  targetDate: string,
  tracks: TrackWorkInput[],
  sustainablePerDay: number | null,
  capacityPerDay: number,
  shares: Record<string, number>,
  historyOk: boolean,
  stretchPerDay: number = capacityPerDay
): CurriculumOutlook {
  const outs = tracks.map((t) =>
    trackOutlook(date, t, sustainablePerDay, capacityPerDay, {
      share: shares[t.key] ?? 0.25,
      historyOk,
      stretchPerDay,
    })
  );
  const done = outs.reduce((a, t) => a + t.done, 0);
  const total = outs.reduce((a, t) => a + t.total, 0);
  const remainingMinutes = outs.reduce((a, t) => a + t.remainingMinutes, 0);
  const daysLeft = daysToDeadline(date, targetDate);
  const requiredPerDay = Math.round(remainingMinutes / daysLeft);
  return {
    targetDate,
    daysLeft,
    studyDaysNote: STUDY_DAYS_NOTE,
    overall: {
      done,
      total,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
      remainingMinutes,
      requiredPerDay,
      status: paceStatus(requiredPerDay, sustainablePerDay, capacityPerDay, stretchPerDay),
    },
    tracks: outs,
  };
}
