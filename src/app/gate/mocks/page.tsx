"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, CheckCircle2 } from "lucide-react";
import { PageShell, PageHeader, StatCard, ChartCard, ErrorState, PageSkeleton } from "@/components/study/ui";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
} from "recharts";

interface MockTest {
  id: string; testName: string; date: string; durationMinutes: number;
  attempted: number; correct: number; incorrect: number; marks: number; accuracy: number;
}

const tipStyle = { backgroundColor: "#111827", borderColor: "#374151", fontSize: 12 };

export default function GateMocksPage() {
  const [mocks, setMocks] = useState<MockTest[]>([]);
  const [testName, setTestName] = useState("");
  const [attempted, setAttempted] = useState("");
  const [correct, setCorrect] = useState("");
  const [incorrect, setIncorrect] = useState("");
  const [marks, setMarks] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchMocks = async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/gate");
      if (!res.ok) throw new Error("Mock data failed to load");
      const data = await res.json();
      setMocks(data.mockTests || []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMocks(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    try {
      const res = await fetch("/api/gate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "LOG_MOCK",
          payload: {
            testName: testName || "GATE Full Mock Test", durationMinutes: 180,
            attempted: Number(attempted), correct: Number(correct),
            incorrect: Number(incorrect), marks: Number(marks),
          },
        }),
      });
      if (!res.ok) throw new Error("Save failed — mock was not recorded. Retry.");
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
      fetchMocks();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    }
  };

  if (loading) return <PageSkeleton />;
  if (loadError) return <PageShell><ErrorState message={loadError} onRetry={fetchMocks} /></PageShell>;

  const avgAcc = mocks.length ? Number((mocks.reduce((a, m) => a + m.accuracy, 0) / mocks.length).toFixed(1)) : 0;
  const bestAcc = mocks.length ? Math.max(...mocks.map((m) => m.accuracy)) : 0;
  const trend = [...mocks].reverse().map((m) => ({ day: m.date.slice(5), acc: m.accuracy, marks: m.marks, att: m.attempted }));

  const inputCls = "w-full mt-1 rounded-xl border border-border bg-border/30 p-2.5 text-xs text-card-foreground focus:outline-none focus:border-accent";

  return (
    <PageShell>
      <Link href="/gate" className="flex items-center gap-2 text-xs text-gray-400 transition hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back to GATE Command Center
      </Link>
      <PageHeader
        icon={<Trophy className="w-6 h-6 text-indigo-400" />}
        title="Mock Tests"
        sub="Factual record only — no rank predictions. Trends show whether accuracy and marks move."
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Completed" value={mocks.length} accent="text-white" />
        <StatCard label="Average accuracy" value={`${avgAcc}%`} accent="text-indigo-300" />
        <StatCard label="Best accuracy" value={`${bestAcc}%`} accent="text-emerald-400" />
      </div>

      {mocks.length > 1 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard title="Accuracy over time">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="day" stroke="#9ca3af" fontSize={10} />
                  <YAxis stroke="#9ca3af" fontSize={11} domain={[0, 100]} />
                  <Tooltip contentStyle={tipStyle} />
                  <Line type="monotone" dataKey="acc" stroke="#8b5cf6" strokeWidth={2.5} dot name="Accuracy %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Marks & attempts">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="day" stroke="#9ca3af" fontSize={10} />
                  <YAxis stroke="#9ca3af" fontSize={11} />
                  <Tooltip contentStyle={tipStyle} />
                  <Bar dataKey="marks" fill="#6366f1" radius={[4, 4, 0, 0]} name="Marks" />
                  <Bar dataKey="att" fill="#1f2937" stroke="#4b5563" radius={[4, 4, 0, 0]} name="Attempted" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      )}

      <ChartCard title="Record mock result">
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="col-span-2 md:col-span-4">
            <label className="text-xs font-semibold text-gray-400">Test name / series</label>
            <input type="text" placeholder="e.g. Full Length Mock #1" value={testName} onChange={(e) => setTestName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400">Attempted</label>
            <input type="number" placeholder="e.g. 65" value={attempted} onChange={(e) => setAttempted(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400">Correct</label>
            <input type="number" placeholder="e.g. 48" value={correct} onChange={(e) => setCorrect(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400">Incorrect</label>
            <input type="number" placeholder="e.g. 17" value={incorrect} onChange={(e) => setIncorrect(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400">Marks</label>
            <input type="number" placeholder="e.g. 72" value={marks} onChange={(e) => setMarks(e.target.value)} className={inputCls} />
          </div>
          <div className="col-span-2 md:col-span-4">
            {saveError && <p className="mb-2 text-xs font-semibold text-rose-400">{saveError}</p>}
            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-md transition hover:bg-indigo-500">
              {savedSuccess ? <><CheckCircle2 className="h-4 w-4" /> Recorded ✓</> : "Log Mock Test Result"}
            </button>
          </div>
        </form>
      </ChartCard>

      <ChartCard title={`History — ${mocks.length}`}>
        {mocks.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-500">No mocks recorded yet. Your first result starts the trend.</p>
        ) : (
          <div className="space-y-2">
            {mocks.map((m) => (
              <div key={m.id} className="flex flex-col justify-between gap-3 rounded-xl border border-border/50 bg-border/20 p-4 md:flex-row md:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-card-foreground">{m.testName}</p>
                  <p className="mt-1 font-mono text-[11px] text-gray-500">{m.date} • {m.durationMinutes} min</p>
                </div>
                <div className="flex shrink-0 items-center gap-5 text-xs">
                  <div><span className="block text-[10px] text-gray-500">Attempted</span><span className="font-bold text-gray-200">{m.attempted}</span></div>
                  <div><span className="block text-[10px] text-gray-500">Accuracy</span><span className="font-bold text-emerald-400">{m.accuracy}%</span></div>
                  <div><span className="block text-[10px] text-gray-500">Marks</span><span className="font-bold text-indigo-300">{m.marks}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </PageShell>
  );
}
