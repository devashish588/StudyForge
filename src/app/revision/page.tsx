"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Repeat, Eye, EyeOff, CheckCircle2, Play, Clock, Pause } from "lucide-react";
import { PageShell, PageHeader, StatCard, StatusBadge, ChartCard, ErrorState, PageSkeleton } from "@/components/study/ui";
import { ConfidenceRating } from "@/components/ui/ConfidenceRating";
import { todayStr, addDays } from "@/lib/date";
import { cn } from "@/lib/cn";

interface RevisionItem {
  id: string; title: string; category: string; stage: number;
  confidence: number; nextRevisionDate: string; notes?: string;
}

export default function RevisionPage() {
  const [items, setItems] = useState<RevisionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [answer, setAnswer] = useState("");
  const [confidence, setConfidence] = useState(3);
  const [busy, setBusy] = useState(false);
  const [doneTick, setDoneTick] = useState(false);

  const fetchItems = async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/revision");
      if (!res.ok) throw new Error("Revision queue failed to load");
      const data = await res.json();
      setItems(data);
      if (!activeId && data.length > 0) setActiveId(data[0].id);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  if (loading) return <PageSkeleton />;
  if (loadError) return <PageShell><ErrorState message={loadError} onRetry={fetchItems} /></PageShell>;

  const today = todayStr();
  const dueToday = items.filter((i) => i.nextRevisionDate <= today);
  const overdue = items.filter((i) => i.nextRevisionDate < today);
  const dueWeek = items.filter((i) => i.nextRevisionDate <= addDays(today, 7));
  const active = items.find((i) => i.id === activeId) ?? dueToday[0] ?? items[0] ?? null;

  const completeRecall = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const res = await fetch("/api/revision", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: active.id, confidence, recallResult: showAnswer ? "Yes" : "Partially" }),
      });
      if (!res.ok) throw new Error("Save failed — your recall is still here, retry to schedule.");
      setDoneTick(true);
      setTimeout(() => {
        setDoneTick(false); setShowAnswer(false); setAnswer("");
        fetchItems();
      }, 900);
    } catch (e) { console.error(e); } finally { setBusy(false); }
  };

  const quickAction = async (id: string, kind: "reviewed" | "snooze") => {
    setBusy(true);
    try {
      if (kind === "reviewed") {
        await fetch("/api/revision", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, confidence: 4, recallResult: "Yes" }),
        });
      } else {
        await fetch("/api/revision", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, snoozeDays: 1 }),
        });
      }
      fetchItems();
    } catch (e) { console.error(e); } finally { setBusy(false); }
  };

  return (
    <PageShell>
      <PageHeader
        icon={<Repeat className="w-7 h-7 text-emerald-400" />}
        title="Revision"
        sub="Recall first, notes second. Confidence sets the next interval — 1→tomorrow, 3→3 days, 4→7 days, 5→21 days."
        actions={<Link href="/today" className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-accent-hover"><Play className="h-4 w-4" /> Study Next</Link>}
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Due today" value={dueToday.length} accent="text-white" />
        <StatCard label="This week" value={dueWeek.length} accent="text-indigo-300" />
        <StatCard label="Overdue" value={overdue.length} accent={overdue.length ? "text-rose-400" : "text-emerald-400"} />
      </div>

      {/* Today's revision list */}
      <ChartCard title={`Today's revision — ${dueToday.length}`}>
        {dueToday.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm font-bold text-emerald-400">YOU&apos;RE CLEAR ✓</p>
            <p className="mt-1 text-xs text-gray-400">No items due. Completing roadmap tasks feeds this queue automatically.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dueToday.map((item) => (
              <div key={item.id}
                className={cn("rounded-xl border p-3 transition", active?.id === item.id ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/50 bg-border/20")}>
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => { setActiveId(item.id); setShowAnswer(false); }} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-xs font-bold text-card-foreground">{item.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400">
                      <StatusBadge tone="indigo">{item.category}</StatusBadge>
                      <span>stage {item.stage}</span>
                      <span>confidence {item.confidence}/5</span>
                      {item.nextRevisionDate < today && <StatusBadge tone="rose">overdue</StatusBadge>}
                    </p>
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button onClick={() => { setActiveId(item.id); setShowAnswer(false); document.getElementById("recall-box")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20">
                    Recall
                  </button>
                  <button onClick={() => quickAction(item.id, "reviewed")} disabled={busy}
                    className="rounded-lg border border-border bg-border/20 px-3 py-1.5 text-[11px] font-bold text-gray-300 hover:bg-border/40 disabled:opacity-50">
                    <CheckCircle2 className="mr-1 inline h-3 w-3" /> Mark Reviewed
                  </button>
                  <button onClick={() => quickAction(item.id, "snooze")} disabled={busy}
                    className="rounded-lg border border-border bg-border/20 px-3 py-1.5 text-[11px] font-bold text-gray-400 hover:bg-border/40 disabled:opacity-50">
                    <Clock className="mr-1 inline h-3 w-3" /> Snooze 1d
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      {/* Immersive recall */}
      {active && (
        <div id="recall-box" className="rounded-2xl border border-emerald-500/30 bg-card p-5 scroll-mt-4 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
            <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
              RECALL — Stage {active.stage}
            </span>
            <span className="font-mono text-xs text-gray-400">{active.category}</span>
          </div>

          <div className="rounded-xl border border-border/50 bg-border/20 p-4">
            <h2 className="text-base font-extrabold text-card-foreground md:text-lg">Explain &ldquo;{active.title}&rdquo; without notes.</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-gray-400">
              <li>Core concept and definition?</li>
              <li>Key properties, complexities, or formulas?</li>
              <li>One implementation from memory?</li>
            </ul>
          </div>

          <label className="mb-1 mt-4 block text-xs font-semibold text-gray-400">Your answer</label>
          <textarea rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Retrieve first — then reveal the concept below…"
            className="w-full rounded-xl border border-border bg-border/30 p-3 text-xs text-card-foreground placeholder-gray-500 focus:outline-none focus:border-emerald-500" />

          <button onClick={() => setShowAnswer(!showAnswer)}
            className="mt-3 flex items-center gap-2 rounded-xl bg-border/50 px-4 py-2 text-xs font-bold text-gray-200 transition hover:bg-border">
            {showAnswer ? <><EyeOff className="h-4 w-4 text-amber-400" /> Hide Concept</> : <><Eye className="h-4 w-4 text-emerald-400" /> Reveal Concept</>}
          </button>

          {showAnswer && (
            <div className="mt-3 space-y-4 animate-fadeIn">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-200">
                <p className="text-sm font-bold">Reference concept</p>
                <p className="mt-1">{active.notes || "No notes attached — verify against your standard reference."}</p>
              </div>
              <div className="border-t border-border pt-4">
                <ConfidenceRating value={confidence} onChange={setConfidence} />
                <button onClick={completeRecall} disabled={busy}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50">
                  {doneTick ? <><CheckCircle2 className="h-4 w-4" /> Scheduled ✓</> : busy ? <><Pause className="h-4 w-4" /> Saving…</> : "Schedule Next Review"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full queue */}
      <ChartCard title={`Full queue — ${items.length}`}>
        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {items.map((item) => (
            <button key={item.id} onClick={() => { setActiveId(item.id); setShowAnswer(false); }}
              className={cn("flex w-full items-center justify-between rounded-xl border p-3 text-left transition",
                active?.id === item.id ? "border-accent bg-accent/10" : "border-border/40 bg-border/20 hover:border-gray-500")}>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-card-foreground">{item.title}</span>
                <span className="text-[10px] text-gray-400">{item.category} • stage {item.stage}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-xs font-semibold text-emerald-400">{item.nextRevisionDate}</span>
                <span className="block text-[10px] text-gray-500">next due</span>
              </span>
            </button>
          ))}
        </div>
      </ChartCard>
    </PageShell>
  );
}
