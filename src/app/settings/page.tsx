"use client";

import React, { useState, useEffect, useRef } from "react";
import { Settings, Download, Upload, Save, CheckCircle2, FlaskConical, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { isTestMode, startTestMode, stopTestMode, testDayNumber, TEST_DAYS } from "@/lib/testmode";

export default function SettingsPage() {
  const [targetHours, setTargetHours] = useState(8);
  const [stretchHours, setStretchHours] = useState(10);
  const [schedulingMode, setSchedulingMode] = useState("Flexible");
  const [gatePct, setGatePct] = useState(37.5);
  const [roadmapPct, setRoadmapPct] = useState(37.5);
  const [revisionPct, setRevisionPct] = useState(12.5);
  const [notify, setNotify] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [syllabusDeadline, setSyllabusDeadline] = useState("2027-01-15");
  const [curriculumDeadline, setCurriculumDeadline] = useState("2026-12-31");
  const [paperDate, setPaperDate] = useState("");
  const [testMode, setTestMode] = useState(false);
  const [testDay, setTestDay] = useState<number | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [resetText, setResetText] = useState("");
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTestMode(isTestMode());
    setTestDay(testDayNumber());
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setTargetHours(data.user.dailyTargetHours || 8);
        const s = data.user?.settings;
        if (s) {
          if (s.dailyTargetMinutes) setTargetHours(s.dailyTargetMinutes / 60);
          if (s.stretchTargetMinutes) setStretchHours(s.stretchTargetMinutes / 60);
          if (s.schedulingMode) setSchedulingMode(s.schedulingMode);
          if (s.gateAllocation) setGatePct(s.gateAllocation * 100);
          if (s.roadmapAllocation) setRoadmapPct(s.roadmapAllocation * 100);
          if (s.revisionAllocation) setRevisionPct(s.revisionAllocation * 100);
          if (s.gateSyllabusDeadline) setSyllabusDeadline(s.gateSyllabusDeadline);
          if (s.curriculumDeadline) setCurriculumDeadline(s.curriculumDeadline);
          if (s.gatePaperDate) setPaperDate(s.gatePaperDate);
        }
      });
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyTargetHours: targetHours,
          dailyTargetMinutes: Math.round(targetHours * 60),
          stretchTargetMinutes: Math.round(stretchHours * 60),
          schedulingMode,
          gateAllocation: gatePct / 100,
          roadmapAllocation: roadmapPct / 100,
          revisionAllocation: revisionPct / 100,
          practiceAllocation: Math.max(0, 1 - gatePct / 100 - roadmapPct / 100 - revisionPct / 100),
          notifyReminders: notify,
          gateSyllabusDeadline: syllabusDeadline || "2027-01-15",
          curriculumDeadline: curriculumDeadline || "2026-12-31",
          gatePaperDate: paperDate || null,
        })
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportJSON = async () => {
    try {
      const res = await fetch("/api/settings");
      const json = await res.json();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(json, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `studyforge_backup_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="border-b border-border pb-4">
        <h1 className="type-h1 flex items-center gap-2">
          <Settings className="h-7 w-7 text-accent" aria-hidden /> Settings
        </h1>
        <p className="type-metadata mt-1">
          Study targets, planning defaults, appearance, and data. Historical study data never changes when targets change.
        </p>
      </div>

      {/* MY JOURNEY — personal, understated */}
      <Card className="border-indigo-500/20 bg-gradient-to-br from-card to-indigo-950/20">
        <CardHeader>
          <CardTitle className="text-indigo-300">My Journey</CardTitle>
        </CardHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-gray-400">Name</span>
            <span className="font-bold text-white">Devashish</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-gray-400">Daily target</span>
            <span className="font-bold text-white">{targetHours}h · stretch {stretchHours}h</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-gray-400">Roadmap target</span>
            <span className="font-bold text-white">Dec 31, 2026</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-gray-400">GATE syllabus target</span>
            <span className="font-bold text-purple-300">{syllabusDeadline || "Jan 15, 2027"}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-gray-400">GATE paper</span>
            <span className="font-bold text-white">{paperDate || "Feb 6–21 window"}</span>
          </div>
          <p className="pt-2 text-xs italic text-gray-500">This is your system — 99 days of focused execution toward 2027.</p>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-card-foreground">Planning — daily targets</CardTitle>
        </CardHeader>
        <form onSubmit={handleSaveSettings} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Daily Target (hours)</label>
              <input type="number" step="0.5" min={1} max={12} value={targetHours}
                onChange={(e) => setTargetHours(Number(e.target.value))}
                className="w-full bg-border/30 border border-border rounded-xl p-3 text-xs text-card-foreground focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Stretch Target (hours)</label>
              <input type="number" step="0.5" min={1} max={14} value={stretchHours}
                onChange={(e) => setStretchHours(Number(e.target.value))}
                className="w-full bg-border/30 border border-border rounded-xl p-3 text-xs text-card-foreground focus:outline-none focus:border-accent" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-2">Session planning</label>
            <div className="flex gap-2">
              {(["Flexible", "Fixed"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setSchedulingMode(m)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${schedulingMode === m ? "bg-accent text-white border-accent" : "bg-border/30 text-gray-400 border-border"}`}>
                  {m === "Flexible" ? "Flexible (recommended)" : "Fixed times (optional)"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">GATE allocation %</label>
              <input type="number" min={0} max={80} value={gatePct} onChange={(e) => setGatePct(Number(e.target.value))}
                className="w-full bg-border/30 border border-border rounded-xl p-3 text-xs text-card-foreground focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Roadmap allocation %</label>
              <input type="number" min={0} max={80} value={roadmapPct} onChange={(e) => setRoadmapPct(Number(e.target.value))}
                className="w-full bg-border/30 border border-border rounded-xl p-3 text-xs text-card-foreground focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Revision allocation %</label>
              <input type="number" min={0} max={60} value={revisionPct} onChange={(e) => setRevisionPct(Number(e.target.value))}
                className="w-full bg-border/30 border border-border rounded-xl p-3 text-xs text-card-foreground focus:outline-none focus:border-accent" />
            </div>
          </div>
          <p className="text-[11px] text-gray-500">GATE planning defaults (35–40% GATE / 35–40% Roadmap / 10–15% Practice / 10–15% Revision). You can override per day. Revision intervals stay at 1 / 7 / 21 / 45 days.</p>

          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-4">
            <div>
              <p className="text-xs font-bold text-emerald-300">Curriculum target date (one authoritative deadline)</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400">
                All required curriculum must complete by this date. Drives per-track required pace
                across planner, hubs, dashboard and Learn. GATE first-pass keeps its own exam deadline below.
              </p>
              <input type="date" value={curriculumDeadline} min="2026-09-24" max="2027-03-31"
                onChange={(e) => setCurriculumDeadline(e.target.value)}
                className="mt-2 w-full sm:w-auto bg-border/30 border border-border rounded-xl px-3 py-2.5 text-xs text-card-foreground focus:outline-none focus:border-accent" />
            </div>
          </div>

          <div className="rounded-xl border border-purple-500/25 bg-purple-500/5 p-4 space-y-4">
            <div>
              <p className="text-xs font-bold text-purple-300">GATE syllabus deadline (your planning deadline)</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400">
                First-pass syllabus completion target. Drives the daily topics/day pace.
                This is your planning deadline — not an official GATE date.
              </p>
              <input type="date" value={syllabusDeadline} min="2026-09-24" max="2027-02-21"
                onChange={(e) => setSyllabusDeadline(e.target.value)}
                className="mt-2 w-full sm:w-auto bg-border/30 border border-border rounded-xl px-3 py-2.5 text-xs text-card-foreground focus:outline-none focus:border-accent" />
            </div>
            <div>
              <p className="text-xs font-bold text-purple-300">Your GATE paper date (optional)</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400">
                Official GATE 2027 window: Feb 6–21, 2027 (IIT Madras, subject to change).
                Set your exact paper date when known for a precise countdown + January plan.
              </p>
              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <input type="date" value={paperDate} min="2027-02-06" max="2027-02-21"
                  onChange={(e) => setPaperDate(e.target.value)}
                  className="w-full sm:w-auto bg-border/30 border border-border rounded-xl px-3 py-2.5 text-xs text-card-foreground focus:outline-none focus:border-accent" />
                {paperDate && (
                  <button type="button" onClick={() => setPaperDate("")}
                    className="px-4 py-2.5 rounded-xl border border-border bg-border/30 text-xs font-bold text-gray-400 hover:bg-border/60">
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-orange-500/25 bg-orange-500/5 p-3">
            <p className="text-xs font-bold text-orange-300">Streak rule</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400">
              A day counts only on core completion — GATE 30m + Roadmap 30m + Revision 15m, or 3h+ focused with real GATE/Roadmap work.
              Opening the app or logging in never counts. Streaks are computed from study history every time.
            </p>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-border/20 border border-border/50">
            <div>
              <p className="text-xs font-bold text-card-foreground">Study Session Reminders</p>
              <p className="text-[11px] text-gray-400">Optional gentle reminders. No fixed 11 AM / 7 PM / 10 PM assumptions.</p>
            </div>
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)}
              className="w-4 h-4 rounded text-accent accent-accent cursor-pointer" />
          </div>

          <button type="submit"
            className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-md">
            {savedSuccess ? <><CheckCircle2 className="w-4 h-4" /> Preferences Saved!</> : <><Save className="w-4 h-4" /> Save Preferences</>}
          </button>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-card-foreground">Appearance</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          {(["dark", "light"] as const).map((m) => (
            <button key={m} type="button"
              onClick={() => {
                if (m === "light") document.documentElement.classList.add("light");
                else document.documentElement.classList.remove("light");
                try { window.localStorage.setItem("sf-theme", m); } catch { /* noop */ }
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold border transition border-border bg-border/30 text-gray-300 hover:bg-border/60 capitalize">
              {m} theme
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-500 mt-2">Dark-first design. The sidebar toggle stays in sync automatically.</p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-indigo-400">
            <Download className="w-4 h-4" /> Data — Export, Import, Reset
          </CardTitle>
        </CardHeader>
        <p className="text-xs text-gray-400 mb-4">
          Export covers roadmap, GATE attempts, errors, mocks, revision, practice, projects, notes, sessions, study days, backlog, reviews, and settings.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={handleExportJSON}
            className="flex-1 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> Export Backup (JSON)
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="flex-1 px-5 py-2.5 rounded-xl border border-border bg-border/30 hover:bg-border/60 text-gray-200 font-bold text-xs transition flex items-center justify-center gap-2">
            <Upload className="w-4 h-4" /> Import Backup
          </button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" aria-label="Import backup file"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setImportMsg(null);
              try {
                const backup = JSON.parse(await f.text());
                const res = await fetch("/api/settings/import", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ backup }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Import failed");
                const total = Object.values(data.restored || {}).reduce((a: number, v) => a + (typeof v === "number" ? v : 0), 0 as number);
                setImportMsg(`Restored ${total} records across ${Object.keys(data.restored || {}).length} collections.`);
              } catch (err) {
                setImportMsg(err instanceof Error ? err.message : "Import failed");
              } finally {
                e.target.value = "";
              }
            }} />
        </div>
        {importMsg && <p className="text-xs text-gray-300 mt-2">{importMsg}</p>}

        <div className="mt-5 pt-4 border-t border-border/60">
          <p className="text-xs font-bold text-rose-300 flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> Danger zone — reset all activity</p>
          <p className="text-[11px] text-gray-500 mt-1">Wipes sessions, study days, GATE attempts, revision, practice, notes, and progress counters. Curriculum structure stays. Type RESET to continue.</p>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <input value={resetText} onChange={(e) => setResetText(e.target.value)} placeholder='Type RESET to continue'
              aria-label="Reset confirmation" className="flex-1 bg-border/30 border border-border rounded-xl px-3 py-2.5 text-xs text-card-foreground placeholder-gray-500 focus:outline-none focus:border-rose-500" />
            <button
              disabled={resetting || resetText !== "RESET"}
              onClick={async () => {
                setResetting(true);
                setResetMsg(null);
                try {
                  const res = await fetch("/api/settings/reset", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ confirm: resetText }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data?.error || "Reset failed");
                  setResetMsg("Reset complete. Re-seed or import a backup to continue.");
                  setResetText("");
                } catch (err) {
                  setResetMsg(err instanceof Error ? err.message : "Reset failed");
                } finally {
                  setResetting(false);
                }
              }}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs transition">
              {resetting ? "Resetting…" : "Reset Data"}
            </button>
          </div>
          {resetMsg && <p className="text-xs text-gray-300 mt-2">{resetMsg}</p>}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-card-foreground">App — install StudyForge</CardTitle>
        </CardHeader>
        <InstallSection />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-card-foreground"><FlaskConical className="w-4 h-4" /> Real-World Test Mode</CardTitle>
        </CardHeader>
        <p className="text-xs text-gray-400 mb-3">
          Optional 7-day usage test. Shows an unobtrusive DAY n OF 7 banner and builds a usage report in Reviews — hours, core days, PYQs, most/least used screens.
        </p>
        {testMode && testDay !== null ? (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <p className="flex-1 text-xs font-bold text-indigo-300">Active — day {testDay} of {TEST_DAYS}</p>
            <button onClick={() => { stopTestMode(); setTestMode(false); setTestDay(null); }}
              className="px-4 py-2 rounded-xl border border-border bg-border/30 text-xs font-bold text-gray-300">Stop test</button>
          </div>
        ) : (
          <button onClick={() => { startTestMode(); setTestMode(true); setTestDay(testDayNumber()); }}
            className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-xs transition">
            Start 7-Day Test
          </button>
        )}
      </Card>

      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle className="text-gray-400 text-sm">About</CardTitle>
        </CardHeader>
        <p className="text-xs leading-relaxed text-gray-400">StudyForge is a personal study operating system — 99 days from Sep 24 to Dec 31, plus GATE 2027 through January.</p>
        <div className="mt-6 text-center">
          <p className="text-sm font-bold tracking-tight text-gray-300">StudyForge</p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">Made by Devashish · for Devashish</p>
        </div>
      </Card>
    </div>
  );
}

