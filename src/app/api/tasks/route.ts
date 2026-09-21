import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayStr, addDays } from "@/lib/date";
import { creditDay, ensureDay } from "@/lib/credit";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const where = date ? { assignedDate: date } : {};
    const tasks = await prisma.roadmapTask.findMany({
      where,
      include: { week: true },
      orderBy: { assignedDate: "asc" }
    });
    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { taskId, status, sitting, blockLabel, confidence, notes, actualMinutes, plannedMinutes } = body;

    if (!taskId && actualMinutes) {
      // Legacy timer-only payload without taskId: record as a session row so
      // every credited minute stays traceable (single source of truth).
      const today = todayStr();
      const mins = Number(actualMinutes) || 0;
      const day = await ensureDay(today);
      const count = await prisma.studySession.count({ where: { studyDayId: day.id } });
      await prisma.studySession.create({
        data: {
          studyDayId: day.id, date: today, title: "Focus session", category: "Roadmap",
          plannedMinutes: mins, durationMinutes: mins, actualMinutes: mins,
          blockLabel: `Block ${count + 1}`, completed: true,
        },
      });
      await creditDay(today, mins, "Roadmap");
      return NextResponse.json({ ok: true, creditedMinutes: mins });
    }

    const existingTask = await prisma.roadmapTask.findUnique({ where: { id: taskId } });
    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const today = todayStr();
    const updatedTask = await prisma.roadmapTask.update({
      where: { id: taskId },
      data: {
        ...(status && { status, completionDate: status === "COMPLETED" ? today : null }),
        ...(sitting && { sitting, blockLabel: sitting }),
        ...(blockLabel && { blockLabel, sitting: blockLabel }),
        ...(confidence !== undefined && { confidence }),
        ...(notes !== undefined && { notes }),
        ...(plannedMinutes !== undefined && { plannedMinutes: Number(plannedMinutes) }),
        ...(actualMinutes !== undefined && { actualMinutes: Number(actualMinutes) }),
      }
    });

    // Time logged against a task is recorded as a session row (traceable)
    // and credited to today's StudyDay.
    if (actualMinutes) {
      const mins = Number(actualMinutes);
      const day = await ensureDay(today);
      const count = await prisma.studySession.count({ where: { studyDayId: day.id } });
      await prisma.studySession.create({
        data: {
          studyDayId: day.id, date: today, title: updatedTask.title, category: "Roadmap",
          taskId: updatedTask.id, plannedMinutes: mins, durationMinutes: mins, actualMinutes: mins,
          blockLabel: `Block ${count + 1}`, completed: true,
        },
      });
      await creditDay(today, mins, "Roadmap");
    }

    // Auto-create revision item if task completed with confidence
    if (status === "COMPLETED" && confidence) {
      const daysToAdd = confidence <= 2 ? 1 : confidence <= 3 ? 3 : 7;
      const nextRevStr = addDays(todayStr(), daysToAdd);

      await prisma.revisionItem.create({
        data: {
          title: updatedTask.title,
          category: updatedTask.category,
          sourceId: updatedTask.id,
          sourceType: "ROADMAP",
          confidence,
          nextRevisionDate: nextRevStr,
          notes: (typeof notes === "string" && notes) || "Auto-created revision item from task completion."
        }
      });
    }

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error("Patch Task Error:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, category, estimatedTimeMinutes, sitting, blockLabel, practiceReq, assignedDate } = body;

    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const defaultWeek = await prisma.roadmapWeek.findFirst({ orderBy: { weekNumber: "asc" } });
    if (!defaultWeek) {
      return NextResponse.json({ error: "No active week found" }, { status: 400 });
    }

    const block = blockLabel || sitting || "Block 1";
    const newTask = await prisma.roadmapTask.create({
      data: {
        weekId: defaultWeek.id,
        title: String(title).trim(),
        category: category || "DSA",
        subtopics: JSON.stringify([String(title).trim()]),
        estimatedTimeMinutes: Number(estimatedTimeMinutes) || 60,
        practiceReq: practiceReq || "General practice",
        sitting: block,
        blockLabel: block,
        plannedMinutes: Number(estimatedTimeMinutes) || 60,
        status: "TODO",
        assignedDate: assignedDate || todayStr()
      }
    });

    return NextResponse.json(newTask);
  } catch (error) {
    console.error("Create Task Error:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
