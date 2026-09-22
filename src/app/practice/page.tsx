"use client";

import React, { useState, useEffect } from "react";
import { Code2, Plus, Trash2, Check, RotateCcw } from "lucide-react";
import { PageShell, PageHeader, StatusBadge, ErrorState, PageSkeleton, PlainSection, FilterPills } from "@/components/study/ui";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { minutesToHM, addDays, todayStr } from "@/lib/date";
import { cn } from "@/lib/cn";

interface Problem {
  id: string; title: string; platform: string; url?: string; category: string;
  pattern: string; difficulty: string; attempted: boolean; solved: boolean;
  timeMinutes: number; createdAt: string;
}

const patterns = [
  "All", "Arrays", "Strings", "Hashing", "Two Pointers", "Sliding Window",
  "Binary Search", "Sorting", "Recursion", "Backtracking", "Linked List",
  "Stack", "Queue", "Trees", "BST", "Heap", "Graph", "Greedy", "Dynamic Programming", "Prefix Sum",
] as const;

const inputCls = "w-full rounded-xl border border-border bg-border/30 p-2.5 text-xs text-card-foreground placeholder:text-gray-500 focus:outline-none focus:border-accent";

export default function PracticePage() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof patterns)[number]>("All");
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<"All" | "Easy" | "Medium" | "Hard">("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "solved" | "attempted">("All");

  const [title, setTitle] = useState("");
  const [pattern, setPattern] = useState("Arrays");
  const [difficulty, setDifficulty] = useState("Medium");
  const [timeMinutes, setTimeMinutes] = useState("");
  const [solved, setSolved] = useState(false);

  const fetchProblems = async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/practice");
      if (!res.ok) throw new Error("Practice data failed to load");
      setProblems(await res.json());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProblems(); }, []);

  const addProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const res = await fetch("/api/practice", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(), platform: "LeetCode", category: "DSA",
          pattern, difficulty, solved, timeMinutes: Number(timeMinutes) || 15,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setTitle("");
      fetchProblems();
    } catch (e) { console.error(e); }
  };

  const toggleSolved = async (p: Problem) => {
    const prev = problems;
    setProblems((ps) => ps.map((x) => (x.id === p.id ? { ...x, solved: !x.solved } : x)));
    try {
      const res = await fetch("/api/practice", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, solved: !p.solved }),
      });
      if (!res.ok) throw new Error("persist failed");
    } catch (e) { console.error(e); setProblems(prev); }
  };

  const remove = async (id: string) => {
    const prev = problems;
    setProblems((ps) => ps.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/practice?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
    } catch (e) { console.error(e); setProblems(prev); }
  };

  if (loading) return <PageSkeleton />;
  if (loadError) return <PageShell wide><ErrorState message={loadError} onRetry={fetchProblems} /></PageShell>;

  const weekStart = addDays(todayStr(), -7);
  const weekSolved = problems.filter((p) => p.solved && p.createdAt.slice(0, 10) >= weekStart);
  const attemptedAll = problems.filter((p) => p.attempted);
  const accuracy = attemptedAll.length ? Math.round((problems.filter((p) => p.solved).length / attemptedAll.length) * 100) : 0;

  // Pattern heatmap (counts of solved per pattern)
  const perPattern: Record<string, { solved: number; total: number }> = {};
  for (const p of problems) {
    perPattern[p.pattern] ??= { solved: 0, total: 0 };
    perPattern[p.pattern].total++;
    if (p.solved) perPattern[p.pattern].solved++;
  }
  const heat = Object.entries(perPattern).sort((a, b) => b[1].solved - a[1].solved);
  const maxHeat = Math.max(1, ...heat.map(([, v]) => v.solved));
  const weakPatterns = heat.filter(([, v]) => v.total > 0 && v.solved / v.total < 0.6).slice(0, 4);

  const filtered = problems.filter((p) => {
    if (filter !== "All" && p.pattern !== filter) return false;
    if (difficultyFilter !== "All" && p.difficulty !== difficultyFilter) return false;
    if (statusFilter !== "All" && (p.solved ? "solved" : "attempted") !== statusFilter) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.pattern.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const weekMinutes = weekSolved.reduce((a, p) => a + p.timeMinutes, 0);

  return (
    <PageShell wide>
      <PageHeader
        icon={<Code2 className="w-7 h-7 text-accent" />}
        title="Practice"
        sub="Learn → Practice → Recall → Revise. Every attempt counts toward accuracy and pattern mastery."
      />

      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <p className="metric-xl text-white">{weekSolved.length}</p>
          <p className="mt-1 text-sm font-bold uppercase tracking-widest text-gray-500">Problems this week</p>
        </div>
        <div>
          <p className="metric-xl text-emerald-400">{accuracy}%</p>
          <p className="mt-1 text-sm font-bold uppercase tracking-widest text-gray-500">Accuracy</p>
        </div>
        <div>
          <p className="metric-xl text-indigo-300">{minutesToHM(weekMinutes)}</p>
          <p className="mt-1 text-sm font-bold uppercase tracking-widest text-gray-500">Practice time</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <PlainSection title="Patterns">
          {heat.length === 0 ? (
            <p className="text-[15px] text-gray-500">Log your first problem — pattern volume appears here.</p>
          ) : (
            <div className="space-y-2.5">
              {heat.slice(0, 10).map(([name, v]) => (
                <button key={name} onClick={() => setFilter(name as (typeof patterns)[number])} className="flex w-full items-center gap-3" title={`Filter ${name}`}>
                  <span className="w-32 shrink-0 truncate text-left text-sm font-semibold text-gray-300">{name}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded-md bg-border/30">
                    <div className="h-4 rounded-md bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all" style={{ width: `${Math.round((v.solved / maxHeat) * 100)}%` }} />
                  </div>
                  <span className="w-14 shrink-0 text-right font-mono text-[13px] text-gray-400">{v.solved}/{v.total}</span>
                </button>
              ))}
            </div>
          )}
        </PlainSection>

        <PlainSection title="Weak patterns">
          {weakPatterns.length === 0 ? (
            <p className="text-[15px] text-gray-500">No weak patterns — every attempted pattern is 60%+ solved.</p>
          ) : (
            <div className="space-y-4">
              {weakPatterns.map(([name, v]) => (
                <div key={name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-bold text-gray-100">{name}</span>
                    <StatusBadge tone="amber">{v.solved}/{v.total} solved</StatusBadge>
                  </div>
                  <ProgressBar value={Math.round((v.solved / Math.max(1, v.total)) * 100)} color="bg-amber-500" heightClass="h-2" />
                </div>
              ))}
            </div>
          )}
        </PlainSection>
      </div>

      <PlainSection title="Recent problems">
        {filtered.length === 0 ? (
          <p className="text-[15px] text-gray-500">Start logging problems — your history builds here.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {filtered.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate text-[15px] font-semibold text-gray-200">{p.title}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusBadge tone={p.solved ? "green" : "amber"}>{p.solved ? "solved" : "attempted"}</StatusBadge>
                  <button onClick={() => toggleSolved(p)} title={p.solved ? "Mark attempted" : "Mark solved"}
                    className="rounded-lg border border-border p-2 text-gray-400 transition hover:border-emerald-500/40 hover:text-emerald-400" aria-label={`Toggle ${p.title}`}>
                    {p.solved ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  </button>
                  <button onClick={() => remove(p.id)} title="Delete" aria-label={`Delete ${p.title}`}
                    className="rounded-lg border border-border p-2 text-gray-400 transition hover:border-rose-500/40 hover:text-rose-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </PlainSection>

      <PlainSection title="Log a problem">
        <form onSubmit={addProblem} className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <div className="col-span-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Problem title (e.g. 3Sum)" className={inputCls} aria-label="Problem title" />
          </div>
          <select value={pattern} onChange={(e) => setPattern(e.target.value)} className={inputCls} aria-label="Pattern">
            {patterns.filter((p) => p !== "All").map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inputCls} aria-label="Difficulty">
            <option>Easy</option><option>Medium</option><option>Hard</option>
          </select>
          <div className="flex gap-2">
            <input value={timeMinutes} onChange={(e) => setTimeMinutes(e.target.value)} inputMode="numeric" placeholder="min" className={inputCls} aria-label="Minutes spent" />
          </div>
          <div className="col-span-2 flex gap-2 md:col-span-1">
            <button type="button" onClick={() => setSolved(!solved)} title="Toggle solved"
              className={cn("flex-1 rounded-xl border px-2 text-xs font-bold transition", solved ? "border-emerald-500 bg-emerald-500/15 text-emerald-300" : "border-border bg-border/20 text-gray-400")}>
              {solved ? "✓ Solved" : "Attempted"}
            </button>
            <button type="submit" className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-accent px-2 py-3 text-xs font-bold text-white transition hover:bg-accent-hover">
              <Plus className="h-4 w-4" /> Log
            </button>
          </div>
        </form>
      </PlainSection>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search problems or patterns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-card pl-10 pr-3 py-2.5 text-sm text-card-foreground placeholder:text-gray-500 focus:border-accent focus:outline-none"
            aria-label="Search problems"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">⌕</span>
        </div>
        <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value as any)} className="rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-card-foreground focus:border-accent focus:outline-none" aria-label="Filter by difficulty">
          <option value="All">All difficulties</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-card-foreground focus:border-accent focus:outline-none" aria-label="Filter by status">
          <option value="All">All status</option>
          <option value="solved">Solved</option>
          <option value="attempted">Attempted</option>
        </select>
      </div>

      <FilterPills options={patterns} value={filter} onChange={setFilter} />

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-border/20 text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
              <th className="p-4">Title</th><th className="p-4">Pattern</th><th className="p-4">Difficulty</th><th className="p-4">Time</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">No problems for this pattern yet.</td></tr>
            ) : filtered.map((p) => (
              <tr key={p.id} className="transition hover:bg-border/20">
                <td className="p-4 font-bold text-card-foreground">{p.title} <span className="font-normal text-gray-500">({p.platform})</span></td>
                <td className="p-4"><StatusBadge tone="indigo">{p.pattern}</StatusBadge></td>
                <td className="p-4"><StatusBadge tone={p.difficulty === "Easy" ? "green" : p.difficulty === "Medium" ? "amber" : "rose"}>{p.difficulty}</StatusBadge></td>
                <td className="p-4 font-mono text-gray-400">{p.timeMinutes} min</td>
                <td className="p-4"><StatusBadge tone={p.solved ? "green" : "amber"}>{p.solved ? "solved" : "attempted"}</StatusBadge></td>
                <td className="p-4">
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => toggleSolved(p)} title={p.solved ? "Mark attempted" : "Mark solved"}
                      className="rounded-lg border border-border p-1.5 text-gray-400 transition hover:border-emerald-500/40 hover:text-emerald-400">
                      {p.solved ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => remove(p.id)} title="Delete" className="rounded-lg border border-border p-1.5 text-gray-400 transition hover:border-rose-500/40 hover:text-rose-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {filtered.length === 0 && <p className="rounded-xl border border-border bg-card p-6 text-center text-xs text-gray-500">No problems for this pattern yet.</p>}
        {filtered.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-bold text-card-foreground">{p.title}</p>
              <StatusBadge tone={p.solved ? "green" : "amber"}>{p.solved ? "solved" : "attempted"}</StatusBadge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge tone="indigo">{p.pattern}</StatusBadge>
              <StatusBadge tone={p.difficulty === "Easy" ? "green" : p.difficulty === "Medium" ? "amber" : "rose"}>{p.difficulty}</StatusBadge>
              <span className="font-mono text-[10px] text-gray-500">{p.timeMinutes} min</span>
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => toggleSolved(p)} className="flex-1 rounded-lg border border-border bg-border/20 py-1.5 text-[11px] font-bold text-gray-300">
                {p.solved ? "Mark attempted" : "Mark solved"}
              </button>
              <button onClick={() => remove(p.id)} className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-gray-500" aria-label={`Delete ${p.title}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
