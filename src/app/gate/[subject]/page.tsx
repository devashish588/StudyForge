"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, Plus, AlertCircle, Repeat } from "lucide-react";
import { PageShell, PageHeader, StatCard, StatusBadge, ChartCard, ErrorState, PageSkeleton, SecondaryButton, SectionHeader } from "@/components/study/ui";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ConfidenceRating } from "@/components/ui/ConfidenceRating";

interface Topic { id: string; name: string; completed: boolean; confidence: number }
interface Question { id: string; topicName: string; year: number; questionNo: number; difficulty: string; correct: boolean; timeMinutes: number; createdAt: string; mistakeType?: string | null }
interface Subject {
  id: string; name: string; totalTopics: number; totalPYQs: number; solvedPYQs: number; accuracy: number;
  topics: Topic[]; questions: Question[];
}

export default function GateSubjectPage() {
  const params = useParams();
  const slug = decodeURIComponent((params?.subject as string) ?? "");
  const [subject, setSubject] = useState<Subject | null>(null);
  const [errors, setErrors] = useState<any[]>([]);
  const [revisionDue, setRevisionDue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      setLoadError(null);
      const [gateRes, revRes] = await Promise.all([fetch("/api/gate"), fetch("/api/revision")]);
      if (!gateRes.ok) throw new Error("GATE data failed to load");
      const gate = await gateRes.json();
      const found = (gate.subjects || []).find((s: Subject) => s.name.toLowerCase() === slug.toLowerCase());
      if (!found) throw new Error(`Subject "${slug}" not found`);
      setSubject(found);
      setErrors((gate.errorLogs || []).filter((e: any) => e.subject === found.name));
      const rev = revRes.ok ? await revRes.json() : [];
      setRevisionDue((rev || []).filter((r: any) => r.category === "GATE" && r.title.toLowerCase().includes(found.name.split(" ")[0].toLowerCase())));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load subject");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [slug]);

  const toggleTopic = async (t: Topic) => {
    try {
      await fetch("/api/gate", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId: t.id, topicCompleted: !t.completed }),
      });
      fetchAll();
    } catch (e) { console.error(e); }
  };

  const setTopicConfidence = async (t: Topic, v: number) => {
    try {
      await fetch("/api/gate", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId: t.id, topicConfidence: v }),
      });
      fetchAll();
    } catch (e) { console.error(e); }
  };

  if (loading) return <PageSkeleton />;
  if (loadError || !subject) return <PageShell><ErrorState message={loadError ?? "Subject not found"} onRetry={fetchAll} /></PageShell>;

  const conceptsDone = subject.topics.filter((t) => t.completed).length;
  const coverage = subject.totalPYQs > 0 ? Math.round((subject.solvedPYQs / subject.totalPYQs) * 100) : 0;
  const weak = subject.topics.filter((t) => !t.completed || t.confidence <= 2);
  const recentMistakes = errors.slice(0, 4);

  return (
    <PageShell wide>
      <Link href="/gate" className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition">
        <ArrowLeft className="w-4 h-4" /> Back to GATE Command Center
      </Link>
      <PageHeader
        icon={<BookOpen className="w-7 h-7 text-purple-400" />}
        title={subject.name}
        sub={`${conceptsDone}/${subject.topics.length} concepts • ${subject.solvedPYQs}/${subject.totalPYQs} PYQs • weak areas tracked below`}
        actions={
          <>
            <Link href="/gate/questions" className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-purple-500">
              <Plus className="w-4 h-4" /> Log PYQ
            </Link>
            <SecondaryButton href="/gate/errors">Error Log</SecondaryButton>
          </>
        }
      />

      <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-card to-purple-950/30 p-5">
        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
          <div className="text-3xl font-black text-white">{coverage}% <span className="text-sm font-bold text-gray-400">coverage</span></div>
          <p className="text-[11px] text-gray-400">Accuracy {subject.accuracy}% • from attempted PYQs + topic mastery</p>
        </div>
        <ProgressBar value={coverage} color="bg-gradient-to-r from-purple-500 to-indigo-400" heightClass="h-2.5 mt-3" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Concepts" value={`${conceptsDone}/${subject.topics.length}`} accent="text-white" />
        <StatCard label="PYQs" value={subject.solvedPYQs} hint={`of ${subject.totalPYQs} target`} accent="text-purple-300" />
        <StatCard label="Accuracy" value={`${subject.accuracy}%`} accent="text-emerald-400" />
        <StatCard label="Revision" value={revisionDue.length} hint="GATE items due" accent="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Topic mastery">
          <div className="space-y-2">
            {subject.topics.map((t) => (
              <div key={t.id} className="rounded-xl border border-border/50 bg-border/20 p-3">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox" checked={t.completed} onChange={() => toggleTopic(t)}
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-purple-500" aria-label={`Mark ${t.name} complete`}
                  />
                  <div className="flex-1">
                    <p className={`text-xs font-bold ${t.completed ? "text-gray-400 line-through" : "text-gray-100"}`}>{t.name}</p>
                    <div className="mt-1.5 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s} onClick={() => setTopicConfidence(t, s)} aria-label={`Confidence ${s} for ${t.name}`}
                          className={`h-6 w-6 rounded-md border text-[10px] font-bold transition ${t.confidence === s ? "border-purple-500 bg-purple-600 text-white" : "border-border bg-border/30 text-gray-500 hover:border-gray-500"}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  {t.confidence <= 2 && <StatusBadge tone="rose">weak</StatusBadge>}
                </div>
              </div>
            ))}
            {subject.topics.length === 0 && <p className="py-4 text-center text-xs text-gray-500">No topics yet.</p>}
          </div>
        </ChartCard>

        <div className="space-y-6">
          <ChartCard title="PYQ activity" action={<Link href="/gate/questions" className="text-[11px] font-bold text-purple-300 hover:underline">Log →</Link>}>
            {subject.questions.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-500">No PYQs logged for this subject yet.</p>
            ) : (
              <div className="space-y-1.5">
                {subject.questions.slice(0, 6).map((q) => (
                  <div key={q.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-border/20 p-2 text-xs">
                    <span className="font-semibold text-gray-200">{q.topicName} <span className="font-normal text-gray-500">• {q.year} Q{q.questionNo}</span></span>
                    <span className="flex items-center gap-2">
                      <StatusBadge tone={q.correct ? "green" : "rose"}>{q.correct ? "correct" : q.mistakeType ?? "wrong"}</StatusBadge>
                      <span className="font-mono text-[10px] text-gray-500">{q.timeMinutes}m</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>

          <ChartCard title="Weak areas">
            {weak.length === 0 ? (
              <p className="py-2 text-xs text-emerald-400">No weak areas — everything at confidence 3+.</p>
            ) : (
              <div className="space-y-1.5">
                {weak.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 text-xs">
                    <span className="font-semibold text-gray-200">{t.name}</span>
                    <StatusBadge tone="rose">confidence {t.confidence}/5</StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>

          <ChartCard title="Recent mistakes" action={<Link href="/gate/errors" className="text-[11px] font-bold text-rose-300 hover:underline">All →</Link>}>
            {recentMistakes.length === 0 ? (
              <p className="py-2 text-xs text-gray-500">No mistakes logged — clean record.</p>
            ) : (
              <div className="space-y-1.5">
                {recentMistakes.map((e: any) => (
                  <div key={e.id} className="rounded-lg border border-border/40 bg-border/20 p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-100">{e.topic}</span>
                      <StatusBadge tone="amber">{e.status}</StatusBadge>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-400">{e.rootCause}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500">
                      <AlertCircle className="h-3 w-3" /> {e.mistakeType} • retry {e.retryDate}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>

          {revisionDue.length > 0 && (
            <ChartCard title="Revision queue">
              <div className="space-y-1.5">
                {revisionDue.slice(0, 4).map((r: any) => (
                  <Link key={r.id} href="/revision" className="flex items-center justify-between rounded-lg border border-border/40 bg-border/20 p-2 text-xs hover:border-emerald-500/40">
                    <span className="font-semibold text-gray-200">{r.title}</span>
                    <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-400"><Repeat className="h-3 w-3" /> {r.nextRevisionDate}</span>
                  </Link>
                ))}
              </div>
            </ChartCard>
          )}
        </div>
      </div>

      <SectionHeader title="Self assessment" />
      <div className="rounded-xl border border-border bg-card p-5">
        <ConfidenceRating value={3} onChange={() => {}} />
        <p className="mt-1 text-[11px] text-gray-500">Rate per-topic above — confidence drives revision intervals.</p>
      </div>

    </PageShell>
  );
}
