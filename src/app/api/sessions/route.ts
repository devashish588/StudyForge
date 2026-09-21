import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayStr } from "@/lib/date";
import { creditDay, ensureDay } from "@/lib/credit";

// GET /api/sessions?date=YYYY-MM-DD
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? todayStr();
    const sessions = await prisma.studySession.findMany({
      where: { date },
      orderBy: [{ blockLabel: "asc" }, { title: "asc" }],
    });
    return NextResponse.json(sessions);
  } catch (e) {
    console.error("Sessions GET error:", e);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

// POST /api/sessions — create a flexible block (no clock time required)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const date: string = body.date ?? todayStr();
    const { title, category, taskId, subjectId, plannedMinutes, blockLabel, clockStart, clockEnd, notes } = body;
    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    let day = await prisma.studyDay.findUnique({ where: { date } });
    if (!day) {
      day = await prisma.studyDay.create({
        data: { date, plannedHours: 8.0, targetMinutes: 480, availableMinutes: 480 },
      });
    }
    const existingCount = await prisma.studySession.count({ where: { studyDayId: day.id } });
    const session = await prisma.studySession.create({
      data: {
        studyDayId: day.id,
        date,
        title: String(title).trim(),
        category: category || "Roadmap",
        taskId: taskId || null,
        subjectId: subjectId || null,
        plannedMinutes: Number(plannedMinutes) || 60,
        durationMinutes: Number(plannedMinutes) || 60,
        blockLabel: blockLabel || `Block ${existingCount + 1}`,
        clockStart: clockStart || null,
        clockEnd: clockEnd || null,
        notes: notes || null,
        completed: false,
        actualMinutes: 0,
      },
    });
    return NextResponse.json(session);
  } catch (e) {
    console.error("Sessions POST error:", e);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

// PATCH /api/sessions — update / complete a block; completing credits StudyDay
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, title, category, plannedMinutes, actualMinutes, completed, clockStart, clockEnd, notes, blockLabel } = body;
    if (!id) return NextResponse.json({ error: "Session id required" }, { status: 400 });
    const existing = await prisma.studySession.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const updated = await prisma.studySession.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: String(title) }),
        ...(category !== undefined && { category: String(category) }),
        ...(plannedMinutes !== undefined && { plannedMinutes: Number(plannedMinutes), durationMinutes: Number(plannedMinutes) }),
        ...(actualMinutes !== undefined && { actualMinutes: Number(actualMinutes) }),
        ...(completed !== undefined && { completed: Boolean(completed), endTime: completed ? new Date() : undefined }),
        ...(clockStart !== undefined && { clockStart }),
        ...(clockEnd !== undefined && { clockEnd }),
        ...(notes !== undefined && { notes }),
        ...(blockLabel !== undefined && { blockLabel: String(blockLabel) }),
      },
    });

    // If actual minutes changed, credit the DELTA to the session's day.
    // Delta semantics keep repeated edits from double-counting.
    const delta = updated.actualMinutes - existing.actualMinutes;
    if (delta !== 0) {
      await creditDay(updated.date, delta, updated.category);
    }

    return NextResponse.json(updated);
  } catch (e) {
    console.error("Sessions PATCH error:", e);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

// POST /api/sessions/log — log a finished timer run with pause-aware segments.
// Body: { sessionId?, title, category, plannedMinutes, blockLabel?,
//         segments: [{ startMs, endMs }], clockStart?, clockEnd? }
// Segments are split at local-midnight boundaries so multi-day runs credit
// each StudyDay correctly. Linked blocks absorb their own date's portion;
// continuation rows are created for the other dates.

// DELETE /api/sessions?id=...
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Session id required" }, { status: 400 });
    const existing = await prisma.studySession.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    // Roll back credited minutes (clamped at zero) and recompute core-day purely
    if (existing.actualMinutes > 0) {
      await creditDay(existing.date, -existing.actualMinutes, existing.category);
    }
    await prisma.studySession.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Sessions DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
