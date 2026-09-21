"use client";

import React, { useState, useEffect } from "react";
import { Printer } from "lucide-react";
import { todayStr, minutesToHM } from "@/lib/date";

type Section = "Daily" | "Weekly" | "Monthly" | "GATE" | "Errors" | "Streak";

const SECTIONS: Section[] = ["Daily", "Weekly", "Monthly", "GATE", "Errors", "Streak"];

export default function PrintPage() {
  const [section, setSection] = useState<Section>("Weekly");
  const [tasks, setTasks] = useState<any[]>([]);
  const [gate, setGate] = useState<any>(null);
  const [errors, setErrors] = useState<any[]>([]);
  const [day, setDay] = useState<any>(null);

  useEffect(() => {
    fetch("/api/tasks").then((r) => r.json()).then((d) => setTasks(d || [])).catch(() => {});
    fetch("/api/gate").then((r) => r.json()).then((d) => { setGate(d); setErrors(d?.errorLogs || []); }).catch(() => {});
    fetch(`/api/study-day?date=${todayStr()}`).then((r) => r.json()).then(setDay).catch(() => {});
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="no-print flex flex-col gap-3 p-4 bg-card border border-border rounded-xl md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-bold text-card-foreground">Printable Planner Mode</h1>
          <p className="text-xs text-gray-400">Pick a sheet, then print. Navigation and buttons never print. Window: Sep 24 → Dec 31 (99 days).</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SECTIONS.map((s) => (
              <button key={s} onClick={() => setSection(s)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${section === s ? "border-accent bg-accent text-white" : "border-border bg-border/20 text-gray-400"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => window.print()}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 shrink-0">
          <Printer className="w-4 h-4" /> Print {section} (A4)
        </button>
      </div>

      <div className="card-print p-8 bg-white text-black rounded-xl border border-gray-300 space-y-6">
        <div className="text-center border-b-2 border-black pb-4">
          <h1 className="text-2xl font-black uppercase tracking-wider">StudyForge — {section} Sheet</h1>
          <p className="text-xs font-semibold mt-1">Sep 24 → Dec 31 (99 days) • Flexible 8–10h • No fixed sittings</p>
        </div>

        {section === "Daily" && (
          <div className="space-y-3">
            <h2 className="text-base font-bold uppercase border-b border-black pb-1">Today — {todayStr()} (target {minutesToHM(day?.targetMinutes ?? 480)})</h2>
            {(day?.sessions || []).map((s: any, i: number) => (
              <CheckRow key={s.id || i} title={`${s.blockLabel || `Block ${i + 1}`}: ${s.title}`} sub={`${s.category} • planned ${s.plannedMinutes}m • actual ${s.actualMinutes}m`} />
            ))}
            {(day?.sessions || []).length === 0 && (
              <>
                <CheckRow title="Block 1: GATE focus (180m)" sub="PYQs + weak-topic drills" />
                <CheckRow title="Block 2: Roadmap deep work (180m)" sub="Current topic + practice set" />
                <CheckRow title="Block 3: Practice (60m)" sub="Pattern problems" />
                <CheckRow title="Block 4: Revision recall (60m)" sub="Due queue first" />
              </>
            )}
            <div className="border-2 border-dashed border-gray-400 p-4 rounded min-h-[100px]">
              <p className="text-xs font-bold text-gray-700 uppercase">Wrap-up: difficult? tomorrow&apos;s focus?</p>
            </div>
          </div>
        )}

        {section === "Weekly" && (
          <div className="space-y-2">
            <h2 className="text-base font-bold uppercase border-b border-black pb-1">Weekly Task Checklist</h2>
            {tasks.slice(0, 14).map((t) => (
              <CheckRow key={t.id} title={t.title} sub={`${t.category} • ${t.practiceReq || ""}`} right={t.blockLabel || t.sitting} />
            ))}
            <div className="border-2 border-dashed border-gray-400 p-4 rounded min-h-[100px]">
              <p className="text-xs font-bold text-gray-700 uppercase">Weekly reflection: went well / badly / change / weak topics</p>
            </div>
          </div>
        )}

        {section === "Monthly" && (
          <div className="space-y-2">
            <h2 className="text-base font-bold uppercase border-b border-black pb-1">Monthly Milestones</h2>
            {["DSA Foundation", "Full Stack", "ML", "GenAI + RAG", "Agents + DevOps", "GATE mocks", "Final ship"].map((m) => (
              <CheckRow key={m} title={m} sub="completion %: ____" />
            ))}
          </div>
        )}

        {section === "GATE" && (
          <div className="space-y-2">
            <h2 className="text-base font-bold uppercase border-b border-black pb-1">GATE 2027 Checklist</h2>
            {(gate?.subjects || []).map((s: any) => (
              <CheckRow key={s.id} title={s.name} sub={`${s.solvedPYQs}/${s.totalPYQs} PYQs • ${s.accuracy}% accuracy`} />
            ))}
          </div>
        )}

        {section === "Errors" && (
          <div className="space-y-2">
            <h2 className="text-base font-bold uppercase border-b border-black pb-1">Error Log — retry queue</h2>
            {errors.filter((e: any) => e.status !== "RESOLVED").slice(0, 14).map((e: any) => (
              <CheckRow key={e.id} title={`${e.subject} — ${e.topic}`} sub={`${e.mistakeType}: ${e.rootCause} • retry ${e.retryDate}`} />
            ))}
            {errors.filter((e: any) => e.status !== "RESOLVED").length === 0 && (
              <p className="text-xs text-gray-600">No open errors. Log wrong PYQs to fill this queue.</p>
            )}
          </div>
        )}

        {section === "Streak" && (
          <div className="space-y-2">
            <h2 className="text-base font-bold uppercase border-b border-black pb-1">99-Day Streak Tracker (Sep 24 → Dec 31)</h2>
            <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(11, minmax(0,1fr))" }}>
              {Array.from({ length: 99 }, (_, i) => (
                <div key={i} className="aspect-square border border-black rounded-sm" />
              ))}
            </div>
            <p className="text-[10px] text-gray-600">Shade a box only on core-day completion (GATE + Roadmap + Revision, or 3h+ focused). Logins don&apos;t count.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckRow({ title, sub, right }: { title: string; sub?: string; right?: string }) {
  return (
    <div className="flex items-start gap-3 text-xs border-b border-gray-200 pb-2">
      <div className="w-4 h-4 border-2 border-black rounded shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-bold">{title}</p>
        {sub && <p className="text-[11px] text-gray-600">{sub}</p>}
      </div>
      {right && <span className="font-mono text-[10px] uppercase font-bold">{right}</span>}
    </div>
  );
}
