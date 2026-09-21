import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  todayStr, addDays, diffDays, toDateStr,
  PROGRAM_START_STR,
  GATE_SYLLABUS_DEADLINE_DEFAULT, GATE_EXAM_WINDOW_START_DEFAULT, GATE_EXAM_WINDOW_END_DEFAULT,
  isDemoDay,
} from "@/lib/date";
import { calculateStreak, type FocusPriority } from "@/lib/study";
import { ensureDay } from "@/lib/credit";
import {
  buildTodayPlan, type TodayPlan, type PlanItem, type NotebookData, type Doubt,
  type EngineInput, type PrevMustInput,
} from "@/lib/today-plan";

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
  const user = await prisma.user.findFirst({ include: { settings: true } });
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
  }));

  const tasks = await prisma.roadmapTask.findMany({
    include: { week: { select: { title: true } } },
    orderBy: { assignedDate: "asc" },
  });
  const roadmapTasks = tasks.map((t) => ({
    id: t.id, title: t.title, category: t.category, assignedDate: t.assignedDate,
    status: t.status, estimatedTimeMinutes: t.estimatedTimeMinutes, practiceReq: t.practiceReq,
    weekTitle: t.week?.title, actualMinutes: t.actualMinutes ?? 0,
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
    include: { tasks: { select: { id: true, title: true, completed: true, milestoneStage: true } } },
    orderBy: { name: "asc" },
  });

  // Yesterday's unfinished MUST → tomorrow candidates (never forced back to MUST).
  const prevDate = addDays(date, -1);
  const prevDay = await prisma.studyDay.findUnique({ where: { date: prevDate } });
  const prevUnfinishedMust: PrevMustInput[] = [];
  let prevFeedback: string | null = null;
  if (prevDay) {
    prevFeedback = prevDay.planFeedback;
    const prevMust = parseArr<PlanItem>(prevDay.mustDoJson);
    const synced = await syncItems(prevMust, prevDate, prevDay.planGeneratedAt || `${prevDate}T00:00:00`);
    for (const it of synced.filter((i) => !i.done).slice(0, 3)) {
      prevUnfinishedMust.push({
        title: it.title, kind: it.kind, minutes: it.minutes, detail: it.detail,
        refType: it.refType, refId: it.refId, subjectName: it.subjectName, topicName: it.topicName,
      });
    }
  }

  // Transparent adaptation: actual/planned ratio per category, last 14 days.
  const since = addDays(date, -14);
  const recentSessions = await prisma.studySession.findMany({
    where: { date: { gte: since, lt: date } },
    select: { category: true, plannedMinutes: true, actualMinutes: true },
  });
  const calAgg = new Map<string, { a: number; p: number }>();
  for (const s of recentSessions) {
    if (s.plannedMinutes <= 0 || s.actualMinutes <= 0) continue;
    const e = calAgg.get(s.category) ?? { a: 0, p: 0 };
    e.a += s.actualMinutes;
    e.p += s.plannedMinutes;
    calAgg.set(s.category, e);
  }
  const calibration: Record<string, number> = {};
  for (const [cat, v] of calAgg) {
    if (v.p >= 60) calibration[cat] = Math.round((v.a / v.p) * 100) / 100;
  }

  const days = await prisma.studyDay.findMany({
    where: { date: { gte: addDays(date, -32), lte: date } },
    select: { date: true, targetMinutes: true, actualMinutes: true },
    orderBy: { date: "asc" },
  });

  const availableMinutes = opts.availableMinutes ?? day.availableMinutes ?? day.targetMinutes ?? 480;
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
      return NextResponse.json({
        date, status: "preview" as const,
        plan: { ...plan, items: await syncItems(plan.items, date, now) },
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
    return NextResponse.json(await assemble(date, day, synced, "generated", plan));
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
) {
  const fresh = await ensureDay(date);
  const notebook = parseNotebook(fresh.notebookContent);
  const doubts: Doubt[] = parseArr<Doubt>(fresh.doubtsJson);
  // Rebuild wrapper (pace/week/horizons) cheaply when serving a stored plan.
  let plan: TodayPlan;
  if (freshPlan) {
    plan = { ...freshPlan, items };
  } else {
    const { input } = await buildEngineInput(date, { generatedAt: fresh.planGeneratedAt || `${date}T00:00:00` });
    const built = buildTodayPlan(input);
    plan = await fillPace({ ...built, items, goal: fresh.dailyGoal || built.goal, locked: fresh.planLocked }, date);
  }
  const must = items.filter((i) => i.tier === "MUST" && !i.done);
  const nextAction = must[0] ?? items.find((i) => !i.done) ?? null;
  return {
    date,
    status,
    plan,
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
    return NextResponse.json(await assemble(date, day, synced, "generated", { ...plan, items: synced }));
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
        const item: PlanItem = {
          id: `${date}:custom:${Date.now().toString(36)}`,
          kind: "CUSTOM", tier,
          title: String(it.title).slice(0, 200),
          detail: it.detail ? String(it.detail).slice(0, 300) : undefined,
          minutes: Math.max(5, Math.min(480, Number(it.minutes) || 30)),
          refType: "custom",
          why: "Added by you for today.",
          done: false,
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
      case "lock": {
        await prisma.studyDay.update({ where: { date }, data: { planLocked: Boolean(body.locked) } });
        break;
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
