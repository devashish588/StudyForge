"use client";

import React, { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/study/bits";
import { Tabs } from "@/components/study/ui";
import { ContributionCalendar } from "@/components/study/Heatmap";
import { minutesToHM } from "@/lib/date";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line,
  CartesianGrid, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";

interface Analytics {
  daily: { date: string; minutes: number; target: number }[];
  weekly: { label: string; minutes: number; target: number }[];
  heatmap: { date: string; minutes: number; gate: number; roadmap: number; revision: number }[];
  gate: {
    totalPyqs: number; solvedPyqs: number; accuracy: number;
    subjectCoverage: { subject: string; solved: number; total: number; accuracy: number }[];
    pyqTrend: { date: string; cumulative: number }[];
    errorBreakdown: { category: string; count: number; pct: number }[];
    mocks: { id: string; testName: string; accuracy: number; marks: number; date: string; attempted: number }[];
  };
  roadmap: { overall: number; done: number; total: number; categoryCompletion: { category: string; done: number; total: number; pct: number }[] };
  revision: { dueToday: number; dueWeek: number; total: number; mastered: number; needsRevisit: number; overdue: number };
  practice: { total: number; solved: number };
  momentum: { last7: number; last30: number; avg: number; best: number };
  streak: { current: number; longest: number };
  scorecard: { focusedMinutes: number; targetMinutes: number; gatePyqs: number; accuracy: number; roadmapDone: number; roadmapTotal: number; revisionDue: number; revisionTotal: number; streak: number; objectivesDone: number; objectivesTotal: number; planAccuracy: number };
  radar: { subject: string; accuracy: number; coverage: number }[];
}

const tipStyle = { backgroundColor: "#111827", borderColor: "#374151", fontSize: 12 };

function rangeDaily(a: Analytics, range: "7d" | "30d" | "Sep" | "Oct" | "Nov" | "Dec" | "All") {
  // Full-window series from heatmap (real minutes); target defaults to 8h.
  const byDate = new Map(a.daily.map((d) => [d.date, d.target]));
  let rows = a.heatmap.map((h) => ({
    date: h.date,
    day: h.date.slice(5),
    hours: Number((h.minutes / 60).toFixed(1)),
    target: Number(((byDate.get(h.date) ?? 480) / 60).toFixed(1)),
  }));
  if (range === "7d") rows = rows.slice(-7);
  else if (range === "30d") rows = rows.slice(-30);
  else if (range !== "All") {
    const prefix = { Sep: "2026-09", Oct: "2026-10", Nov: "2026-11", Dec: "2026-12" }[range];
    rows = rows.filter((r) => r.date.startsWith(prefix));
  }
  return rows;
}

export default function AnalyticsPage() {
  const [a, setA] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [range, setRange] = useState<"7d" | "30d" | "Sep" | "Oct" | "Nov" | "Dec" | "All">("30d");
  const [tab, setTab] = useState<"Focus" | "GATE" | "Roadmap" | "Revision" | "Momentum">("Focus");

  const fetchAnalytics = async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error("Analytics failed to load");
      setA(await res.json());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalytics(); }, []);

  if (loading || !a) {
    return <div className="space-y-4 max-w-7xl mx-auto">{[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-xl bg-card border border-border animate-pulse" />)}</div>;
  }
  if (loadError) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 text-center">
          <p className="text-sm font-bold text-rose-300">Analytics couldn&apos;t load</p>
          <p className="text-xs text-gray-400 mt-1">{loadError}</p>
          <button onClick={fetchAnalytics} className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-300">Retry</button>
        </div>
      </div>
    );
  }

  const hasActivity = a.daily.some((d) => d.minutes > 0);
  const revHealth = a.revision.total > 0 ? Math.round(((a.revision.total - a.revision.overdue) / a.revision.total) * 100) : 100;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-accent" /> Productivity & Execution Analytics
        </h1>
        <p className="text-xs text-gray-400 mt-1">Every chart reads live database data. No decorative metrics.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><span className="text-xs font-bold text-gray-400">Last 7 days</span>
          <div className="text-2xl font-extrabold text-accent mt-1">{minutesToHM(a.momentum.last7)}</div>
          <p className="text-[11px] text-gray-400 mt-1">Best day {minutesToHM(a.momentum.best)} • avg {minutesToHM(a.momentum.avg)}/day</p></Card>
        <Card className="border-purple-500/30"><span className="text-xs font-bold text-gray-400">GATE accuracy</span>
          <div className="text-2xl font-extrabold text-purple-400 mt-1">{a.gate.accuracy}%</div>
          <p className="text-[11px] text-gray-400 mt-1">{a.gate.solvedPyqs}/{a.gate.totalPyqs} PYQs • {a.gate.mocks.length} mocks</p></Card>
        <Card className="border-emerald-500/30"><span className="text-xs font-bold text-gray-400">Revision health</span>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">{revHealth}%</div>
          <p className="text-[11px] text-gray-400 mt-1">{a.revision.dueToday} due today • {a.revision.mastered} mastered</p></Card>
        <Card className="border-orange-500/30"><span className="text-xs font-bold text-gray-400">Streak</span>
          <div className="text-2xl font-extrabold text-orange-400 mt-1">🔥 {a.streak.current} days</div>
          <p className="text-[11px] text-gray-400 mt-1">Longest {a.streak.longest} • core-day based</p></Card>
      </div>

      {/* Executive summary — PLANNED / ACTUAL / EXECUTION */}
      <Card className="border-border/60">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Planned</p>
            <p className="mt-1 text-xl font-black text-white">{minutesToHM(a.scorecard.targetMinutes)}</p>
            <p className="text-xs text-gray-500">last 7 days</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Actual</p>
            <p className="mt-1 text-xl font-black text-white">{minutesToHM(a.scorecard.focusedMinutes)}</p>
            <p className="text-xs text-gray-500">focused</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Execution</p>
            <p className="mt-1 text-xl font-black text-accent">{a.scorecard.targetMinutes > 0 ? Math.round((a.scorecard.focusedMinutes / a.scorecard.targetMinutes) * 100) : 0}%</p>
            <p className="text-xs text-gray-500">of plan</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          {(() => {
            const gapDay = [...a.daily].slice(-7).reduce((worst, d) => {
              const gap = (d.target - d.minutes);
              return gap > (worst.gap ?? -1) ? { date: d.date, gap } : worst;
            }, { date: "", gap: -1 } as { date: string; gap: number });
            const strongest = [...a.roadmap.categoryCompletion].sort((x,y) => y.pct - x.pct)[0];
            return (
              <>
                <div className="rounded-lg bg-border/20 px-3 py-2">
                  <p className="font-bold text-gray-400">Biggest gap</p>
                  <p className="mt-1 font-semibold text-white">{gapDay.date ? `${gapDay.date.slice(5)} · ${minutesToHM(gapDay.gap)} short` : "—"}</p>
                </div>
                <div className="rounded-lg bg-border/20 px-3 py-2">
                  <p className="font-bold text-gray-400">Strongest area</p>
                  <p className="mt-1 font-semibold text-white">{strongest ? `${strongest.category} · ${strongest.pct}%` : "—"}</p>
                </div>
                <div className="rounded-lg bg-border/20 px-3 py-2">
                  <p className="font-bold text-gray-400">Overdue load</p>
                  <p className="mt-1 font-semibold text-white">{a.revision.overdue} revision · {a.revision.dueToday} due today</p>
                </div>
                <div className="rounded-lg bg-border/20 px-3 py-2">
                  <p className="font-bold text-gray-400">GATE trend</p>
                  <p className="mt-1 font-semibold text-white">{a.gate.accuracy}% accuracy · {a.gate.pyqTrend.length} points</p>
                </div>
              </>
            );
          })()}
        </div>
      </Card>

      {!hasActivity && <EmptyState title="Your activity will appear here" hint="Complete your first study session — charts populate from real sessions." />}

      <Tabs tabs={["Focus", "GATE", "Roadmap", "Revision", "Momentum"] as const} value={tab} onChange={setTab} />

      {tab === "Focus" && (
      <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="text-accent">Daily Focus Time</CardTitle>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(["7d", "30d", "Sep", "Oct", "Nov", "Dec", "All"] as const).map((r) => (
                  <button key={r} onClick={() => setRange(r)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${range === r ? "border-accent bg-accent text-white" : "border-border bg-border/20 text-gray-400 hover:bg-border/40"}`}>
                    {r === "7d" ? "Last 7 days" : r === "30d" ? "Last 30 days" : r === "All" ? "All" : r}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rangeDaily(a, range)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="day" stroke="#9ca3af" fontSize={10} interval="preserveStartEnd" minTickGap={24} />
                <YAxis stroke="#9ca3af" fontSize={11} />
                <Tooltip contentStyle={tipStyle} />
                <Line type="monotone" dataKey="hours" stroke="#6366f1" strokeWidth={3} dot={false} name="Hours" />
                <Line type="monotone" dataKey="target" stroke="#374151" strokeDasharray="5 5" dot={false} name="Target" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-accent">Weekly Hours — Target vs Actual</CardTitle></CardHeader>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.weekly.map((w) => ({ ...w, hours: Number((w.minutes / 60).toFixed(1)), tgt: Number((w.target / 60).toFixed(1)) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="label" stroke="#9ca3af" fontSize={10} />
                <YAxis stroke="#9ca3af" fontSize={11} />
                <Tooltip contentStyle={tipStyle} />
                <Bar dataKey="hours" fill="#6366f1" radius={[4, 4, 0, 0]} name="Actual h" />
                <Bar dataKey="tgt" fill="#1f2937" radius={[4, 4, 0, 0]} name="Target h" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-white">Plan vs Actual — Daily (last 14 active days)</CardTitle></CardHeader>
        <p className="mb-3 text-xs text-gray-400">
          Planned (target) vs actual focused hours. Plan accuracy: <span className="font-bold text-white">{a.scorecard.planAccuracy}%</span>
          <span className="text-gray-500"> · objectives {a.scorecard.objectivesDone}/{a.scorecard.objectivesTotal} (7d)</span>
        </p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={a.daily.slice(-14).map((d) => ({
              day: d.date.slice(5),
              planned: Number((d.target / 60).toFixed(1)),
              actual: Number((d.minutes / 60).toFixed(1)),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="day" stroke="#9ca3af" fontSize={10} interval="preserveStartEnd" minTickGap={16} />
              <YAxis stroke="#9ca3af" fontSize={11} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="planned" fill="#374151" radius={[4, 4, 0, 0]} name="Planned h" />
              <Bar dataKey="actual" fill="#10b981" radius={[4, 4, 0, 0]} name="Actual h" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-white">Productivity Heatmap — Sep 24 → Dec 31</CardTitle></CardHeader>
        <ContributionCalendar days={a.heatmap} />
      </Card>
      </div>
      )}

      {tab === "GATE" && (
      <div className="space-y-6 animate-fadeIn">
      <Card>
        <CardHeader><CardTitle className="text-purple-300">PYQs Solved Over Time (cumulative)</CardTitle></CardHeader>
        {a.gate.pyqTrend.length === 0 ? (
          <EmptyState title="No PYQs logged yet" hint="Log your first PYQ attempt — the trend builds here." />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={a.gate.pyqTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickFormatter={(v: string) => v.slice(5)} minTickGap={32} />
                <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={tipStyle} labelFormatter={(v: string) => v} />
                <Line type="monotone" dataKey="cumulative" stroke="#8b5cf6" strokeWidth={3} dot={false} name="PYQs" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-purple-300">GATE Subject Coverage</CardTitle></CardHeader>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.gate.subjectCoverage} layout="vertical" margin={{ left: 90 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis type="number" stroke="#9ca3af" fontSize={11} />
                <YAxis type="category" dataKey="subject" stroke="#9ca3af" fontSize={10} width={90} />
                <Tooltip contentStyle={tipStyle} />
                <Bar dataKey="solved" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="PYQs solved" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-white">Subject Radar — Accuracy vs Coverage</CardTitle></CardHeader>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={a.radar.slice(0, 8)}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#9ca3af", fontSize: 9 }} />
                <Radar dataKey="accuracy" stroke="#10b981" fill="#10b981" fillOpacity={0.4} name="Accuracy" />
                <Radar dataKey="coverage" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} name="Coverage" />
                <Tooltip contentStyle={tipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-white">GATE Subject Accuracy (live)</CardTitle></CardHeader>
        <div className="space-y-3">
          {a.gate.subjectCoverage.map((s) => (
            <div key={s.subject} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-gray-300">{s.subject} <span className="text-gray-500">({s.solved}/{s.total})</span></span>
                <span className="text-emerald-400 font-bold">{s.accuracy}%</span>
              </div>
              <ProgressBar value={s.accuracy} color="bg-emerald-500" heightClass="h-2" />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-white">Error Taxonomy</CardTitle></CardHeader>
          {a.gate.errorBreakdown.length === 0 ? (
            <EmptyState title="No errors logged yet" hint="Wrong PYQs automatically appear here with mistake categories." />
          ) : (
            <div className="space-y-2">
              {a.gate.errorBreakdown.map((e) => (
                <div key={e.category} className="flex items-center gap-2 text-xs">
                  <span className="w-32 text-gray-300 font-semibold shrink-0">{e.category}</span>
                  <div className="flex-1 h-3 rounded bg-border/30 overflow-hidden">
                    <div className="h-3 rounded bg-rose-500" style={{ width: `${e.pct}%` }} />
                  </div>
                  <span className="w-16 text-right text-gray-400">{e.pct}% ({e.count})</span>
                </div>
              ))}
            </div>
          )}
          {a.gate.mocks.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/40">
              <p className="text-xs font-bold text-gray-300 mb-2">Mock performance</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={a.gate.mocks.map((m) => ({ day: m.date.slice(5), acc: m.accuracy, marks: m.marks }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="day" stroke="#9ca3af" fontSize={10} />
                    <YAxis stroke="#9ca3af" fontSize={11} />
                    <Tooltip contentStyle={tipStyle} />
                    <Line type="monotone" dataKey="acc" stroke="#8b5cf6" strokeWidth={2} dot name="Accuracy %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-white">Mock Marks Over Time</CardTitle></CardHeader>
          {a.gate.mocks.length === 0 ? (
            <EmptyState title="No mocks recorded yet" hint="Log your first full-length mock — marks trend here." />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={a.gate.mocks.map((m) => ({ day: m.date.slice(5), marks: m.marks, attempted: m.attempted }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="day" stroke="#9ca3af" fontSize={10} />
                  <YAxis stroke="#9ca3af" fontSize={11} />
                  <Tooltip contentStyle={tipStyle} />
                  <Bar dataKey="marks" fill="#6366f1" radius={[4, 4, 0, 0]} name="Marks" />
                  <Bar dataKey="attempted" fill="#1f2937" stroke="#4b5563" radius={[4, 4, 0, 0]} name="Attempted" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
      </div>
      )}

      {tab === "Roadmap" && (
      <div className="space-y-6 animate-fadeIn">
        <Card>
          <CardHeader><CardTitle className="text-white">Roadmap Completion by Category</CardTitle></CardHeader>
          <div className="space-y-3">
            {a.roadmap.categoryCompletion.map((c) => (
              <div key={c.category} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-gray-300">{c.category} <span className="text-gray-500">({c.done}/{c.total})</span></span>
                  <span className="text-blue-400 font-bold">{c.pct}%</span>
                </div>
                <ProgressBar value={c.pct} color="bg-blue-500" heightClass="h-2" />
              </div>
            ))}
          </div>
          <div className="mt-4 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[{ name: "Done", value: a.roadmap.done }, { name: "Remaining", value: Math.max(0, a.roadmap.total - a.roadmap.done) }]} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3}>
                  <Cell fill="#3b82f6" /><Cell fill="#1f2937" />
                </Pie>
                <Tooltip contentStyle={tipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-center text-xs text-gray-400 -mt-6">Overall {a.roadmap.overall}%</p>
          </div>
        </Card>
      </div>
      )}

      {tab === "Revision" && (
      <div className="space-y-6 animate-fadeIn">
        <Card>
          <CardHeader><CardTitle className="text-white">Revision Health</CardTitle></CardHeader>
          {a.revision.total === 0 ? (
            <EmptyState title="No revision items yet" hint="Complete roadmap topics — revision entries generate automatically." />
          ) : (
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-xs font-semibold">
                  <span className="text-gray-300">Mastered / healthy / needs revisit</span>
                  <span className="font-bold text-emerald-400">{revHealth}% healthy</span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-border/40">
                  <div className="bg-emerald-500" style={{ width: `${(a.revision.mastered / a.revision.total) * 100}%` }} title="Mastered" />
                  <div className="bg-indigo-500" style={{ width: `${(Math.max(0, a.revision.total - a.revision.mastered - a.revision.needsRevisit) / a.revision.total) * 100}%` }} title="In progress" />
                  <div className="bg-rose-500" style={{ width: `${(a.revision.needsRevisit / a.revision.total) * 100}%` }} title="Needs revisit" />
                </div>
                <div className="mt-1.5 flex gap-4 text-[11px] text-gray-400">
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Mastered {a.revision.mastered}</span>
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />Needs revisit {a.revision.needsRevisit}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                <div className="rounded-xl border border-border/40 bg-border/20 p-3"><p className="text-gray-400">Due today</p><p className="text-lg font-black text-white">{a.revision.dueToday}</p></div>
                <div className="rounded-xl border border-border/40 bg-border/20 p-3"><p className="text-gray-400">Due this week</p><p className="text-lg font-black text-white">{a.revision.dueWeek}</p></div>
                <div className="rounded-xl border border-border/40 bg-border/20 p-3"><p className="text-gray-400">Overdue</p><p className="text-lg font-black text-rose-400">{a.revision.overdue}</p></div>
                <div className="rounded-xl border border-border/40 bg-border/20 p-3"><p className="text-gray-400">Total</p><p className="text-lg font-black text-white">{a.revision.total}</p></div>
              </div>
            </div>
          )}
        </Card>
      </div>
      )}

      {tab === "Momentum" && (
      <div className="space-y-6 animate-fadeIn">
        <Card className="border-orange-500/20">
          <CardHeader><CardTitle className="text-orange-300">Momentum — streak, active days, average hours</CardTitle></CardHeader>
          <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
            <div className="rounded-xl border border-border/40 bg-border/20 p-3"><p className="text-gray-400">Streak</p><p className="text-lg font-black text-orange-400">🔥 {a.streak.current}d</p><p className="text-gray-500">longest {a.streak.longest}d</p></div>
            <div className="rounded-xl border border-border/40 bg-border/20 p-3"><p className="text-gray-400">Last 7 days</p><p className="text-lg font-black text-white">{minutesToHM(a.momentum.last7)}</p></div>
            <div className="rounded-xl border border-border/40 bg-border/20 p-3"><p className="text-gray-400">Last 30 days</p><p className="text-lg font-black text-white">{minutesToHM(a.momentum.last30)}</p></div>
            <div className="rounded-xl border border-border/40 bg-border/20 p-3"><p className="text-gray-400">Average / best</p><p className="text-lg font-black text-white">{minutesToHM(a.momentum.avg)}</p><p className="text-gray-500">best {minutesToHM(a.momentum.best)}</p></div>
          </div>
        </Card>
        <Card className="border-indigo-500/20">
          <CardHeader><CardTitle className="text-indigo-300">Weekly Scorecard (last 7 days)</CardTitle></CardHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-border/20 border border-border/40"><p className="text-gray-400">Focused</p><p className="text-lg font-black text-white">{minutesToHM(a.scorecard.focusedMinutes)}</p><p className="text-gray-500">of {minutesToHM(a.scorecard.targetMinutes)}</p></div>
            <div className="p-3 rounded-xl bg-border/20 border border-border/40"><p className="text-gray-400">GATE PYQs</p><p className="text-lg font-black text-purple-300">{a.scorecard.gatePyqs}</p><p className="text-gray-500">{a.scorecard.accuracy}% acc</p></div>
            <div className="p-3 rounded-xl bg-border/20 border border-border/40"><p className="text-gray-400">Roadmap</p><p className="text-lg font-black text-blue-300">{a.scorecard.roadmapDone}/{a.scorecard.roadmapTotal}</p><p className="text-gray-500">tasks done</p></div>
            <div className="p-3 rounded-xl bg-border/20 border border-border/40"><p className="text-gray-400">Revision</p><p className="text-lg font-black text-emerald-300">{a.scorecard.revisionDue} due</p><p className="text-gray-500">streak {a.scorecard.streak}d</p></div>
          </div>
        </Card>
      </div>
      )}
    </div>
  );
}
