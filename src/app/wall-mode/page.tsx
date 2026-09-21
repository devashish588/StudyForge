"use client";

import React, { useState, useEffect } from "react";
import { Monitor, Printer } from "lucide-react";

export default function WallModePage() {
  const [streak, setStreak] = useState<number | null>(null);
  const [dayNum, setDayNum] = useState<number | null>(null);
  const [roadmapPct, setRoadmapPct] = useState<number | null>(null);
  const [gatePct, setGatePct] = useState<number | null>(null);
  const [activeCount, setActiveCount] = useState<number | null>(null);

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
            <h2 className="text-xl font-black text-roadmap uppercase">TRACK 1: AI ENGINEERING & FULL STACK</h2>
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
            <h2 className="text-xl font-black text-gate uppercase">TRACK 2: GATE 2027 MASTERY</h2>
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
          <h2 className="text-sm font-black uppercase tracking-widest mb-3 flex items-center gap-2"><Monitor className="w-4 h-4" /> 99-Day Tracker</h2>
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(11, minmax(0,1fr))" }}>
            {Array.from({ length: 99 }, (_, i) => (
              <div key={i} className="aspect-square border border-gray-500 rounded-sm" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
