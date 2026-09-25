"use client";

import React, { useState } from "react";
import { X, MoonStar, CheckCircle2, Flame } from "lucide-react";
import { minutesToHM } from "@/lib/date";

export default function WrapUpModal({
  isOpen, onClose, onDone,
  actualMinutes = 0, gateMinutes = 0, roadmapMinutes = 0,
  practiceMinutes = 0, revisionMinutes = 0, coreComplete = false,
  unfinished = [], onCarry, planFeedback = null, onFeedback,
}: {
  isOpen: boolean; onClose: () => void; onDone: () => void;
  actualMinutes?: number; gateMinutes?: number; roadmapMinutes?: number;
  practiceMinutes?: number; revisionMinutes?: number; coreComplete?: boolean;
  unfinished?: { id: string; title: string }[];
  onCarry?: (id: string) => Promise<void> | void;
  planFeedback?: string | null;
  onFeedback?: (f: "easy" | "ok" | "hard") => Promise<void> | void;
}) {
  const [learned, setLearned] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [carried, setCarried] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<string | null>(planFeedback);
  const [fbSaving, setFbSaving] = useState(false);

  if (!isOpen) return null;

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/study-day", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyReflection: learned, tomorrowPriority: tomorrow }),
      });
      if (!res.ok) throw new Error("Wrap-up failed to save — your words are still here. Retry.");
      await res.json();
      setSaved(true);
      onDone();
      setTimeout(() => { setSaved(false); setLearned(""); setTomorrow(""); setCarried({}); onClose(); }, 900);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed — retry.");
    } finally { setSaving(false); }
  };

  const rows: [string, number][] = [
    ["GATE", gateMinutes],
    ["Roadmap", roadmapMinutes],
    ["Practice", practiceMinutes],
    ["Revision", revisionMinutes],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="relative max-h-[92vh] w-full max-w-lg animate-fadeIn overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <button onClick={onClose} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center text-gray-400 hover:text-white" aria-label="Close wrap-up">
          <X className="h-5 w-5" />
        </button>
        <div className="mb-1 flex items-center gap-2">
          <MoonStar className="h-5 w-5 text-indigo-400" />
          <h2 className="text-xl font-bold text-card-foreground">Today complete</h2>
        </div>
        <p className="metric-xl mt-2 text-white">{minutesToHM(actualMinutes)} <span className="text-base font-semibold text-gray-500">studied</span></p>

        <ul className="mt-4 divide-y divide-border/60">
          {rows.map(([label, mins]) => (
            <li key={label} className="flex items-center justify-between py-2.5">
              <span className="text-[15px] font-semibold text-gray-300">{label}</span>
              <span className="font-mono text-sm text-gray-400">{minutesToHM(mins)}</span>
            </li>
          ))}
        </ul>

        {coreComplete ? (
          <p className="mt-3 flex items-center gap-1.5 text-[15px] font-bold text-emerald-300">
            <Flame className="h-4 w-4" /> Streak preserved
          </p>
        ) : (
          <p className="mt-3 text-sm text-gray-500">Core day open — every focused minute still counts.</p>
        )}

        <label className="mb-1 mt-5 block text-sm font-bold text-gray-200" htmlFor="wrap-learned">One thing you learned</label>
        <textarea id="wrap-learned" value={learned} onChange={(e) => setLearned(e.target.value)} rows={2}
          placeholder="Normalization clicks when I think in keys…"
          className="w-full rounded-xl border border-border bg-border/30 p-3 text-sm text-card-foreground placeholder-gray-500 focus:border-accent focus:outline-none" />

        <label className="mb-1 mt-4 block text-sm font-bold text-gray-200" htmlFor="wrap-tomorrow">
          Tomorrow&apos;s priority <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <input id="wrap-tomorrow" value={tomorrow} onChange={(e) => setTomorrow(e.target.value)} placeholder="DBMS transactions…"
          className="w-full rounded-xl border border-border bg-border/30 px-3 py-3 text-sm text-card-foreground placeholder-gray-500 focus:border-accent focus:outline-none" />

        {saveError && <p className="mt-3 text-center text-xs font-semibold text-rose-400">{saveError} <button onClick={save} className="underline">Retry</button></p>}

        {unfinished.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-bold text-gray-200">What remains ({unfinished.length})</p>
            <ul className="space-y-1.5">
              {unfinished.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-gray-300">{u.title}</span>
                  {carried[u.id] ? (
                    <span className="shrink-0 text-xs font-bold text-emerald-400">Queued ✓</span>
                  ) : (
                    <button
                      onClick={async () => { try { await onCarry?.(u.id); setCarried((c) => ({ ...c, [u.id]: true })); } catch {} }}
                      className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-bold text-gray-300 hover:bg-border/40">
                      Carry to tomorrow
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-gray-500">Carried work joins tomorrow&apos;s candidates — never forced back into must-do.</p>
          </div>
        )}

        <div className="mt-4">
          <p className="mb-2 text-sm font-bold text-gray-200">Was today&apos;s plan realistic?</p>
          <div className="flex gap-2">
            {([["easy", "Too easy"], ["ok", "About right"], ["hard", "Too much"]] as const).map(([v, label]) => (
              <button key={v} disabled={fbSaving}
                onClick={async () => { setFbSaving(true); try { await onFeedback?.(v); setFeedback(v); } catch {} finally { setFbSaving(false); } }}
                className={`flex-1 rounded-xl border px-2 py-2 text-xs font-bold transition disabled:opacity-50 ${feedback === v ? "border-accent bg-accent text-white" : "border-border bg-border/20 text-gray-400 hover:bg-border/40"}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-gray-500">Shapes tomorrow&apos;s must-do budget. Descriptive, never a judgment.</p>
        </div>

        <button onClick={save} disabled={saving}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-base font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50">
          {saved ? <><CheckCircle2 className="h-5 w-5" /> Saved — see you tomorrow</> : saving ? "Saving…" : "Complete wrap-up"}
        </button>
      </div>
    </div>
  );
}
