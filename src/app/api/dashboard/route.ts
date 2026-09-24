import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  todayStr, dayNumber, daysLeft, addDays, diffDays,
  PROGRAM_START_STR, PROGRAM_END_STR, PROGRAM_TOTAL_DAYS,
  getProgramDay, getDaysRemaining, getProgramStatus, isDemoDay,
  getStudyPhase, formatCountdown, daysUntil,
  GATE_SYLLABUS_DEADLINE_DEFAULT, GATE_EXAM_WINDOW_START_DEFAULT, GATE_EXAM_WINDOW_END_DEFAULT,
} from "@/lib/date";
import { calculateStreak, computeCoreDayPure, generatePlan } from "@/lib/study";
import { ensureUser } from "@/lib/user";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const today = dateParam ?? todayStr();

    // 1. Get or create StudyDay (flexible, 8h default)
    let studyDay = await prisma.studyDay.findUnique({
      where: { date: today },
      include: { sessions: { orderBy: { blockLabel: "asc" } } },
    });

    if (!studyDay) {
      studyDay = await prisma.studyDay.create({
        data: {
          date: today,
          plannedHours: 6.0,
          targetMinutes: 360,
          availableMinutes: 360,
          actualMinutes: 0,
          focusPriority: "Balanced",
        },
        include: { sessions: true },
      });
    }

    // 2. User info + settings (bootstrap row is guaranteed to exist)
    const user = await ensureUser();
    const targetMinutes = studyDay.targetMinutes || user?.settings?.dailyTargetMinutes || 360;

    // 3. Roadmap tasks due today (assignedDate <= today, not completed) + today's explicit
    const explicitToday = await prisma.roadmapTask.findMany({
      where: { assignedDate: today },
      include: { week: true },
    });
    const overdue = await prisma.roadmapTask.findMany({
      where: { assignedDate: { lt: today }, status: { notIn: ["COMPLETED", "PRACTICE"] } },
      include: { week: true },
      take: 6,
      orderBy: { assignedDate: "asc" },
    });
    const todayTasks = explicitToday.length > 0 ? explicitToday : await prisma.roadmapTask.findMany({
      where: { status: { notIn: ["COMPLETED", "PRACTICE"] } },
      include: { week: true },
      take: 4,
      orderBy: { assignedDate: "asc" },
    });

    // 4. GATE snapshot
    const gateSubjects = await prisma.gateSubject.findMany({ include: { topics: true } });
    const totalGatePyqs = gateSubjects.reduce((a, s) => a + s.totalPYQs, 0);
    const solvedGatePyqs = gateSubjects.reduce((a, s) => a + s.solvedPYQs, 0);
    const gatePercent = totalGatePyqs > 0 ? Math.round((solvedGatePyqs / totalGatePyqs) * 100) : 0;
    const avgAccuracy = gateSubjects.length > 0
      ? Number((gateSubjects.reduce((a, s) => a + s.accuracy, 0) / gateSubjects.length).toFixed(1))
      : 0;
    const focusSubject = gateSubjects.find((s) => s.name === "DBMS") ?? gateSubjects[0] ?? null;

    // This week's PYQs (questions created in last 7 days)
    const weekAgo = addDays(today, -7);
    const recentPyqs = await prisma.gateQuestion.findMany({
      where: { createdAt: { gte: new Date(`${weekAgo}T00:00:00`) } },
    });

    // 5. Revision queue
    const revisionQueue = await prisma.revisionItem.findMany({
      where: { nextRevisionDate: { lte: today } },
      orderBy: { nextRevisionDate: "asc" },
    });
    const revisionWeek = await prisma.revisionItem.findMany({
      where: { nextRevisionDate: { lte: addDays(today, 7) } },
    });

    // 6. Backlog
    const backlogItems = await prisma.backlogItem.findMany({ where: { status: "PENDING" } });

    // 7. Roadmap progress
    const allRoadmapTasks = await prisma.roadmapTask.findMany({ select: { status: true, category: true } });
    const completedRoadmap = allRoadmapTasks.filter((t) => t.status === "COMPLETED" || t.status === "PRACTICE").length;
    const roadmapPercent = allRoadmapTasks.length > 0 ? Math.round((completedRoadmap / allRoadmapTasks.length) * 100) : 0;
    const roadmapByCategory: Record<string, { total: number; done: number }> = {};
    for (const t of allRoadmapTasks) {
      roadmapByCategory[t.category] ??= { total: 0, done: 0 };
      roadmapByCategory[t.category].total++;
      if (t.status === "COMPLETED" || t.status === "PRACTICE") roadmapByCategory[t.category].done++;
    }

    const allProblems = await prisma.practiceProblem.findMany({ select: { solved: true } });
    const solvedProblems = allProblems.filter((p) => p.solved).length;

    // 8. Streak from source data (StudyDay history).
    // Only program days (Sep 24+) count, and demo rows never count.
    const allDays = await prisma.studyDay.findMany({
      orderBy: { date: "asc" },
      select: {
        date: true, actualMinutes: true, gateMinutes: true, roadmapMinutes: true,
        practiceMinutes: true, revisionMinutes: true, coreDayCompleted: true, restDay: true, notes: true,
      },
    });
    type DayRow = (typeof allDays)[number];
    const isActiveDay = (d: DayRow) => d.date >= PROGRAM_START_STR && !isDemoDay({ notes: d.notes });
    const activeDays = allDays.filter(isActiveDay);
    const streak = calculateStreak(activeDays, undefined, PROGRAM_START_STR);
    const coreDayComplete = computeCoreDayPure({
      actualMinutes: studyDay.actualMinutes,
      gateMinutes: studyDay.gateMinutes,
      roadmapMinutes: studyDay.roadmapMinutes,
      practiceMinutes: studyDay.practiceMinutes,
      revisionMinutes: studyDay.revisionMinutes,
      restDay: studyDay.restDay,
    });
    // Persist cached streak + core-day flag (best-effort)
    if (user && (user.currentStreak !== streak.current || user.longestStreak !== streak.longest)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { currentStreak: streak.current, longestStreak: Math.max(streak.longest, user.longestStreak) },
      });
    }
    if (studyDay.coreDayCompleted !== coreDayComplete) {
      await prisma.studyDay.update({ where: { date: today }, data: { coreDayCompleted: coreDayComplete } });
      studyDay = { ...studyDay, coreDayCompleted: coreDayComplete };
    }

    // 9. Last 7 days activity for weekly chart (active days only)
    const last7: { date: string; minutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(today, -i);
      const found = activeDays.find((x) => x.date === d);
      last7.push({ date: d, minutes: found?.actualMinutes ?? 0 });
    }

    // 10. Heatmap data (program window; demo rows excluded)
    const heatmap = activeDays
      .filter((d) => d.date >= PROGRAM_START_STR && d.date <= PROGRAM_END_STR)
      .map((d) => ({
        date: d.date,
        minutes: d.actualMinutes,
        gate: d.gateMinutes,
        roadmap: d.roadmapMinutes,
        revision: d.revisionMinutes,
      }));

    // 11. Suggested plan (if none stored)
    let plan: { gateMinutes: number; roadmapMinutes: number; practiceMinutes: number; revisionMinutes: number };
    try {
      const stored = JSON.parse((studyDay as { planJson?: string }).planJson || "{}");
      if (stored && stored.gateMinutes) plan = stored;
      else plan = generatePlan({ availableMinutes: studyDay.availableMinutes || 360, priority: (studyDay.focusPriority as "Balanced" | "GATE" | "Roadmap" | "Project" | "Revision") ?? "Balanced", revisionDueCount: revisionQueue.length });
    } catch {
      plan = generatePlan({ availableMinutes: studyDay.availableMinutes || 360, priority: "Balanced", revisionDueCount: revisionQueue.length });
    }

    // 12. Next-session candidate (priority engine input for client)
    const nextCandidates = [
      ...overdue.slice(0, 3).map((t) => ({ id: t.id, title: t.title, kind: "Roadmap" as const, category: t.category, minutes: t.estimatedTimeMinutes })),
      ...revisionQueue.slice(0, 2).map((r) => ({ id: r.id, title: r.title, kind: "Revision" as const, category: r.category, minutes: 30 })),
      ...(focusSubject ? [{ id: focusSubject.id, title: `${focusSubject.name} PYQ set`, kind: "GATE" as const, category: focusSubject.name, minutes: 75 }] : []),
    ];

    const dn = getProgramDay(today);

    // Two-timeline horizons (V3.1): BUILD track → Dec 31; CRACK track → GATE window.
    const st = user?.settings;
    const syllabusDeadline = st?.gateSyllabusDeadline || GATE_SYLLABUS_DEADLINE_DEFAULT;
    const examWindowStart = st?.gateExamWindowStart || GATE_EXAM_WINDOW_START_DEFAULT;
    const examWindowEnd = st?.gateExamWindowEnd || GATE_EXAM_WINDOW_END_DEFAULT;
    const paperDate: string | null = st?.gatePaperDate || null;
    const examTarget = paperDate ?? examWindowStart;
    const horizons = {
      phase: getStudyPhase(today, syllabusDeadline),
      buildDaysLeft: Math.max(0, diffDays(today, PROGRAM_END_STR) + (today <= PROGRAM_END_STR ? 1 : 0)),
      crackLabel: formatCountdown(today, examTarget),
      crackDays: daysUntil(today, examTarget),
      syllabusDeadline,
      examWindowStart,
      examWindowEnd,
      paperDate,
      examCountdownLabel: paperDate ? `Your paper: ${paperDate}` : `GATE 2027 window: ${examWindowStart} → ${examWindowEnd}`,
    };

    // 13. Current program phase + up-next tasks (single source for dashboard/roadmap)
    const weeks = await prisma.roadmapWeek.findMany({ orderBy: { weekNumber: "asc" } });
    const currentWeek =
      weeks.find((w) => w.startDate <= today && today <= w.endDate) ??
      (today < PROGRAM_START_STR ? weeks[0] ?? null : weeks[weeks.length - 1] ?? null);
    const upNext = await prisma.roadmapTask.findMany({
      where: { status: { notIn: ["COMPLETED", "PRACTICE"] } },
      orderBy: { assignedDate: "asc" },
      take: 3,
      select: { id: true, title: true, category: true, assignedDate: true, estimatedTimeMinutes: true },
    });

    // 14. Autonomous orchestrator — carry notice, journey, schedule status.
    // All derived from real rows; no fake percentages, no invented progress.
    const parseJson = <T,>(s: string | null | undefined, fb: T): T => {
      try { const v = JSON.parse(s || ""); return (v ?? fb) as T; } catch { return fb; }
    };
    const todayCarry = parseJson<{ title: string; minutes: number; movedFrom?: string | null }[]>(studyDay.carryOverJson ?? "[]", []);
    const yesterdayDate = addDays(today, -1);
    const yesterdayRow = await prisma.studyDay.findUnique({
      where: { date: yesterdayDate },
      select: { mustDoJson: true, shouldDoJson: true, actualMinutes: true },
    });
    const yItems = [
      ...parseJson<{ title: string; done: boolean; minutes: number }[]>(yesterdayRow?.mustDoJson, []),
      ...parseJson<{ title: string; done: boolean; minutes: number }[]>(yesterdayRow?.shouldDoJson, []),
    ];
    const yUnfinished = yItems.filter((i) => !i.done);
    const carryNotice = {
      hasCarry: todayCarry.length > 0 || yUnfinished.length > 0,
      prevDate: yesterdayDate,
      count: todayCarry.length || yUnfinished.length,
      minutes: todayCarry.reduce((a, i) => a + (i.minutes || 0), 0) || yUnfinished.reduce((a, i) => a + (i.minutes || 0), 0),
      items: (todayCarry.length ? todayCarry : yUnfinished).slice(0, 4),
      resolved: todayCarry.length === 0 && yUnfinished.length === 0,
    };

    const AI_CATS = ["ML", "Generative AI", "RAG", "AI Agents"];
    const aiTasks = allRoadmapTasks.filter((t) => AI_CATS.includes(t.category));
    const aiDone = aiTasks.filter((t) => t.status === "COMPLETED" || t.status === "PRACTICE").length;
    const sweTasks = allRoadmapTasks.filter((t) => !AI_CATS.includes(t.category));
    const sweDone = sweTasks.filter((t) => t.status === "COMPLETED" || t.status === "PRACTICE").length;
    const gateTopics = await prisma.gateTopic.findMany({ select: { completed: true } });
    const gateDone = gateTopics.filter((t) => t.completed).length;
    const completedDays = activeDays.filter((d) => d.actualMinutes >= 180).length;
    const journey = {
      completedDays,
      totalDays: PROGRAM_TOTAL_DAYS,
      roadmapPercent,
      aiPercent: aiTasks.length ? Math.round((aiDone / aiTasks.length) * 100) : 0,
      swePercent: sweTasks.length ? Math.round((sweDone / sweTasks.length) * 100) : 0,
      gateFirstPassPercent: gateTopics.length ? Math.round((gateDone / gateTopics.length) * 100) : 0,
      roadmapDeadline: PROGRAM_END_STR,
      gateDeadline: syllabusDeadline,
    };

    const remainingRoadmap = await prisma.roadmapTask.findMany({
      where: { status: { notIn: ["COMPLETED", "PRACTICE"] }, priority: { not: "OPTIONAL" } },
      select: { estimatedTimeMinutes: true, actualMinutes: true },
    });
    const remainingGate = await prisma.gateTopic.findMany({
      where: { completed: false, priority: { not: "OPTIONAL" } },
      select: { estimatedMinutes: true },
    });
    const remainingProjects = await prisma.projectTask.findMany({
      where: { completed: false, priority: { not: "OPTIONAL" } },
      select: { estimatedMinutes: true },
    });
    const remainingPractice = await prisma.practiceProblem.findMany({
      where: { solved: false },
      select: { timeMinutes: true },
    });
    const totalRemaining = remainingRoadmap.reduce((a, t) => a + Math.max(0, t.estimatedTimeMinutes - (t.actualMinutes ?? 0)), 0)
      + remainingGate.reduce((a, t) => a + (t.estimatedMinutes ?? 90), 0)
      + remainingProjects.reduce((a, t) => a + (t.estimatedMinutes ?? 60), 0)
      + remainingPractice.reduce((a, q) => a + (q.timeMinutes || 15), 0);
    // Jan-15 feasibility horizon (114-day window); OPTIONAL excluded by design.
    const daysLeftNum = Math.max(1, diffDays(today, syllabusDeadline) + (today <= syllabusDeadline ? 1 : 0));
    const requiredPerDay = Math.round(totalRemaining / daysLeftNum);
    const last7Actual = last7.filter((d) => d.minutes > 0).map((d) => d.minutes);
    const currentPerDay = last7Actual.length ? Math.round(last7Actual.reduce((a, b) => a + b, 0) / last7Actual.length) : 0;
    const risk = parseJson<{ status?: string }>(studyDay.scheduleRiskJson ?? "{}", {});
    const computed = requiredPerDay <= 360 ? "ON_TRACK" : requiredPerDay <= 420 ? "AT_RISK" : "OVERLOAD";
    const schedule = {
      status: risk.status ?? computed,
      requiredPerDay,
      currentPerDay,
      carryOverMinutes: carryNotice.minutes,
      totalRemainingMinutes: totalRemaining,
      daysLeft: daysLeftNum,
      horizon: syllabusDeadline,
    };

    return NextResponse.json({
      user: user ? { ...user, currentStreak: streak.current, longestStreak: Math.max(streak.longest, user.longestStreak) } : null,
      studyDay: { ...studyDay, targetMinutes },
      window: {
        start: PROGRAM_START_STR, end: PROGRAM_END_STR, totalDays: PROGRAM_TOTAL_DAYS,
        dayNumber: dn, daysLeft: getDaysRemaining(today), status: getProgramStatus(today),
      },
      // Legacy aliases (kept for backward-compatible clients)
      legacyDayNumber: dayNumber(today),
      legacyDaysLeft: daysLeft(today),
      streak,
      todayTasks,
      overdue,
      gateSubject: focusSubject,
      gate: { totalPyqs: totalGatePyqs, solved: solvedGatePyqs, percent: gatePercent, accuracy: avgAccuracy, weekPyqs: recentPyqs.length },
      revisionQueue,
      revisionWeekCount: revisionWeek.length,
      backlogItems,
      last7,
      heatmap,
      plan,
      nextCandidates,
      horizons,
      program: {
        phase: currentWeek ? { title: currentWeek.title, weekNumber: currentWeek.weekNumber, focusArea: currentWeek.focusArea } : null,
        upNext,
      },
      carryNotice,
      journey,
      schedule,
      monthly: {
        roadmapPercent,
        gatePercent,
        solvedProblems,
        targetProblems: 100,
        roadmapByCategory,
      },
      coreDayComplete,
    });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
