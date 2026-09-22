"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, AlertCircle, Plus, Trophy, Play, ChevronRight } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PlainSection } from "@/components/study/ui";
import { minutesToHM } from "@/lib/date";

interface GateSubject {
  id: string;
  name: string;
  icon: string;
  totalTopics: number;
  totalPYQs: number;
  solvedPYQs: number;
  accuracy: number;
  topics: any[];
  questions?: any[];
}

export default function GateDashboardPage() {
  const [subjects, setSubjects] = useState<GateSubject[]>([]);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [mockTests, setMockTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchGate = async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/gate");
      if (!res.ok) throw new Error("GATE data failed to load");
      const data = await res.json();
      setSubjects(data.subjects || []);
      setErrorLogs(data.errorLogs || []);
      setMockTests(data.mockTests || []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load GATE");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGate(); }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pt-10">
        <div className="h-44 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-8 text-center">
          <p className="text-base font-bold text-rose-300">GATE couldn&apos;t load</p>
          <p className="mt-1 text-sm text-gray-400">{loadError}</p>
          <button onClick={fetchGate} className="mt-4 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white">Retry</button>
        </div>
      </div>
    );
  }

  const totalPYQs = subjects.reduce((acc, s) => acc + s.totalPYQs, 0);
  const solvedPYQs = subjects.reduce((acc, s) => acc + s.solvedPYQs, 0);
  const avgAccuracy = subjects.length > 0 ? Number((subjects.reduce((acc, s) => acc + s.accuracy, 0) / subjects.length).toFixed(1)) : 0;
  const openErrors = errorLogs.filter((e) => e.status === "OPEN");

  // Today's GATE: subject with most open errors, else DBMS, else first.
  const focus =
    subjects
      .map((s) => ({ s, open: openErrors.filter((e) => e.subject === s.name).length }))
      .sort((a, b) => b.open - a.open)[0]?.s ??
    subjects.find((s) => s.name === "DBMS") ?? subjects[0] ?? null;
  const focusWeak = (focus?.topics || []).filter((t: any) => !t.completed || t.confidence <= 2)[0];

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-16 md:space-y-12">
      {/* 1 — hero */}
      <header className="pt-4 md:pt-8">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-purple-300">
          <BookOpen className="h-4 w-4" /> GATE 2027
        </p>
        <p className="metric-xl mt-3 text-white">
          {solvedPYQs} <span className="text-lg font-semibold text-gray-500">PYQs solved</span>
        </p>
        <p className="mt-1 text-2xl font-extrabold text-emerald-400 md:text-3xl">{avgAccuracy}% <span className="text-base font-semibold text-gray-500">accuracy</span></p>
        <div className="mt-4 max-w-md">
          <ProgressBar value={totalPYQs > 0 ? Math.round((solvedPYQs / totalPYQs) * 100) : 0} color="bg-gradient-to-r from-purple-500 to-indigo-400" heightClass="h-2.5" />
          <p className="mt-2 text-xs text-gray-500">
            {totalPYQs > 0 ? `${solvedPYQs}/${totalPYQs} PYQs • ${Math.max(0, totalPYQs - solvedPYQs)} remaining` : "1270 PYQs target"} • {(() => { const d = Math.max(1, Math.ceil((new Date("2027-01-15").getTime() - Date.now()) / 86400000)); const rem = Math.max(0, totalPYQs - solvedPYQs || 1270 - solvedPYQs); return `${Math.ceil(rem / d)}/day to Jan 15`; })()}
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/gate/questions" className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-purple-500">
            <Plus className="h-4 w-4" /> Log PYQ
          </Link>
          <Link href="/gate/errors" className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-3 text-sm font-bold text-rose-300 transition hover:bg-rose-500/20">
            <AlertCircle className="h-4 w-4" /> Errors ({openErrors.length})
          </Link>
          <Link href="/gate/mocks" className="flex items-center gap-1.5 rounded-xl border border-border bg-border/30 px-5 py-3 text-sm font-bold text-gray-200 transition hover:bg-border/60">
            <Trophy className="h-4 w-4" /> Mocks ({mockTests.length})
          </Link>
        </div>
      </header>

      {/* 2 — today's GATE */}
      {focus && (
        <section className="rounded-2xl border border-purple-500/25 bg-purple-500/5 p-6 md:p-8">
          <p className="text-[13px] font-extrabold uppercase tracking-widest text-purple-300">Today&apos;s GATE</p>
          <p className="mt-2 text-2xl font-bold text-white md:text-[1.7rem]">{focus.name}</p>
          <p className="mt-1 text-[15px] text-gray-400">
            {focusWeak ? `Weak spot: ${focusWeak.name}` : "Pick any 10 PYQs"} • {minutesToHM(75)} block
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/today" className="flex items-center gap-2 rounded-2xl bg-accent px-8 py-3.5 text-base font-bold text-white shadow-md transition hover:bg-accent-hover">
              <Play className="h-5 w-5" /> Start
            </Link>
            <Link href={`/gate/${encodeURIComponent(focus.name)}`} className="rounded-2xl border border-border bg-border/30 px-6 py-3.5 text-sm font-bold text-gray-200 transition hover:bg-border/60">
              Subject detail
            </Link>
          </div>
        </section>
      )}

      {/* 3 — subject progress (compact table, progressive disclosure) */}
      <PlainSection title="Subject progress" action={<Link href="/analytics" className="text-sm font-bold text-indigo-300 hover:underline">Trends →</Link>}>
        {subjects.length === 0 ? (
          <p className="text-[15px] text-gray-500">Start logging GATE PYQs.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {subjects.map((sub) => {
              const pct = sub.totalPYQs > 0 ? Math.round((sub.solvedPYQs / sub.totalPYQs) * 100) : 0;
              return (
                <li key={sub.id}>
                  <Link href={`/gate/${encodeURIComponent(sub.name)}`} className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3">
                    <span className="truncate text-[15px] font-semibold text-gray-200 group-hover:text-white group-hover:underline">{sub.name}</span>
                    <span className="flex items-center gap-2 font-mono text-[13px] text-gray-400">
                      {sub.solvedPYQs}/{sub.totalPYQs} · {sub.accuracy}%
                      <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-gray-300" />
                    </span>
                    <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-border/40">
                      <span className="block h-1.5 rounded-full bg-purple-500" style={{ width: `${pct}%` }} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PlainSection>

      {/* 4 — open errors (top 3) */}
      {openErrors.length > 0 && (
        <PlainSection title={`Open errors (${openErrors.length})`} action={<Link href="/gate/errors" className="text-sm font-bold text-rose-300 hover:underline">All →</Link>}>
          <ul className="space-y-3">
            {openErrors.slice(0, 3).map((e) => (
              <li key={e.id}>
                <Link href="/gate/errors" className="block text-[15px] font-semibold text-gray-200 hover:text-white hover:underline">
                  {e.subject} — {e.topic}
                </Link>
                <p className="mt-0.5 text-sm text-gray-500">{e.mistakeType} • retry {e.retryDate}</p>
              </li>
            ))}
          </ul>
        </PlainSection>
      )}
    </div>
  );
}
