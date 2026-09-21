"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, FolderGit2, Check, Minus, Circle } from "lucide-react";
import { PageShell, StatusBadge, ErrorState, PageSkeleton } from "@/components/study/ui";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";

interface ProjectDetail {
  id: string; name: string; description: string; goal: string;
  techStack: string; repoUrl?: string | null; deployUrl?: string | null;
  progress: number; milestoneStage: string;
  tasks: { id: string; title: string; milestoneStage: string; completed: boolean }[];
}

const milestonesOrder = ["Planning", "Architecture", "Implementation", "Testing", "Optimization", "Deployment", "Documentation", "Demo"];

const safeParse = (s: string): string[] => { try { return JSON.parse(s || "[]"); } catch { return []; } };

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchProject = async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Project failed to load");
      const data = await res.json();
      const found = data.find((p: any) => p.id === projectId);
      if (!found) throw new Error("Project not found");
      setProject(found);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProject(); }, [projectId]);

  const toggleTask = async (taskId: string, current: boolean) => {
    if (!project) return;
    const prev = project;
    setProject({ ...project, tasks: project.tasks.map((t) => (t.id === taskId ? { ...t, completed: !current } : t)) });
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, completed: !current }),
      });
      if (!res.ok) throw new Error("persist failed");
      fetchProject();
    } catch (e) {
      console.error(e);
      setProject(prev); // rollback
    }
  };

  if (loading) return <PageSkeleton />;
  if (loadError || !project) return <PageShell><ErrorState message={loadError ?? "Project not found"} onRetry={fetchProject} /></PageShell>;

  const techList = safeParse(project.techStack);
  const doneCount = project.tasks.filter((t) => t.completed).length;

  return (
    <PageShell>
      <Link href="/projects" className="flex items-center gap-2 text-xs text-gray-400 transition hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </Link>

      <div className="flex flex-col gap-4 border-b border-border pb-5">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-card-foreground md:text-3xl">
            <FolderGit2 className="h-6 w-6 shrink-0 text-indigo-400" /> {project.name}
          </h1>
          <p className="mt-1 text-xs text-gray-400 md:text-sm">{project.description}</p>
          <p className="mt-1 text-xs text-gray-300">Goal: <strong>{project.goal}</strong></p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {techList.map((t) => (
              <span key={t} className="rounded border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-300">{t}</span>
            ))}
          </div>
        </div>
        <div className="w-full rounded-xl border border-border bg-card p-3 md:max-w-xs">
          <div className="mb-1 flex justify-between text-xs font-bold">
            <span className="text-gray-300">{doneCount}/{project.tasks.length} tasks</span>
            <span className="text-indigo-300">{project.progress}%</span>
          </div>
          <ProgressBar value={project.progress} color="bg-indigo-500" heightClass="h-2" />
          <p className="mt-1.5 text-[11px] text-gray-500">Current stage: <span className="font-bold text-gray-300">{project.milestoneStage}</span></p>
        </div>
      </div>

      {/* Visual stepper */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card p-4">
        <div className="flex min-w-[640px] items-start">
          {milestonesOrder.map((stage, idx) => {
            const stageTasks = project.tasks.filter((t) => t.milestoneStage === stage);
            const stageDone = stageTasks.length > 0 && stageTasks.every((t) => t.completed);
            const stageActive = stageTasks.some((t) => !t.completed) && stageTasks.some((t) => t.completed) || (!stageDone && stageTasks.length > 0 && project.tasks.filter((t) => t.completed).length > 0 && idx === milestonesOrder.findIndex((s) => project.tasks.some((t) => t.milestoneStage === s && !t.completed)));
            return (
              <div key={stage} className="flex flex-1 items-start last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold",
                    stageDone ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                    : stageActive ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                    : "border-border bg-border/20 text-gray-500")}>
                    {stageDone ? <Check className="h-4 w-4" /> : stageActive ? <Minus className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
                  </span>
                  <span className="whitespace-nowrap text-[10px] font-bold text-gray-400">{stage}</span>
                </div>
                {idx < milestonesOrder.length - 1 && <div className={cn("mx-1 mt-4 h-0.5 flex-1", stageDone ? "bg-emerald-500/60" : "bg-border")} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        {milestonesOrder.map((stage, idx) => {
          const stageTasks = project.tasks.filter((t) => t.milestoneStage === stage);
          return (
            <div key={stage} className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-[11px] font-bold text-indigo-300">{idx + 1}</span>
                <h3 className="text-sm font-extrabold text-card-foreground">{stage}</h3>
                {stageTasks.length > 0 && stageTasks.every((t) => t.completed) && <StatusBadge tone="green">complete</StatusBadge>}
              </div>
              {stageTasks.length > 0 ? (
                <div className="space-y-2 md:pl-7">
                  {stageTasks.map((t) => (
                    <label key={t.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-xs transition",
                      t.completed ? "border-emerald-500/25 bg-emerald-500/5" : "border-border/40 bg-border/20 hover:border-gray-500")}>
                      <input type="checkbox" checked={t.completed} onChange={() => toggleTask(t.id, t.completed)}
                        className="h-4 w-4 cursor-pointer accent-indigo-500" />
                      <span className={cn("font-medium", t.completed ? "text-gray-400 line-through" : "text-card-foreground")}>{t.title}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs italic text-gray-500 md:pl-7">No tasks logged for this stage yet.</p>
              )}
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
