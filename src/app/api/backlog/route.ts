import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/backlog — pending backlog items (overdue identifiable via overdueDays)
export async function GET() {
  try {
    const items = await prisma.backlogItem.findMany({
      where: { status: "PENDING" },
      orderBy: [{ priority: "asc" }, { overdueDays: "desc" }],
    });
    return NextResponse.json(items);
  } catch (e) {
    console.error("Backlog GET error:", e);
    return NextResponse.json({ error: "Failed to fetch backlog" }, { status: 500 });
  }
}

// PATCH /api/backlog — { id, status: RESOLVED | RESCHEDULED | SKIPPED, rescheduledDate? }
// Resolved/skipped items leave PENDING so they disappear without reappearing.
// Rescheduled items keep their history (originalDate/overdueDays untouched).
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, status, rescheduledDate } = body;
    if (!id) return NextResponse.json({ error: "Backlog id required" }, { status: 400 });
    if (!["RESOLVED", "RESCHEDULED", "SKIPPED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const existing = await prisma.backlogItem.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Backlog item not found" }, { status: 404 });
    if (existing.status !== "PENDING") {
      return NextResponse.json({ error: "Item already handled — no duplicates created" }, { status: 409 });
    }
    const updated = await prisma.backlogItem.update({
      where: { id },
      data: {
        status,
        ...(status === "RESCHEDULED" && rescheduledDate ? { originalDate: String(rescheduledDate) } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("Backlog PATCH error:", e);
    return NextResponse.json({ error: "Failed to update backlog" }, { status: 500 });
  }
}
