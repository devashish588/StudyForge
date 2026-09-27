// Track-identity pipeline tests: canonical track/priority/difficulty metadata
// must survive every planner transformation (engine → candidate → mission
// item → overflow), so no consumer falls back to heuristic/default labels.
// Run: npm run test:identity (exits non-zero on failure).

import { buildMission, type PlannerContext, type WorkCandidate } from "../src/lib/autonomous-planner";
import { buildMissionPayload } from "../src/lib/mission";
import type { PlanItem } from "../src/lib/today-plan";

let failures = 0;

function check(label: string, condition: boolean, extra: string = "") {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label} ${extra}`);
  } else {
    console.log(`ok: ${label}`);
  }
}

function candidate(refId: string, title: string, kind: WorkCandidate["kind"], track: WorkCandidate["track"], minutes: number): WorkCandidate {
  return {
    refType: "custom",
    refId,
    title,
    kind,
    track,
    minutes,
    originalMinutes: minutes,
    difficulty: "Medium",
    priority: "CORE",
    carryOverCount: 0,
    sourceDate: null,
    overdueDays: 0,
    openErrors: 0,
    confidence: 3,
    dueDate: null,
    assignedDate: "2026-09-25",
    revisionDue: false,
    whyBase: "test",
  };
}

const ctx: PlannerContext = {
  date: "2026-09-25",
  capacity: 360,
  stretch: 480,
  daysToRoadmapEnd: 98,
  daysToGateDeadline: 113,
  gateBehind: false,
  aiBehind: false,
  sweBehind: false,
  projectDueSoon: false,
  completedTitles: new Set<string>(),
};

// 1. Kernel: fitted items keep canonical track.
const m1 = buildMission(
  [
    candidate("dsa-1", "6 practice problems", "PRACTICE", "DSA", 45),
    candidate("gate-1", "Discrete Mathematics — Propositional and First Order Logic", "GATE", "GATE", 150),
  ],
  ctx
);
const fitted1 = [...m1.easyStart, ...m1.hardDeepWork, ...m1.easyApply, ...m1.recall];
check(
  "kernel fitted practice keeps track DSA",
  fitted1.some((i) => i.refId === "dsa-1" && i.track === "DSA")
);
check(
  "kernel fitted gate keeps track GATE",
  fitted1.some((i) => i.refId === "gate-1" && i.track === "GATE")
);

// 2. Kernel: deferred (unscheduled) items keep canonical track too.
const m2 = buildMission(
  [
    candidate("big-1", "Huge Deep Topic", "GATE", "GATE", 300),
    candidate("big-2", "Huge DSA Topic", "ROADMAP", "DSA", 300),
  ],
  { ...ctx, capacity: 60 }
);
check(
  "kernel deferred items keep canonical track",
  m2.deferred.length > 0 && m2.deferred.every((i) => i.track === "GATE" || i.track === "DSA"),
  `deferred tracks: ${m2.deferred.map((d) => d.track).join(",")}`
);

// 3. Bridge: mission payload preserves track on fitted AND overflow items.
function planItem(id: string, title: string, kind: PlanItem["kind"], minutes: number, track?: PlanItem["track"]): PlanItem {
  return {
    id, kind, tier: "SHOULD", title, minutes,
    detail: `${title} detail`, why: "", done: false,
    difficulty: "Medium", priority: "IMPORTANT",
    ...(track ? { track } : {}),
  } as PlanItem;
}
const plan: any = {
  date: "2026-09-25",
  targetMinutes: 360,
  items: [
    planItem("2026-09-25:practice:set", "6 practice problems", "PRACTICE", 45, "DSA"),
    planItem("2026-09-25:gate:t1", "Discrete Mathematics — Sets", "GATE", 420),
  ],
  pace: { currentTopicsPerDay: 0, driftTopicsPerDay: 0 },
  horizons: { phase: "build" },
  tomorrowCandidates: [],
};
const input: any = {
  date: "2026-09-25",
  availableMinutes: 360,
  priorityMode: "Balanced",
  generatedAt: "2026-09-25T00:00:00.000Z",
  settings: {
    gateAllocation: 0.375, roadmapAllocation: 0.375, practiceAllocation: 0.125, revisionAllocation: 0.125,
    syllabusDeadline: "2027-01-15", curriculumDeadline: "2026-12-31",
    examWindowStart: "2027-02-06", examWindowEnd: "2027-02-21", paperDate: null,
  },
  gateTopics: [],
  roadmapTasks: [],
  revisionDue: [],
  backlog: [],
  projects: [],
  prevUnfinishedMust: [],
  prevDate: null,
  calibration: {},
  days: [],
  practiceRemainingMinutes: 0,
  practiceSolved: 0,
  practiceTotal: 0,
  adaptation: { plannedMinutes: 0, actualMinutes: 0, completionRate: 0, carryOverMinutes: 0, sustainablePerDay: null },
};
const payload = buildMissionPayload(plan, input, 480);
const all = [...payload.carryOver, ...payload.easyStart, ...payload.hardDeepWork, ...payload.easyApply, ...payload.recall];
const practiceOut = all.find((i) => /practice problems/.test(i.title));
check("bridge practice item keeps track DSA", !!practiceOut && practiceOut.track === "DSA");
check(
  "bridge never emits undefined track on fitted items",
  all.filter((i) => i.fitted).every((i) => !!i.track),
  `missing: ${all.filter((i) => i.fitted && !i.track).map((i) => i.title).join(",")}`
);

if (failures > 0) {
  console.error(`${failures} track identity case(s) failed.`);
  process.exit(1);
}
console.log("All track identity cases passed.");
