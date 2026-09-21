import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayStr, addDays, PROGRAM_START_STR, PROGRAM_END_STR, isDemoDay } from "@/lib/date";
import { calculateStreak } from "@/lib/study";

export const dynamic = "force-dynamic";

// GET /api/analytics — server-aggregated REAL data (no hardcoded charts)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const end = url.searchParams.get("date") ?? todayStr();

    const days = await prisma.studyDay.findMany({ orderBy: { date: "asc" } });
    const sessions = await prisma.studySession.findMany({ orderBy: { date: "asc" } });
    const subjects = await prisma.gateSubject.findMany({ include: { topics: true } });
    const questions = await prisma.gateQuestion.findMany({ orderBy: { createdAt: "asc" } });
    const errorLogs = await prisma.gateErrorLog.findMany();
    const mocks = await prisma.gateMockTest.findMany({ orderBy: { date: "asc" } });
    const tasks = await prisma.roadmapTask.findMany({ select: { status: true, category: true, assignedDate: true } });
    const revisions = await prisma.revisionItem.findMany();
    const problems = await prisma.practiceProblem.findMany();
    const projects = await prisma.project.findMany({ include: { tasks: true } });

    // Active program days only: Sep 24+ and never demo rows.
    const isActiveDay = (d: { date: string; notes?: string | null }) =>
      d.date >= PROGRAM_START_STR && !isDemoDay({ notes: d.notes ?? null });
    const activeDays = days.filter(isActiveDay);

    // Daily focus series (last 30 days ending `end`; pre-program/demo days read as 0)
    const daily: { date: string; minutes: number; target: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = addDays(end, -i);
      const found = days.find((x) => x.date === d);
      const usable = found && isActiveDay(found as { date: string; notes?: string | null });
      daily.push({ date: d, minutes: usable ? found!.actualMinutes : 0, target: found?.targetMinutes ?? 480 });
    }

    // Weekly bars (last 8 weeks, Mon-anchored approx by 7-day chunks)
    const weekly: { label: string; minutes: number; target: number }[] = [];
    for (let w = 7; w >= 0; w--) {
      const wEnd = addDays(end, -w * 7);
      const wStart = addDays(wEnd, -6);
      const mins = activeDays.filter((d) => d.date >= wStart && d.date <= wEnd).reduce((a, d) => a + d.actualMinutes, 0);
      const tgt = activeDays.filter((d) => d.date >= wStart && d.date <= wEnd).reduce((a, d) => a + (d.targetMinutes || 480), 0)
        || 7 * 480;
      weekly.push({ label: wStart.slice(5), minutes: mins, target: Math.min(tgt, 7 * 600) });
    }

    // GATE analytics
    const totalPyqs = subjects.reduce((a, s) => a + s.totalPYQs, 0);
    const solvedPyqs = subjects.reduce((a, s) => a + s.solvedPYQs, 0);
    const attempted = questions.filter((q) => q.attempted);
    const correct = attempted.filter((q) => q.correct).length;
    const accuracy = attempted.length > 0 ? Number(((correct / attempted.length) * 100).toFixed(1)) : 0;
    const subjectCoverage = subjects.map((s) => ({
      subject: s.name,
      solved: s.solvedPYQs,
      total: s.totalPYQs,
      accuracy: s.accuracy,
      topicsDone: s.topics.filter((t) => t.completed).length,
      topicsTotal: s.topics.length,
    }));
    // PYQs over time (cumulative by created date)
    const pyqTrend: { date: string; cumulative: number }[] = [];
    let cum = 0;
    const byDay: Record<string, number> = {};
    for (const q of questions) {
      const d = new Date(q.createdAt).toISOString().split("T")[0];
      byDay[d] = (byDay[d] ?? 0) + 1;
    }
    for (const d of Object.keys(byDay).sort()) { cum += byDay[d]; pyqTrend.push({ date: d, cumulative: cum }); }
    // Error taxonomy
    const errCats: Record<string, number> = {};
    for (const q of questions.filter((q) => !q.correct && q.mistakeType)) {
      errCats[q.mistakeType!] = (errCats[q.mistakeType!] ?? 0) + 1;
    }
    for (const e of errorLogs) {
      if (!questions.some((q) => q.id === e.questionId)) {
        errCats[e.mistakeType] = (errCats[e.mistakeType] ?? 0) + 1;
      }
    }
    const errTotal = Object.values(errCats).reduce((a, b) => a + b, 0) || 1;
    const errorBreakdown = Object.entries(errCats).map(([k, v]) => ({ category: k, count: v, pct: Number(((v / errTotal) * 100).toFixed(1)) }));

    // Roadmap analytics
    const done = tasks.filter((t) => t.status === "COMPLETED" || t.status === "PRACTICE").length;
    const roadmapOverall = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
    const catMap: Record<string, { total: number; done: number }> = {};
    for (const t of tasks) {
      catMap[t.category] ??= { total: 0, done: 0 };
      catMap[t.category].total++;
      if (t.status === "COMPLETED" || t.status === "PRACTICE") catMap[t.category].done++;
    }
    const categoryCompletion = Object.entries(catMap).map(([k, v]) => ({
      category: k, total: v.total, done: v.done,
      pct: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
    }));

    // Revision analytics
    const revDueToday = revisions.filter((r) => r.nextRevisionDate <= end).length;
    const revDueWeek = revisions.filter((r) => r.nextRevisionDate <= addDays(end, 7)).length;
    const revMastered = revisions.filter((r) => r.stage >= 4).length;
    const revNeeds = revisions.filter((r) => r.confidence <= 2).length;
    const revOverdue = revisions.filter((r) => r.nextRevisionDate < end).length;

    // Heatmap (program window; demo rows excluded)
    const heatmap = activeDays
      .filter((d) => d.date >= PROGRAM_START_STR && d.date <= PROGRAM_END_STR)
      .map((d) => ({ date: d.date, minutes: d.actualMinutes, gate: d.gateMinutes, roadmap: d.roadmapMinutes, revision: d.revisionMinutes }));

    // Momentum
    const last7 = activeDays.filter((d) => d.date > addDays(end, -7) && d.date <= end);
    const last30 = activeDays.filter((d) => d.date > addDays(end, -30) && d.date <= end);
    const sum = (arr: typeof activeDays) => arr.reduce((a, d) => a + d.actualMinutes, 0);
    const best = last30.length ? Math.max(...last30.map((d) => d.actualMinutes)) : 0;
    const streak = calculateStreak(activeDays.map((d) => ({
      date: d.date, actualMinutes: d.actualMinutes, gateMinutes: d.gateMinutes,
      roadmapMinutes: d.roadmapMinutes, practiceMinutes: d.practiceMinutes,
      revisionMinutes: d.revisionMinutes, coreDayCompleted: d.coreDayCompleted, restDay: d.restDay,
    })), undefined, PROGRAM_START_STR);

    // Weekly scorecard (current 7-day window)
    const gateWeek = questions.filter((q) => new Date(q.createdAt) >= new Date(`${addDays(end, -7)}T00:00:00`)).length;
    const countObjectives = (d: (typeof activeDays)[number]) => {
      let done = 0, total = 0;
      for (const key of ["mustDoJson", "shouldDoJson", "couldDoJson"] as const) {
        try {
          const arr = JSON.parse((d as Record<string, unknown>)[key] as string || "[]");
          if (Array.isArray(arr)) {
            total += arr.length;
            done += arr.filter((i: { done?: boolean }) => i?.done).length;
          }
        } catch { /* unparseable plan segment counts as nothing */ }
      }
      return { done, total };
    };
    const objectives7 = last7.reduce(
      (a, d) => {
        const o = countObjectives(d);
        return { done: a.done + o.done, total: a.total + o.total };
      },
      { done: 0, total: 0 },
    );
    // Plan accuracy (descriptive): avg min(actual,planned)/planned over last 14 active days.
    const acc14 = activeDays.filter((d) => d.date > addDays(end, -14) && d.date <= end && (d.targetMinutes || 0) > 0);
    const planAccuracy = acc14.length
      ? Math.round((acc14.reduce((a, d) => a + Math.min(d.actualMinutes, d.targetMinutes || 480) / (d.targetMinutes || 480), 0) / acc14.length) * 100)
      : 0;
    const scorecard = {
      focusedMinutes: sum(last7),
      targetMinutes: last7.reduce((a, d) => a + (d.targetMinutes || 480), 0) || 7 * 480,
      gatePyqs: gateWeek,
      accuracy,
      roadmapDone: done,
      roadmapTotal: tasks.length,
      revisionDue: revDueWeek,
      revisionTotal: revisions.length,
      streak: streak.current,
      objectivesDone: objectives7.done,
      objectivesTotal: objectives7.total,
      planAccuracy,
    };

    // Subject radar (activity + mastery blend per GATE subject from questions + topics)
    const radar = subjects.map((s) => {
      const qs = questions.filter((q) => q.subjectId === s.id && q.attempted);
      const acc = qs.length > 0 ? Math.round((qs.filter((q) => q.correct).length / qs.length) * 100) : Math.round(s.accuracy);
      const coverage = s.totalPYQs > 0 ? Math.round((s.solvedPYQs / s.totalPYQs) * 100) : 0;
      return { subject: s.name, accuracy: acc, coverage, questions: qs.length };
    });

    return NextResponse.json({
      daily, weekly, heatmap,
      gate: { totalPyqs, solvedPyqs, accuracy, subjectCoverage, pyqTrend, errorBreakdown, mocks },
      roadmap: { overall: roadmapOverall, done, total: tasks.length, categoryCompletion, projects: projects.map((p) => ({ id: p.id, name: p.name, progress: p.progress, stage: p.milestoneStage, total: p.tasks.length, done: p.tasks.filter((t) => t.completed).length })) },
      revision: { dueToday: revDueToday, dueWeek: revDueWeek, total: revisions.length, mastered: revMastered, needsRevisit: revNeeds, overdue: revOverdue },
      practice: { total: problems.length, solved: problems.filter((p) => p.solved).length },
      momentum: { last7: sum(last7), last30: sum(last30), avg: last30.length ? Math.round(sum(last30) / last30.length) : 0, best },
      streak,
      scorecard,
      radar,
      sessionsByCategory: sessions.reduce((acc: Record<string, number>, s) => {
        acc[s.category] = (acc[s.category] ?? 0) + s.actualMinutes;
        return acc;
      }, {}),
    });
  } catch (e) {
    console.error("Analytics API error:", e);
    return NextResponse.json({ error: "Failed to compute analytics" }, { status: 500 });
  }
}
