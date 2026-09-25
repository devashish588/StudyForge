"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Code2, Play, RotateCcw, ChevronRight, Target } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PlainSection, StatusBadge } from "@/components/study/ui";
import { HubLoading, HubError, CrossTrackLinks, statusTone } from "@/components/tracks/HubBits";

interface DsaProblem {
  id: string;
  title: string;
  difficulty: string;
  solved: boolean;
  attempted: boolean;
  needsRevisit: boolean;
}

interface DsaPattern {
  key: string;
  label: string;
  solved: number;
  attempted: number;
  total: number;
  needsRevisit: number;
  percent: number;
  problems: DsaProblem[];
}

interface DsaPayload {
  core100: { solved: number; attempted: number; total: number; percent: number; byDifficulty: Record<string, { solved: number; total: number }> };
  patterns: DsaPattern[];
  currentPattern: { key: string; label: string; nextUp: string } | null;
  weakPatterns: { key: string; label: string; solved: number; total: number; needsRevisit: number }[];
  recentSolves: { title: string; date: string; actualMinutes: number }[];
  resolves: { count: number; items: { id: string; title: string; retryDate: string | null }[] };
  readiness: { percent: number; label: string };
  primers: { done: number; total: number };
}

const DIFF_ORDER = ["Easy", "Medium", "Hard"];

