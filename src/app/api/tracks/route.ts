import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayStr, addDays, diffDays, PROGRAM_END_STR, GATE_SYLLABUS_DEADLINE_DEFAULT } from "@/lib/date";
import {
  AI_GROUPS, SWE_GROUPS, DSA_PATTERNS, DISTRIBUTED_LINK_TITLES, groupStage,
  type HubGroupDef,
} from "@/lib/tracks";

export const dynamic = "force-dynamic";

interface HubTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  difficulty: string | null;
  estMin: number;
  actMin: number;
  assignedDate: string;
  weekNumber: number | null;
}

function toHubTask(r: {
  id: string; title: string; status: string; priority: string; difficulty: string | null;
  estimatedTimeMinutes: number; actualMinutes: number; assignedDate: string;
  week: { weekNumber: number } | null;
}): HubTask {
  return {
    id: r.id, title: r.title, status: r.status, priority: r.priority,
    difficulty: r.difficulty, estMin: r.estimatedTimeMinutes, actMin: r.actualMinutes,
    assignedDate: r.assignedDate, weekNumber: r.week?.weekNumber ?? null,
  };
}

const doneStatus = (s: string) => s === "COMPLETED" || s === "PRACTICE";

function buildGroups(defs: HubGroupDef[], tasks: HubTask[]) {
  const byTitle = new Map(tasks.map((t) => [t.title, t]));
  return defs.map((d) => {
    let group = d.titles.map((t) => byTitle.get(t)).filter((t): t is HubTask => !!t);
    if (group.length === 0) {
      // Keyword fallback (robust to future retitles; still canonical rows only).
      group = tasks.filter((t) => d.match.test(t.title));
    }
    const done = group.filter((t) => doneStatus(t.status)).length;
    const est = group.reduce((a, t) => a + t.estMin, 0);
    const act = group.reduce((a, t) => a + Math.min(t.actMin, t.estMin), 0);
    const { stage, needsRepair } = groupStage(group.map((t) => t.status));
    return {
      key: d.key, label: d.label, tasks: group,
      done, total: group.length,
      percent: group.length ? Math.round((done / group.length) * 100) : 0,
      minutesDone: act, minutesTotal: est,
      stage, needsRepair,
    };
  });
}

function currentAndNext(tasks: HubTask[]) {
  const open = tasks
    .filter((t) => !doneStatus(t.status))
    .sort((a, b) => a.assignedDate.localeCompare(b.assignedDate) || a.title.localeCompare(b.title));
  const inProg = open.find((t) => t.status === "IN_PROGRESS");
  const current = inProg ?? open[0] ?? null;
  const next = open.find((t) => t !== current) ?? null;
  return { current, next };
}

async function overallPace(): Promise<{ perDay: number }> {
  const since = addDays(todayStr(), -14);
  const sessions = await prisma.studySession.findMany({
    where: { date: { gte: since } },
    select: { actualMinutes: true },
  });
  const total = sessions.reduce((a, s) => a + (s.actualMinutes || 0), 0);
  return { perDay: Math.round(total / 14) };
}

async function hubPayload(track: "AI_ENGINEERING" | "SOFTWARE_ENGINEERING", deadline: string) {
  const tasks = (
    await prisma.roadmapTask.findMany({
      where: { track },
      select: {
        id: true, title: true, status: true, priority: true, difficulty: true,
        estimatedTimeMinutes: true, actualMinutes: true, assignedDate: true,
        week: { select: { weekNumber: true } },
      },
      orderBy: { assignedDate: "asc" },
    })
  ).map(toHubTask);
  const defs = track === "AI_ENGINEERING" ? AI_GROUPS : SWE_GROUPS;
  const groups = buildGroups(defs, tasks.filter((t) => defs.some((d) => d.titles.includes(t.title) || d.match.test(t.title))));
  const done = tasks.filter((t) => doneStatus(t.status)).length;
  const estTotal = tasks.reduce((a, t) => a + t.estMin, 0);
  const counted = tasks.filter((t) => t.priority !== "OPTIONAL");
  const remaining = counted
    .filter((t) => !doneStatus(t.status))
    .reduce((a, t) => a + Math.max(0, t.estMin - t.actMin), 0);
  const daysLeft = Math.max(1, diffDays(todayStr(), deadline) + 1);
  const requiredPerDay = Math.round(remaining / daysLeft);
  const { perDay } = await overallPace();
  const { current, next } = currentAndNext(tasks);
  const excludedOptional = tasks.filter((t) => t.priority === "OPTIONAL").length;
  return {
    progress: {
      done, total: tasks.length,
      percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      minutesTotal: estTotal,
      minutesCounted: counted.reduce((a, t) => a + t.estMin, 0),
    },
    current, next,
    pace: {
      remainingMinutes: remaining, daysLeft, requiredPerDay,
      currentPerDay: perDay, deadline,
      status: perDay <= 0 ? "not-started" : requiredPerDay <= perDay ? "on-track" : "behind",
    },
    groups,
    excludedOptional,
  };
}

