"use client";

import React, { useState } from "react";
import { ShieldAlert, RefreshCw, X, CheckCircle2 } from "lucide-react";
import { todayStr } from "@/lib/date";

interface BacklogItem {
  id: string;
  title: string;
  category: string;
  priority: string;
  estimatedMinutes: number;
  overdueDays: number;
}

interface RecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: BacklogItem[];
  onApplied?: () => void;
}

// Slim recovery plan: capped blocks, never dumps the whole backlog into one day.
const PLAN = [
  { title: "GATE catch-up (highest overdue first)", category: "GATE", minutes: 45 },
  { title: "Roadmap catch-up practice", category: "Roadmap", minutes: 45 },
  { title: "Essential revision sweep", category: "Revision", minutes: 30 },
];

export default function RecoveryModal({ isOpen, onClose, items, onApplied }: RecoveryModalProps) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const activate = async () => {
    setBusy(true);
    setError(null);
    try {
      // Create the three capped recovery blocks for today.
      for (const [i, p] of PLAN.entries()) {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: todayStr(),
            title: p.title,
            category: p.category,
            plannedMinutes: p.minutes,
            blockLabel: `Recovery ${i + 1}`,
            notes: `Recovery plan for ${items.length} missed item(s). Capped — remainder stays queued.`,
          }),
        });
        if (!res.ok) throw new Error("block creation failed");
      }
      // Mark backlog items rescheduled (keeps history, never duplicates).
      for (const item of items) {
        await fetch("/api/backlog", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, status: "RESCHEDULED", rescheduledDate: todayStr() }),
        });
      }
      setDone(true);
      onApplied?.();
      setTimeout(() => {
        setDone(false);
        onClose();
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation failed — nothing was changed. Retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 sm:p-6 relative shadow-2xl max-h-[92vh] overflow-y-auto animate-fadeIn">
        <button onClick={onClose} className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center text-gray-400 hover:text-white" aria-label="Close recovery">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2 text-amber-400">
          <ShieldAlert className="w-5 h-5" />
          <h2 className="text-lg font-bold">RECOVERY MODE</h2>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          {items.length > 0
            ? `${items.length} missed item${items.length === 1 ? "" : "s"} — consistency beats intensity. Capped plan below; the rest stays queued (max 60m catch-up/day).`
            : "No pending backlog. This slim plan keeps the day moving without overload."}
        </p>

        <div className="space-y-2 bg-border/20 border border-border rounded-xl p-4 mb-4">
          {PLAN.map((p, i) => (
            <div key={p.title} className="flex items-center justify-between text-xs pb-2 border-b border-border/50 last:border-0 last:pb-0">
              <span className="font-semibold text-gray-200">{i + 1}. {p.title}</span>
              <span className="font-bold text-amber-400">{p.minutes} min</span>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div className="mb-4 space-y-1 max-h-28 overflow-y-auto">
            {items.map((item) => (
              <p key={item.id} className="text-[11px] text-gray-500">
                • {item.title} <span className="font-mono">({item.overdueDays}d overdue • {item.priority})</span>
              </p>
            ))}
          </div>
        )}

        {error && <p className="mb-2 text-center text-xs font-semibold text-rose-400">{error} <button onClick={activate} className="underline">Retry</button></p>}

        <button
          onClick={activate}
          disabled={busy}
          className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-2 min-h-[44px]"
        >
          {done ? <><CheckCircle2 className="w-4 h-4" /> Recovery blocks added ✓</> : busy ? "Adding blocks…" : <><RefreshCw className="w-4 h-4" /> Activate Recovery Schedule</>}
        </button>
      </div>
    </div>
  );
}
