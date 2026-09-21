"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Flame, ArrowRight, Play } from "lucide-react";
import { PageShell, PageHeader, StatCard, StatusBadge, ErrorState, PageSkeleton, SecondaryButton } from "@/components/study/ui";
import { ContributionCalendar, type HeatDay } from "@/components/study/Heatmap";
import { todayStr, minutesToHM, formatDisplay } from "@/lib/date";

interface StreakData {
  streak: { current: number; longest: number; thisMonth: number };
  heatmap: { date: string; minutes: number; gate: number; roadmap: number; revision: number }[];
  studyDay: { actualMinutes: number; gateMinutes: number; roadmapMinutes: number; revisionMinutes: number; coreDayCompleted: boolean };
  coreDayComplete: boolean;
}

export default function StreakPage() {
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [totalActive, setTotalActive] = useState(0);
  const [selDate, setSelDate] = useState<string | null>(null);
  const [selDetail, setSelDetail] = useState<any>(null);
  const [selLoading, setSelLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Dashboard failed to load");
      const d = await res.json();
      setData({ streak: d.streak, heatmap: d.heatmap, studyDay: d.studyDay, coreDayComplete: d.coreDayComplete });
      setTotalActive((d.heatmap || []).filter((h: any) => h.minutes >= 180).length);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load streak");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openDay = async (d: HeatDay) => {
    setSelDate(d.date);
    setSelDetail(null);
    setSelLoading(true);
    try {
      const res = await fetch(`/api/study-day?date=${d.date}`);
      if (res.ok) setSelDetail(await res.json());
    } catch (e) { console.error(e); } finally { setSelLoading(false); }
  };

  if (loading) return <PageSkeleton />;
  if (loadError || !data) return <PageShell><ErrorState message={loadError ?? "No streak data"} onRetry={fetchData} /></PageShell>;

  const remaining = Math.max(0, 180 - data.studyDay.actualMinutes);
  const gateOk = data.studyDay.gateMinutes >= 30;
  const roadOk = data.studyDay.roadmapMinutes >= 30;
  const revOk = data.studyDay.revisionMinutes >= 15;

  return (
    <PageShell wide>
      <PageHeader
        icon={<Flame className="w-7 h-7 text-orange-400" />}
        title="Study Streak"
        sub="Active since September 24. A day counts only on core-day completion — GATE + Roadmap + Revision, or 3h+ focused. Logins never count."
        actions={<SecondaryButton href="/today"><Play className="h-4 w-4" /> Continue Study</SecondaryButton>}
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Current streak" value={<span className="flex items-center gap-1">🔥 {data.streak.current}</span>} hint="days" accent="text-orange-300" />
        <StatCard label="Longest streak" value={data.streak.longest} hint="days" accent="text-white" />
        <StatCard label="Total active days" value={totalActive} hint={`this month ${data.streak.thisMonth}`} accent="text-emerald-400" />
      </div>

      {!data.coreDayComplete ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 animate-fadeIn">
          <p className="text-xs font-extrabold uppercase tracking-widest text-amber-300">Keep your streak alive</p>
          <p className="mt-1 text-sm font-bold text-white">
            {remaining > 0 ? `${minutesToHM(remaining)} of core focus remaining today` : "Finish the remaining core tasks"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className={gateOk ? "text-emerald-400" : "text-gray-400"}>{gateOk ? "✓" : "○"} GATE (30m+)</span>
            <span className={roadOk ? "text-emerald-400" : "text-gray-400"}>{roadOk ? "✓" : "○"} Roadmap (30m+)</span>
            <span className={revOk ? "text-emerald-400" : "text-gray-400"}>{revOk ? "✓" : "○"} Revision (15m+)</span>
          </div>
          <Link href="/today" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-accent-hover">
            Continue Study <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="core-glow rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-center animate-popIn">
          <p className="text-sm font-black uppercase tracking-widest text-emerald-300">Core day complete — streak preserved 🔥</p>
          <p className="mt-1 text-xs text-gray-300">{minutesToHM(data.studyDay.actualMinutes)} studied today ({todayStr()})</p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-xs font-extrabold uppercase tracking-widest text-gray-400">Contribution heatmap — Sep 24 → Dec 31 · click any day</h2>
        <ContributionCalendar days={data.heatmap} onSelect={openDay} />
        {selDate && (
          <div className="mt-4 rounded-xl border border-border/60 bg-border/10 p-4 animate-fadeIn">
            {selLoading ? (
              <div className="h-24 animate-pulse rounded-lg bg-border/30" />
            ) : selDetail ? (
              <div className="text-xs">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-extrabold text-white">{formatDisplay(selDate)}</p>
                  {selDetail.coreDayCompleted
                    ? <StatusBadge tone="green">🔥 core day</StatusBadge>
                    : selDetail.restDay
                    ? <StatusBadge tone="gray">rest day</StatusBadge>
                    : <StatusBadge tone="amber">partial</StatusBadge>}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="rounded-lg bg-border/20 p-2"><p className="text-[10px] text-gray-500">Study</p><p className="text-sm font-black text-white">{minutesToHM(selDetail.actualMinutes)}</p></div>
                  <div className="rounded-lg bg-border/20 p-2"><p className="text-[10px] text-gray-500">GATE</p><p className="text-sm font-black text-purple-300">{minutesToHM(selDetail.gateMinutes)}</p></div>
                  <div className="rounded-lg bg-border/20 p-2"><p className="text-[10px] text-gray-500">Roadmap</p><p className="text-sm font-black text-blue-300">{minutesToHM(selDetail.roadmapMinutes)}</p></div>
                  <div className="rounded-lg bg-border/20 p-2"><p className="text-[10px] text-gray-500">Practice</p><p className="text-sm font-black text-amber-300">{minutesToHM(selDetail.practiceMinutes)}</p></div>
                  <div className="rounded-lg bg-border/20 p-2"><p className="text-[10px] text-gray-500">Revision</p><p className="text-sm font-black text-emerald-300">{minutesToHM(selDetail.revisionMinutes)}</p></div>
                  <div className="rounded-lg bg-border/20 p-2"><p className="text-[10px] text-gray-500">Problems</p><p className="text-sm font-black text-white">{selDetail.problemsSolved ?? 0}</p></div>
                </div>
                <p className="mt-2 text-[11px] text-gray-500">All values from stored StudyDay — no estimates.</p>
              </div>
            ) : (
              <p className="py-2 text-center text-xs text-gray-500">No stored data for this day yet.</p>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
