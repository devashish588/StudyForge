"use client";

import React, { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { generatePlan, type FocusPriority } from "@/lib/study";
import { minutesToHM } from "@/lib/date";

export default function GenerateDayModal({
  isOpen, onClose, onApply, revisionDue = 0,
}: {
  isOpen: boolean;
  onClose: () => void;
  onApply: (plan: { gateMinutes: number; roadmapMinutes: number; practiceMinutes: number; revisionMinutes: number }) => void;
  revisionDue?: number;
}) {
  const [hours, setHours] = useState<8 | 9 | 10>(8);
  const [priority, setPriority] = useState<FocusPriority>("Balanced");

  if (!isOpen) return null;

  const plan = generatePlan({ availableMinutes: hours * 60, priority, revisionDueCount: revisionDue });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 sm:p-6 relative shadow-2xl max-h-[92vh] overflow-y-auto animate-fadeIn">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close planner">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold text-card-foreground">Generate My Day</h2>
        </div>
        <p className="text-xs text-gray-400 mb-5">Flexible 8–10h capacity planning. No fixed sittings — redistribute freely.</p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {([8, 9, 10] as const).map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={`p-3 rounded-xl border text-center font-bold text-sm transition ${hours === h ? "bg-accent border-accent text-white" : "bg-border/30 border-border text-gray-400 hover:bg-border/60"}`}
            >
              {h} Hours
              <p className="text-[10px] font-normal opacity-80 mt-0.5">{h * 60} min</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {(["Balanced", "GATE", "Roadmap", "Project", "Revision"] as FocusPriority[]).map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${priority === p ? "bg-accent text-white border-accent" : "bg-border/30 text-gray-400 border-border"}`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="space-y-2 bg-background/50 border border-border rounded-xl p-4 mb-5 text-xs">
          <div className="flex justify-between"><span className="text-gray-300">GATE 2027</span><span className="font-bold text-purple-400">{minutesToHM(plan.gateMinutes)}</span></div>
          <div className="flex justify-between"><span className="text-gray-300">Roadmap / AI</span><span className="font-bold text-blue-400">{minutesToHM(plan.roadmapMinutes)}</span></div>
          <div className="flex justify-between"><span className="text-gray-300">Practice</span><span className="font-bold text-amber-400">{minutesToHM(plan.practiceMinutes)}</span></div>
          <div className="flex justify-between"><span className="text-gray-300">Revision</span><span className="font-bold text-emerald-400">{minutesToHM(plan.revisionMinutes)}</span></div>
        </div>

        <button
          onClick={async () => {
            try {
              await fetch("/api/study-day", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ availableMinutes: hours * 60, targetMinutes: hours * 60, focusPriority: priority }),
              });
            } catch (e) { console.error(e); }
            onApply({ gateMinutes: plan.gateMinutes, roadmapMinutes: plan.roadmapMinutes, practiceMinutes: plan.practiceMinutes, revisionMinutes: plan.revisionMinutes });
            onClose();
          }}
          className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-xs transition shadow-md"
        >
          Apply {hours}h Plan
        </button>
      </div>
    </div>
  );
}
