"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, ChevronDown } from "lucide-react";
import { PageShell, PageHeader, StatCard, StatusBadge, ErrorState, PageSkeleton, SecondaryButton } from "@/components/study/ui";
import { cn } from "@/lib/cn";

interface ErrorLogItem {
  id: string; subject: string; topic: string; mistakeType: string;
  rootCause: string; correctConcept: string; retryDate: string; status: string; createdAt: string;
}

export default function GateErrorLogPage() {
  const [logs, setLogs] = useState<ErrorLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subject, setSubject] = useState("All");
  const [openId, setOpenId] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/gate");
      if (!res.ok) throw new Error("Error log failed to load");
      const data = await res.json();
      setLogs(data.errorLogs || []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const setStatus = async (id: string, status: string) => {
    const prev = logs;
    setLogs((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l))); // optimistic
    try {
      const res = await fetch("/api/gate", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ errorId: id, status }),
      });
      if (!res.ok) throw new Error("persist failed");
    } catch (e) {
      console.error(e);
      setLogs(prev); // rollback
    }
  };

  if (loading) return <PageSkeleton />;
  if (loadError) return <PageShell><ErrorState message={loadError} onRetry={fetchLogs} /></PageShell>;

  const subjects = ["All", ...Array.from(new Set(logs.map((e) => e.subject)))];
  const filtered = subject === "All" ? logs : logs.filter((e) => e.subject === subject);

  const cats: Record<string, number> = {};
  for (const l of filtered) cats[l.mistakeType] = (cats[l.mistakeType] ?? 0) + 1;
  const catEntries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(1, ...catEntries.map(([, v]) => v));

  return (
    <PageShell wide>
      <Link href="/gate" className="flex items-center gap-2 text-xs text-gray-400 transition hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back to GATE Command Center
      </Link>
      <PageHeader
        icon={<AlertCircle className="w-6 h-6 text-rose-400" />}
        title="GATE Error Log"
        sub="Every wrong PYQ lands here. Expand, understand the root cause, retry, resolve."
        actions={
          <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Filter by subject"
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold text-card-foreground">
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        }
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-xs font-extrabold uppercase tracking-widest text-gray-400">Error summary — {filtered.length} total</h2>
        {catEntries.length === 0 ? (
          <p className="py-2 text-xs text-gray-500">No errors. Wrong PYQs automatically appear here with mistake categories.</p>
        ) : (
          <div className="space-y-2">
            {catEntries.map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="w-32 shrink-0 font-semibold text-gray-300">{k}</span>
                <div className="h-3 flex-1 overflow-hidden rounded bg-border/30">
                  <div className="h-3 rounded bg-rose-500 transition-all" style={{ width: `${Math.round((v / maxCat) * 100)}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-gray-400">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Open" value={filtered.filter((l) => l.status === "OPEN").length} accent="text-amber-400" />
        <StatCard label="Revised" value={filtered.filter((l) => l.status === "REVISED").length} accent="text-blue-400" />
        <StatCard label="Resolved" value={filtered.filter((l) => l.status === "RESOLVED").length} accent="text-emerald-400" />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-bold text-gray-300">Clean record</p>
          <p className="mt-1 text-xs text-gray-500">Keep practicing PYQs cleanly.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const open = openId === log.id;
            return (
              <div key={log.id} className={cn("rounded-xl border bg-card transition", open ? "border-rose-500/40" : "border-border hover:border-gray-600")}>
                <button onClick={() => setOpenId(open ? null : log.id)} className="flex w-full items-center justify-between gap-3 p-3.5 text-left" aria-expanded={open}>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-card-foreground">{log.topic} <span className="font-normal text-gray-500">• {log.subject}</span></span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <StatusBadge tone="rose">{log.mistakeType}</StatusBadge>
                      <span className="font-mono text-[10px] text-gray-500">retry {log.retryDate}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <StatusBadge tone={log.status === "RESOLVED" ? "green" : log.status === "REVISED" ? "blue" : "amber"}>{log.status}</StatusBadge>
                    <ChevronDown className={cn("h-4 w-4 text-gray-500 transition", open && "rotate-180")} />
                  </span>
                </button>
                {open && (
                  <div className="space-y-2 border-t border-border/50 p-3.5 text-xs animate-fadeIn">
                    <div>
                      <p className="font-bold text-gray-300">Mistake</p>
                      <p className="mt-0.5 text-gray-400">{log.rootCause}</p>
                    </div>
                    <div>
                      <p className="font-bold text-gray-300">Correct concept</p>
                      <p className="mt-0.5 italic text-emerald-400">✓ {log.correctConcept}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] text-gray-500">Status:</span>
                      {(["OPEN", "REVISED", "RESOLVED"] as const).map((s) => (
                        <button key={s} onClick={() => setStatus(log.id, s)}
                          className={cn("rounded-lg border px-2.5 py-1 text-[11px] font-bold transition",
                            log.status === s ? "border-accent bg-accent text-white" : "border-border bg-border/20 text-gray-400 hover:bg-border/40")}>
                          {s === "OPEN" ? "Needs Revision" : s === "REVISED" ? "Revised" : "Resolved"}
                        </button>
                      ))}
                      <SecondaryButton href="/gate/questions" className="ml-auto !px-3 !py-1.5">Retry PYQ</SecondaryButton>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
