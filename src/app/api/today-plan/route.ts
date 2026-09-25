import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  todayStr, addDays, diffDays, toDateStr,
  PROGRAM_START_STR, PROGRAM_END_STR,
  GATE_SYLLABUS_DEADLINE_DEFAULT, GATE_EXAM_WINDOW_START_DEFAULT, GATE_EXAM_WINDOW_END_DEFAULT,
  isDemoDay,
} from "@/lib/date";
import { calculateStreak, type FocusPriority } from "@/lib/study";
import { ensureDay } from "@/lib/credit";
import { ensureUser } from "@/lib/user";
import {
  buildTodayPlan, type TodayPlan, type PlanItem, type NotebookData, type Doubt,
  type EngineInput, type PrevMustInput,
} from "@/lib/today-plan";
import { buildMissionPayload, type MissionPayload } from "@/lib/mission";
import { journeyDay, remainingMinutes } from "@/lib/autonomous-planner";

export const dynamic = "force-dynamic";

/* ---------------- small helpers ---------------- */

function parseArr<T>(s: string | null | undefined, fallback: T[] = []): T[] {
  try {
    const v = JSON.parse(s || "");
    return Array.isArray(v) ? (v as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function parseNotebook(s: string | null | undefined): NotebookData {
  try {
    const v = JSON.parse(s || "");
    return {
      goal: typeof v.goal === "string" ? v.goal : "",
      must: Array.isArray(v.must) ? v.must.filter((x: unknown) => typeof x === "string") : [],
      notes: typeof v.notes === "string" ? v.notes : "",
      questions: Array.isArray(v.questions) ? v.questions : [],
      learned: typeof v.learned === "string" ? v.learned : "",
    };
  } catch {
    return { goal: "", must: [], notes: "", questions: [], learned: "" };
  }
}

async function getSettings() {
  const user = await ensureUser();
  const s = user?.settings;
  return {
    gateAllocation: s?.gateAllocation ?? 0.375,
    roadmapAllocation: s?.roadmapAllocation ?? 0.375,
    practiceAllocation: s?.practiceAllocation ?? 0.125,
    revisionAllocation: s?.revisionAllocation ?? 0.125,
    syllabusDeadline: s?.gateSyllabusDeadline || GATE_SYLLABUS_DEADLINE_DEFAULT,
    examWindowStart: s?.gateExamWindowStart || GATE_EXAM_WINDOW_START_DEFAULT,
    examWindowEnd: s?.gateExamWindowEnd || GATE_EXAM_WINDOW_END_DEFAULT,
    paperDate: s?.gatePaperDate || null,
  };
}

/** Auto-sync plan item done-flags from source-of-truth rows. */
async function syncItems(items: PlanItem[], planDate: string, generatedAt: string): Promise<PlanItem[]> {
  const genDay = (generatedAt || "").slice(0, 10);
  const out: PlanItem[] = [];
  // Batch-load refs by type to avoid N+1 queries.
  const byType = new Map<string, PlanItem[]>();
  for (const it of items) {
    if (!it.refType || !it.refId || it.done) { out.push(it); continue; }
    const list = byType.get(it.refType) ?? [];
    list.push(it);
    byType.set(it.refType, list);
  }
  const doneMap = new Map<string, { done: boolean; pyqDone?: number }>();
  const mark = (it: PlanItem, done: boolean, pyqDone?: number) => doneMap.set(it.id, { done, pyqDone });

  const sessItems = byType.get("session") ?? [];
  if (sessItems.length) {
    const rows = await prisma.studySession.findMany({ where: { id: { in: sessItems.map((i) => i.refId!) } }, select: { id: true, completed: true } });
    const byId = new Map(rows.map((r) => [r.id, r.completed]));
    for (const it of sessItems) mark(it, byId.get(it.refId!) === true);
  }
  const taskItems = byType.get("roadmapTask") ?? [];
  if (taskItems.length) {
    const rows = await prisma.roadmapTask.findMany({ where: { id: { in: taskItems.map((i) => i.refId!) } }, select: { id: true, status: true } });
    const byId = new Map(rows.map((r) => [r.id, r.status]));
    for (const it of taskItems) {
      const st = byId.get(it.refId!);
      mark(it, st === "COMPLETED" || st === "PRACTICE");
    }
  }
  const topicItems = byType.get("gateTopic") ?? [];
  if (topicItems.length) {
    const rows = await prisma.gateTopic.findMany({ where: { id: { in: topicItems.map((i) => i.refId!) } }, select: { id: true, completed: true } });
    const byId = new Map(rows.map((r) => [r.id, r.completed]));
    for (const it of topicItems) mark(it, byId.get(it.refId!) === true);
  }
  const revItems = byType.get("revisionItem") ?? [];
  if (revItems.length) {
    const rows = await prisma.revisionItem.findMany({ where: { id: { in: revItems.map((i) => i.refId!) } }, select: { id: true, lastRevisedDate: true } });
    const byId = new Map(rows.map((r) => [r.id, r.lastRevisedDate]));
    for (const it of revItems) mark(it, (byId.get(it.refId!) ?? "") >= planDate);
  }
  const projItems = byType.get("projectTask") ?? [];
  if (projItems.length) {
    const rows = await prisma.projectTask.findMany({ where: { id: { in: projItems.map((i) => i.refId!) } }, select: { id: true, completed: true } });
    const byId = new Map(rows.map((r) => [r.id, r.completed]));
    for (const it of projItems) mark(it, byId.get(it.refId!) === true);
  }
  const backlogItems = byType.get("backlogItem") ?? [];
  if (backlogItems.length) {
    const rows = await prisma.backlogItem.findMany({ where: { id: { in: backlogItems.map((i) => i.refId!) } }, select: { id: true, status: true } });
    const byId = new Map(rows.map((r) => [r.id, r.status]));
    for (const it of backlogItems) mark(it, (byId.get(it.refId!) ?? "PENDING") !== "PENDING");
  }
  const pyqItems = byType.get("pyqSet") ?? [];
  if (pyqItems.length) {
    const subjects = await prisma.gateSubject.findMany({ select: { id: true, name: true } });
    const nameToId = new Map(subjects.map((s) => [s.name, s.id]));
    for (const it of pyqItems) {
      const sid = nameToId.get(it.refId!);
      let n = 0;
      if (sid) {
        const qs = await prisma.gateQuestion.findMany({ where: { subjectId: sid, attempted: true }, select: { createdAt: true } });
        n = qs.filter((q) => toDateStr(new Date(q.createdAt)) === planDate || toDateStr(new Date(q.createdAt)) >= genDay).length;
      }
      mark(it, n >= (it.pyqTarget ?? 10), n);
    }
  }
  return items.map((it) => {
    const s = doneMap.get(it.id);
    if (!s) return it;
    return { ...it, done: s.done, ...(s.pyqDone !== undefined ? { pyqDone: s.pyqDone } : {}) };
  });
}

function splitTiers(items: PlanItem[]): { must: PlanItem[]; should: PlanItem[]; could: PlanItem[] } {
  return {
    must: items.filter((i) => i.tier === "MUST"),
    should: items.filter((i) => i.tier === "SHOULD"),
    could: items.filter((i) => i.tier === "COULD"),
  };
}

/* ---------------- engine input assembly ---------------- */

async function buildEngineInput(
  date: string,
  opts: { availableMinutes?: number; priorityMode?: FocusPriority; manualGoal?: string; generatedAt: string; prevFeedback?: string | null }
): Promise<{ input: EngineInput; day: Awaited<ReturnType<typeof ensureDay>>; settings: Awaited<ReturnType<typeof getSettings>> }> {
  const settings = await getSettings();
  const day = await ensureDay(date);

  const topics = await prisma.gateTopic.findMany({ include: { subject: { select: { id: true, name: true } } }, orderBy: { name: "asc" } });
  const questions = await prisma.gateQuestion.findMany({ select: { subjectId: true, topicName: true, attempted: true, correct: true, createdAt: true } });
  const openErrors = await prisma.gateErrorLog.findMany({ where: { status: "OPEN" }, select: { subject: true, topic: true } });

  const gateTopics = topics.map((t) => ({
    id: t.id,
    subjectId: t.subjectId,
    subjectName: t.subject.name,
    name: t.name,
    completed: t.completed,
    confidence: t.confidence,
    estimatedMinutes: t.estimatedMinutes ?? 90,
    difficulty: t.difficulty ?? "Medium",
    pyqTarget: t.pyqTarget ?? 10,
    lastStudied: t.lastStudied,
    pyqsSolved: questions.filter((q) => q.subjectId === t.subjectId && q.topicName === t.name && q.attempted).length,
    openErrors: openErrors.filter((e) => e.subject === t.subject.name && e.topic === t.name).length,
    remainingMinutes: (t as { remainingMinutes?: number | null }).remainingMinutes ?? null,
    completionPercent: (t as { completionPercent?: number }).completionPercent ?? 0,
    carryOverCount: (t as { carryOverCount?: number }).carryOverCount ?? 0,
    priority: (t as { priority?: string }).priority ?? "CORE",
  }));

  const tasks = await prisma.roadmapTask.findMany({
    include: { week: { select: { title: true } } },
    orderBy: { assignedDate: "asc" },
  });
  const roadmapTasks = tasks.map((t) => ({
    id: t.id, title: t.title, category: t.category, assignedDate: t.assignedDate,
    status: t.status, estimatedTimeMinutes: t.estimatedTimeMinutes, practiceReq: t.practiceReq,
    weekTitle: t.week?.title, actualMinutes: t.actualMinutes ?? 0,
    remainingMinutes: (t as { remainingMinutes?: number | null }).remainingMinutes ?? null,
    completionPercent: (t as { completionPercent?: number }).completionPercent ?? 0,
    carryOverCount: (t as { carryOverCount?: number }).carryOverCount ?? 0,
    priority: (t as { priority?: string }).priority ?? "CORE",
    difficulty: (t as { difficulty?: string }).difficulty ?? "Medium",
    prerequisites: (t as { prerequisites?: string }).prerequisites ?? "[]",
    track: (t as { track?: string }).track ?? "",
  }));

  const revisionDue = await prisma.revisionItem.findMany({
    where: { nextRevisionDate: { lte: date } },
    orderBy: { nextRevisionDate: "asc" },
    take: 12,
    select: { id: true, title: true, category: true },
  });

  const backlog = await prisma.backlogItem.findMany({
    where: { status: "PENDING" },
    orderBy: [{ priority: "asc" }, { overdueDays: "desc" }],
    take: 10,
  });

  const projects = await prisma.project.findMany({
    include: { tasks: { select: { id: true, title: true, completed: true, milestoneStage: true, estimatedMinutes: true, dueDate: true, priority: true } } },
    orderBy: { name: "asc" },
  });

  // Yesterday's unfinished MUST → tomorrow candidates (never forced back to MUST).
  // Missed-day recovery (spec §20): scan back up to 7 days; days with zero
  // actual minutes (and not a rest day) contribute their unfinished items as
  // recovery carry-over instead of being marked permanently failed.
  const prevDate = addDays(date, -1);
  const prevDay = await prisma.studyDay.findUnique({ where: { date: prevDate } });
  const prevUnfinishedMust: PrevMustInput[] = [];
  const missedDays: string[] = [];
  let prevFeedback: string | null = null;
  const pushUnfinished = async (dayDate: string, isMissed: boolean) => {
    const d = await prisma.studyDay.findUnique({ where: { date: dayDate } });
    if (!d) return;
    if (isMissed) missedDays.push(dayDate);
    const prevMust = parseArr<PlanItem>(d.mustDoJson);
    const prevShould = parseArr<PlanItem>(d.shouldDoJson);
    const synced = await syncItems([...prevMust, ...prevShould], dayDate, d.planGeneratedAt || `${dayDate}T00:00:00`);
    for (const it of synced.filter((i) => !i.done)) {
      if (prevUnfinishedMust.length >= 5) break;
      if (prevUnfinishedMust.some((p) => p.refId === it.refId && p.refId)) continue; // no duplicates
      const actual = it.actualMinutes ?? 0;
      const remaining = Math.max(0, (it.remainingMinutes ?? it.minutes) - 0 || it.minutes - actual);
      if (remaining <= 0) continue;
      prevUnfinishedMust.push({
        title: it.title, kind: it.kind, minutes: remaining, detail: it.detail,
        refType: it.refType, refId: it.refId, subjectName: it.subjectName, topicName: it.topicName,
      });
    }
  };
  if (prevDay) {
    prevFeedback = prevDay.planFeedback;
    await pushUnfinished(prevDate, false);
    // Missed-day scan: earlier days with no credited minutes and no rest flag.
    for (let back = 2; back <= 7; back++) {
      const d = addDays(date, -back);
      if (d < PROGRAM_START_STR) break;
      const row = await prisma.studyDay.findUnique({ where: { date: d }, select: { actualMinutes: true, restDay: true } });
      if (!row || row.restDay || row.actualMinutes > 0) continue;
      await pushUnfinished(d, true);
      if (prevUnfinishedMust.length >= 5) break;
    }
  }

  // Transparent adaptation: actual/planned ratio per category, last 14 days.
  // Rolling window only (never one unusual day): needs ≥60 planned minutes
  // before a factor applies, and post-completion difficulty ratings
  // (Easy/Normal/Hard) nudge the factor (spec §25/§26). Dependency order is
  // never overridden by difficulty — this only sizes estimates.
  const since = addDays(date, -14);
  const recentSessions = await prisma.studySession.findMany({
    where: { date: { gte: since, lt: date } },
    select: { category: true, plannedMinutes: true, actualMinutes: true, difficultyRating: true },
  });
  const calAgg = new Map<string, { a: number; p: number; hard: number; easy: number; n: number }>();
  for (const s of recentSessions) {
    if (s.plannedMinutes <= 0 || s.actualMinutes <= 0) continue;
    const e = calAgg.get(s.category) ?? { a: 0, p: 0, hard: 0, easy: 0, n: 0 };
    e.a += s.actualMinutes;
    e.p += s.plannedMinutes;
    e.n++;
    if (s.difficultyRating === "Hard") e.hard++;
    if (s.difficultyRating === "Easy") e.easy++;
    calAgg.set(s.category, e);
  }
  const calibration: Record<string, number> = {};
  for (const [cat, v] of calAgg) {
    if (v.p >= 60 && v.n >= 3) {
      const base = v.a / v.p;
      const nudge = 1 + 0.05 * (v.hard / v.n) - 0.05 * (v.easy / v.n);
      calibration[cat] = Math.min(1.5, Math.max(0.7, Math.round(base * nudge * 100) / 100));
    }
  }

  // 7-day adaptation snapshot for weekly rebalancing (spec §27).
  const weekSince = addDays(date, -7);
  const weekDays = await prisma.studyDay.findMany({
    where: { date: { gte: weekSince, lt: date } },
    select: { date: true, targetMinutes: true, actualMinutes: true, mustDoJson: true, shouldDoJson: true },
  });
  let weekPlanned = 0, weekActual = 0, weekDone = 0, weekTotal = 0, weekCarry = 0;
  for (const d of weekDays) {
    weekPlanned += d.targetMinutes;
    weekActual += d.actualMinutes;
    const items = [...parseArr<PlanItem>(d.mustDoJson), ...parseArr<PlanItem>(d.shouldDoJson)];
    weekTotal += items.length;
    weekDone += items.filter((i) => i.done).length;
    weekCarry += items.filter((i) => !i.done).reduce((a, i) => a + (i.remainingMinutes ?? i.minutes), 0);
  }
  const adaptation = {
    plannedMinutes: weekPlanned,
    actualMinutes: weekActual,
    completionRate: weekTotal ? Math.round((weekDone / weekTotal) * 100) : 0,
    carryOverMinutes: weekCarry,
    sustainablePerDay: weekDays.length ? Math.round(weekActual / Math.max(1, weekDays.length)) : 0,
  };

  const days = await prisma.studyDay.findMany({
    where: { date: { gte: addDays(date, -32), lte: date } },
    select: { date: true, targetMinutes: true, actualMinutes: true },
    orderBy: { date: "asc" },
  });

  // Unsolved practice-bank remainder (Core 100) for honest feasibility math.
  const unsolvedPractice = await prisma.practiceProblem.findMany({
    where: { solved: false },
    select: { timeMinutes: true },
  });
  const practiceRemainingMinutes = unsolvedPractice.reduce((a, q) => a + (q.timeMinutes || 15), 0);

  const availableMinutes = opts.availableMinutes ?? day.availableMinutes ?? day.targetMinutes ?? 360;
  const priorityMode = (opts.priorityMode ?? day.focusPriority ?? "Balanced") as FocusPriority;

  return {
    settings,
    day,
    input: {
      date,
      availableMinutes,
      priorityMode,
      manualGoal: opts.manualGoal,
      generatedAt: opts.generatedAt,
      settings,
      gateTopics,
      roadmapTasks,
      revisionDue,
      backlog: backlog.map((b) => ({ id: b.id, title: b.title, category: b.category, priority: b.priority, estimatedMinutes: b.estimatedMinutes, overdueDays: b.overdueDays })),
      projects: projects.map((p) => ({ id: p.id, name: p.name, tasks: p.tasks })),
      prevUnfinishedMust,
      prevDate,
      calibration,
      days,
      prevFeedback: opts.prevFeedback ?? prevFeedback,
      adaptation,
      practiceRemainingMinutes,
    },
  };
}

/** Fill route-computed pace fields (needs completion timestamps). */
async function fillPace(plan: TodayPlan, date: string): Promise<TodayPlan> {
  const since14 = addDays(date, -14);
  const [topicDone14, questions, taskDone14] = await Promise.all([
    prisma.gateTopic.findMany({ where: { completedAt: { gte: since14, lte: date } }, select: { id: true } }),
    prisma.gateQuestion.findMany({ where: { attempted: true }, select: { createdAt: true } }),
    prisma.roadmapTask.findMany({ where: { completionDate: { gte: since14, lte: date } }, select: { id: true } }),
  ]);
  const curTopics = topicDone14.length / 14;
  const recentQ = questions.filter((q) => { const d = toDateStr(new Date(q.createdAt)); return d >= since14 && d <= date; });
  const curPyqs = recentQ.length / 14;
  const p = plan.pace;
  const remaining = p.gateTopicsRemaining;
  const rate = Math.max(curTopics, 0.05);
  const projected = remaining <= 0 ? date : addDays(date, Math.ceil(remaining / rate));
  const onPace = curTopics >= p.requiredTopicsPerDay * 0.9 || remaining === 0;

  const roadRate = Math.max(taskDone14.length / 14, 0.05);
  const roadProj = p.roadmapRemaining <= 0 ? date : addDays(date, Math.ceil(p.roadmapRemaining / roadRate));

  // Week roadmap topics target from required pace.
  const roadReq = p.roadmapRemaining / Math.max(1, p.roadmapDaysLeft);

  plan.pace = {
    ...p,
    currentTopicsPerDay: Math.round(curTopics * 10) / 10,
    currentPyqsPerDay: Math.round(curPyqs * 10) / 10,
    projectedCompletionDate: projected,
    onPace,
    driftTopicsPerDay: Math.round((curTopics - p.requiredTopicsPerDay) * 10) / 10,
    roadmapRequiredPerDay: Math.round(roadReq * 10) / 10,
    roadmapCurrentPerDay: Math.round((taskDone14.length / 14) * 10) / 10,
    roadmapProjectedDate: roadProj,
  };
  plan.week = { ...plan.week, roadmapTopics: Math.max(1, Math.ceil(roadReq * 7)) };
  return plan;
}

async function savePlan(date: string, plan: TodayPlan, goal: string, locked: boolean) {
  const { must, should, could } = splitTiers(plan.items);
  await prisma.studyDay.update({
    where: { date },
    data: {
      dailyGoal: goal,
      mustDoJson: JSON.stringify(must),
      shouldDoJson: JSON.stringify(should),
      couldDoJson: JSON.stringify(could),
      planGeneratedAt: plan.generatedAt,
      planLocked: locked,
      targetMinutes: plan.targetMinutes,
    },
  });
  return { must, should, could };
}

function readStoredPlan(day: {
  mustDoJson: string; shouldDoJson: string; couldDoJson: string;
  dailyGoal: string | null; planGeneratedAt: string | null; planLocked: boolean;
  planFeedback: string | null;
}): PlanItem[] {
  return [...parseArr<PlanItem>(day.mustDoJson), ...parseArr<PlanItem>(day.shouldDoJson), ...parseArr<PlanItem>(day.couldDoJson)];
}

async function computeYesterday(date: string) {
  const y = addDays(date, -1);
  const day = await prisma.studyDay.findUnique({ where: { date: y } });
  if (!day) return null;
  const items = readStoredPlan(day);
  const done = items.filter((i) => i.done).length;
  const questions = await prisma.gateQuestion.findMany({ where: { attempted: true }, select: { subjectId: true, createdAt: true } });
  const pyqs = questions.filter((q) => toDateStr(new Date(q.createdAt)) === y).length;
  const topicsDone = await prisma.roadmapTask.count({ where: { completionDate: y } });
  const gateTopicsDone = await prisma.gateTopic.count({ where: { completedAt: y } });
  let revisions = 0;
  const revItems = await prisma.revisionItem.findMany({ select: { history: true } });
  for (const r of revItems) {
    try {
      const h = JSON.parse(r.history || "[]");
      if (Array.isArray(h) && h.some((e: { date?: string }) => e?.date === y)) revisions++;
    } catch { /* ignore malformed history */ }
  }
  return {
    date: y,
    actualMinutes: day.actualMinutes,
    targetMinutes: day.targetMinutes,
    objectivesDone: done,
    objectivesTotal: items.length,
    pyqs, topicsDone: topicsDone + gateTopicsDone, revisions,
    reflection: day.dailyReflection,
  };
}

async function computeStreak() {
  const all = await prisma.studyDay.findMany({
    orderBy: { date: "asc" },
    select: {
      date: true, actualMinutes: true, gateMinutes: true, roadmapMinutes: true,
      practiceMinutes: true, revisionMinutes: true, coreDayCompleted: true, restDay: true, notes: true,
    },
  });
  const active = all.filter((d) => d.date >= PROGRAM_START_STR && !isDemoDay({ notes: d.notes }));
  return calculateStreak(active, undefined, PROGRAM_START_STR);
}

/* ---------------- GET: locked plan or generate+save ---------------- */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? todayStr();
    const preview = url.searchParams.get("preview") === "1";
    const now = new Date().toISOString();

    if (preview) {
      // Tomorrow preview: generate in-memory, never persist.
      const { input, settings } = await buildEngineInput(date, { generatedAt: now });
      const plan = await fillPace(buildTodayPlan(input), date);
      const syncedPreview = await syncItems(plan.items, date, now);
      const missionPreview = (() => {
        try { return buildMissionPayload({ ...plan, items: syncedPreview }, input, 480); }
        catch { return null; }
      })();
      return NextResponse.json({
        date, status: "preview" as const,
        plan: { ...plan, items: syncedPreview },
        mission: missionPreview,
        settings: { syllabusDeadline: settings.syllabusDeadline },
      });
    }

    const day = await ensureDay(date);
    const stored = readStoredPlan(day);
    // A stored plan exists if items were saved OR a generation ran. Carried
    // items (move-tomorrow) land in shouldDoJson with no generation stamp —
    // they must still be served, never silently regenerated over.
    const hasStored = stored.length > 0 || !!day.planGeneratedAt;

    if (hasStored) {
      const synced = await syncItems(stored, date, day.planGeneratedAt || `${date}T00:00:00`);
      // Persist synced flags back so refresh + history agree (cheap, same data).
      const { must, should, could } = splitTiers(synced);
      await prisma.studyDay.update({
        where: { date },
        data: { mustDoJson: JSON.stringify(must), shouldDoJson: JSON.stringify(should), couldDoJson: JSON.stringify(could) },
      });
      return NextResponse.json(await assemble(date, day, synced, "locked"));
    }

    // First open: generate + store.
    const { input, settings } = await buildEngineInput(date, { generatedAt: now });
    const plan = await fillPace(buildTodayPlan(input), date);
    const synced = await syncItems(plan.items, date, now);
    await savePlan(date, { ...plan, items: synced }, plan.goal, false);
    await prisma.studyDay.update({ where: { date }, data: { notebookContent: day.notebookContent ?? JSON.stringify({ goal: plan.goal, must: [], notes: "", questions: [], learned: "" }) } });
    return NextResponse.json(await assemble(date, day, synced, "generated", plan, input));
  } catch (e) {
    console.error("TodayPlan GET error:", e);
    return NextResponse.json({ error: "Failed to load today's plan" }, { status: 500 });
  }
}

async function assemble(
  date: string,
  day: Awaited<ReturnType<typeof ensureDay>>,
  items: PlanItem[],
  status: "locked" | "generated",
  freshPlan?: TodayPlan,
  engineInput?: EngineInput,
) {
  const fresh = await ensureDay(date);
  const notebook = parseNotebook(fresh.notebookContent);
  const doubts: Doubt[] = parseArr<Doubt>(fresh.doubtsJson);
  // Rebuild wrapper (pace/week/horizons) cheaply when serving a stored plan.
  let plan: TodayPlan;
  let input = engineInput;
  if (freshPlan) {
    plan = { ...freshPlan, items };
  } else {
    const built = await buildEngineInput(date, { generatedAt: fresh.planGeneratedAt || `${date}T00:00:00` });
    input = built.input;
    const b = buildTodayPlan(input);
    plan = await fillPace({ ...b, items, goal: fresh.dailyGoal || b.goal, locked: fresh.planLocked }, date);
  }
  if (!input) {
    input = (await buildEngineInput(date, { generatedAt: fresh.planGeneratedAt || `${date}T00:00:00` })).input;
  }
  const must = items.filter((i) => i.tier === "MUST" && !i.done);
  const nextAction = must[0] ?? items.find((i) => !i.done) ?? null;

  // Autonomous mission layer (spec §34): structured, backward-compatible.
  // Existing `plan`/`items` consumers keep working; new clients read `mission`.
  const stretchMinutes = (fresh as { stretchMinutes?: number }).stretchMinutes ?? 480;
  let mission: MissionPayload;
  try {
    mission = buildMissionPayload(plan, input, stretchMinutes);
  } catch (e) {
    console.error("Mission build error (plan still served):", e);
    const total = items.filter((i) => !i.done).reduce((a, i) => a + i.minutes, 0);
    mission = {
      date,
      journey: {
        day: journeyDay(date), total: 99,
        daysLeft: Math.max(0, diffDays(date, PROGRAM_END_STR)),
        phase: plan.horizons.phase, targetMinutes: plan.targetMinutes,
        stretchMinutes, gateDeadline: input.settings.syllabusDeadline,
      },
      carryOver: items.filter((i) => i.movedFrom && !i.done).map((i) => ({ ...i, fitted: false as const })),
      easyStart: [], hardDeepWork: [], easyApply: items.filter((i) => !i.done).map((i) => ({ ...i, fitted: false as const })), recall: [],
      // No capacity fit ran on this path: nothing is scheduled, everything
      // visible is overflow (same semantics as overflowMinutes elsewhere).
      totalPlannedMinutes: 0, overflowMinutes: total,
      remainingCapacity: Math.max(0, plan.targetMinutes),
      scheduleRisk: {
        status: "ON_TRACK", totalRemainingMinutes: total, availableMinutes: plan.targetMinutes,
        requiredPerDay: 0, sustainablePerDay: plan.targetMinutes, gapPerDay: 0,
        message: "On track.", recovery: [],
      },
      rebalance: { gateShare: 0.375, aiShare: 0.375, sweShare: 0.25, reason: "Default allocation." },
      deferred: [],
    };
  }

  // Persist journey + carry-over + risk snapshot (best-effort, never blocks).
  const carryMins = mission.carryOver.reduce((a, i) => a + i.minutes, 0);
  try {
    await prisma.studyDay.update({
      where: { date },
      data: {
        journeyDay: mission.journey.day,
        stretchMinutes,
        carryOverJson: JSON.stringify(mission.carryOver.map((i) => ({ id: i.id, title: i.title, minutes: i.minutes, movedFrom: i.movedFrom ?? null, refId: i.refId ?? null, refType: i.refType ?? null }))),
        scheduleRiskJson: JSON.stringify(mission.scheduleRisk),
        rebalanceJson: JSON.stringify(mission.rebalance),
        adaptationJson: JSON.stringify(input.adaptation ?? {}),
        missedRecovery: (fresh as { missedRecovery?: boolean }).missedRecovery ?? false,
      },
    });
  } catch { /* additive columns may lag in exotic envs — plan still served */ }
  void carryMins;

  return {
    date,
    status,
    plan,
    // Spec §34 structured planning data (new clients) — mirrors mission blocks.
    mission,
    journeyDay: mission.journey.day,
    targetMinutes: plan.targetMinutes,
    stretchMinutes,
    carryOver: mission.carryOver,
    easyStart: mission.easyStart,
    hardDeepWork: mission.hardDeepWork,
    easyApply: mission.easyApply,
    recall: mission.recall,
    totalPlannedMinutes: mission.totalPlannedMinutes,
    overflowMinutes: mission.overflowMinutes,
    remainingCapacity: mission.remainingCapacity,
    scheduleRisk: mission.scheduleRisk,
    reasons: plan.logic,
    notebook,
    doubts,
    yesterday: await computeYesterday(date),
    nextAction,
    streak: await computeStreak(),
    studyDay: {
      actualMinutes: fresh.actualMinutes,
      targetMinutes: fresh.targetMinutes,
      coreDayCompleted: fresh.coreDayCompleted,
      planFeedback: fresh.planFeedback,
    },
    planFeedback: fresh.planFeedback,
  };
}

/* ---------------- POST: explicit regenerate ---------------- */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const date: string = body.date ?? todayStr();
    const now = new Date().toISOString();
    const day = await ensureDay(date);
    const manualGoal = typeof body.manualGoal === "string" && body.manualGoal.trim() ? body.manualGoal.trim() : undefined;
    // Blank goal field → fresh auto goal (stored manual text is replaced, not reused).
    const { input } = await buildEngineInput(date, {
      generatedAt: now,
      availableMinutes: body.availableMinutes !== undefined ? Number(body.availableMinutes) : undefined,
      priorityMode: body.priorityMode,
      manualGoal,
    });
    const plan = await fillPace(buildTodayPlan(input), date);
    const synced = await syncItems(plan.items, date, now);
    await savePlan(date, { ...plan, items: synced }, plan.goal, false);
    return NextResponse.json(await assemble(date, day, synced, "generated", { ...plan, items: synced }, input));
  } catch (e) {
    console.error("TodayPlan POST error:", e);
    return NextResponse.json({ error: "Failed to regenerate plan" }, { status: 500 });
  }
}

