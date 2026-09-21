import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDateStr } from "@/lib/date";
import { creditDay, ensureDay } from "@/lib/credit";
import { mergeAllocations } from "@/lib/sessions";

export const dynamic = "force-dynamic";

interface Segment { startMs: number; endMs: number }

// POST /api/sessions/log — persist a finished timer run.
// Body: { sessionId?, title, category, plannedMinutes, blockLabel?,
//         segments: [{ startMs, endMs }] }
// Running segments exclude paused periods. Minutes are split at local
// midnight so each StudyDay is credited exactly its share.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, title, category, plannedMinutes, blockLabel, segments } = body as {
      sessionId?: string;
      title?: string;
      category?: string;
      plannedMinutes?: number;
      blockLabel?: string;
      segments?: Segment[];
    };

    const segs = Array.isArray(segments) ? segments.filter((s) => Number.isFinite(s?.startMs) && Number.isFinite(s?.endMs) && s.endMs > s.startMs) : [];
    if (segs.length === 0) {
      return NextResponse.json({ error: "No running time to log (segments empty)" }, { status: 400 });
    }

    const allocations = mergeAllocations(segs);
    const total = allocations.reduce((a, x) => a + x.minutes, 0);
    if (total < 1) {
      return NextResponse.json({ error: "Session shorter than 1 minute — nothing logged" }, { status: 400 });
    }

    const cat = category || "Roadmap";
    const firstStart = new Date(Math.min(...segs.map((s) => s.startMs)));
    const lastEnd = new Date(Math.max(...segs.map((s) => s.endMs)));
    const fmtClock = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

    const rows: unknown[] = [];
    let linked = sessionId ? await prisma.studySession.findUnique({ where: { id: sessionId } }) : null;

    for (const alloc of allocations) {
      const day = await ensureDay(alloc.date);

      if (linked && linked.date === alloc.date) {
        // Linked block absorbs its own date's portion (absolute set + delta credit).
        const delta = alloc.minutes - linked.actualMinutes;
        const updatedRow = await prisma.studySession.update({
          where: { id: linked.id },
          data: {
            actualMinutes: alloc.minutes,
            completed: true,
            endTime: lastEnd,
            ...(plannedMinutes !== undefined && { plannedMinutes: Number(plannedMinutes), durationMinutes: Number(plannedMinutes) }),
          },
        });
        rows.push(updatedRow);
        if (delta !== 0) await creditDay(alloc.date, delta, updatedRow.category);
        linked = updatedRow;
      } else {
        // Continuation (or fresh) row for this date.
        const count = await prisma.studySession.count({ where: { studyDayId: day.id } });
        const created = await prisma.studySession.create({
          data: {
            studyDayId: day.id,
            date: alloc.date,
            title: linked ? `${linked.title} (after midnight)` : String(title || "Focus session").trim() || "Focus session",
            category: linked ? linked.category : cat,
            plannedMinutes: plannedMinutes !== undefined ? Number(plannedMinutes) : alloc.minutes,
            durationMinutes: plannedMinutes !== undefined ? Number(plannedMinutes) : alloc.minutes,
            actualMinutes: alloc.minutes,
            blockLabel: linked ? linked.blockLabel : blockLabel || `Block ${count + 1}`,
            clockStart: alloc.date === toDateStr(firstStart) ? fmtClock(firstStart) : "00:00",
            clockEnd: alloc.date === toDateStr(lastEnd) ? fmtClock(lastEnd) : undefined,
            startTime: alloc.date === toDateStr(firstStart) ? firstStart : new Date(`${alloc.date}T00:00:00`),
            endTime: alloc.date === toDateStr(lastEnd) ? lastEnd : new Date(`${alloc.date}T00:00:00`),
            completed: true,
          },
        });
        rows.push(created);
        await creditDay(alloc.date, alloc.minutes, created.category);
      }
    }

    return NextResponse.json({ rows, allocations, totalMinutes: total });
  } catch (e) {
    console.error("Sessions LOG error:", e);
    return NextResponse.json({ error: "Failed to log session" }, { status: 500 });
  }
}
