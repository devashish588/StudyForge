"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, BookOpen, Code2, Brain, Save, Repeat, StickyNote } from "lucide-react";
import { PageShell, StatusBadge, ChartCard, ErrorState, PageSkeleton, PrimaryButton, SecondaryButton, SectionHeader } from "@/components/study/ui";
import { ConfidenceRating } from "@/components/ui/ConfidenceRating";
import { minutesToHM } from "@/lib/date";

interface TaskDetail {
  id: string; title: string; category: string; subtopics: string;
  estimatedTimeMinutes: number; practiceReq: string; status: string;
  confidence: number; notes?: string; assignedDate: string;
}

const STATUS_LABEL: Record<string, string> = {
  TODO: "Not Started", IN_PROGRESS: "In Progress", PRACTICE: "Practice",
  REVISION: "Revision", COMPLETED: "Completed", NEEDS_REVISIT: "Needs Revisit",
};

export default function RoadmapTaskPage({ params }: { params: { id: string } }) {
  const taskId = params.id;
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [confidence, setConfidence] = useState(3);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("TODO");
  const [checks, setChecks] = useState<boolean[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextRevision, setNextRevision] = useState<string | null>(null);

  const fetchTask = async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Task failed to load");
      const tasks = await res.json();
      const found = tasks.find((t: any) => t.id === taskId);
      if (!found) throw new Error("Task not found");
      setTask(found);
      setConfidence(found.confidence || 3);
      setNotes(found.notes || "");
      setStatus(found.status || "TODO");
      const subs: string[] = JSON.parse(found.subtopics || "[]");
      try {
        const stored = JSON.parse(localStorage.getItem(`sf:checks:${taskId}`) || "null");
        setChecks(Array.isArray(stored) && stored.length === subs.length ? stored : subs.map(() => false));
      } catch { setChecks(subs.map(() => false)); }
      const revRes = await fetch("/api/revision");
      if (revRes.ok) {
        const revs = await revRes.json();
        const match = revs.filter((r: any) => r.sourceId === taskId).sort((a: any, b: any) => b.nextRevisionDate.localeCompare(a.nextRevisionDate))[0];
        setNextRevision(match ? match.nextRevisionDate : null);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load task");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTask(); }, [taskId]);

  if (loading) return <PageSkeleton />;
  if (loadError || !task) return <PageShell><ErrorState message={loadError ?? "Task not found"} onRetry={fetchTask} /></PageShell>;

  const subtopicsList: string[] = JSON.parse(task.subtopics || "[]");
  const checksDone = checks.filter(Boolean).length;

  const toggleCheck = (i: number) => {
    const next = checks.map((c, idx) => (idx === i ? !c : c));
    setChecks(next);
    try { localStorage.setItem(`sf:checks:${taskId}`, JSON.stringify(next)); } catch { /* noop */ }
  };

  const save = async (newStatus?: string) => {
    setSaving(true);
    const targetStatus = newStatus || status;
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, status: targetStatus, confidence, notes }),
      });
      if (!res.ok) throw new Error("Save failed — your edits are still in the form, retry to persist.");
      setStatus(targetStatus);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const isDone = status === "COMPLETED" || status === "PRACTICE";

  return (
    <PageShell>
      <Link href="/roadmap" className="flex items-center gap-2 text-xs text-gray-400 transition hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back to Master Roadmap
      </Link>

      <div className="flex flex-col gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs text-gray-500">{task.category} • due {task.assignedDate} • est. {minutesToHM(task.estimatedTimeMinutes)}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-card-foreground md:text-3xl">{task.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge tone={isDone ? "green" : status === "IN_PROGRESS" ? "blue" : "gray"}>{STATUS_LABEL[status] ?? status}</StatusBadge>
            <StatusBadge tone="indigo">confidence {confidence}/5</StatusBadge>
            {nextRevision && <StatusBadge tone="amber">next revision {nextRevision}</StatusBadge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status} onChange={(e) => save(e.target.value)} aria-label="Task status"
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-card-foreground focus:outline-none"
          >
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <PrimaryButton onClick={() => save("COMPLETED")} disabled={saving}>
            <CheckCircle2 className="h-4 w-4" /> {savedTick ? "Saved ✓" : "Mark Complete"}
          </PrimaryButton>
        </div>
      </div>

      <SectionHeader title="Learn — concept checklist" action={<span className="font-mono text-[11px] text-gray-500">{checksDone}/{subtopicsList.length}</span>} />
      <ChartCard title="Concepts">
        <div className="space-y-2">
          {subtopicsList.map((sub, idx) => (
            <label key={idx} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-xs transition ${checks[idx] ? "border-emerald-500/30 bg-emerald-500/5 text-gray-400" : "border-border/40 bg-border/20 text-gray-200 hover:border-gray-500"}`}>
              <input type="checkbox" checked={!!checks[idx]} onChange={() => toggleCheck(idx)} className="h-4 w-4 cursor-pointer accent-emerald-500" />
              <span className={checks[idx] ? "line-through" : ""}>{sub}</span>
            </label>
          ))}
        </div>
      </ChartCard>

      <SectionHeader title="Practice" />
      <ChartCard title="Problem checklist">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <p className="flex items-center gap-1.5 font-semibold"><Code2 className="h-4 w-4" /> Do this from memory</p>
          <p className="mt-1">{task.practiceReq}</p>
        </div>
        <Link href="/practice" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-300 hover:underline">
          <BookOpen className="h-3.5 w-3.5" /> Log solved problems in Practice →
        </Link>
      </ChartCard>

      <SectionHeader title="Recall" />
      <ChartCard title="Active recall prompt">
        <p className="text-sm font-bold text-white">Explain &ldquo;{task.title}&rdquo; from memory.</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-gray-400">
          <li>Core concept and definition, no notes.</li>
          <li>Key properties, complexities, or formulas.</li>
          <li>One implementation or worked example.</li>
        </ul>
        <div className="mt-3">
          <Link href="/revision" className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20">
            <Brain className="h-4 w-4" /> Open Recall Mode
          </Link>
        </div>
      </ChartCard>

      <SectionHeader title="Confidence" />
      <ChartCard title="Self assessment">
        <ConfidenceRating value={confidence} onChange={setConfidence} />
        <p className="mt-2 text-[11px] text-gray-500">Completing with low confidence schedules revision tomorrow; high confidence pushes it out.</p>
      </ChartCard>

      <SectionHeader title="Revision" />
      <ChartCard title="Spaced revision">
        {nextRevision ? (
          <p className="flex items-center gap-1.5 text-xs text-gray-300"><Repeat className="h-4 w-4 text-emerald-400" /> Next revision: <span className="font-mono font-bold text-emerald-300">{nextRevision}</span></p>
        ) : (
          <p className="text-xs text-gray-500">No revision scheduled yet — completing this task auto-creates one.</p>
        )}
      </ChartCard>

      <SectionHeader title="Notes" />
      <ChartCard title="Implementation log">
        <textarea
          rows={6} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Key formulas, gotchas, solution sketches…"
          className="w-full rounded-xl border border-border bg-border/30 p-3 text-xs text-card-foreground placeholder-gray-500 focus:outline-none focus:border-accent"
        />
        <div className="mt-3 flex justify-end gap-2">
          <SecondaryButton href="/notes"><StickyNote className="h-4 w-4" /> Notes</SecondaryButton>
          <PrimaryButton onClick={() => save()} disabled={saving}><Save className="h-4 w-4" /> {saving ? "Saving…" : savedTick ? "Saved ✓" : "Save"}</PrimaryButton>
        </div>
      </ChartCard>
    </PageShell>
  );
}