export default function DsaPage() {
  const [data, setData] = useState<DsaPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openPattern, setOpenPattern] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/tracks?track=dsa");
      if (!res.ok) throw new Error("DSA data failed to load");
      const json = await res.json();
      setData(json.dsa);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSolve = async (p: DsaProblem) => {
    try {
      await fetch("/api/practice", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, solved: !p.solved, attempted: true }),
      });
      fetchData();
    } catch { /* noop */ }
  };

  if (!data) {
    if (loadError) return <HubError message={loadError} onRetry={fetchData} />;
    return <HubLoading />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-16 md:space-y-12">
      {/* hero: Core 100 progress */}
      <header className="pt-4 md:pt-8">
        <p className="type-label flex items-center gap-2 !text-amber-300">
          <Code2 className="h-4 w-4" aria-hidden /> DSA · Core 100
        </p>
        <h1 className="metric-xl mt-3 text-white">
          {data.core100.solved}<span className="text-lg font-semibold text-gray-500">/{data.core100.total} solved</span>
        </h1>
        <p className="type-body mt-1 text-[15px]">
          {data.core100.attempted} attempted · primers {data.primers.done}/{data.primers.total}
        </p>
        <div className="mt-4 max-w-md">
          <ProgressBar value={data.core100.percent} label="Core 100 progress" color="bg-gradient-to-r from-amber-500 to-orange-400" heightClass="h-2" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {DIFF_ORDER.map((d) => {
            const b = data.core100.byDifficulty[d];
            if (!b) return null;
            return (
              <span key={d} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-gray-300">
                {d}: {b.solved}/{b.total}
              </span>
            );
          })}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent">
            <Target className="h-3.5 w-3.5" /> {data.readiness.label}
          </span>
        </div>
      </header>

      {/* current pattern */}
      {data.currentPattern && (
        <section className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 via-card to-card p-5 md:p-6">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-accent">Current pattern</p>
          <p className="mt-2 text-xl font-bold text-white">{data.currentPattern.label}</p>
          <p className="mt-1 text-sm text-gray-400">Next up: {data.currentPattern.nextUp}</p>
          <Link href="/today" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-white hover:bg-accent-hover">
            <Play className="h-4 w-4" /> Practice in Today
          </Link>
        </section>
      )}

      {/* weak patterns */}
      {data.weakPatterns.length > 0 && (
        <PlainSection title="Weak patterns">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {data.weakPatterns.map((w) => (
              <button
                key={w.key}
                onClick={() => setOpenPattern(w.key)}
                className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-4 text-left transition hover:bg-rose-500/10"
              >
                <p className="text-sm font-bold text-white">{w.label}</p>
                <p className="mt-1 font-mono text-xs text-gray-400">{w.solved}/{w.total} solved{w.needsRevisit > 0 ? ` · ${w.needsRevisit} to revisit` : ""}</p>
              </button>
            ))}
          </div>
        </PlainSection>
      )}

      {/* patterns */}
      <PlainSection title="Patterns" action={<Link href="/practice" className="text-sm font-bold text-accent hover:underline">Practice log →</Link>}>
        <div className="space-y-2.5">
          {data.patterns.map((g) => {
            const open = openPattern === g.key;
            return (
              <div key={g.key} className="rounded-xl border border-border bg-card">
                <button onClick={() => setOpenPattern(open ? null : g.key)} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${g.percent === 100 ? "bg-emerald-400" : g.solved > 0 ? "bg-amber-400" : "bg-gray-600"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-white">{g.label}</span>
                    <span className="mt-0.5 block text-[11px] text-gray-500">
                      {g.solved}/{g.total} solved{g.needsRevisit > 0 ? ` · ${g.needsRevisit} to revisit` : ""}
                    </span>
                  </span>
                  <span className="w-16 shrink-0 font-mono text-xs text-gray-400">{g.percent}%</span>
                  <span className="shrink-0 text-gray-500">{open ? "▾" : "▸"}</span>
                </button>
                {open && (
                  <ul className="space-y-1 border-t border-border/60 px-2 py-2">
                    {g.problems.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-border/20">
                        <input
                          type="checkbox" checked={p.solved} onChange={() => toggleSolve(p)}
                          className="h-5 w-5 shrink-0 accent-emerald-500" aria-label={`Solved: ${p.title}`}
                        />
                        <span className={`min-w-0 flex-1 truncate text-sm ${p.solved ? "text-gray-500 line-through" : "text-gray-200"}`}>
                          {p.title}
                        </span>
                        {p.needsRevisit && <StatusBadge tone="rose">revisit</StatusBadge>}
                        <StatusBadge tone={p.difficulty === "Easy" ? "green" : p.difficulty === "Hard" ? "rose" : "amber"}>{p.difficulty}</StatusBadge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </PlainSection>

      {/* recent solves + re-solves */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <PlainSection title="Recent solves">
          {data.recentSolves.length === 0 ? (
            <p className="text-sm text-gray-500">No timed practice sessions logged yet — start one from Today.</p>
          ) : (
            <ul className="space-y-2">
              {data.recentSolves.map((s, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-semibold text-gray-200">{s.title}</span>
                  <span className="shrink-0 font-mono text-xs text-gray-500">{s.date.slice(5)} · {s.actualMinutes}m</span>
                </li>
              ))}
            </ul>
          )}
        </PlainSection>
        <PlainSection title="Re-solves" action={<span className="flex items-center gap-1 text-xs font-bold text-gray-400"><RotateCcw className="h-3.5 w-3.5" />{data.resolves.count}</span>}>
          {data.resolves.items.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing flagged for re-solve. Problems solved with hints stay here automatically.</p>
          ) : (
            <ul className="space-y-2">
              {data.resolves.items.map((r) => (
                <li key={r.id} className="text-sm font-semibold text-gray-200">
                  {r.title}
                  {r.retryDate && <span className="ml-2 font-mono text-xs font-normal text-gray-500">retry {r.retryDate.slice(5)}</span>}
                </li>
              ))}
            </ul>
          )}
        </PlainSection>
      </div>

      {/* cross-track */}
      <PlainSection title="Connected tracks">
        <CrossTrackLinks filter={(label) => /algorithms|system design|DBMS/i.test(label)} />
        <Link href="/practice" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-accent hover:underline">
          Full practice log <ChevronRight className="h-4 w-4" />
        </Link>
      </PlainSection>
    </div>
  );
}
