"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Server, Play, ChevronRight } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PlainSection } from "@/components/study/ui";
import { minutesToHM } from "@/lib/date";
import { DISTRIBUTED_LINK_TITLES } from "@/lib/tracks";
import {
  HubLoading, HubError, GroupCard, PaceStrip, CrossTrackLinks,
  type HubGroupView, type HubTaskView,
} from "@/components/tracks/HubBits";

interface SwePayload {
  progress: { done: number; total: number; percent: number; minutesTotal: number; minutesCounted: number };
  current: HubTaskView | null;
  next: HubTaskView | null;
  pace: { remainingMinutes: number; daysLeft: number; requiredPerDay: number; currentPerDay: number; deadline: string; status: string };
  groups: HubGroupView[];
  excludedOptional: number;
}

export default function SoftwareEngineeringPage() {
  const [data, setData] = useState<SwePayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/tracks?track=swe");
      if (!res.ok) throw new Error("Software Engineering data failed to load");
      const json = await res.json();
      setData(json.swe);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!data) {
    if (loadError) return <HubError message={loadError} onRetry={fetchData} />;
    return <HubLoading />;
  }

  const distributed = data.groups
    .flatMap((g) => g.tasks)
    .filter((t) => DISTRIBUTED_LINK_TITLES.includes(t.title));

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-16 md:space-y-12">
      {/* hero: overall progress */}
      <header className="pt-4 md:pt-8">
        <p className="type-label flex items-center gap-2 !text-emerald-300">
          <Server className="h-4 w-4" aria-hidden /> Software Engineering
        </p>
        <h1 className="metric-xl mt-3 text-white">
          {data.progress.percent}<span className="text-lg font-semibold text-gray-500">% complete</span>
        </h1>
        <p className="type-body mt-1 text-[15px]">
          {data.progress.done}/{data.progress.total} tasks · {minutesToHM(data.progress.minutesTotal)} curriculum
          {data.excludedOptional > 0 ? ` · ${data.excludedOptional} deprioritized basics excluded from pace` : ""}
        </p>
        <div className="mt-4 max-w-md">
          <ProgressBar value={data.progress.percent} label="Software Engineering progress" color="bg-gradient-to-r from-emerald-500 to-teal-400" heightClass="h-2" />
        </div>
      </header>

      {/* current / next */}
      {(data.current || data.next) && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.current && (
            <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 via-card to-card p-5">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-accent">Current task</p>
              <p className="mt-2 text-base font-bold leading-snug text-white">{data.current.title}</p>
              <p className="mt-1 font-mono text-xs text-gray-400">{minutesToHM(data.current.estMin)} · {data.current.status.replace(/_/g, " ").toLowerCase()}</p>
              <Link href="/today" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-white hover:bg-accent-hover">
                <Play className="h-4 w-4" /> Open in Today
              </Link>
            </div>
          )}
          {data.next && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400">Next task</p>
              <p className="mt-2 text-base font-bold leading-snug text-gray-100">{data.next.title}</p>
              <p className="mt-1 font-mono text-xs text-gray-500">{minutesToHM(data.next.estMin)}</p>
              <Link href={`/roadmap/task/${data.next.id}`} className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline">
                View task <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </section>
      )}

      {/* pace */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="type-h3">Schedule status · due {data.pace.deadline}</h3>
        <div className="mt-3">
          <PaceStrip pace={data.pace} />
        </div>
      </section>

      {/* needs attention — only when repair flags exist in live data */}
      {data.groups.some((g) => g.needsRepair) && (
        <section aria-label="Needs attention">
          <h2 className="type-h2">Needs attention</h2>
          <ul className="mt-3 space-y-2">
            {data.groups.filter((g) => g.needsRepair).map((g) => (
              <li key={g.key} className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl border border-rose-500/25 bg-rose-500/5 px-4 py-2.5">
                <span className="min-w-0 truncate text-sm font-semibold text-gray-200">{g.label}</span>
                <span className="shrink-0 text-xs font-bold text-rose-300">failure repair · {g.done}/{g.total}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* groups */}
      <PlainSection title="Curriculum groups">
        <div className="space-y-2.5">
          {data.groups.filter((g) => g.key !== "distributed").map((g) => (
            <GroupCard key={g.key} group={g} defaultOpen={g.key === "backend"} />
          ))}
        </div>
      </PlainSection>

      {/* distributed systems lens: compact links to canonical rows, no copies */}
      <PlainSection title="Distributed Systems lens">
        <p className="mb-3 text-xs text-gray-500">
          Primitives covered across this hub — same canonical tasks, one source of truth.
        </p>
        <div className="flex flex-wrap gap-2">
          {distributed.map((t) => (
            <Link
              key={t.id}
              href={`/roadmap/task/${t.id}`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-gray-200 transition-colors duration-200 motion-reduce:transition-none hover:border-accent/40"
            >
              <span aria-hidden className={`h-2 w-2 rounded-full ${t.status === "COMPLETED" || t.status === "PRACTICE" ? "bg-emerald-400" : t.status === "IN_PROGRESS" ? "bg-amber-400" : "bg-gray-600"}`} />
              {t.title}
            </Link>
          ))}
          {distributed.length === 0 && <p className="text-xs text-gray-500">No linked tasks found.</p>}
        </div>
      </PlainSection>

      {/* cross-track */}
      <PlainSection title="Connected tracks">
        <CrossTrackLinks filter={(label) => /DBMS|PostgreSQL|algorithms|system design/i.test(label)} />
      </PlainSection>
    </div>
  );
}
