"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, X, CheckCircle2, Clock } from "lucide-react";
import { todayStr } from "@/lib/date";
import { mergeAllocations } from "@/lib/sessions";

interface TimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTitle?: string;
  defaultCategory?: string;
  sessionId?: string | null;
  onSaved?: () => void;
}

const LS_KEY = "studyforge:active-timer";

interface Segment { startMs: number; endMs: number | null }

interface Persisted {
  totalSeconds: number;
  deadline: number; // epoch ms when running
  remaining: number; // seconds when paused
  isRunning: boolean;
  category: string;
  sessionName: string;
  sessionId?: string | null;
  date: string;
  segments: Segment[];
  savedAt: number;
}

function loadPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Persisted;
  } catch { return null; }
}

export default function TimerModal({ isOpen, onClose, defaultTitle, defaultCategory, sessionId, onSaved }: TimerModalProps) {
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [category, setCategory] = useState(defaultCategory || "Roadmap");
  const [sessionName, setSessionName] = useState(defaultTitle || "DSA Practice Session");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [splitNote, setSplitNote] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessionId ?? null);
  const [mode, setMode] = useState<"25" | "50" | "75" | "90" | "custom">("25");
  const deadlineRef = useRef<number>(0);
  const segmentsRef = useRef<Segment[]>([]);

  // Recover persisted timer on open (close/reopen safe; closed-gap counts as running time)
  useEffect(() => {
    if (!isOpen) return;
    if (defaultTitle) setSessionName(defaultTitle);
    if (defaultCategory) setCategory(defaultCategory);
    if (sessionId !== undefined) setActiveSessionId(sessionId);
    setSaveError(null);
    setSplitNote(null);
    const p = loadPersisted();
    if (p && p.date === todayStr()) {
      setTotalSeconds(p.totalSeconds);
      setCategory(p.category);
      setSessionName(p.sessionName);
      setActiveSessionId(p.sessionId ?? null);
      const segs = Array.isArray(p.segments) ? p.segments : [];
      if (p.isRunning) {
        // Count the while-closed interval as running time (deadline semantics),
        // then keep running from the persisted deadline.
        const reopened: Segment[] = [...segs.filter((s) => s.endMs !== null) as Segment[], { startMs: p.savedAt || Date.now(), endMs: null }];
        segmentsRef.current = reopened;
        const left = Math.max(0, Math.round((p.deadline - Date.now()) / 1000));
        setSecondsLeft(left);
        deadlineRef.current = p.deadline;
        setIsRunning(left > 0);
        if (left <= 0) closeOpenSegment();
      } else {
        segmentsRef.current = segs as Segment[];
        setSecondsLeft(p.remaining);
        setIsRunning(false);
      }
    } else {
      segmentsRef.current = [];
    }
  }, [isOpen, defaultTitle, defaultCategory, sessionId]);

  // Tick accurately via deadline (handles background tabs)
  useEffect(() => {
    if (!isRunning) return;
    const iv = setInterval(() => {
      const left = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        setIsRunning(false);
        closeOpenSegment();
      }
    }, 500);
    return () => clearInterval(iv);
  }, [isRunning]);

  // Persist on every change while open
  useEffect(() => {
    if (!isOpen) return;
    const p: Persisted = {
      totalSeconds, deadline: deadlineRef.current, remaining: secondsLeft,
      isRunning, category, sessionName, sessionId: activeSessionId, date: todayStr(),
      segments: segmentsRef.current, savedAt: Date.now(),
    };
    try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* noop */ }
  }, [isOpen, totalSeconds, secondsLeft, isRunning, category, sessionName, activeSessionId]);

  if (!isOpen) return null;

  function closeOpenSegment(now = Date.now()) {
    const segs = segmentsRef.current;
    const open = segs.find((s) => s.endMs === null);
    if (open) open.endMs = now;
  }

  const handleModeChange = (m: "25" | "50" | "75" | "90" | "custom") => {
    setMode(m);
    setIsRunning(false);
    closeOpenSegment();
    const mins = m === "25" ? 25 : m === "50" ? 50 : m === "75" ? 75 : m === "90" ? 90 : 60;
    setTotalSeconds(mins * 60);
    setSecondsLeft(mins * 60);
    segmentsRef.current = [];
  };

  const toggle = () => {
    if (isRunning) {
      const now = Date.now();
      const left = Math.max(0, Math.round((deadlineRef.current - now) / 1000));
      setSecondsLeft(left);
      setIsRunning(false);
      closeOpenSegment(now); // paused periods are excluded from logged time
    } else {
      if (secondsLeft <= 0) return;
      const now = Date.now();
      deadlineRef.current = now + secondsLeft * 1000;
      segmentsRef.current = [...segmentsRef.current.filter((s) => s.endMs !== null), { startMs: now, endMs: null }];
      setIsRunning(true);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    closeOpenSegment();
    segmentsRef.current = [];
    setSecondsLeft(totalSeconds);
    setSplitNote(null);
  };

  const finishedSegments = segmentsRef.current.filter((s) => s.endMs !== null && (s.endMs as number) > s.startMs);
  const preview = mergeAllocations(finishedSegments.map((s) => ({ startMs: s.startMs, endMs: s.endMs as number })));
  const previewTotal = preview.reduce((a, x) => a + x.minutes, 0);

  const handleSaveSession = async () => {
    closeOpenSegment();
    const segs = segmentsRef.current
      .filter((s) => s.endMs !== null && (s.endMs as number) > s.startMs)
      .map((s) => ({ startMs: s.startMs, endMs: s.endMs as number }));
    if (segs.length === 0) {
      setSaveError("No running time recorded yet — press Start first.");
      return;
    }
    setSaveError(null);
    try {
      const res = await fetch("/api/sessions/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          title: sessionName,
          category,
          plannedMinutes: Math.round(totalSeconds / 60),
          segments: segs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed — timer state preserved. Retry.");
      if (data.allocations?.length > 1) {
        setSplitNote(`Split across midnight: ${data.allocations.map((a: { date: string; minutes: number }) => `${a.date} +${a.minutes}m`).join(" · ")}`);
      }
      try { localStorage.removeItem(LS_KEY); } catch { /* noop */ }
      segmentsRef.current = [];
      setSavedSuccess(true);
      onSaved?.();
      setTimeout(() => {
        setSavedSuccess(false);
        setSplitNote(null);
        onClose();
      }, 1400);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed — timer state preserved. Retry.");
    }
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = totalSeconds > 0 ? Math.round(((totalSeconds - secondsLeft) / totalSeconds) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 sm:p-6 relative shadow-2xl max-h-[92vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white" aria-label="Close timer">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold text-card-foreground">Focus Session</h2>
        </div>

        {isRunning ? (
          /* Focus mode: minimal distractions, obvious Finish */
          <div className="animate-fadeIn">
            <p className="text-center text-sm font-bold text-white">{sessionName}</p>
            <p className="text-center text-[11px] text-gray-400 mt-0.5">{category}</p>
            <div className="text-center py-8 border border-border/50 rounded-xl bg-background/50 my-4 relative overflow-hidden">
              <div className="text-6xl font-mono font-extrabold tracking-tight text-white mb-2">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </div>
              <div className="w-full bg-border/40 h-1.5 absolute bottom-0 left-0">
                <div className="bg-accent h-1.5 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={toggle} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition shadow-md bg-amber-500 hover:bg-amber-600 text-white">
                <Pause className="w-5 h-5" /> Pause
              </button>
              <button onClick={handleSaveSession} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition shadow-md">
                {savedSuccess ? <><CheckCircle2 className="w-5 h-5" /> Saved!</> : "Finish"}
              </button>
            </div>
            {saveError && <p className="mt-2 text-center text-xs font-semibold text-rose-400">{saveError} <button onClick={handleSaveSession} className="underline">Retry</button></p>}
            {splitNote && <p className="mt-2 text-center text-[11px] text-indigo-300">{splitNote}</p>}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-5 gap-2 mb-5">
              {(["25", "50", "75", "90", "custom"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModeChange(m)}
                  className={`py-2 text-xs font-semibold rounded-lg border transition min-h-[40px] ${
                    mode === m
                      ? "bg-accent text-white border-accent"
                      : "bg-border/30 text-gray-400 border-border hover:bg-border/60"
                  }`}
                >
                  {m === "custom" ? "60m" : `${m}m`}
                </button>
              ))}
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs font-medium text-gray-400" htmlFor="tm-cat">Category</label>
                <select id="tm-cat" value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full mt-1 bg-border/40 border border-border rounded-lg px-3 py-2.5 text-xs text-card-foreground focus:outline-none focus:border-accent min-h-[40px]">
                  <option value="Roadmap">Roadmap Practice</option>
                  <option value="GATE">GATE 2027 Prep</option>
                  <option value="Revision">Active Recall / Revision</option>
                  <option value="Practice">Problem Practice</option>
                  <option value="Project">Project Development</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400" htmlFor="tm-name">Focus Task</label>
                <input id="tm-name" type="text" value={sessionName} onChange={(e) => setSessionName(e.target.value)}
                  className="w-full mt-1 bg-border/40 border border-border rounded-lg px-3 py-2.5 text-xs text-card-foreground focus:outline-none focus:border-accent min-h-[40px]" />
              </div>
            </div>

            <div className="text-center py-6 border border-border/50 rounded-xl bg-background/50 mb-5 relative overflow-hidden">
              <div className="text-5xl font-mono font-extrabold tracking-tight text-white mb-2">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </div>
              <p className="text-xs text-gray-400">
                Logged so far: {previewTotal} min
                {preview.length > 1 && <span className="text-indigo-300"> • spans midnight — will split</span>}
              </p>
              <div className="w-full bg-border/40 h-1.5 absolute bottom-0 left-0">
                <div className="bg-accent h-1.5 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {saveError && <p className="mb-2 text-center text-xs font-semibold text-rose-400">{saveError} <button onClick={handleSaveSession} className="underline">Retry</button></p>}
            {splitNote && <p className="mb-2 text-center text-[11px] text-indigo-300">{splitNote}</p>}

            <div className="flex items-center gap-3">
              <button onClick={toggle} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs transition shadow-md bg-accent hover:bg-accent-hover text-white min-h-[44px]">
                <Play className="w-4 h-4" /> Start Focus
              </button>
              <button onClick={handleReset} className="p-3 rounded-xl border border-border text-gray-400 hover:text-white hover:bg-border transition min-h-[44px] min-w-[44px]" title="Reset" aria-label="Reset timer">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={handleSaveSession} disabled={finishedSegments.length === 0}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-md min-h-[44px]">
                {savedSuccess ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : "Finish & Log"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
