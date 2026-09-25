// Planner hierarchy — derived from curriculum + target date + study windows.
// No new DB tables. All three levels are computed from the same remaining-
// curriculum rows the daily mission already uses, so Today / Planner / Print
// / Dashboard never disagree.
//
// Layers:  MONTH (milestone, workload, progress)
//       → WEEK  (per-day goals, track allocation, completion)
//       → DAY   (goals, sessions with clock times, subtopic checklist)
//       → SESSION → subtopics
//
// Sessions split fitted work across the user's configured study windows.
// Hard topics keep long contiguous blocks; light topics are packed.

import { addDays, diffDays, todayStr, minutesToHM, getProgramDay } from "./date";
import { buildCurriculumOutlook, AI_PROJECT_RE, type CurriculumOutlook } from "./curriculum";
import { classifyTrack, remainingMinutes, type Track } from "./autonomous-planner";
import { parseStudyWindows, windowEndTime, type StudyWindow } from "./study-windows";
import type { PlanItem } from "./today-plan";

// ---- types shared with the /api/planner response ----

export type SessionPurpose =
  | "DEEP_WORK"
  | "PRACTICE"
  | "IMPLEMENTATION"
  | "REVISION"
  | "RECALL"
  | "PYQ"
  | "PROJECT"
  | "REVIEW";

export interface SessionCheckItem {
  id: string;
  title: string;
  kind: string;
  refType?: string;
  refId?: string;
  minutes: number;
  done: boolean;
  fitted?: boolean;
}

export interface PlannedSession {
  id: string;
  label: string; // Morning / Afternoon / Evening / Night
  part: "MORNING" | "MIDDAY" | "AFTERNOON" | "EVENING" | "NIGHT";
  start: string; // HH:MM
  end: string;   // HH:MM
  duration: number;
  track: string; // GATE / AI Engineering / ...
  subject: string;
  topic: string;
  purpose: SessionPurpose;
  items: SessionCheckItem[]; // subtopics in this session
  doneCount: number;
  totalCount: number;
}

export interface DayPlan {
  date: string;
  dayNumber: number | null;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  targetMinutes: number;
  plannedMinutes: number;
  overflowMinutes: number;
  remainingCapacity: number;
  goals: { eyebrow: string; title: string; subs: SessionCheckItem[] }[];
  sessions: PlannedSession[];
  carryOverMinutes: number;
}

export interface WeekPlan {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  days: DayPlan[];
  targetMinutes: number;
  plannedMinutes: number;
  completedMinutes: number;
  remainingMinutes: number;
  percent: number;
  trackMinutes: Record<string, number>;
  milestone: string;
  status: string;
}

export interface MonthPlan {
  key: string; // YYYY-MM
  label: string; // September 2026
  monthStart: string;
  monthEnd: string;
  daysInWindow: number;
  targetMinutes: number;
  plannedMinutes: number;
  completedMinutes: number;
  remainingMinutes: number;
  percent: number;
  trackMinutes: Record<string, number>;
  majorModules: { track: string; label: string; minutes: number }[];
  milestone: string;
  status: string;
}

// ---- internal helpers ----

