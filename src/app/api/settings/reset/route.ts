import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/settings/reset — wipe user activity but keep curriculum structure.
// Body: { confirm: "RESET" }. Anything else → 400, nothing touched.
// Wiped: sessions, study days, backlog, GATE attempts/errors/mocks,
// practice, revision queue, notes, weekly reviews.
// Reset to baseline: roadmap tasks → TODO, GATE counters → 0,
// topics → incomplete, project tasks → incomplete, streaks → 0.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body?.confirm !== "RESET") {
      return NextResponse.json({ error: 'Type RESET to continue — nothing was deleted' }, { status: 400 });
    }

    await prisma.studySession.deleteMany();
    await prisma.studyDay.deleteMany();
    await prisma.backlogItem.deleteMany();
    await prisma.gateQuestion.deleteMany();
    await prisma.gateErrorLog.deleteMany();
    await prisma.gateMockTest.deleteMany();
    await prisma.practiceProblem.deleteMany();
    await prisma.revisionItem.deleteMany();
    await prisma.note.deleteMany();
    await prisma.weeklyReview.deleteMany();

    await prisma.roadmapTask.updateMany({
      data: { status: "TODO", completionDate: null, confidence: 3, actualMinutes: 0 },
    });
    await prisma.gateSubject.updateMany({ data: { solvedPYQs: 0, accuracy: 0 } });
    await prisma.gateTopic.updateMany({ data: { completed: false, confidence: 3 } });
    await prisma.projectTask.updateMany({ data: { completed: false } });
    await prisma.project.updateMany({ data: { progress: 0, milestoneStage: "Planning" } });
    await prisma.user.updateMany({ data: { currentStreak: 0, longestStreak: 0 } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Settings RESET error:", e);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
