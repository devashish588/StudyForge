"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { FolderGit2, CheckCircle2, Circle, Github, Globe } from "lucide-react";
import { PageShell, PageHeader, StatusBadge, ErrorState, PageSkeleton, PlainSection } from "@/components/study/ui";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface Project {
  id: string; name: string; description: string; goal: string;
  techStack: string; repoUrl?: string | null; deployUrl?: string | null;
  progress: number; milestoneStage: string;
  tasks: { id: string; title: string; milestoneStage: string; completed: boolean }[];
}

const safeParse = (s: string): string[] => { try { return JSON.parse(s || "[]"); } catch { return []; } };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Projects failed to load");
      setProjects(await res.json() || []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  if (loading) return <PageSkeleton />;
  if (loadError) return <PageShell wide><ErrorState message={loadError} onRetry={fetchProjects} /></PageShell>;

  // Recent activity from actual task state: completed + next-up per project
  const activity = projects.flatMap((p) => {
    const doneList = p.tasks.filter((t) => t.completed);
    const next = p.tasks.find((t) => !t.completed);
    return [
      ...doneList.slice(-2).map((t) => ({ project: p.name, pid: p.id, title: t.title, done: true })),
      ...(next ? [{ project: p.name, pid: p.id, title: next.title, done: false }] : []),
    ];
  }).slice(0, 8);

  return (
    <PageShell wide>
      <PageHeader
        icon={<FolderGit2 className="w-7 h-7 text-indigo-400" />}
        title="Projects"
        sub="What are you actually building? Portfolio pieces mapped to the Sep 24 → Dec 31 milestones."
      />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {projects.map((proj) => {
          const techList = safeParse(proj.techStack);
          const doneCount = proj.tasks.filter((t) => t.completed).length;
          const next = proj.tasks.find((t) => !t.completed);
          const lastDone = [...proj.tasks].reverse().find((t) => t.completed);
          return (
            <div key={proj.id} className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 transition hover:border-indigo-500/50 md:p-8">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl font-bold tracking-tight text-card-foreground md:text-2xl">{proj.name}</h2>
                  <StatusBadge tone="indigo">{proj.milestoneStage}</StatusBadge>
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-gray-400">{proj.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {techList.slice(0, 6).map((tech) => (
                    <span key={tech} className="rounded border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-300">{tech}</span>
                  ))}
                </div>
                <div className="mt-6 flex items-end gap-3">
                  <span className="metric-xl text-white">{proj.progress}<span className="text-lg text-gray-500">%</span></span>
                  <span className="mb-1.5 text-sm text-gray-500">{doneCount}/{proj.tasks.length} milestones</span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={proj.progress} color="bg-indigo-500" heightClass="h-2.5" />
                </div>
                <div className="mt-4 space-y-1.5 text-sm">
                  {lastDone && <p className="text-gray-400">Current phase: <span className="font-semibold text-gray-200">{lastDone.title}</span></p>}
                  {next && <p className="text-gray-300">Next iteration: <span className="font-semibold text-white">{next.title}</span> <span className="text-xs text-indigo-300">• {next.milestoneStage}</span></p>}
                </div>
                {(proj.repoUrl || proj.deployUrl) && (
                  <div className="mt-3 flex gap-4 text-[13px] font-bold">
                    {proj.repoUrl && <a href={proj.repoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-gray-300 hover:text-white"><Github className="h-4 w-4" /> GitHub</a>}
                    {proj.deployUrl && <a href={proj.deployUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-gray-300 hover:text-white"><Globe className="h-4 w-4" /> Live Demo</a>}
                  </div>
                )}
              </div>
              <Link href={`/projects/${proj.id}`} className="mt-6 rounded-2xl bg-indigo-600 px-6 py-3.5 text-center text-base font-bold text-white transition hover:bg-indigo-500">
                Open project
              </Link>
            </div>
          );
        })}
      </div>

      <PlainSection title="Recent activity">
        {activity.length === 0 ? (
          <p className="text-[15px] text-gray-500">No activity yet — check off milestone tasks to build momentum.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {activity.map((a, i) => (
              <li key={`${a.pid}-${i}`}>
                <Link href={`/projects/${a.pid}`} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className={a.done ? "text-emerald-400" : "text-indigo-300"}>{a.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</span>
                    <span className="truncate text-[15px] font-semibold text-gray-200">{a.title}</span>
                  </span>
                  <span className="shrink-0 text-[13px] text-gray-500">{a.project}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PlainSection>
    </PageShell>
  );
}