async function dsaPayload() {
  const problems = await prisma.practiceProblem.findMany({
    where: { category: "DSA" },
    select: {
      id: true, title: true, pattern: true, difficulty: true,
      attempted: true, solved: true, hintsUsed: true, solutionViewed: true,
      timeMinutes: true, retryDate: true, createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const solved = problems.filter((p) => p.solved).length;
  const attempted = problems.filter((p) => p.attempted || p.solved).length;
  const byDiff: Record<string, { solved: number; total: number }> = {};
  for (const p of problems) {
    const d = p.difficulty || "Medium";
    byDiff[d] ??= { solved: 0, total: 0 };
    byDiff[d].total++;
    if (p.solved) byDiff[d].solved++;
  }
  const patterns = DSA_PATTERNS.map((def) => {
    const ps = problems.filter((p) => def.dbPatterns.includes(p.pattern));
    const s = ps.filter((p) => p.solved).length;
    const a = ps.filter((p) => p.attempted || p.solved).length;
    const needsRevisit = ps.filter((p) => !p.solved && (p.hintsUsed || p.solutionViewed)).length;
    return {
      key: def.key, label: def.label,
      solved: s, attempted: a, total: ps.length, needsRevisit,
      percent: ps.length ? Math.round((s / ps.length) * 100) : 0,
      problems: ps.map((p) => ({
        id: p.id, title: p.title, difficulty: p.difficulty,
        solved: p.solved, attempted: p.attempted,
        needsRevisit: !p.solved && (p.hintsUsed || p.solutionViewed),
      })),
    };
  }).filter((g) => g.total > 0 || ["topo", "union-find"].includes(g.key));
  const overallRate = problems.length ? solved / problems.length : 0;
  const weakPatterns = patterns
    .filter((g) => g.attempted > 0 && g.total > 0)
    .map((g) => ({ ...g, rate: g.solved / g.total }))
    .filter((g) => g.rate < overallRate || g.needsRevisit > 0)
    .sort((a, b) => a.rate - b.rate || b.needsRevisit - a.needsRevisit)
    .slice(0, 3);
  const firstUnsolved = problems.find((p) => !p.solved) ?? null;
  const currentPattern = firstUnsolved
    ? patterns.find((g) => g.problems.some((x) => x.id === firstUnsolved.id)) ?? null
    : null;
  const recentSolves = await prisma.studySession.findMany({
    where: { category: "Practice", completed: true },
    select: { title: true, date: true, actualMinutes: true },
    orderBy: [{ date: "desc" }],
    take: 5,
  });
  const resolvables = problems
    .filter((p) => p.retryDate || (!p.solved && (p.hintsUsed || p.solutionViewed)))
    .slice(0, 5)
    .map((p) => ({ id: p.id, title: p.title, retryDate: p.retryDate }));
  const primers = await prisma.roadmapTask.findMany({
    where: { track: "SOFTWARE_ENGINEERING", category: "DSA" },
    select: { status: true },
  });
  const primersDone = primers.filter((t) => doneStatus(t.status)).length;
  const pct = problems.length ? Math.round((solved / problems.length) * 100) : 0;
  return {
    core100: { solved, attempted, total: problems.length, percent: pct, byDifficulty: byDiff },
    patterns,
    currentPattern: currentPattern
      ? { key: currentPattern.key, label: currentPattern.label, nextUp: firstUnsolved?.title ?? null }
      : null,
    weakPatterns: weakPatterns.map((g) => ({ key: g.key, label: g.label, solved: g.solved, total: g.total, needsRevisit: g.needsRevisit })),
    recentSolves,
    resolves: { count: resolvables.length, items: resolvables },
    readiness: {
      percent: pct,
      label: pct >= 80 ? "Interview-ready" : pct >= 50 ? "Building" : pct > 0 ? "Foundations" : "Not started",
    },
    primers: { done: primersDone, total: primers.length },
  };
}

async function linksPayload() {
  const topics = await prisma.gateTopic.findMany({
    select: { name: true, completed: true, confidence: true, subject: { select: { name: true } } },
  });
  const tasks = await prisma.roadmapTask.findMany({
    select: { title: true, status: true, track: true },
  });
  const findTopic = (subject: string, namePart: RegExp) =>
    topics.find((t) => t.subject.name === subject && namePart.test(t.name)) ?? null;
  const findTask = (titlePart: RegExp) => tasks.find((t) => titlePart.test(t.title)) ?? null;
  const topicStatus = (t: { completed: boolean } | null) => (!t ? "missing" : t.completed ? "done" : "todo");
  const taskStatus = (t: { status: string } | null) =>
    !t ? "missing" : doneStatus(t.status) ? "done" : t.status === "IN_PROGRESS" ? "in-progress" : "todo";
  const pairs: { label: string; aLabel: string; aHref: string; bLabel: string; bHref: string }[] = [
    { label: "GATE DBMS ↔ SWE PostgreSQL", aLabel: "DBMS · Normalization", aHref: "/gate", bLabel: "PostgreSQL Depth: Schema → MVCC → Query Plans", bHref: "/software-engineering" },
    { label: "DSA algorithms ↔ SWE engineering", aLabel: "DSA Interview Patterns & Mock Interview", aHref: "/dsa", bLabel: "System Design Core (Interviews)", bHref: "/software-engineering" },
    { label: "AI retrieval ↔ production engineering", aLabel: "RAG Evaluation Suite (P@K → Faithfulness → Judge)", aHref: "/ai-engineering", bLabel: "Production AI Systems (FastAPI → CI/CD → Deploy)", bHref: "/ai-engineering" },
  ];
  const topicFor = [
    findTopic("DBMS", /normalization/i),
    null, null,
  ];
  const taskFor = [
    findTask(/postgresql depth/i),
    findTask(/system design core/i),
    findTask(/production ai systems/i),
  ];
  const taskForA = [null, findTask(/dsa interview patterns/i), findTask(/rag evaluation suite/i)];
  return pairs.map((p, i) => ({
    label: p.label,
    a: { label: p.aLabel, href: p.aHref, status: i === 0 ? topicStatus(topicFor[i]) : taskStatus(taskForA[i]) },
    b: { label: p.bLabel, href: p.bHref, status: taskStatus(taskFor[i]) },
  }));
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const which = url.searchParams.get("track") ?? "all";
    const out: Record<string, unknown> = {};
    if (which === "all" || which === "ai") {
      out.ai = await hubPayload("AI_ENGINEERING", PROGRAM_END_STR);
    }
    if (which === "all" || which === "swe") {
      out.swe = await hubPayload("SOFTWARE_ENGINEERING", PROGRAM_END_STR);
    }
    if (which === "all" || which === "dsa") {
      out.dsa = await dsaPayload();
    }
    if (which === "all" || which === "links") {
      out.links = await linksPayload();
    }
    out.deadlines = { roadmap: PROGRAM_END_STR, gateSyllabus: GATE_SYLLABUS_DEADLINE_DEFAULT };
    return NextResponse.json(out);
  } catch (e) {
    console.error("Tracks API error:", e);
    return NextResponse.json({ error: "Failed to load track data" }, { status: 500 });
  }
}
