// Server-side day-credit helpers — the ONLY place StudyDay minute math lives.
import { prisma } from "./prisma";
import { computeCoreDayPure } from "./study";

export type CategoryField = "gateMinutes" | "roadmapMinutes" | "practiceMinutes" | "revisionMinutes";

export const CATEGORY_FIELD: Record<string, CategoryField> = {
  GATE: "gateMinutes",
  Roadmap: "roadmapMinutes",
  Practice: "practiceMinutes",
  Revision: "revisionMinutes",
  Project: "roadmapMinutes",
};

export async function ensureDay(date: string) {
  let day = await prisma.studyDay.findUnique({ where: { date } });
  if (!day) {
    day = await prisma.studyDay.create({
      data: { date, plannedHours: 6.0, targetMinutes: 360, availableMinutes: 360, stretchMinutes: 480 },
    });
  }
  return day;
}

/** Recompute the cached core-day flag purely from minutes. Call after any minute change. */
export async function recomputeDay(date: string) {
  const day = await prisma.studyDay.findUnique({ where: { date } });
  if (!day) return null;
  const core = computeCoreDayPure({
    actualMinutes: day.actualMinutes,
    gateMinutes: day.gateMinutes,
    roadmapMinutes: day.roadmapMinutes,
    practiceMinutes: day.practiceMinutes,
    revisionMinutes: day.revisionMinutes,
    restDay: day.restDay,
  });
  if (core !== day.coreDayCompleted) {
    return prisma.studyDay.update({ where: { date }, data: { coreDayCompleted: core } });
  }
  return day;
}

/** Credit (or debit, if minutes negative) a day's minutes + category. Clamped at zero. */
export async function creditDay(date: string, minutes: number, category: string) {
  const field = CATEGORY_FIELD[category] ?? "roadmapMinutes";
  const day = await ensureDay(date);
  const next = await prisma.studyDay.update({
    where: { date },
    data: {
      actualMinutes: Math.max(0, day.actualMinutes + minutes),
      [field]: Math.max(0, (day[field] as number) + minutes),
    },
  });
  await recomputeDay(date);
  return next;
}
