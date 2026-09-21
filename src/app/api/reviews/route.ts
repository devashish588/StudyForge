import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/reviews?weekNumber=5 — fetch a weekly review + available live metrics hint
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const weekParam = url.searchParams.get("weekNumber");
    if (weekParam) {
      const review = await prisma.weeklyReview.findUnique({ where: { weekNumber: Number(weekParam) } });
      return NextResponse.json(review);
    }
    const reviews = await prisma.weeklyReview.findMany({ orderBy: { weekNumber: "desc" } });
    return NextResponse.json(reviews);
  } catch (e) {
    console.error("Reviews GET error:", e);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

// POST /api/reviews — upsert weekly review (reflections persist; metrics snapshot optional)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      weekNumber, startDate, endDate,
      roadmapCompleted, roadmapTotal, gateHours, pyqsSolved, accuracy,
      topicsDue, topicsCompleted,
      textWhatWentWell, textWhatWentBad, textWhatToChange, textWeakTopics,
    } = body;
    if (!weekNumber) return NextResponse.json({ error: "weekNumber required" }, { status: 400 });

    const data = {
      weekNumber: Number(weekNumber),
      startDate: startDate || "",
      endDate: endDate || "",
      roadmapCompleted: Number(roadmapCompleted) || 0,
      roadmapTotal: Number(roadmapTotal) || 0,
      gateHours: Number(gateHours) || 0,
      pyqsSolved: Number(pyqsSolved) || 0,
      accuracy: Number(accuracy) || 0,
      topicsDue: Number(topicsDue) || 0,
      topicsCompleted: Number(topicsCompleted) || 0,
      textWhatWentWell: textWhatWentWell || "",
      textWhatWentBad: textWhatWentBad || "",
      textWhatToChange: textWhatToChange || "",
      textWeakTopics: textWeakTopics || "",
    };

    const saved = await prisma.weeklyReview.upsert({
      where: { weekNumber: data.weekNumber },
      create: data,
      update: data,
    });
    return NextResponse.json(saved);
  } catch (e) {
    console.error("Reviews POST error:", e);
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }
}