/* ---------------- PATCH: item/notebook/doubt/goal/lock/feedback ops ---------------- */

function findItem(day: { mustDoJson: string; shouldDoJson: string; couldDoJson: string }, itemId: string) {
  const buckets = [
    { key: "mustDoJson", items: parseArr<PlanItem>(day.mustDoJson) },
    { key: "shouldDoJson", items: parseArr<PlanItem>(day.shouldDoJson) },
    { key: "couldDoJson", items: parseArr<PlanItem>(day.couldDoJson) },
  ] as const;
  for (const b of buckets) {
    const idx = b.items.findIndex((i) => i.id === itemId);
    if (idx >= 0) return { bucket: b.key as "mustDoJson" | "shouldDoJson" | "couldDoJson", items: b.items, idx };
  }
  return null;
}

async function persistBuckets(date: string, buckets: Record<"mustDoJson" | "shouldDoJson" | "couldDoJson", PlanItem[]>) {
  await prisma.studyDay.update({
    where: { date },
    data: {
      mustDoJson: JSON.stringify(buckets.mustDoJson),
      shouldDoJson: JSON.stringify(buckets.shouldDoJson),
      couldDoJson: JSON.stringify(buckets.couldDoJson),
    },
  });
}

/** Mirror atomic progress onto the source-of-truth row (no duplicates). */
async function mirrorAtomicProgress(item: PlanItem, actual: number, remaining: number, pct: number, sourceDate: string) {
  try {
    if (item.refType === "roadmapTask" && item.refId) {
      const row = await prisma.roadmapTask.findUnique({ where: { id: item.refId } });
      if (row) {
        const prevActual = (row as { actualMinutes?: number }).actualMinutes ?? 0;
        await prisma.roadmapTask.update({
          where: { id: item.refId },
          data: {
            actualMinutes: prevActual + actual,
            remainingMinutes: remaining,
            completionPercent: pct,
            carryOverCount: remaining > 0 ? ((row as { carryOverCount?: number }).carryOverCount ?? 0) + 1 : ((row as { carryOverCount?: number }).carryOverCount ?? 0),
            sourceDate: remaining > 0 ? sourceDate : ((row as { sourceDate?: string | null }).sourceDate ?? null),
            status: remaining === 0 ? "COMPLETED" : row.status === "TODO" ? "IN_PROGRESS" : row.status,
            ...(remaining === 0 ? { completionDate: sourceDate } : {}),
          },
        });
      }
    } else if (item.refType === "gateTopic" && item.refId) {
      const row = await prisma.gateTopic.findUnique({ where: { id: item.refId } });
      if (row) {
        await prisma.gateTopic.update({
          where: { id: item.refId },
          data: {
            remainingMinutes: remaining,
            completionPercent: pct,
            carryOverCount: remaining > 0 ? ((row as { carryOverCount?: number }).carryOverCount ?? 0) + 1 : ((row as { carryOverCount?: number }).carryOverCount ?? 0),
            sourceDate: remaining > 0 ? sourceDate : ((row as { sourceDate?: string | null }).sourceDate ?? null),
            ...(remaining === 0 ? { completed: true, completedAt: sourceDate } : {}),
          },
        });
      }
    } else if (item.refType === "projectTask" && item.refId) {
      const row = await prisma.projectTask.findUnique({ where: { id: item.refId } });
      if (row) {
        await prisma.projectTask.update({
          where: { id: item.refId },
          data: {
            remainingMinutes: remaining,
            completionPercent: pct,
            carryOverCount: remaining > 0 ? ((row as { carryOverCount?: number }).carryOverCount ?? 0) + 1 : ((row as { carryOverCount?: number }).carryOverCount ?? 0),
            ...(remaining === 0 ? { completed: true } : {}),
          },
        });
      }
    }
  } catch (e) {
    console.error("mirrorAtomicProgress error:", e);
  }
}

