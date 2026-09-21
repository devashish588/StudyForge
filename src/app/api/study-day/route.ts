import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayStr } from "@/lib/date";
import { generatePlan, computeCoreDayPure, type FocusPriority } from "@/lib/study";

// GET /api/study-day?date=YYYY-MM-DD — fetch one day with sessions
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? todayStr();
    let day = await prisma.studyDay.findUnique({
      where: { date },
      include: { sessions: { orderBy: [{ blockLabel: "asc" }, { title: "asc" }] } },
    });
    if (!day) {
      day = await prisma.studyDay.create({
        data: { date, plannedHours: 8.0, targetMinutes: 480, availableMinutes: 480 },
        include: { sessions: true },
      });
    }
    return NextResponse.json(day);
  } catch (e) {
    console.error("StudyDay GET error:", e);
    return NextResponse.json({ error: "Failed to fetch study day" }, { status: 500 });
  }
}

// PATCH /api/study-day — check-in (availableMinutes, focusPriority, plan)
// or wrap-up (dailyReflection, tomorrowPriority, problemsSolved, etc.)
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const date: string = body.date ?? todayStr();
    const {
      availableMinutes, focusPriority, targetMinutes,
      dailyReflection, tomorrowPriority, struggleNotes,
      problemsSolved, questionsReviewed, notes, restDay,
      gateMinutes, roadmapMinutes, practiceMinutes, revisionMinutes, actualMinutes,
    } = body;

    let day = await prisma.studyDay.findUnique({ where: { date } });
    if (!day) {
      day = await prisma.studyDay.create({
        data: { date, plannedHours: 8.0, targetMinutes: 480, availableMinutes: 480 },
      });
    }

    // If check-in provides availableMinutes/priority and no stored plan, generate one
    let planJson = day.planJson;
    const priority = (focusPriority ?? day.focusPriority ?? "Balanced") as FocusPriority;
    const avail = availableMinutes !== undefined ? Number(availableMinutes) : day.availableMinutes;
    const hasPlan = (() => { try { const p = JSON.parse(planJson || "{}"); return !!p.gateMinutes; } catch { return false; } })();
    if ((availableMinutes !== undefined || focusPriority) && !hasPlan) {
      const revDue = await prisma.revisionItem.count({ where: { nextRevisionDate: { lte: date } } });
      const plan = generatePlan({ availableMinutes: avail, priority, revisionDueCount: revDue });
      planJson = JSON.stringify(plan);
    }

    const updated = await prisma.studyDay.update({
      where: { date },
      data: {
        ...(availableMinutes !== undefined && { availableMinutes: Number(availableMinutes) }),
        ...(targetMinutes !== undefined && { targetMinutes: Number(targetMinutes), plannedHours: Number(targetMinutes) / 60 }),
        ...(focusPriority !== undefined && { focusPriority: String(focusPriority) }),
        ...(planJson !== day.planJson && { planJson }),
        ...(dailyReflection !== undefined && { dailyReflection: String(dailyReflection) }),
        ...(tomorrowPriority !== undefined && { tomorrowPriority: String(tomorrowPriority) }),
        ...(struggleNotes !== undefined && { struggleNotes: String(struggleNotes) }),
        ...(problemsSolved !== undefined && { problemsSolved: Number(problemsSolved) }),
        ...(questionsReviewed !== undefined && { questionsReviewed: Number(questionsReviewed) }),
        ...(notes !== undefined && { notes: String(notes) }),
        ...(restDay !== undefined && { restDay: Boolean(restDay) }),
        ...(gateMinutes !== undefined && { gateMinutes: Number(gateMinutes) }),
        ...(roadmapMinutes !== undefined && { roadmapMinutes: Number(roadmapMinutes) }),
        ...(practiceMinutes !== undefined && { practiceMinutes: Number(practiceMinutes) }),
        ...(revisionMinutes !== undefined && { revisionMinutes: Number(revisionMinutes) }),
        ...(actualMinutes !== undefined && { actualMinutes: Number(actualMinutes) }),
      },
      include: { sessions: true },
    });

    const core = computeCoreDayPure({
      actualMinutes: updated.actualMinutes,
      gateMinutes: updated.gateMinutes,
      roadmapMinutes: updated.roadmapMinutes,
      practiceMinutes: updated.practiceMinutes,
      revisionMinutes: updated.revisionMinutes,
      restDay: updated.restDay,
    });
    const final = core !== updated.coreDayCompleted
      ? await prisma.studyDay.update({ where: { date }, data: { coreDayCompleted: core }, include: { sessions: true } })
      : updated;

    return NextResponse.json(final);
  } catch (e) {
    console.error("StudyDay PATCH error:", e);
    return NextResponse.json({ error: "Failed to update study day" }, { status: 500 });
  }
}
