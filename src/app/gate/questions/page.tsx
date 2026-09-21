"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, BookOpen, Zap } from "lucide-react";
import { PageShell, PageHeader, StatusBadge, ChartCard, ErrorState } from "@/components/study/ui";
import { cn } from "@/lib/cn";

interface GateSubject { id: string; name: string; topics: { name: string }[] }
interface RecentQ { id: string; topicName: string; year: number; questionNo: number; difficulty: string; correct: boolean; timeMinutes: number; createdAt: string; subjectId: string }

const mistakeTypes = ["Conceptual", "Calculation", "Misread Question", "Memory", "Carelessness", "Time Management", "Guess"];

const inputCls = "w-full mt-1 rounded-xl border border-border bg-border/30 p-2.5 text-xs text-card-foreground focus:outline-none focus:border-purple-500";
const labelCls = "text-xs font-semibold text-gray-400";

export default function GateQuestionsPage() {
  const [subjects, setSubjects] = useState<GateSubject[]>([]);
  const [recent, setRecent] = useState<RecentQ[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [topicName, setTopicName] = useState("");
  const [year, setYear] = useState("2024");
  const [questionNo, setQuestionNo] = useState("1");
  const [difficulty, setDifficulty] = useState("Medium");
  const [correct, setCorrect] = useState(true);
  const [timeMinutes, setTimeMinutes] = useState("5");
  const [confidence, setConfidence] = useState("4");
  const [mistakeType, setMistakeType] = useState("Conceptual");
  const [explanation, setExplanation] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/gate");
      if (!res.ok) throw new Error("GATE data failed to load");
      const data = await res.json();
      setSubjects(data.subjects || []);
      if (data.subjects?.length && !subjectId) setSubjectId(data.subjects[0].id);
      const all: RecentQ[] = [];
      for (const s of data.subjects || []) for (const q of s.questions || []) all.push({ ...q, subjectId: s.id });
      all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRecent(all.slice(0, 8));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (e.key === "c" || e.key === "C") setCorrect(true);
      if (e.key === "w" || e.key === "W") setCorrect(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId) return;
    setSaveError(null);
    try {
      const res = await fetch("/api/gate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "LOG_PYQ",
          payload: {
            subjectId, topicName, year: Number(year), questionNo: Number(questionNo),
            difficulty, correct, timeMinutes: Number(timeMinutes), confidence: Number(confidence),
            mistakeType: correct ? null : mistakeType, explanation,
          },
        }),
      });
      if (!res.ok) throw new Error("Save failed — nothing was recorded. Retry.");
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
      setExplanation("");
      setQuestionNo(String(Number(questionNo) + 1));
      fetchAll();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    }
  };

  if (loading) {
    return <PageShell><div className="h-64 animate-pulse rounded-xl border border-border bg-card" /></PageShell>;
  }
  if (loadError) return <PageShell><ErrorState message={loadError} onRetry={fetchAll} /></PageShell>;

  const topics = subjects.find((s) => s.id === subjectId)?.topics ?? [];

  return (
    <PageShell>
      <Link href="/gate" className="flex items-center gap-2 text-xs text-gray-400 transition hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back to GATE Command Center
      </Link>
      <PageHeader
        icon={<BookOpen className="w-6 h-6 text-purple-400" />}
        title="Log PYQ Attempt"
        sub="Fast flow: subject → topic → question → correct? → time → mistake → save. Question number auto-increments."
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: subject + topic */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>1 · Subject</label>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputCls}>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>2 · Topic</label>
              <input list="gate-topics" value={topicName} onChange={(e) => setTopicName(e.target.value)} placeholder="e.g. Normalization" className={inputCls} />
              <datalist id="gate-topics">{topics.map((t) => <option key={t.name} value={t.name} />)}</datalist>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>3 · Year</label>
                <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Q. No</label>
                <input type="number" value={questionNo} onChange={(e) => setQuestionNo(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>5 · Time (m)</label>
                <input type="number" value={timeMinutes} onChange={(e) => setTimeMinutes(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Difficulty</label>
              <div className="mt-1 flex gap-2">
                {["Easy", "Medium", "Hard"].map((d) => (
                  <button key={d} type="button" onClick={() => setDifficulty(d)}
                    className={cn("flex-1 rounded-lg border py-2 text-xs font-bold transition", difficulty === d ? "border-purple-500 bg-purple-600 text-white" : "border-border bg-border/20 text-gray-400")}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 4: outcome */}
          <div>
            <label className={cn(labelCls, "mb-2 block")}>4 · Correct?</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setCorrect(true)}
                className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition", correct ? "border-emerald-500 bg-emerald-500/20 text-emerald-400" : "border-border bg-border/20 text-gray-400")}>
                <CheckCircle2 className="h-4 w-4" /> Correct <kbd className="rounded bg-black/30 px-1 text-[10px]">C</kbd>
              </button>
              <button type="button" onClick={() => setCorrect(false)}
                className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition", !correct ? "border-rose-500 bg-rose-500/20 text-rose-400" : "border-border bg-border/20 text-gray-400")}>
                <XCircle className="h-4 w-4" /> Wrong <kbd className="rounded bg-black/30 px-1 text-[10px]">W</kbd>
              </button>
            </div>
          </div>

          {!correct && (
            <div className="grid grid-cols-1 gap-4 animate-fadeIn md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold text-rose-400">6 · Mistake category</label>
                <div className="flex flex-wrap gap-1.5">
                  {mistakeTypes.map((m) => (
                    <button key={m} type="button" onClick={() => setMistakeType(m)}
                      className={cn("rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition", mistakeType === m ? "border-rose-500 bg-rose-600 text-white" : "border-border bg-border/20 text-gray-400")}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Confidence 1–5</label>
                <div className="mt-1 flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((c) => (
                    <button key={c} type="button" onClick={() => setConfidence(String(c))}
                      className={cn("h-9 flex-1 rounded-lg border text-xs font-bold transition", confidence === String(c) ? "border-purple-500 bg-purple-600 text-white" : "border-border bg-border/20 text-gray-400")}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>Notes / root cause</label>
            <textarea rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="What was the trap? What concept fixes it?" className={cn(inputCls, "mt-1")} />
          </div>

          {saveError && <p className="text-xs font-semibold text-rose-400">{saveError}</p>}

          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-xs font-bold text-white shadow-md transition hover:bg-purple-500">
            {savedSuccess ? <><CheckCircle2 className="h-4 w-4" /> Logged ✓ — error queue updated</> : <><Zap className="h-4 w-4" /> Save PYQ Attempt</>}
          </button>
        </form>
      </div>

      <ChartCard title="Recent attempts">
        {recent.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-500">No PYQs logged yet — your first entry appears here.</p>
        ) : (
          <div className="space-y-1.5">
            {recent.map((q) => (
              <div key={q.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-border/20 p-2 text-xs">
                <span className="font-semibold text-gray-200">{subjectName(q.subjectId)} <span className="font-normal text-gray-500">• {q.topicName} • {q.year} Q{q.questionNo}</span></span>
                <StatusBadge tone={q.correct ? "green" : "rose"}>{q.correct ? "correct" : "wrong"}</StatusBadge>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </PageShell>
  );
}
