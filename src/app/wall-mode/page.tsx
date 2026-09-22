"use client";

import React, { useState, useEffect } from "react";
import { Monitor, Printer, CheckCircle2, Circle, Clock } from "lucide-react";
import { PROGRAM_START_STR, addDays, todayStr } from "@/lib/date";

export default function WallModePage() {
  const [streak, setStreak] = useState<number | null>(null);
  const [dayNum, setDayNum] = useState<number | null>(null);
  const [roadmapPct, setRoadmapPct] = useState<number | null>(null);
  const [gatePct, setGatePct] = useState<number | null>(null);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [heatmap, setHeatmap] = useState<{ date: string; minutes: number }[]>([]);
  const today = todayStr();

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setStreak(d.streak?.current ?? null);
        setDayNum(d.window?.dayNumber ?? null);
        setRoadmapPct(d.monthly?.roadmapPercent ?? null);
        setGatePct(d.gate?.percent ?? null);
        setActiveCount((d.heatmap || []).filter((h: any) => h.minutes >= 180).length);
        setHeatmap(d.heatmap || []);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="no-print flex flex-col gap-3 p-4 bg-card border border-border rounded-xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-card-foreground">Wall Planner Display Mode</h1>
          <p className="text-xs text-gray-400">Live numbers from your database. High-contrast layout for wall monitors and poster prints.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 shrink-0"
        >
          <Printer className="w-4 h-4" /> Print Wall Poster
        </button>
      </div>

      <div className="card-print p-6 sm:p-10 bg-card border-2 border-border text-card-foreground rounded-2xl space-y-8 overflow-hidden">
        <div className="border-b-4 border-accent pb-6">
          <span className="text-sm font-extrabold text-accent uppercase tracking-widest">SEPTEMBER 24 – DECEMBER 31 • 99 DAYS{dayNum ? ` • DAY ${dayNum}` : ""}</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mt-1 break-words">DECEMBER TARGET: SHIP & MASTER GATE</h1>
          <p className="text-sm text-gray-400 mt-2 font-mono">Daily Execution • 8–10 Flexible Hours • Core Day = Streak</p>
          <div className="mt-4 flex flex-wrap gap-4 text-center">
            <div className="rounded-xl border border-border px-5 py-3">
              <p className="text-3xl font-black">🔥 {streak ?? "…"}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Day streak</p>
            </div>
            <div className="rounded-xl border border-border px-5 py-3">
              <p className="text-3xl font-black">{roadmapPct ?? "…"}%</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Roadmap</p>
            </div>
            <div className="rounded-xl border border-border px-5 py-3">
              <p className="text-3xl font-black">{gatePct ?? "…"}%</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">GATE PYQs</p>
            </div>
            <div className="rounded-xl border border-border px-5 py-3">
              <p className="text-3xl font-black">{activeCount ?? "…"}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Active days</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-border/20 border-2 border-roadmap/30 rounded-xl space-y-4">
            <div>
              <h2 className="text-xl font-black text-roadmap uppercase">TRACK 1: AI ENGINEERING & FULL STACK</h2>
              <p className="text-xs font-bold uppercase tracking-widest text-roadmap/70">Fixed target checklist — not live progress</p>
            </div>
            <div className="space-y-3 font-semibold text-sm">
              {["DSA Foundations & 30 Problems", "Full Stack SaaS Project Shipped", "Deployed ML Prediction API", "PDF Question-Answering RAG App", "Multi-Tool Autonomous AI Agent"].map((t) => (
                <div key={t} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded border-2 border-roadmap shrink-0" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 bg-border/20 border-2 border-gate/30 rounded-xl space-y-4">
            <div>
              <h2 className="text-xl font-black text-gate uppercase">TRACK 2: GATE 2027 MASTERY</h2>
              <p className="text-xs font-bold uppercase tracking-widest text-gate/70">Fixed target checklist — not live progress</p>
            </div>
            <div className="space-y-3 font-semibold text-sm">
              {["Discrete Math & Graph Theory PYQs", "Data Structures & Algorithms PYQs", "DBMS Normalization & Concurrency", "Operating Systems & Memory Management", "GATE Error Log 100% Resolved"].map((t) => (
                <div key={t} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded border-2 border-gate shrink-0" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Monitor className="w-4 h-4" /> 99-Day Tracker — live from database</h2>
            <span className="text-xs font-semibold text-gray-500">{heatmap.filter(h => h.minutes >= 180).length} core · {heatmap.filter(h => h.minutes > 0 && h.minutes < 180).length} partial</span>
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(11, minmax(0,1fr))" }}>
            {Array.from({ length: 99 }, (_, i) => {
              const date = addDays(PROGRAM_START_STR, i);
              const entry = heatmap.find(h => h.date === date);
              const mins = entry?.minutes ?? 0;
              const isFuture = date > today;
              const isToday = date === today;
              let bg = "bg-card border-gray-600";
              let icon = null;
              if (isFuture) bg = "bg-transparent border-gray-700/50";
              else if (mins >= 180) { bg = "bg-emerald-500 border-emerald-500"; icon = <CheckCircle2 className="w-3 h-3 text-white" />; }
              else if (mins > 0) { bg = "bg-amber-500/60 border-amber-500"; icon = <Clock className="w-3 h-3 text-white" />; }
              else if (date < today) { bg = "bg-rose-500/20 border-rose-500/50"; icon = <Circle className="w-3 h-3 text-rose-400" />; }
              return (
                <div key={i} title={`${date}: ${mins > 0 ? `${Math.floor(mins/60)}h ${mins%60}m` : isFuture ? "future" : "no data"}${isToday ? " · TODAY" : ""}`} className={`aspect-square border rounded-sm flex items-center justify-center ${bg} ${isToday ? "ring-2 ring-accent ring-offset-1 ring-offset-card" : ""}`}>
                  {icon}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-emerald-500 border border-emerald-500" /> Core complete</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-amber-500/60 border border-amber-500" /> Partial</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-rose-500/20 border border-rose-500/50" /> Missed</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-transparent border border-gray-700/50" /> Future</span>
          </div>
        </div>
      </div>
    </div>
  );
}
