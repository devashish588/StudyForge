"use client";

import React, { useState } from "react";
import { X, Sparkles } from "lucide-react";
import type { FocusPriority } from "@/lib/study";

export default function CheckInModal({
  isOpen, onClose, onDone, initialAvailable = 360, initialPriority = "Balanced",
}: {
  isOpen: boolean; onClose: () => void; onDone: () => void;
  initialAvailable?: number; initialPriority?: FocusPriority;
}) {
  const [hours, setHours] = useState<number>(initialAvailable >= 480 ? 8 : initialAvailable >= 420 ? 7 : 6);
  const [custom, setCustom] = useState<string>("");
  const [priority, setPriority] = useState<FocusPriority>(initialPriority);
  const [mustFinish, setMustFinish] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!isOpen) return null;

  const availableMinutes = custom ? Math.max(60, Math.min(720, Math.round(Number(custom) * 60) || 0)) : hours * 60;

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const dayRes = await fetch("/api/study-day", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableMinutes, targetMinutes: availableMinutes, focusPriority: priority }),
      });
      if (!dayRes.ok) throw new Error("Check-in failed — nothing was saved. Retry.");
      // (Re)build today's plan around the check-in, honoring a manual must-finish goal.
      const planRes = await fetch("/api/today-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availableMinutes, priorityMode: priority,
          ...(mustFinish.trim() ? { manualGoal: mustFinish.trim() } : {}),
        }),
      });
      if (!planRes.ok) throw new Error("Day saved, but plan build failed — retry to generate it.");
      onDone();
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed — retry.");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 sm:p-6 relative shadow-2xl max-h-[92vh] overflow-y-auto animate-fadeIn">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close check-in">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold text-card-foreground">Daily Check-In</h2>
        </div>
        <p className="text-xs text-gray-400 mb-5">15 seconds. Pick time + focus — we generate your flexible plan (no fixed sittings).</p>

        <p className="text-xs font-bold text-gray-300 mb-2">TIME AVAILABLE TODAY</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[6, 7, 8].map((h) => (
            <button
              key={h}
              onClick={() => { setHours(h); setCustom(""); }}
              className={`py-2.5 rounded-xl border font-bold text-sm transition ${!custom && hours === h ? "bg-accent border-accent text-white" : "bg-border/30 border-border text-gray-400 hover:bg-border/60"}`}
            >
              {h}h
            </button>
          ))}
        </div>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Custom hours (e.g. 6.5)"
          inputMode="decimal"
          className="w-full bg-border/30 border border-border rounded-xl px-3 py-2 text-xs text-card-foreground placeholder-gray-500 focus:outline-none focus:border-accent mb-5"
        />

        <p className="text-xs font-bold text-gray-300 mb-2">TODAY'S FOCUS</p>
        <div className="flex flex-wrap gap-2 mb-6">
          {(["Balanced", "GATE", "Roadmap", "Project", "Revision"] as FocusPriority[]).map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${priority === p ? "bg-accent text-white border-accent" : "bg-border/30 text-gray-400 border-border hover:bg-border/60"}`}
            >
              {p}
            </button>
          ))}
        </div>

        <p className="text-xs font-bold text-gray-300 mb-2">WHAT MUST BE FINISHED TODAY? <span className="font-normal text-gray-500">(optional)</span></p>
        <input
          value={mustFinish}
          onChange={(e) => setMustFinish(e.target.value)}
          placeholder="e.g. Finish DBMS Transactions"
          className="w-full bg-border/30 border border-border rounded-xl px-3 py-2 text-xs text-card-foreground placeholder-gray-500 focus:outline-none focus:border-accent mb-6"
        />

        {saveError && <p className="mb-2 text-center text-xs font-semibold text-rose-400">{saveError}</p>}
        <button
          onClick={save}
          disabled={saving || availableMinutes < 60}
          className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-bold text-xs transition shadow-md"
        >
          {saving ? "Building…" : `Build My Day (${Math.round(availableMinutes / 60 * 10) / 10}h)`}
        </button>
      </div>
    </div>
  );
}
