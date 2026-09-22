"use client";

import React, { useState, useEffect } from "react";
import { FileSpreadsheet, CheckCircle2, Save, FlaskConical } from "lucide-react";
import { PageShell, PageHeader, StatCard, Tabs, ErrorState, PageSkeleton } from "@/components/study/ui";
import { minutesToHM, weekNumberFor, todayStr, addDays } from "@/lib/date";
import { isTestMode, testStartMs, readUsage } from "@/lib/testmode";

type Tab = "Weekly" | "Monthly";

export default function ReviewsPage() {
  const [tab, setTab] = useState<Tab>("Weekly");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Live metrics
  const [score, setScore] = useState<any>(null);
  const [weekNum, setWeekNum] = useState(weekNumberFor(todayStr()));
  const [full, setFull] = useState<any>(null);
  const [pace, setPace] = useState<any>(null);

  // Reflections (persisted)
  const [wentWell, setWentWell] = useState("");
  const [wentBadly, setWentBadly] = useState("");
  const [whatChange, setWhatChange] = useState("");
  const [weakTopics, setWeakTopics] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    try {
      setLoadError(null);
      const [aRes, rRes] = await Promise.all([
        fetch("/api/analytics"),
        fetch(`/api/reviews?weekNumber=${weekNumberFor(todayStr())}`),
      ]);
      if (!aRes.ok) throw new Error("Review metrics failed to load");
      const a = await aRes.json();
      setScore(a.scorecard);
      setFull(a);
      // Next-week targets from the deterministic pace engine (preview: no writes).
      try {
        const pRes = await fetch(`/api/today-plan?date=${todayStr()}&preview=1`);
        if (pRes.ok) {
          const p = await pRes.json();
          setPace(p?.plan?.pace ?? null);
        }
      } catch { /* pace block stays hidden */ }
      if (rRes.ok) {
        const r = await rRes.json();
        if (r) {
          setWentWell(r.textWhatWentWell || "");
          setWentBadly(r.textWhatWentBad || "");
          setWhatChange(r.textWhatToChange || "");
          setWeakTopics(r.textWeakTopics || "");
          setWeekNum(r.weekNumber);
        } else {
          setWeekNum(weekNumberFor(todayStr()));
        }
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekNumber: weekNum,
          startDate: addDays(todayStr(), -6),
          endDate: todayStr(),
          roadmapCompleted: score?.roadmapDone ?? 0,
          roadmapTotal: score?.roadmapTotal ?? 0,
          pyqsSolved: score?.gatePyqs ?? 0,
          accuracy: score?.accuracy ?? 0,
          topicsDue: score?.revisionDue ?? 0,
          textWhatWentWell: wentWell,
          textWhatWentBad: wentBadly,
          textWhatToChange: whatChange,
          textWeakTopics: weakTopics,
        }),
      });
      if (!res.ok) throw new Error("Save failed — reflections kept in the form, retry.");
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  if (loading) return <PageSkeleton />;
  if (loadError) return <PageShell><ErrorState message={loadError} onRetry={fetchAll} /></PageShell>;

  const targetPct = score && score.targetMinutes ? Math.round((score.focusedMinutes / score.targetMinutes) * 100) : 0;
  const taCls = "w-full rounded-xl border border-border bg-border/30 p-3 text-xs text-card-foreground placeholder:text-gray-500 focus:outline-none focus:border-accent";
  const labCls = "mb-1 block text-xs font-bold text-gray-300";

  return (
    <PageShell>
      <PageHeader
        icon={<FileSpreadsheet className="w-7 h-7 text-accent" />}
        title="Reviews"
        sub="Performance report from live data — then your reflections, saved per week."
        actions={<Tabs tabs={["Weekly", "Monthly"] as const} value={tab} onChange={setTab} />}
      />

      {tab === "Weekly" ? (
        <div className="space-y-8 animate-fadeIn">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-accent">Week {weekNum}</p>
            <div className="mt-4 space-y-5">
              <div>
                <p className="metric-xl text-white">{minutesToHM(score?.focusedMinutes ?? 0)} <span className="text-base font-semibold text-gray-500">studied</span></p>
                <p className="mt-1 text-[15px] text-gray-400">Goal {minutesToHM(score?.targetMinutes ?? 3360)} • {targetPct}% completed</p>
              </div>
              <dl className="divide-y divide-border/60">
                <div className="flex items-center justify-between py-3">
                  <dt className="text-[15px] font-semibold text-gray-300">GATE PYQs</dt>
                  <dd className="font-mono text-sm text-purple-300">{score?.gatePyqs ?? 0} • {score?.accuracy ?? 0}% acc</dd>
                </div>
                <div className="flex items-center justify-between py-3">
                  <dt className="text-[15px] font-semibold text-gray-300">Roadmap tasks</dt>
                  <dd className="font-mono text-sm text-blue-300">{score?.roadmapDone ?? 0}/{score?.roadmapTotal ?? 0}</dd>
                </div>
                <div className="flex items-center justify-between py-3">
                  <dt className="text-[15px] font-semibold text-gray-300">Revisions completed</dt>
                  <dd className="font-mono text-sm text-emerald-300">{score?.revisionDue ?? 0} due</dd>
                </div>
                <div className="flex items-center justify-between py-3">
                  <dt className="text-[15px] font-semibold text-gray-300">Current streak</dt>
                  <dd className="font-mono text-sm text-orange-300">🔥 {score?.streak ?? 0} days</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold text-card-foreground">Next week&apos;s plan — auto-derived, you decide</h2>
            <p className="mt-1 text-xs text-gray-500">Based on your current pace and remaining syllabus — adjust as you see fit.</p>
            {!pace ? (
              <p className="mt-1 text-xs text-gray-500">Pace data unavailable.</p>
            ) : (
              <dl className="mt-2 divide-y divide-border/60">
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-[15px] font-semibold text-gray-300">GATE</dt>
                  <dd className="font-mono text-sm text-purple-300">{Math.ceil(pace.requiredTopicsPerDay * 7)} topics · {Math.ceil(pace.requiredPyqsPerDay * 7)} PYQs</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-[15px] font-semibold text-gray-300">Roadmap</dt>
                  <dd className="font-mono text-sm text-blue-300">{Math.ceil(pace.roadmapRequiredPerDay * 7)} topics</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-[15px] font-semibold text-gray-300">Projected syllabus completion</dt>
                  <dd className="font-mono text-sm text-gray-200">{pace.projectedCompletionDate ?? "—"}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-[15px] font-semibold text-gray-300">Roadmap projection</dt>
                  <dd className="font-mono text-sm text-gray-200">{pace.roadmapProjectedDate ?? "—"}</dd>
                </div>
              </dl>
            )}
            <p className="mt-2 text-[11px] text-gray-500">Derived from remaining work ÷ remaining days at your current pace. Projections, not predictions.</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <form onSubmit={save} className="space-y-4">              <div><label className={labCls}>What went well this week?</label><textarea rows={3} value={wentWell} onChange={(e) => setWentWell(e.target.value)} className={taCls} placeholder="e.g. Hit 8h on 5 days; DBMS accuracy climbing…" /></div>
              <div><label className={labCls}>What went badly?</label><textarea rows={3} value={wentBadly} onChange={(e) => setWentBadly(e.target.value)} className={taCls} placeholder="e.g. Revision slipped on Thursday…" /></div>
              <div><label className={labCls}>What should change next week?</label><textarea rows={3} value={whatChange} onChange={(e) => setWhatChange(e.target.value)} className={taCls} placeholder="e.g. Protect the first 90-min block…" /></div>
              <div><label className={labCls}>Weak topics needing immediate revisit</label><textarea rows={2} value={weakTopics} onChange={(e) => setWeakTopics(e.target.value)} className={taCls} placeholder="e.g. Normalization 3NF vs BCNF…" /></div>
              <button type="submit" disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-xs font-bold text-white shadow-md transition hover:bg-accent-hover disabled:opacity-50">
                {savedSuccess ? <><CheckCircle2 className="h-4 w-4" /> Saved ✓</> : saving ? "Saving…" : <><Save className="h-4 w-4" /> Save Weekly Reflection</>}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-fadeIn">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold text-card-foreground">Monthly view</h2>
            <p className="mt-1 text-xs text-gray-400">Monthly rollups derive from the same live scorecard. Pick any week above — reflections persist per week number, so the month is the sum of its weeks.</p>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard label="Focused (7d)" value={minutesToHM(score?.focusedMinutes ?? 0)} />
              <StatCard label="GATE PYQs (7d)" value={score?.gatePyqs ?? 0} accent="text-purple-300" />
              <StatCard label="Roadmap done" value={`${score?.roadmapDone ?? 0}/${score?.roadmapTotal ?? 0}`} accent="text-blue-300" />
              <StatCard label="Streak" value={`🔥 ${score?.streak ?? 0}`} accent="text-orange-300" />
            </div>
            {pace && (
              <dl className="mt-4 divide-y divide-border/60 border-t border-border/60 pt-2">
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-[15px] font-semibold text-gray-300">GATE topics planned / completed</dt>
                  <dd className="font-mono text-sm text-gray-200">{pace.gateTopicsRemaining} remaining</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-[15px] font-semibold text-gray-300">Roadmap topics planned / completed</dt>
                  <dd className="font-mono text-sm text-gray-200">{pace.roadmapRemaining} remaining</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-[15px] font-semibold text-gray-300">Projected GATE syllabus completion</dt>
                  <dd className="font-mono text-sm text-gray-200">{pace.projectedCompletionDate ?? "—"}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-[15px] font-semibold text-gray-300">Projected roadmap completion</dt>
                  <dd className="font-mono text-sm text-gray-200">{pace.roadmapProjectedDate ?? "—"}</dd>
                </div>
              </dl>
            )}
          </div>
          <SevenDayReport full={full} />
        </div>
      )}
    </PageShell>
  );
}

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard", "/today": "Today", "/roadmap": "Roadmap",
  "/gate": "GATE", "/practice": "Practice", "/revision": "Revision",
  "/projects": "Projects", "/calendar": "Calendar", "/analytics": "Analytics",
  "/notes": "Notes", "/reviews": "Reviews", "/settings": "Settings", "/streak": "Streak",
};

