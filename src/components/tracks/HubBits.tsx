"use client";

import React from "react";
import Link from "next/link";
import { TRACK_META, type TrackKey } from "@/lib/tracks";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PlainSection, StatusBadge, Skeleton, ErrorState } from "@/components/study/ui";
import { minutesToHM } from "@/lib/date";

export function TrackBadge({ track, link = true }: { track: TrackKey; link?: boolean }) {
  const meta = TRACK_META[track];
  const pill = (
    <span className={`inline-flex items-center rounded border border-border bg-border/40 px-1.5 py-0.5 font-mono text-[10px] font-bold ${meta.accent}`}>
      [{meta.short}]
    </span>
  );
  if (!link) return pill;
  return (
    <Link href={meta.href} aria-label={`${meta.label} hub`} className="shrink-0 hover:opacity-80">
      {pill}
    </Link>
  );
}

export function statusTone(status: string): "green" | "amber" | "rose" | "gray" | "blue" {
  if (status === "COMPLETED" || status === "PRACTICE") return "green";
  if (status === "IN_PROGRESS") return "amber";
  if (status === "NEEDS_REVISIT") return "rose";
  if (status === "REVISION") return "blue";
  return "gray";
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

// "Why this task?" — human-readable planner reasons, never raw scores.
// Returns short chips derived from real item signals; null when nothing
// meaningful exists (callers omit the section in that case).
export interface WhySignals {
  carryOverCount?: number | null;
  movedFrom?: string | null;
  priority?: string | null;
  kind?: string | null;
  why?: string | null;
  status?: string | null;
}

export function whyChips(s: WhySignals): string[] {
  const chips: string[] = [];
  const why = (s.why ?? "").toLowerCase();
  if ((s.carryOverCount ?? 0) > 0 || s.movedFrom) chips.push("Continued from yesterday");
  if (/missed|recovery/.test(why)) chips.push("Recovery from missed study day");
  if (/weak|low confidence|confidence [12]\b|error/.test(why)) chips.push("Weak area from recent practice");
  if (/revision|recall|spaced/.test(why) || s.kind === "REVISION") chips.push("Due for revision");
  if (/pyq/.test(why)) chips.push("GATE PYQ practice");
  if (/deadline|jan 15|exam/.test(why)) chips.push("Deadline priority");
  if (/mock/.test(why)) chips.push("Mock preparation");
  if (s.priority === "CORE" && chips.length === 0) chips.push("High-priority core topic");
  if (s.status === "NEEDS_REVISIT" && !chips.includes("Weak area from recent practice")) chips.push("Needs revisit");
  return chips.slice(0, 3);
}

export function WhyThisTask({ signals, className, includeGeneric = true }: { signals: WhySignals; className?: string; includeGeneric?: boolean }) {
  const chips = whyChips(signals).filter((c) => includeGeneric || c !== "High-priority core topic");
  if (chips.length === 0) return null;
  return (
    <p className={className ?? "mt-1.5 flex flex-wrap gap-1.5"} aria-label={`Selected because: ${chips.join("; ")}`}>
      <span className="sr-only">Selected because: </span>
      {chips.map((c) => (
        <span key={c} className="inline-flex items-center rounded-full border border-border bg-border/30 px-2 py-0.5 text-[11px] font-semibold text-gray-300">
          {c}
        </span>
      ))}
    </p>
  );
}

export interface HubTaskView {
  id: string;
  title: string;
  status: string;
  priority: string;
  difficulty: string | null;
  estMin: number;
  actMin: number;
  assignedDate?: string;
  weekNumber?: number | null;
}

export function TaskRow({ task }: { task: HubTaskView }) {
  return (
    <Link
      href={`/roadmap/task/${task.id}`}
      aria-label={`${task.title} — ${statusLabel(task.status)}`}
      className="group flex min-h-[44px] items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors duration-200 motion-reduce:transition-none hover:border-border hover:bg-border/20"
    >
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${task.status === "COMPLETED" || task.status === "PRACTICE" ? "bg-emerald-400" : task.status === "IN_PROGRESS" ? "bg-amber-400" : task.status === "NEEDS_REVISIT" ? "bg-rose-400" : "bg-gray-600"}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-gray-200 group-hover:text-white group-hover:underline">
          {task.title}
        </span>
        <span className="type-metadata mt-0.5 block">
          {minutesToHM(task.estMin)}{task.actMin > 0 ? ` · ${minutesToHM(task.actMin)} logged` : ""}{task.priority !== "CORE" ? ` · ${task.priority.toLowerCase()}` : ""}
        </span>
        {task.status === "NEEDS_REVISIT" && <WhyThisTask signals={{ status: task.status }} />}
      </span>
      <StatusBadge tone={statusTone(task.status)}>{statusLabel(task.status)}</StatusBadge>
    </Link>
  );
}

export interface HubGroupView {
  key: string;
  label: string;
  tasks: HubTaskView[];
  done: number;
  total: number;
  percent: number;
  stage: string;
  needsRepair: boolean;
}

export function GroupCard({ group, defaultOpen = false }: { group: HubGroupView; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen || group.done < group.total);
  return (
    <div className="rounded-xl border border-border bg-card">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={`${group.label} — ${group.done} of ${group.total} done`} className="flex min-h-[56px] w-full items-center gap-3 p-4 text-left">
        <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${group.percent === 100 ? "bg-emerald-400" : group.done > 0 ? "bg-amber-400" : "bg-gray-600"}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-white">{group.label}</span>
          <span className="type-metadata mt-0.5 block">
            {group.done}/{group.total} done · {group.stage}
            {group.needsRepair ? <span className="font-bold text-rose-400"> · failure repair</span> : ""}
          </span>
        </span>
        <span className="w-16 shrink-0 font-mono text-xs text-gray-400" aria-hidden>{group.percent}%</span>
        <span aria-hidden className="shrink-0 text-gray-500">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="border-t border-border/60 px-2 py-2">
          {group.tasks.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-500">No tasks in this group yet.</p>
          ) : (
            group.tasks.map((t) => <TaskRow key={t.id} task={t} />)
          )}
        </div>
      )}
    </div>
  );
}

