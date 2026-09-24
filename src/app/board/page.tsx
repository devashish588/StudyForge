"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Play, Flame } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import TimerModal from "@/components/ui/TimerModal";
import { minutesToHM, formatDisplay, getProgramDay, getDaysRemaining } from "@/lib/date";

const REFRESH_MS = 20000;

export default function BoardPage() {
  const [data, setData] = useState<any>(null);
  const [timerOpen, setTimerOpen] = useState(false);
  const [next, setNext] = useState<{ title: string; category: string; minutes: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) setData(await res.json());
    } catch { /* board stays on last known state */ }
  }, []);

  useEffect(() => {
    fetchData();
    timerRef.current = setInterval(fetchData, REFRESH_MS);
    const onVis = () => { if (document.visibilityState === "visible") fetchData(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", fetchData);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", fetchData);
    };
  }, [fetchData]);

  const start = () => {
    const c = data?.nextCandidates?.[0];
    setNext(c ? { title: c.title, category: c.category, minutes: c.minutes } : { title: "Focus block", category: "Roadmap", minutes: 60 });
    setTimerOpen(true);
  };

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-16 w-16 animate-spin rounded-full border-b-4 border-accent" role="status" aria-label="Loading board" />
      </div>
    );
  }

  if (data.window?.status === "pre") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-xl font-bold uppercase tracking-[0.3em] text-indigo-300">StudyForge</p>
        <p className="text-5xl font-extrabold text-white md:text-6xl">Starts Sep 24</p>
      </div>
    );
  }

  const day = data.studyDay ?? {};
  const target = day.targetMinutes || 360;
  const actual = day.actualMinutes || 0;
  const pct = Math.round((actual / Math.max(1, target)) * 100);
  const today = formatDisplay(day.date ?? "");
  const programDay = Math.max(1, Math.min(99, data.window?.dayNumber ?? getProgramDay(day.date ?? "")));
  const streak = data.streak?.current ?? 0;
  const cand = data.nextCandidates?.[0];
  const thenCand = data.nextCandidates?.[1];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-6 text-center md:gap-10 md:p-12">
      <div>
        <p className="text-xl font-bold uppercase tracking-[0.3em] text-gray-400 md:text-2xl">Today — {today}</p>
        <p className="mt-1 font-mono text-base text-gray-500 md:text-lg">Day {programDay} / 99 • {getDaysRemaining(day.date ?? "")} to go</p>
      </div>

      <div>
        <p className="font-extrabold tracking-tight text-white" style={{ fontSize: "clamp(3.5rem, 10vw, 7rem)", lineHeight: 1 }}>
          {minutesToHM(actual)} <span className="text-gray-500" style={{ fontSize: "0.35em" }}>/ {minutesToHM(target)}</span>
        </p>
        <div className="mx-auto mt-6 w-[min(90vw,640px)]">
          <ProgressBar value={Math.min(100, pct)} color="bg-gradient-to-r from-indigo-500 to-emerald-400" heightClass="h-4" />
        </div>
      </div>

      <p className="flex items-center gap-3 text-3xl font-extrabold text-white md:text-4xl" aria-label={`${streak} day streak`}>
        <span role="img" aria-label="flame">🔥</span> {streak} <span className="text-lg font-bold text-gray-500">day streak</span>
      </p>

      <div>
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-gray-500">Next</p>
        <p className="mt-2 text-3xl font-bold text-white md:text-4xl">{cand ? cand.title : "Free focus block"}</p>
        {cand && <p className="mt-1 text-xl text-gray-400">{cand.category} • {cand.minutes} min</p>}
        {thenCand && (
          <p className="mt-3 text-lg text-gray-500">
            <span className="font-bold uppercase tracking-[0.2em] text-gray-600">Then </span>
            {thenCand.title} <span className="text-gray-600">· {thenCand.category}</span>
          </p>
        )}
        <button onClick={start} className="mx-auto mt-6 flex items-center gap-3 rounded-2xl bg-accent px-14 py-5 text-2xl font-bold text-white shadow-lg transition hover:bg-accent-hover">
          <Play className="h-7 w-7" /> Start
        </button>
      </div>

      <Link href="/today" className="mt-2 text-sm font-bold text-gray-600 hover:text-gray-300 hover:underline">
        Open full app →
      </Link>

      <TimerModal
        isOpen={timerOpen}
        onClose={() => { setTimerOpen(false); fetchData(); }}
        defaultTitle={next?.title} defaultCategory={next?.category} onSaved={fetchData}
      />
    </div>
  );
}
