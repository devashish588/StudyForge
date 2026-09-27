import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureUser } from "@/lib/user";
import { isValidDateStr } from "@/lib/date";

export async function GET() {
  try {
    const user = await prisma.user.findFirst({
      include: { settings: true }
    });

    const roadmapTasks = await prisma.roadmapTask.findMany();
    const gateQuestions = await prisma.gateQuestion.findMany();
    const errorLogs = await prisma.gateErrorLog.findMany();
    const gateMocks = await prisma.gateMockTest.findMany();
    const revisionItems = await prisma.revisionItem.findMany();
    const practiceProblems = await prisma.practiceProblem.findMany();
    const projects = await prisma.project.findMany({ include: { tasks: true } });
    const notes = await prisma.note.findMany();
    const studyDays = await prisma.studyDay.findMany();
    const sessions = await prisma.studySession.findMany();
    const backlogItems = await prisma.backlogItem.findMany();
    const weeklyReviews = await prisma.weeklyReview.findMany();
    const gateSubjects = await prisma.gateSubject.findMany({ include: { topics: true } });

    const fullExport = {
      exportedAt: new Date().toISOString(),
      app: "studyforge",
      version: 2,
      user,
      roadmapTasks,
      gateQuestions,
      errorLogs,
      gateMocks,
      revisionItems,
      practiceProblems,
      projects,
      notes,
      studyDays,
      sessions,
      backlogItems,
      weeklyReviews,
      gateSubjects,
    };

    return NextResponse.json(fullExport);
  } catch (error) {
    return NextResponse.json({ error: "Failed to export settings & data" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { dailyTargetHours, dailyTargetMinutes, stretchTargetMinutes, schedulingMode, notifyReminders, preferredSittings, gateAllocation, roadmapAllocation, revisionAllocation, practiceAllocation, gateSyllabusDeadline, gateExamWindowStart, gateExamWindowEnd, gatePaperDate, curriculumDeadline } = body;

    // Boundary validation: malformed deadlines would poison pace math with
    // NaN; non-numeric allocations would write NaN to the database. Reject
    // bad deadlines (400, no write); clamp/ignore bad numerics.
    const badDates = [
      ["gateSyllabusDeadline", gateSyllabusDeadline],
      ["gateExamWindowStart", gateExamWindowStart],
      ["gateExamWindowEnd", gateExamWindowEnd],
      ["curriculumDeadline", curriculumDeadline],
    ].filter(([, v]) => v !== undefined && !isValidDateStr(v)).map(([k]) => k);
    if (gatePaperDate !== undefined && gatePaperDate !== null && !isValidDateStr(gatePaperDate)) {
      badDates.push("gatePaperDate");
    }
    if (badDates.length > 0) {
      return NextResponse.json({ error: `Invalid date (expected YYYY-MM-DD): ${badDates.join(", ")}` }, { status: 400 });
    }
    const frac = (v: unknown): number | undefined => {
      const n = Number(v);
      return v === undefined || !Number.isFinite(n) ? undefined : Math.min(1, Math.max(0, n));
    };
    const mins = (v: unknown): number | undefined => {
      // Absent/non-positive values are ignored (preserves the previous
      // ignore-falsy contract); anything else is clamped to [60, 720].
      const n = Math.round(Number(v));
      if (v === undefined || !Number.isFinite(n) || n <= 0) return undefined;
      return Math.min(720, Math.max(60, n));
    };

    // Bootstrap row is guaranteed to exist, so saves always persist
    // (previously a silent no-op on databases where seed never ran).
    const user = await ensureUser();
    {
      // dailyTargetHours mirror: only ever a finite positive number, else untouched.
      const hoursRaw = dailyTargetHours ?? (dailyTargetMinutes !== undefined ? Number(dailyTargetMinutes) / 60 : undefined);
      const hoursNum = hoursRaw === undefined ? undefined : Number(hoursRaw);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...((hoursNum !== undefined && Number.isFinite(hoursNum) && hoursNum > 0) && { dailyTargetHours: hoursNum })
        }
      });

      await prisma.userSettings.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          schedulingMode: schedulingMode || "Flexible",
          dailyTargetMinutes: Number(dailyTargetMinutes) || 360,
          stretchTargetMinutes: Number(stretchTargetMinutes) || 480,
        },
        update: {
          ...(notifyReminders !== undefined && { notifyReminders }),
          ...(preferredSittings && { preferredSittings: JSON.stringify(preferredSittings) }),
          ...(schedulingMode && { schedulingMode }),
          ...(mins(dailyTargetMinutes) !== undefined && { dailyTargetMinutes: mins(dailyTargetMinutes) }),
          ...(mins(stretchTargetMinutes) !== undefined && { stretchTargetMinutes: mins(stretchTargetMinutes) }),
          ...(frac(gateAllocation) !== undefined && { gateAllocation: frac(gateAllocation) }),
          ...(frac(roadmapAllocation) !== undefined && { roadmapAllocation: frac(roadmapAllocation) }),
          ...(frac(revisionAllocation) !== undefined && { revisionAllocation: frac(revisionAllocation) }),
          ...(frac(practiceAllocation) !== undefined && { practiceAllocation: frac(practiceAllocation) }),
          ...(gateSyllabusDeadline !== undefined && { gateSyllabusDeadline: String(gateSyllabusDeadline) }),
          ...(gateExamWindowStart !== undefined && { gateExamWindowStart: String(gateExamWindowStart) }),
          ...(gateExamWindowEnd !== undefined && { gateExamWindowEnd: String(gateExamWindowEnd) }),
          ...(gatePaperDate !== undefined && { gatePaperDate: gatePaperDate ? String(gatePaperDate) : null }),
          ...(curriculumDeadline !== undefined && { curriculumDeadline: String(curriculumDeadline) }),
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