function SevenDayReport({ full }: { full: any }) {
  const [active, setActive] = useState(false);
  const [day, setDay] = useState<number | null>(null);
  const [usage, setUsage] = useState<{ route: string; at: number }[]>([]);

  useEffect(() => {
    setActive(isTestMode());
    const start = testStartMs();
    if (isTestMode() && start) {
      const d = Math.min(7, Math.floor((Date.now() - start) / 86400000) + 1);
      setDay(Math.max(1, d));
    }
    setUsage(readUsage());
  }, []);

  if (!active) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-card-foreground">
          <FlaskConical className="h-4 w-4 text-indigo-300" /> 7-Day Real-World Report
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          Start test mode in Settings to track a full week of real usage, then this report fills in: hours, core days, PYQs, revision, most/least used screens, and best day.
        </p>
      </div>
    );
  }

  const start = testStartMs() ?? Date.now();
  const inWindow = usage.filter((u) => u.at >= start);
  const byRoute: Record<string, number> = {};
  for (const u of inWindow) {
    const base = "/" + u.route.split("/")[1];
    byRoute[base] = (byRoute[base] ?? 0) + 1;
  }
  const ranked = Object.entries(byRoute).sort((a, b) => b[1] - a[1]);
  const most = ranked[0];
  const least = ranked[ranked.length - 1];

  // Study-data side (last 7 days ending today, from live analytics)
  const daily: { date: string; minutes: number }[] = full?.daily?.slice(-7) ?? [];
  const totalMins = daily.reduce((a, d) => a + d.minutes, 0);
  const best = daily.length ? daily.reduce((a, b) => (b.minutes > a.minutes ? b : a)) : null;
  const activeDays = daily.filter((d) => d.minutes >= 180).length;

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-card-foreground">
        <FlaskConical className="h-4 w-4 text-indigo-300" /> 7-Day Report — day {day} of 7
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
        <div className="rounded-lg bg-border/20 p-3"><p className="text-gray-500">Study hours</p><p className="text-lg font-black text-white">{minutesToHM(totalMins)}</p></div>
        <div className="rounded-lg bg-border/20 p-3"><p className="text-gray-500">Average/day</p><p className="text-lg font-black text-white">{minutesToHM(daily.length ? Math.round(totalMins / 7) : 0)}</p></div>
        <div className="rounded-lg bg-border/20 p-3"><p className="text-gray-500">Core days</p><p className="text-lg font-black text-emerald-300">{activeDays} / 7</p></div>
        <div className="rounded-lg bg-border/20 p-3"><p className="text-gray-500">GATE PYQs (7d)</p><p className="text-lg font-black text-purple-300">{full?.scorecard?.gatePyqs ?? 0}</p></div>
        <div className="rounded-lg bg-border/20 p-3"><p className="text-gray-500">Revision due now</p><p className="text-lg font-black text-white">{full?.revision?.dueToday ?? 0}</p></div>
        <div className="rounded-lg bg-border/20 p-3"><p className="text-gray-500">Most used</p><p className="text-lg font-black text-indigo-300">{most ? ROUTE_LABELS[most[0]] ?? most[0] : "—"}</p><p className="text-[10px] text-gray-500">{most ? `${most[1]} visits` : "no visits logged"}</p></div>
        <div className="rounded-lg bg-border/20 p-3"><p className="text-gray-500">Least used</p><p className="text-lg font-black text-gray-300">{least && least[0] !== most?.[0] ? ROUTE_LABELS[least[0]] ?? least[0] : "—"}</p><p className="text-[10px] text-gray-500">{least ? `${least[1]} visits` : ""}</p></div>
        <div className="rounded-lg bg-border/20 p-3"><p className="text-gray-500">Best day</p><p className="text-lg font-black text-white">{best && best.minutes > 0 ? best.date.slice(5) : "—"}</p><p className="text-[10px] text-gray-500">{best ? minutesToHM(best.minutes) : ""}</p></div>
      </div>
      <p className="mt-3 text-[11px] text-gray-500">
        Study metrics come from stored StudyDays; screen usage from the local visit log. Compare against the 8–10h plan to judge the allocation, GATE/roadmap ratio, and revision load — that decides the next tuning pass.
      </p>
    </div>
  );
}