function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  const dow = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - dow);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function monthKey(d: string): string {
  return d.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function purposeFor(item: PlanItem): SessionPurpose {
  if (item.kind === "REVISION") return "REVISION";
  if (item.kind === "PRACTICE") return "PRACTICE";
  if (item.kind === "PROJECT") return "PROJECT";
  if (item.kind === "GATE" && item.refType === "pyqSet") return "PYQ";
  const diff = String(item.difficulty || "").toLowerCase();
  const block = String(item.block || "");
  if (block === "HARD_DEEP" || diff === "hard") return "DEEP_WORK";
  if (block === "RECALL") return "RECALL";
  if (block === "EASY_APPLY") return "IMPLEMENTATION";
  return "REVIEW";
}

function trackLabelFor(item: PlanItem): string {
  const t = String(item.track || "");
  if (t === "GATE" || t === "GATE_PREP") return "GATE";
  if (t === "AI_ENGINEERING") return "AI Engineering";
  if (t === "DSA") return "DSA";
  if (t === "SOFTWARE_ENGINEERING") return "Software Engineering";
  return item.kind === "GATE" ? "GATE" : "Roadmap";
}

function subjectFor(item: PlanItem): string {
  if (item.subjectName) return item.subjectName;
  const detail = item.detail || "";
  const dot = detail.indexOf("·");
  if (dot >= 0) return detail.slice(0, dot).trim();
  return detail || item.kind;
}

// Split a PlanItem's title into subtopic chips when the canonical subtopics
// JSON is available. For bundles like "6 practice problems" without further
// breakdown we keep the single item; callers may replace it with real problems.
function subtopicTitlesFor(item: PlanItem, rawSubtopics: string | null): string[] {
  if (rawSubtopics) {
    try {
      const arr = JSON.parse(rawSubtopics);
      if (Array.isArray(arr) && arr.length > 0) return arr.map((s: string) => String(s)).slice(0, 6);
    } catch { /* use title */ }
  }
  return [item.title];
}

// ---- curriculum inventory (no DB — caller supplies rows) ----

export interface CurriculumInventory {
  gateTopics: { id: string; name: string; subjectName: string; completed: boolean; priority: string; estimatedMinutes: number; remainingMinutes: number | null }[];
  roadmapTasks: { id: string; title: string; category: string; track: string; status: string; priority: string; estimatedTimeMinutes: number; actualMinutes: number; remainingMinutes: number | null; assignedDate: string; subtopics: string; weekTitle?: string }[];
  practice: { id: string; title: string; pattern: string; solved: boolean; timeMinutes: number }[];
  projects: { id: string; name: string; tasks: { id: string; title: string; completed: boolean; milestoneStage: string; estimatedMinutes: number; priority: string }[] }[];
  revisionDue: { id: string; title: string; category: string }[];
}

// ---- monthly plan (strategic milestone per month) ----

export function buildMonthlyPlans(args: {
  fromDate: string;
  curriculumDeadline: string;
  syllabusDeadline: string;
  inventory: CurriculumInventory;
  dailyTargetMinutes: number;
  curriculum: CurriculumOutlook;
}): MonthPlan[] {
  const start = args.fromDate.slice(0, 7) + "-01";
  const months: MonthPlan[] = [];
  // Build a single sorted queue of all remaining required work (CORE+IMPORTANT)
  // — same priority order the daily planner uses — then consume it month by month.
  const gateQueue = args.inventory.gateTopics
    .filter((t) => !t.completed && t.priority !== "OPTIONAL")
    .map((t) => ({
      track: "GATE" as const,
      label: `${t.subjectName} — ${t.name}`,
      minutes: Math.max(15, t.estimatedMinutes),
      sortKey: `${t.priority === "CORE" ? 0 : 1}-${t.subjectName}`,
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const roadQueue = args.inventory.roadmapTasks
    .filter((t) => t.status !== "COMPLETED" && t.status !== "PRACTICE" && t.priority !== "OPTIONAL")
    .map((t) => ({
      track:
        t.track === "AI_ENGINEERING"
          ? ("AI Engineering" as const)
          : t.track === "GATE_PREP"
            ? ("GATE" as const)
            : (t.category as string),
      label: t.title,
      minutes: Math.max(15, remainingMinutes(t.estimatedTimeMinutes, t.actualMinutes, t.remainingMinutes)),
      sortKey: `${t.priority === "CORE" ? 0 : 1}-${t.assignedDate}`,
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  let gateIdx = 0;
  let roadIdx = 0;
  let cursor = start;
  while (cursor <= args.curriculumDeadline) {
    const [y, m] = cursor.split("-").map(Number);
    const monthStart = y === Number(args.fromDate.slice(0, 4)) && m === Number(args.fromDate.slice(5, 7))
      ? args.fromDate
      : cursor;
    const monthEndDate = new Date(y, m, 0);
    const lastDay = `${y}-${String(m).padStart(2, "0")}-${String(monthEndDate.getDate()).padStart(2, "0")}`;
    const monthEnd = lastDay > args.curriculumDeadline ? args.curriculumDeadline : lastDay;
    if (monthStart > monthEnd) break;
    const daysInWindow = diffDays(monthStart, monthEnd) + 1;
    const targetMinutes = args.dailyTargetMinutes * daysInWindow;
    // Consume queue for this month: 1–2 GATE topics + remainder roadmap, up to capacity
    const majorModules: { track: string; label: string; minutes: number }[] = [];
    let consumed = 0;
    // GATE first
    while (gateIdx < gateQueue.length && majorModules.length < 2 && consumed < targetMinutes) {
      const item = gateQueue[gateIdx++];
      majorModules.push(item);
      consumed += item.minutes;
    }
    while (roadIdx < roadQueue.length && majorModules.length < 5 && consumed < targetMinutes) {
      const item = roadQueue[roadIdx++];
      majorModules.push(item);
      consumed += item.minutes;
    }
    // If still capacity and gate topics remain, top up
    while (gateIdx < gateQueue.length && majorModules.length < 5 && consumed < targetMinutes) {
      const item = gateQueue[gateIdx++];
      majorModules.push(item);
      consumed += item.minutes;
    }
    // If queue exhausted, show consolidation
    const plannedMinutes = Math.min(targetMinutes, majorModules.reduce((a, x) => a + x.minutes, 0));
    const milestone =
      majorModules.length > 0
        ? `Finish ${majorModules.slice(0, 3).map((x) => x.label).join(" · ")}`
        : "Consolidation & review";
    const completedMinutes = 0;
    months.push({
      key: monthKey(cursor),
      label: monthLabel(monthKey(cursor)),
      monthStart,
      monthEnd,
      daysInWindow,
      targetMinutes,
      plannedMinutes,
      completedMinutes,
      remainingMinutes: Math.max(0, targetMinutes - completedMinutes),
      percent: targetMinutes > 0 ? Math.round((completedMinutes / targetMinutes) * 100) : 0,
      trackMinutes: {
        GATE: majorModules.filter((x) => x.track === "GATE").reduce((a, x) => a + x.minutes, 0),
        AI: majorModules.filter((x) => x.track === "AI Engineering").reduce((a, x) => a + x.minutes, 0),
        SWE: majorModules.filter((x) => /Software|Full Stack|DevOps|Backend|Postgres|Redis|Docker|System Design/i.test(x.track)).reduce((a, x) => a + x.minutes, 0),
      },
      majorModules,
      milestone,
      status: plannedMinutes <= targetMinutes ? "ON_TRACK" : "AT_RISK",
    });
    const nd = new Date(y, m, 1);
    cursor = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}-01`;
    if (months.length > 12) break;
    if (gateIdx >= gateQueue.length && roadIdx >= roadQueue.length && months.length >= 2) {
      if (months[months.length - 1].majorModules.length === 0) break;
    }
  }
  return months;
}

// ---- weekly plan (Mon–Sun allocation, 7-day schedule preview) ----

export function buildWeeklyPlans(args: {
  fromDate: string;
  curriculumDeadline: string;
  inventory: CurriculumInventory;
  dailyTargetMinutes: number;
  curriculum: CurriculumOutlook;
  dailySessionsByDate?: Map<string, PlannedSession[]>; // optional: real sessions for the current week
}): WeekPlan[] {
  const weeks: WeekPlan[] = [];
  let monday = mondayOf(args.fromDate);
  const horizon = args.curriculumDeadline;
  for (let w = 0; w < 20; w++) {
    const weekStart = monday;
    const weekEnd = addDays(weekStart, 6);
    if (weekStart > horizon) break;
    const days: DayPlan[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      const isPast = date < args.fromDate;
      const isToday = date === args.fromDate;
      const isFuture = date > args.fromDate;
      const targetMinutes = isPast ? 0 : args.dailyTargetMinutes;
      days.push({
        date,
        dayNumber: (() => { try { return getProgramDay(date); } catch { return null; } })(),
        isToday,
        isPast,
        isFuture,
        targetMinutes,
        plannedMinutes: isToday || isFuture ? args.dailyTargetMinutes : 0,
        overflowMinutes: 0,
        remainingCapacity: isPast ? 0 : args.dailyTargetMinutes,
        goals: [],
        sessions: [],
        carryOverMinutes: 0,
      });
    }
    const targetMinutes = args.dailyTargetMinutes * 7;
    const plannedMinutes = args.dailyTargetMinutes * 7;
    // Track allocation for the week derived from curriculum required pace (same source as planner selection)
    const curriculumTracks = (args.curriculum as { tracks?: { key: string; requiredPerDay: number }[] } | null)?.tracks;
    const trackMinutes: Record<string, number> = {};
    if (curriculumTracks) {
      for (const t of curriculumTracks) trackMinutes[t.key.toUpperCase()] = t.requiredPerDay * 7;
      // Normalize to weekly capacity if tracks exceed it (honest, no fake overflow)
      const sum = Object.values(trackMinutes).reduce((a, v) => a + v, 0) || 1;
      if (sum > targetMinutes) {
        for (const k of Object.keys(trackMinutes)) trackMinutes[k] = Math.round((trackMinutes[k] / sum) * targetMinutes);
      }
    } else {
      trackMinutes["GATE"] = 0; trackMinutes["AI"] = 0; trackMinutes["SWE"] = 0; trackMinutes["DSA"] = 0;
    }
    const milestone =
      args.inventory.roadmapTasks
        .filter((t) => t.status !== "COMPLETED" && t.status !== "PRACTICE")
        .slice(0, 3)
        .map((t) => t.title)
        .join(" · ") || "Consolidation";
    weeks.push({
      weekLabel: `${weekStart.slice(5)} → ${weekEnd.slice(5)}`,
      weekStart,
      weekEnd,
      days,
      targetMinutes,
      plannedMinutes,
      completedMinutes: 0,
      remainingMinutes: targetMinutes,
      percent: 0,
      trackMinutes,
      milestone,
      status: "ON_TRACK",
    });
    monday = addDays(monday, 7);
    if (weeks.length >= 16) break;
  }
  return weeks;
}

// ---- daily session schedule (clock-time sessions for one date) ----

export function buildDailySessions(args: {
  date: string;
  mission: {
    carryOver: PlanItem[];
    easyStart: PlanItem[];
    hardDeepWork: PlanItem[];
    easyApply: PlanItem[];
    recall: PlanItem[];
  };
  windows: StudyWindow[];
  // Map from PlanItem refId → raw subtopics JSON (RoadmapTask.subtopics)
  subtopicsByRefId?: Map<string, string>;
}): PlannedSession[] {
  const ordered: PlanItem[] = [
    ...args.mission.carryOver,
    ...args.mission.easyStart,
    ...args.mission.hardDeepWork,
    ...args.mission.easyApply,
    ...args.mission.recall,
  ].filter((i) => i.fitted === true || i.fitted == null);

  if (ordered.length === 0 || args.windows.length === 0) return [];

  const sessions: PlannedSession[] = [];
  let itemIdx = 0;
  let itemRemaining = ordered[0]?.minutes ?? 0;
  let partNum = 1;

  for (const win of args.windows) {
    if (itemIdx >= ordered.length) break;
    const items: SessionCheckItem[] = [];
    let used = 0;
    const winCap = win.minutes;

    while (itemIdx < ordered.length) {
      const item = ordered[itemIdx];
      const need = itemRemaining;
      const space = winCap - used;

      if (space <= 0) break;
      if (need <= 0) {
        itemIdx++;
        if (itemIdx < ordered.length) {
          itemRemaining = ordered[itemIdx].minutes;
          partNum = 1;
        }
        continue;
      }

      if (need <= space) {
        // Whole item fits — keep canonical title (not subtopic slice)
        items.push({
          id: partNum > 1 ? `${item.id}#p${partNum}` : item.id,
          title: item.title + (partNum > 1 ? ` (cont.)` : ""),
          kind: item.kind,
          refType: item.refType,
          refId: item.refId,
          minutes: need,
          done: item.done,
          fitted: item.fitted,
        });
        used += need;
        itemIdx++;
        if (itemIdx < ordered.length) {
          itemRemaining = ordered[itemIdx].minutes;
          partNum = 1;
        }
        // After a hard block, pause packing so the next window starts fresh
        const isHard = String(item.difficulty || "").toLowerCase() === "hard" || String(item.block || "") === "HARD_DEEP";
        if (isHard && used + 45 > winCap) break;
      } else {
        // Item larger than remaining space — split to fill window and carry remainder
        // Any topic (hard or light) can be split; this keeps total capacity exact
        // and prevents items from being dropped.
        items.push({
          id: `${item.id}#p${partNum}`,
          title: `${item.title} (part ${partNum})`,
          kind: item.kind,
          refType: item.refType,
          refId: item.refId,
          minutes: space,
          done: item.done,
          fitted: item.fitted,
        });
        itemRemaining -= space;
        partNum += 1;
        used += space;
        break; // window full, remainder continues next window
      }
    }

    if (items.length === 0) continue;

    const firstItem = ordered[Math.max(0, itemIdx - items.length)] ?? ordered[itemIdx] ?? (items[0] as unknown as PlanItem);
    const track = trackLabelFor(firstItem as PlanItem);
    const subject = subjectFor(firstItem as PlanItem);
    const topic = (firstItem as PlanItem).title;
    const purpose = purposeFor(firstItem as PlanItem);
    const duration = items.reduce((a, x) => a + x.minutes, 0);
    const end = windowEndTime(win.start, duration);
    sessions.push({
      id: `${args.date}:${win.id}`,
      label: win.label,
      part: win.label === "Midday" ? "MIDDAY" : win.label === "Morning" ? "MORNING" : win.label === "Afternoon" ? "AFTERNOON" : win.label === "Evening" ? "EVENING" : "NIGHT",
      start: win.start,
      end,
      duration,
      track,
      subject,
      topic,
      purpose,
      items,
      doneCount: items.filter((i) => i.done).length,
      totalCount: items.length,
    });
  }
  return sessions;
}

// ---- helpers reused by the /api/planner assembler ----

export function dayPartForWindow(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("morning")) return "MORNING";
  if (l.includes("midday")) return "MIDDAY";
  if (l.includes("afternoon")) return "AFTERNOON";
  if (l.includes("evening")) return "EVENING";
  return "NIGHT";
}
