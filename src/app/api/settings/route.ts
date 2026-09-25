import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureUser } from "@/lib/user";

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

    // Bootstrap row is guaranteed to exist, so saves always persist
    // (previously a silent no-op on databases where seed never ran).
    const user = await ensureUser();
    {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...((dailyTargetHours || dailyTargetMinutes) && { dailyTargetHours: Number(dailyTargetHours ?? Number(dailyTargetMinutes) / 60) })
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
          ...(dailyTargetMinutes && { dailyTargetMinutes: Number(dailyTargetMinutes) }),
          ...(stretchTargetMinutes && { stretchTargetMinutes: Number(stretchTargetMinutes) }),
          ...(gateAllocation !== undefined && { gateAllocation: Number(gateAllocation) }),
          ...(roadmapAllocation !== undefined && { roadmapAllocation: Number(roadmapAllocation) }),
          ...(revisionAllocation !== undefined && { revisionAllocation: Number(revisionAllocation) }),
          ...(practiceAllocation !== undefined && { practiceAllocation: Number(practiceAllocation) }),
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
