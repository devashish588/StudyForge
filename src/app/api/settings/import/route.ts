import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/settings/import — restore a backup produced by GET /api/settings.
// Designed for restore-after-reset: rows whose id already exists are skipped
// (no duplicates, no overwrites); missing rows are recreated with their
// original ids so relations (sessions→days, tasks→weeks, topics→subjects)
// stay intact.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const backup = body.backup ?? body;
    if (!backup || typeof backup !== "object") {
      return NextResponse.json({ error: "Invalid backup file" }, { status: 400 });
    }
    const counts: Record<string, number> = {};

    // Insert only rows whose id is absent. (SQLite has no skipDuplicates.)
    async function insertMissing(model: { findMany: (a: { select: { id: true } }) => Promise<{ id: string }[]>; createMany: (a: { data: never[] }) => Promise<unknown> }, key: string, rows: unknown): Promise<void> {
      if (!Array.isArray(rows) || rows.length === 0) { counts[key] = 0; return; }
      const existing = new Set((await model.findMany({ select: { id: true } })).map((r) => r.id));
      const fresh = (rows as Record<string, unknown>[]).filter((r) => r && typeof r.id === "string" && !existing.has(r.id as string));
      for (const r of fresh) existing.add(r.id as string); // dedupe within file
      const deduped = fresh.filter((r, i) => fresh.findIndex((x) => x.id === r.id) === i);
      if (deduped.length > 0) await model.createMany({ data: deduped as never[] });
      counts[key] = deduped.length;
    }

    // Order matters: parents before children.
    await insertMissing(prisma.studyDay, "studyDays", backup.studyDays);
    await insertMissing(prisma.studySession, "sessions", backup.sessions);
    await insertMissing(prisma.roadmapTask, "roadmapTasks", backup.roadmapTasks);
    if (Array.isArray(backup.gateSubjects)) {
      let n = 0;
      for (const s of backup.gateSubjects) {
        const { topics, ...sub } = s;
        await prisma.gateSubject.upsert({
          where: { id: sub.id },
          create: sub,
          update: { solvedPYQs: sub.solvedPYQs, accuracy: sub.accuracy },
        });
        n++;
        if (Array.isArray(topics)) {
          for (const t of topics) {
            await prisma.gateTopic.upsert({
              where: { id: t.id },
              create: t,
              update: { completed: t.completed, confidence: t.confidence },
            });
            n++;
          }
        }
      }
      counts["gateSubjects"] = n;
    }
    await insertMissing(prisma.gateQuestion, "gateQuestions", backup.gateQuestions);
    await insertMissing(prisma.gateErrorLog, "errorLogs", backup.errorLogs);
    await insertMissing(prisma.gateMockTest, "gateMocks", backup.gateMocks);
    await insertMissing(prisma.revisionItem, "revisionItems", backup.revisionItems);
    await insertMissing(prisma.practiceProblem, "practiceProblems", backup.practiceProblems);
    if (Array.isArray(backup.projects)) {
      let n = 0;
      for (const p of backup.projects) {
        const { tasks, ...proj } = p;
        await prisma.project.upsert({
          where: { id: proj.id },
          create: proj,
          update: { progress: proj.progress, milestoneStage: proj.milestoneStage },
        });
        n++;
        if (Array.isArray(tasks)) {
          for (const t of tasks) {
            await prisma.projectTask.upsert({
              where: { id: t.id },
              create: t,
              update: { completed: t.completed, milestoneStage: t.milestoneStage, title: t.title },
            });
            n++;
          }
        }
      }
      counts["projects"] = n;
    }
    await insertMissing(prisma.note, "notes", backup.notes);
    await insertMissing(prisma.backlogItem, "backlogItems", backup.backlogItems);
    await insertMissing(prisma.weeklyReview, "weeklyReviews", backup.weeklyReviews);
    if (backup.user?.settings) {
      const { ...settingsData } = backup.user.settings as Record<string, unknown>;
      await prisma.userSettings.upsert({
        where: { userId: (backup.user.id as string) ?? "user_devashish" },
        create: { ...(settingsData as Record<string, never>), userId: (backup.user.id as string) ?? "user_devashish" },
        update: settingsData as Record<string, never>,
      });
      counts["settings"] = 1;
    }

    return NextResponse.json({ ok: true, restored: counts });
  } catch (e) {
    console.error("Settings IMPORT error:", e);
    return NextResponse.json({ error: "Import failed — existing data preserved where possible" }, { status: 500 });
  }
}