function InstallSection() {
  const [state, setState] = useState<"checking" | "installed" | "ready" | "unsupported">("checking");

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
      setState("installed");
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__sfInstallPrompt = e;
      setState("ready");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // If no prompt arrives, the browser doesn't support it — don't block.
    const t = setTimeout(() => setState((s) => (s === "checking" ? "unsupported" : s)), 2500);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      clearTimeout(t);
    };
  }, []);

  const install = async () => {
    const evt = (window as any).__sfInstallPrompt;
    if (!evt) { setState("unsupported"); return; }
    evt.prompt();
    try { await evt.userChoice; } catch { /* noop */ }
    (window as any).__sfInstallPrompt = null;
    setState("unsupported");
  };

  if (state === "checking") return <p className="text-xs text-gray-500">Checking install support…</p>;
  if (state === "installed") return <p className="text-xs font-bold text-emerald-400">✓ StudyForge is installed — running as an app.</p>;
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">StudyForge works better as an installed app — fullscreen, home-screen icon, offline shell.</p>
      {state === "ready" ? (
        <button onClick={install} className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-xs transition shadow-md">
          Install app
        </button>
      ) : (
        <p className="text-xs text-gray-500">Use the browser version — your browser doesn&apos;t offer installation right now. Chrome/Edge on desktop or Android do.</p>
      )}
    </div>
  );
}
