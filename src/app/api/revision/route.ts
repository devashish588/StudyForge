import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayStr, addDays } from "@/lib/date";

export async function GET() {
  try {
    const revisionItems = await prisma.revisionItem.findMany({
      orderBy: { nextRevisionDate: "asc" }
    });
    return NextResponse.json(revisionItems);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch revision items" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Create path (e.g. notebook doubt → revision). Distinct from recall path below.
    if (body.action === "create") {
      const { title, category, notes, sourceType, sourceId } = body;
      if (!title || !String(title).trim()) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }
      const created = await prisma.revisionItem.create({
        data: {
          title: String(title).trim(),
          category: category || "GATE",
          sourceType: sourceType || "NOTE",
          sourceId: sourceId || null,
          stage: 1,
          confidence: 2,
          nextRevisionDate: todayStr(),
          notes: notes || null,
        },
      });
      return NextResponse.json(created);
    }
    const { id, confidence, recallResult } = body; // confidence 1-5, recallResult: 'Yes', 'Partially', 'No'

    const item = await prisma.revisionItem.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: "Revision item not found" }, { status: 404 });
    }

    const conf = Number(confidence) || 3;
    const currentStage = item.stage;
    const nextStage = conf >= 4 ? Math.min(4, currentStage + 1) : Math.max(1, currentStage - 1);

    // Confidence 1-2: revise tomorrow (+1 day); Confidence 3: +3 days; Confidence 4-5: +7/21 days
    let daysToAdd = 1;
    if (conf === 3) daysToAdd = 3;
    if (conf === 4) daysToAdd = 7;
    if (conf === 5) daysToAdd = 21;

    const today = todayStr();
    const nextDateStr = addDays(today, daysToAdd);

    const historyArr = JSON.parse(item.history || "[]");
    historyArr.push({
      date: today,
      confidence: conf,
      recallResult: recallResult || "Yes"
    });

    const updatedItem = await prisma.revisionItem.update({
      where: { id },
      data: {
        stage: nextStage,
        confidence: conf,
        lastRevisedDate: today,
        nextRevisionDate: nextDateStr,
        history: JSON.stringify(historyArr)
      }
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error("Revision API Error:", error);
    return NextResponse.json({ error: "Failed to update revision" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, snoozeDays, nextRevisionDate } = body;
    if (!id) return NextResponse.json({ error: "Revision id required" }, { status: 400 });
    const item = await prisma.revisionItem.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: "Revision item not found" }, { status: 404 });

    let next: string;
    if (nextRevisionDate) {
      next = String(nextRevisionDate);
    } else {
      next = addDays(todayStr(), Number(snoozeDays) || 1);
    }
    const updated = await prisma.revisionItem.update({ where: { id }, data: { nextRevisionDate: next } });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Revision PATCH Error:", error);
    return NextResponse.json({ error: "Failed to snooze revision" }, { status: 500 });
  }
}
