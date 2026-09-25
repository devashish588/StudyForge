import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayStr, addDays, diffDays, PROGRAM_START_STR } from "@/lib/date";
import { ensureUser } from "@/lib/user";
import { buildCurriculumOutlook } from "@/lib/curriculum";
import {
  buildMonthlyPlans,
  buildWeeklyPlans,
  buildDailySessions,
} from "@/lib/planner-hierarchy";
import { parseStudyWindows } from "@/lib/study-windows";
import { buildTodayPlan, type EngineInput } from "@/lib/today-plan";
import { prisma as prismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Helper to assemble the same EngineInput the daily planner uses, but without
// persisting. Extracted to share remaining-work rows for all three tabs.
async function curriculumSnapshot(date: string) {
  const user = await ensureUser();
  const settings = {
    gateAllocation: user?.settings?.gateAllocation ?? 0.375,
    roadmapAllocation: user?.settings?.roadmapAllocation ?? 0.375,
    practiceAllocation: user?.settings?.practiceAllocation ?? 0.125,
    revisionAllocation: user?.settings?.revisionAllocation ?? 0.125,
    syllabusDeadline: user?.settings?.gateSyllabusDeadline || "2027-01-15",
    curriculumDeadline: (user?.settings as { curriculumDeadline?: string } | undefined)?.curriculumDeadline || "2026-12-31",
    examWindowStart: user?.settings?.gateExamWindowStart || "2027-02-06",
    examWindowEnd: user?.settings?.gateExamWindowEnd || "2027-02-21",
    paperDate: user?.settings?.gatePaperDate || null,
  };
  const topics = await prisma.gateTopic.findMany({ include: { subject: { select: { name: true } } } });
  const tasks = await prisma.roadmapTask.findMany({ include: { week: { select: { title: true } } } });
  const practice = await prisma.practiceProblem.findMany({ select: { solved: true, timeMinutes: true } });
  const projects = await prisma.project.findMany({ include: { tasks: true } });
  const days = await prisma.studyDay.findMany({
    where: { date: { gte: addDays(date, -14), lte: date } },
    select: { date: true, actualMinutes: true },
  });
  const sustainable = days.filter((d) => d.actualMinutes > 0).length
    ? Math.round(days.filter((d) => d.actualMinutes > 0).reduce((a, d) => a + d.actualMinutes, 0) / 7)
    : null;
  const capacity = user?.settings?.dailyTargetMinutes ?? 360;
  const stretch = user?.settings?.stretchTargetMinutes ?? 480;
  const hasHistory = days.length >= 7;
  const inventory = {
    gateTopics: topics.map((t) => ({
      id: t.id, name: t.name, subjectName: t.subject.name, completed: t.completed,
      priority: (t as { priority?: string }).priority ?? "CORE",
      estimatedMinutes: t.estimatedMinutes ?? 90,
      remainingMinutes: (t as { remainingMinutes?: number | null }).remainingMinutes ?? null,
    })),
    roadmapTasks: tasks.map((t) => ({
      id: t.id, title: t.title, category: t.category, track: (t as { track?: string }).track ?? "",
      status: t.status, priority: (t as { priority?: string }).priority ?? "CORE",
      estimatedTimeMinutes: t.estimatedTimeMinutes, actualMinutes: t.actualMinutes ?? 0,
      remainingMinutes: (t as { remainingMinutes?: number | null }).remainingMinutes ?? null,
      assignedDate: t.assignedDate, subtopics: t.subtopics, weekTitle: t.week?.title,
    })),
    practice: practice.map((p) => ({ id: (p as { id?: string }).id ?? "", title: "", pattern: "", solved: p.solved, timeMinutes: p.timeMinutes })),
    projects: projects.map((pr) => ({
      id: pr.id, name: pr.name,
      tasks: pr.tasks.map((x) => ({ id: x.id, title: x.title, completed: x.completed, milestoneStage: x.milestoneStage, estimatedMinutes: x.estimatedMinutes ?? 60, priority: (x as { priority?: string }).priority ?? "IMPORTANT" })),
    })),
    revisionDue: [] as { id: string; title: string; category: string }[],
  };
  return { user, settings, inventory, sustainable, capacity, stretch, hasHistory };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? todayStr();
    const mode = (url.searchParams.get("mode") || "day") as "day" | "week" | "month";
    const { user, settings, inventory, sustainable, capacity, stretch, hasHistory } = await curriculumSnapshot(date);
    const target = settings.curriculumDeadline;
    const dayTarget = user?.settings?.dailyTargetMinutes ?? capacity ?? 360;

    // Build a single curriculum outlook reused by all three modes (same math
    // as Today/Dashboard/Learn — single source of truth).
    const { ...curriculum} = (() => {
      // Reuse the same bucket logic as mission.ts: GATE + GATE_PREP, AI, SWE, DSA
      const gateOpen = inventory.gateTopics.filter((t) => !t.completed);
      let gateRem = 0, gatePrepRem = 0, aiRem = 0, sweRem = 0, aiProjRem = 0, sweProjRem = 0;
      const AI_RE = /RAG|Agent|Chatbot|ML Prediction|Containerized/i;
      for (const t of gateOpen) {
        const mins = t.remainingMinutes ?? t.estimatedMinutes;
        if ((t as { priority?: string }).priority === "OPTIONAL") continue;
        gateRem += Math.max(0, mins);
      }
      for (const t of inventory.roadmapTasks) {
        if (t.status === "COMPLETED" || t.status === "PRACTICE") continue;
        const mins = Math.max(15, (t.remainingMinutes ?? Math.max(0, t.estimatedTimeMinutes - (t.actualMinutes ?? 0))));
        if (t.priority === "OPTIONAL") continue;
        const bucket = (t as { track?: string }).track;
        if (bucket === "AI_ENGINEERING") aiRem += mins;
        else if (bucket === "SOFTWARE_ENGINEERING") sweRem += mins;
        else if (bucket === "GATE_PREP") gatePrepRem += mins;
        else {
          // fallback classify like mission.ts
          const isAI = /ml|generative|rag|agent|llm|transformer|embedding|prompt|genai/i.test(`${t.category} ${t.title}`);
          if (isAI) aiRem += mins; else sweRem += mins;
        }
      }
      for (const pr of inventory.projects) {
        for (const x of pr.tasks.filter((x) => !x.completed)) {
          if ((x as { priority?: string }).priority === "OPTIONAL") continue;
          const mins = Math.max(0, x.estimatedMinutes ?? 60);
          if (AI_RE.test(`${pr.name} ${x.title}`)) aiProjRem += mins; else sweProjRem += mins;
        }
      }
      const practiceRem = inventory.practice.filter((p) => !p.solved).reduce((a, p) => a + (p.timeMinutes || 15), 0);
      const gateDone = inventory.gateTopics.length - gateOpen.length;
      const aiDone = inventory.roadmapTasks.filter((t) => t.track === "AI_ENGINEERING" && (t.status === "COMPLETED" || t.status === "PRACTICE")).length;
      const sweDone = inventory.roadmapTasks.filter((t) => t.track === "SOFTWARE_ENGINEERING" && (t.status === "COMPLETED" || t.status === "PRACTICE")).length;
      const solved = inventory.practice.filter((p) => p.solved).length;
      return buildCurriculumOutlook(
        date, target,
        [
          { key: "gate", label: "GATE", done: gateDone, total: inventory.gateTopics.length, remainingMinutes: gateRem + gatePrepRem, deadline: settings.syllabusDeadline },
          { key: "ai", label: "AI Engineering", done: aiDone, total: inventory.roadmapTasks.filter((t) => t.track === "AI_ENGINEERING").length, remainingMinutes: aiRem + aiProjRem, deadline: target },
          { key: "swe", label: "Software Engineering", done: sweDone, total: inventory.roadmapTasks.filter((t) => t.track === "SOFTWARE_ENGINEERING").length, remainingMinutes: sweRem + sweProjRem, deadline: target },
          { key: "dsa", label: "DSA", done: solved, total: inventory.practice.length, remainingMinutes: practiceRem, deadline: target },
        ],
        sustainable, dayTarget,
        { gate: 0.375, ai: 0.375, swe: 0.25, dsa: 0.25 },
        hasHistory, dayTarget
      );
    })();

    if (mode === "day") {
      // Reuse the canonical today-plan mission for this date. Fetch via the
      // planner's own HTTP endpoint to stay decoupled from route internals
      // (route helpers are not exported as a public API).
      const base = `${url.protocol}//${url.host}`;
      try {
        const tp = await fetch(`${base}/api/today-plan?date=${date}&preview=1`, { cache: "no-store" }).then((r) => r.json());
        const mission = tp.mission ?? null;
        const windows = parseStudyWindows(user?.settings?.preferredSittings as string, dayTarget);
        const subtopicsByRefId = new Map<string, string>();
        for (const t of inventory.roadmapTasks) subtopicsByRefId.set(t.id, t.subtopics);
        const sessions = mission
          ? buildDailySessions({ date, mission, windows, subtopicsByRefId })
          : [];
        return NextResponse.json({ date, mode: "day" as const, mission, sessions, windows, target, capacity: dayTarget, stretch });
      } catch (e) {
        // Fallback: return mission-less response so the page can still render
        const windows = parseStudyWindows(user?.settings?.preferredSittings as string, dayTarget);
        return NextResponse.json({ date, mode: "day" as const, mission: null, sessions: [], windows, target, capacity: dayTarget, stretch, error: String(e) });
      }
    }

    if (mode === "week") {
      const weeks = buildWeeklyPlans({
        fromDate: date,
        curriculumDeadline: target,
        inventory,
        dailyTargetMinutes: dayTarget,
        curriculum,
      });
      return NextResponse.json({ date, mode: "week" as const, weeks, target, capacity: dayTarget, stretch, curriculum });
    }

    // month
    const months = buildMonthlyPlans({
      fromDate: date,
      curriculumDeadline: target,
      syllabusDeadline: settings.syllabusDeadline,
      inventory,
      dailyTargetMinutes: dayTarget,
      curriculum,
    });
    return NextResponse.json({ date, mode: "month" as const, months, target, capacity: dayTarget, stretch, curriculum });
  } catch (e) {
    console.error("Planner API error:", e);
    return NextResponse.json({ error: "Failed to load planner" }, { status: 500 });
  }
}
