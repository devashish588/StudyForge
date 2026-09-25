"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { GraduationCap, ChevronRight, BookOpen, Brain, Server, Code2 } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PlainSection, ErrorState, Skeleton } from "@/components/study/ui";

interface TrackRow {
  key: string;
  label: string;
  href: string;
  icon: "gate" | "ai" | "swe" | "dsa";
  done: number;
  total: number;
  percent: number;
  hint: string;
}

const ICONS = {
  gate: <BookOpen className="h-5 w-5 text-purple-300" />,
  ai: <Brain className="h-5 w-5 text-indigo-300" />,
  swe: <Server className="h-5 w-5 text-emerald-300" />,
  dsa: <Code2 className="h-5 w-5 text-amber-300" />,
};

export default function LearnPage() {
  const [rows, setRows] = useState<TrackRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoadError(null);
      const [tracksRes, gateRes] = await Promise.all([fetch("/api/tracks?track=all"), fetch("/api/gate")]);
      if (!tracksRes.ok || !gateRes.ok) throw new Error("Learn data failed to load");
      const tracks = await tracksRes.json();
      const gate = await gateRes.json();
      const subjects: any[] = gate.subjects || [];
      const topics = subjects.flatMap((s) => s.topics || []);
      const topicsDone = topics.filter((t: any) => t.completed).length;
      const out: TrackRow[] = [
        {
          key: "gate", label: "GATE", href: "/gate", icon: "gate",
          done: topicsDone, total: topics.length,
          percent: topics.length ? Math.round((topicsDone / topics.length) * 100) : 0,
          hint: `${subjects.length} subjects · syllabus first-pass`,
        },
        {
          key: "ai", label: "AI Engineering", href: "/ai-engineering", icon: "ai",
          done: tracks.ai?.progress?.done ?? 0, total: tracks.ai?.progress?.total ?? 0,
          percent: tracks.ai?.progress?.percent ?? 0,
          hint: "14 groups · foundations → production",
        },
        {
          key: "swe", label: "Software Engineering", href: "/software-engineering", icon: "swe",
          done: tracks.swe?.progress?.done ?? 0, total: tracks.swe?.progress?.total ?? 0,
          percent: tracks.swe?.progress?.percent ?? 0,
          hint: "15 groups · backend → system design",
        },
        {
          key: "dsa", label: "DSA", href: "/dsa", icon: "dsa",
          done: tracks.dsa?.core100?.solved ?? 0, total: tracks.dsa?.core100?.total ?? 0,
          percent: tracks.dsa?.core100?.percent ?? 0,
          hint: `Core 100 · ${tracks.dsa?.readiness?.label ?? ""}`,
        },
      ];
      setRows(out);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-16 md:space-y-12">
      <header className="pt-4 md:pt-8">
        <p className="type-label flex items-center gap-2 !text-accent">
          <GraduationCap className="h-4 w-4" aria-hidden /> Learn
        </p>
        <h1 className="type-h1 mt-2">Four tracks, one plan</h1>
        <p className="type-body mt-2 max-w-2xl text-[15px]">
          Today decides the order — these hubs show where each track stands. Execution stays on <Link href="/today" className="font-bold text-accent hover:underline">Today</Link>.
        </p>
      </header>

      {loadError ? (
        <ErrorState message={loadError} onRetry={fetchData} />
      ) : !rows ? (
        <div className="space-y-3">
          <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
      ) : (
        <PlainSection>
          <div className="space-y-3">
            {rows.map((r) => (
              <Link
                key={r.key}
                href={r.href}
                className="group flex min-h-[64px] items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors duration-200 motion-reduce:transition-none hover:border-accent/40"
              >
                <span className="shrink-0" aria-hidden>{ICONS[r.icon]}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-base font-bold text-white group-hover:underline">{r.label}</span>
                    <span className="type-metadata shrink-0">{r.done}/{r.total} · {r.percent}%</span>
                  </span>
                  <span className="mt-2 block"><ProgressBar value={r.percent} label={`${r.label} progress`} heightClass="h-2" /></span>
                  <span className="type-metadata mt-1.5 block">{r.hint}</span>
                </span>
                <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-gray-500 group-hover:text-accent" />
              </Link>
            ))}
          </div>
        </PlainSection>
      )}
    </div>
  );
}