export function PaceStrip({ pace, currentLabel = "Current pace" }: {
  pace: { remainingMinutes: number; daysLeft: number; requiredPerDay: number; currentPerDay: number; deadline: string; status: string };
  currentLabel?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="surface-muted min-w-0 px-3 py-2.5">
        <p className="type-label">Required pace</p>
        <p className="mt-1 truncate text-sm font-bold text-white">{minutesToHM(pace.requiredPerDay)}/day</p>
      </div>
      <div className="surface-muted min-w-0 px-3 py-2.5">
        <p className="type-label">{currentLabel}</p>
        <p className="mt-1 truncate text-sm font-bold text-white">{pace.currentPerDay > 0 ? `${minutesToHM(pace.currentPerDay)}/day` : "—"}</p>
      </div>
      <div className="surface-muted min-w-0 px-3 py-2.5">
        <p className="type-label">Remaining</p>
        <p className="mt-1 truncate text-sm font-bold text-white">{minutesToHM(pace.remainingMinutes)}</p>
      </div>
      <div className="surface-muted min-w-0 px-3 py-2.5">
        <p className="type-label">Status</p>
        <p className={`mt-1 text-sm font-bold ${pace.status === "on-track" ? "text-emerald-400" : pace.status === "not-started" ? "text-gray-400" : "text-amber-400"}`}>
          {pace.status === "on-track" ? "On track" : pace.status === "not-started" ? "Not started" : "Behind"}
        </p>
      </div>
    </div>
  );
}

export function HubLoading() {  return (
    <div className="mx-auto max-w-3xl space-y-4 pt-10">
      <div className="h-44 animate-pulse rounded-2xl border border-border bg-card" />
      <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
    </div>
  );
}

export function HubError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-3xl pt-10">
      <ErrorState message={message} onRetry={onRetry} />
    </div>
  );
}

export interface CrossLink {
  label: string;
  a: { label: string; href: string; status: string };
  b: { label: string; href: string; status: string };
}

function linkDot(status: string) {
  return status === "done" ? "bg-emerald-400" : status === "in-progress" ? "bg-amber-400" : status === "missing" ? "bg-gray-700" : "bg-gray-600";
}

// Cross-track relationships from live canonical rows — links only, never copies.
export function CrossTrackLinks({ filter }: { filter?: (label: string) => boolean }) {
  const [links, setLinks] = React.useState<CrossLink[] | null>(null);
  React.useEffect(() => {
    fetch("/api/tracks?track=links")
      .then((r) => r.json())
      .then((d) => setLinks(d.links ?? []))
      .catch(() => setLinks([]));
  }, []);
  const shown = (links ?? []).filter((l) => (filter ? filter(l.label) : true));
  if (!links) return <Skeleton className="h-20" />;
  if (shown.length === 0) return null;
  return (
    <div className="space-y-2.5">
      {shown.map((l) => (
        <div key={l.label} className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400">{l.label}</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {([l.a, l.b] as const).map((side, i) => (
              <Link key={i} href={side.href} className="flex items-center gap-2 rounded-lg bg-border/20 px-3 py-2 hover:bg-border/40">
                <span className={`h-2 w-2 shrink-0 rounded-full ${linkDot(side.status)}`} />
                <span className="min-w-0 truncate text-xs font-semibold text-gray-200">{side.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export { PlainSection, ProgressBar, Skeleton };