/** Carry one item into tomorrow's SHOULD pool (dedupe by refId, keep original id). */
async function carryItemToTomorrow(date: string, item: PlanItem) {
  const tomorrow = addDays(date, 1);
  const tday = await ensureDay(tomorrow);
  const tShould = parseArr<PlanItem>(tday.shouldDoJson);
  if (item.refId && tShould.some((i) => i.refId === item.refId)) return;
  if (tShould.some((i) => i.id === item.id)) return;
  const carryCount = (item.carryOverCount ?? 0) + 1;
  tShould.push({
    ...item,
    id: `${tomorrow}:carried:${item.refType ?? "custom"}:${item.refId ?? item.id.split(":").slice(-1)[0]}`,
    tier: "SHOULD",
    done: false,
    actualMinutes: 0,
    carryOverCount: carryCount,
    sourceDate: date,
    movedFrom: date,
    why: `${item.title} — unfinished ${date}, carried with ${item.minutes}m remaining (carry #${carryCount}).`,
  });
  await prisma.studyDay.update({ where: { date: tomorrow }, data: { shouldDoJson: JSON.stringify(tShould) } });
}

/** End-of-day close (spec §36): returns summary, persists carry-over. */
async function closeDay(date: string, buckets: Record<"mustDoJson" | "shouldDoJson" | "couldDoJson", PlanItem[]>) {
  const all = [...buckets.mustDoJson, ...buckets.shouldDoJson, ...buckets.couldDoJson];
  let completed = 0, partial = 0, missed = 0, carryMinutes = 0;
  const carried: string[] = [];
  for (const it of all) {
    const actual = it.actualMinutes ?? (it.done ? it.minutes : 0);
    const remaining = it.remainingMinutes ?? Math.max(0, it.minutes - actual);
    if (it.done || remaining === 0) {
      completed++;
      if (!it.done) {
        // Mark fully-worked items done for history consistency.
        it.done = true;
      }
      await mirrorAtomicProgress(it, actual, 0, 100, date);
    } else if (actual > 0) {
      partial++;
      carryMinutes += remaining;
      carried.push(it.title);
      await mirrorAtomicProgress(it, actual, remaining, Math.round((actual / it.minutes) * 100), date);
      await carryItemToTomorrow(date, { ...it, minutes: remaining });
    } else {
      missed++;
      carryMinutes += it.minutes;
      carried.push(it.title);
      // Missed items keep their full estimate as remaining (no fake progress).
      await mirrorAtomicProgress(it, 0, it.minutes, 0, date);
      if (it.tier !== "COULD") await carryItemToTomorrow(date, it);
    }
  }
  await persistBuckets(date, buckets);
  const fresh = await ensureDay(date);
  const summary = {
    actualMinutes: fresh.actualMinutes,
    targetMinutes: fresh.targetMinutes,
    completed, partial, missed,
    carryOverMinutes: carryMinutes,
    carried,
    note: carried.length ? "Carry-over protected automatically for tomorrow." : "Nothing to carry — clean close.",
  };
  return summary;
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const date: string = body.date ?? todayStr();
    const action: string = body.action;
    const day = await ensureDay(date);

    const buckets = {
      mustDoJson: parseArr<PlanItem>(day.mustDoJson),
      shouldDoJson: parseArr<PlanItem>(day.shouldDoJson),
      couldDoJson: parseArr<PlanItem>(day.couldDoJson),
    };

    switch (action) {
      case "toggle-item": {
        const found = findItem(day, body.itemId);
        if (!found) return NextResponse.json({ error: "Plan item not found" }, { status: 404 });
        buckets[found.bucket][found.idx] = { ...buckets[found.bucket][found.idx], done: Boolean(body.done) };
        await persistBuckets(date, buckets);
        break;
      }
      case "update-item": {
        // Edit title/minutes/tier — never triggers regeneration.
        const found = findItem(day, body.item?.id);
        if (!found) return NextResponse.json({ error: "Plan item not found" }, { status: 404 });
        const cur = buckets[found.bucket][found.idx];
        const patch = body.item as Partial<PlanItem>;
        const next: PlanItem = {
          ...cur,
          ...(patch.title !== undefined && { title: String(patch.title).slice(0, 200) }),
          ...(patch.minutes !== undefined && { minutes: Math.max(5, Math.min(480, Number(patch.minutes) || cur.minutes)) }),
          ...(patch.detail !== undefined && { detail: String(patch.detail).slice(0, 300) }),
        };
        const tier = patch.tier;
        if (tier && (tier === "MUST" || tier === "SHOULD" || tier === "COULD") && tier !== cur.tier) {
          buckets[found.bucket].splice(found.idx, 1);
          next.tier = tier;
          if (tier === "MUST") buckets.mustDoJson.push(next);
          else if (tier === "SHOULD") buckets.shouldDoJson.push(next);
          else buckets.couldDoJson.push(next);
        } else {
          buckets[found.bucket][found.idx] = next;
        }
        await persistBuckets(date, buckets);
        break;
      }
      case "add-item": {
        const it = body.item ?? {};
        if (!it.title || !String(it.title).trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
        const tier: PlanItem["tier"] = it.tier === "MUST" || it.tier === "COULD" ? it.tier : "SHOULD";
        // Canonical extra (additive): link an existing curriculum row so
        // completion mirrors onto it via the standard log-progress path.
        // No duplicate canonical rows are ever created here.
        const linkable = ["roadmapTask", "gateTopic", "projectTask", "revisionItem"] as const;
        let refType: PlanItem["refType"] = "custom";
        let refId: string | undefined;
        let kind: PlanItem["kind"] = "CUSTOM";
        if (typeof it.refId === "string" && it.refId.trim()) {
          if (!linkable.includes(it.refType)) return NextResponse.json({ error: "Unsupported canonical link type" }, { status: 400 });
          refType = it.refType;
          refId = it.refId.trim();
          const exists =
            refType === "roadmapTask" ? await prisma.roadmapTask.findUnique({ where: { id: refId }, select: { id: true } }) :
            refType === "gateTopic" ? await prisma.gateTopic.findUnique({ where: { id: refId }, select: { id: true } }) :
            refType === "projectTask" ? await prisma.projectTask.findUnique({ where: { id: refId }, select: { id: true } }) :
            await prisma.revisionItem.findUnique({ where: { id: refId }, select: { id: true } });
          if (!exists) return NextResponse.json({ error: "Canonical item not found" }, { status: 404 });
          kind =
            refType === "roadmapTask" ? "ROADMAP" :
            refType === "gateTopic" ? "GATE" :
            refType === "projectTask" ? "PROJECT" : "REVISION";
          // Duplicate prevention (server-side): same canonical ref already on today's plan.
          const already = [...buckets.mustDoJson, ...buckets.shouldDoJson, ...buckets.couldDoJson]
            .find((i) => i.refId === refId);
          if (already) return NextResponse.json({ duplicate: true, item: already });
        } else if (it.kind === "ROADMAP" || it.kind === "GATE" || it.kind === "PRACTICE" || it.kind === "REVISION" || it.kind === "PROJECT" || it.kind === "BACKLOG") {
          kind = it.kind;
        }
        const item: PlanItem = {
          id: `${date}:custom:${Date.now().toString(36)}`,
          kind, tier,
          title: String(it.title).slice(0, 200),
          detail: it.detail ? String(it.detail).slice(0, 300) : undefined,
          minutes: Math.max(5, Math.min(480, Number(it.minutes) || 30)),
          refType,
          ...(refId ? { refId } : {}),
          ...(it.subjectName ? { subjectName: String(it.subjectName).slice(0, 120) } : {}),
          ...(it.topicName ? { topicName: String(it.topicName).slice(0, 200) } : {}),
          why: "Added by you for today.",
          done: false,
          extra: true,
        };
        if (tier === "MUST") buckets.mustDoJson.push(item);
        else if (tier === "COULD") buckets.couldDoJson.push(item);
        else buckets.shouldDoJson.push(item);
        await persistBuckets(date, buckets);
        break;
      }
      case "remove-item": {
        const found = findItem(day, body.itemId);
        if (!found) return NextResponse.json({ error: "Plan item not found" }, { status: 404 });
        buckets[found.bucket].splice(found.idx, 1);
        await persistBuckets(date, buckets);
        break;
      }
      case "move-tomorrow": {
        // Carry into tomorrow's candidate pool (SHOULD), never forced MUST.
        const found = findItem(day, body.itemId);
        if (!found) return NextResponse.json({ error: "Plan item not found" }, { status: 404 });
        const [moved] = buckets[found.bucket].splice(found.idx, 1);
        await persistBuckets(date, buckets);
        const tomorrow = addDays(date, 1);
        const tday = await ensureDay(tomorrow);
        const tShould = parseArr<PlanItem>(tday.shouldDoJson);
        if (!tShould.some((i) => i.id === moved.id)) {
          tShould.push({ ...moved, id: `${tomorrow}:carried:${moved.id.split(":").slice(-1)[0]}`, tier: "SHOULD", done: false, movedFrom: date });
          await prisma.studyDay.update({ where: { date: tomorrow }, data: { shouldDoJson: JSON.stringify(tShould) } });
        }
        break;
      }
      case "set-goal": {
        await prisma.studyDay.update({ where: { date }, data: { dailyGoal: String(body.goal ?? "").slice(0, 300) } });
        const nb = parseNotebook(day.notebookContent);
        nb.goal = String(body.goal ?? "").slice(0, 300);
        await prisma.studyDay.update({ where: { date }, data: { notebookContent: JSON.stringify(nb) } });
        break;
      }
      case "notebook": {
        const nb = parseNotebook(day.notebookContent);
        const patch = body.notebook ?? {};
        const next: NotebookData = {
          goal: typeof patch.goal === "string" ? patch.goal.slice(0, 300) : nb.goal,
          must: Array.isArray(patch.must) ? patch.must.filter((x: unknown) => typeof x === "string").map((x: string) => x.slice(0, 200)).slice(0, 20) : nb.must,
          notes: typeof patch.notes === "string" ? patch.notes.slice(0, 5000) : nb.notes,
          questions: Array.isArray(patch.questions) ? patch.questions.slice(0, 30) : nb.questions,
          learned: typeof patch.learned === "string" ? patch.learned.slice(0, 2000) : nb.learned,
        };
        await prisma.studyDay.update({ where: { date }, data: { notebookContent: JSON.stringify(next) } });
        break;
      }
      case "doubt-add": {
        const text = String(body.text ?? "").trim().slice(0, 500);
        if (!text) return NextResponse.json({ error: "Doubt text is required" }, { status: 400 });
        const doubts = parseArr<Doubt>(day.doubtsJson);
        doubts.push({ id: `d${Date.now().toString(36)}`, text, status: "open", createdAt: new Date().toISOString() });
        await prisma.studyDay.update({ where: { date }, data: { doubtsJson: JSON.stringify(doubts.slice(-30)) } });
        break;
      }
      case "doubt-status": {
        const doubts = parseArr<Doubt>(day.doubtsJson);
        const d = doubts.find((x) => x.id === body.id);
        if (!d) return NextResponse.json({ error: "Doubt not found" }, { status: 404 });
        d.status = body.status === "resolved" ? "resolved" : "open";
        await prisma.studyDay.update({ where: { date }, data: { doubtsJson: JSON.stringify(doubts) } });
        break;
      }
      case "doubt-to-revision": {
        const doubts = parseArr<Doubt>(day.doubtsJson);
        const d = doubts.find((x) => x.id === body.id);
        if (!d) return NextResponse.json({ error: "Doubt not found" }, { status: 404 });
        await prisma.revisionItem.create({
          data: {
            title: d.text.slice(0, 120),
            category: "GATE",
            sourceType: "DOUBT",
            confidence: 2,
            nextRevisionDate: date,
            notes: `From ${date} notebook doubts.`,
          },
        });
        d.status = "resolved";
        await prisma.studyDay.update({ where: { date }, data: { doubtsJson: JSON.stringify(doubts) } });
        break;
      }
      case "feedback": {
        const f = body.feedback;
        if (!["easy", "ok", "hard"].includes(f)) return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
        await prisma.studyDay.update({ where: { date }, data: { planFeedback: f } });
        break;
      }
      case "rate-difficulty": {
        // Post-completion calibration (spec §26): Easy | Normal | Hard.
        // Stored on the linked timer session(s); feeds future estimates via
        // the rolling adaptation window. Never overrides dependency order.
        const rating = String(body.rating ?? "");
        if (!["Easy", "Normal", "Hard"].includes(rating)) return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
        const found = findItem(day, body.itemId);
        const titleMatch = found
          ? (buckets[found.bucket][found.idx].topicName
            ? `${buckets[found.bucket][found.idx].subjectName ?? ""} — ${buckets[found.bucket][found.idx].topicName}`
            : buckets[found.bucket][found.idx].title)
          : null;
        if (found) {
          buckets[found.bucket][found.idx] = { ...buckets[found.bucket][found.idx], difficulty: rating };
          await persistBuckets(date, buckets);
        }
        const sessions = await prisma.studySession.findMany({
          where: { date },
          select: { id: true, title: true, notes: true },
        });
        const linked = sessions.filter((s) =>
          (body.itemId && s.notes === `plan:${date}:${body.itemId}`) ||
          (titleMatch && s.title === titleMatch)
        );
        for (const s of linked.slice(0, 3)) {
          await prisma.studySession.update({ where: { id: s.id }, data: { difficultyRating: rating } });
        }
        break;
      }
      case "lock": {
        await prisma.studyDay.update({ where: { date }, data: { planLocked: Boolean(body.locked) } });
        break;
      }
      case "log-progress": {
        // Partial completion (spec §10/§19): record actual minutes on the plan
        // item, compute remaining, and mirror atomic state onto the source row
        // (RoadmapTask / GateTopic / ProjectTask). Remaining > 0 stays on the
        // item for automatic carry-over; it is never silently deleted.
        // Explicit done=true means "user finished this": force remaining 0 /
        // pct 100 even if the item carries stale atomic residue, mirroring
        // the close-day completed branch (never silently un-complete).
        const found = findItem(day, body.itemId);
        if (!found) return NextResponse.json({ error: "Plan item not found" }, { status: 404 });
        const cur = buckets[found.bucket][found.idx];
        const explicitDone = body.done === true;
        const actual = Math.max(0, Math.min(cur.minutes, Number(body.actualMinutes) || 0));
        // Explicit done=true means "user finished this": force remaining 0 /
        // pct 100 / done even if the item carries stale atomic residue,
        // mirroring the close-day completed branch. The mirrored actual stays
        // the newly-reported portion so partials are never double-counted.
        const remaining = explicitDone ? 0 : Math.max(0, cur.minutes - actual);
        const pct = explicitDone ? 100 : (cur.minutes > 0 ? Math.round((actual / cur.minutes) * 100) : 0);
        const stopped = body.stopped === true || remaining > 0;
        buckets[found.bucket][found.idx] = {
          ...cur,
          actualMinutes: actual,
          remainingMinutes: remaining,
          completionPercent: pct,
          done: explicitDone ? true : (remaining === 0 ? true : Boolean(body.done)),
        };
        await persistBuckets(date, buckets);
        await mirrorAtomicProgress(cur, actual, remaining, pct, date);
        if (stopped && remaining > 0 && body.carry === true) {
          await carryItemToTomorrow(date, { ...cur, minutes: remaining, actualMinutes: 0, remainingMinutes: remaining, completionPercent: pct, done: false });
        }
        break;
      }
      case "close-day": {
        // End-of-day process (spec §36): classify every item, create
        // carry-over candidates with remaining minutes, update source rows,
        // and return a short summary. Tomorrow is pre-planned on next GET.
        const summary = await closeDay(date, buckets);
        return NextResponse.json({ ok: true, date, summary });
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const fresh = await ensureDay(date);
    const items = [...parseArr<PlanItem>(fresh.mustDoJson), ...parseArr<PlanItem>(fresh.shouldDoJson), ...parseArr<PlanItem>(fresh.couldDoJson)];
    const synced = await syncItems(items, date, fresh.planGeneratedAt || `${date}T00:00:00`);
    return NextResponse.json(await assemble(date, fresh, synced, "locked"));
  } catch (e) {
    console.error("TodayPlan PATCH error:", e);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}
