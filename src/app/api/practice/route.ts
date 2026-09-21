import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const problems = await prisma.practiceProblem.findMany({
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json(problems);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch practice problems" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, platform, url, category, pattern, difficulty, solved, hintsUsed, solutionViewed, timeMinutes, notes } = body;

    const problem = await prisma.practiceProblem.create({
      data: {
        title,
        platform: platform || "LeetCode",
        url: url || null,
        category: category || "DSA",
        pattern: pattern || "Arrays",
        difficulty: difficulty || "Medium",
        attempted: true,
        solved: Boolean(solved),
        hintsUsed: Boolean(hintsUsed),
        solutionViewed: Boolean(solutionViewed),
        timeMinutes: Number(timeMinutes) || 15,
        notes: notes || null
      }
    });

    return NextResponse.json(problem);
  } catch (error) {
    console.error("Practice API Error:", error);
    return NextResponse.json({ error: "Failed to save practice problem" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, solved, attempted } = body;
    if (!id) return NextResponse.json({ error: "Problem id required" }, { status: 400 });
    const updated = await prisma.practiceProblem.update({
      where: { id },
      data: {
        ...(solved !== undefined && { solved: Boolean(solved) }),
        ...(attempted !== undefined && { attempted: Boolean(attempted) }),
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Practice PATCH Error:", error);
    return NextResponse.json({ error: "Failed to update problem" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Problem id required" }, { status: 400 });
    await prisma.practiceProblem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Practice DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete problem" }, { status: 500 });
  }
}
