// Carry-over capacity regression tests (P0.5).
// Defect: when every candidate was a carry-over item and the first one
// exceeded the 35% carry cap, `break` aborted the whole carry loop AND the
// `rest` pool excluded all carries — the mission scheduled nothing (fitted 0,
// deferred empty) despite eligible carried work. INCOMPLETE must never mean
// STUCK ON NOTHING.
// Rules locked here: oversized carries are skipped (loop continues); carries
// that miss the cap still compete in normal block fitting; scheduled carries
// are never double-booked.
// Run: npm run test:carry (exits non-zero on failure).

import { buildMission, type PlannerContext, type WorkCandidate } from "../src/lib/autonomous-planner";

let failures = 0;

function check(label: string, condition: boolean, extra: string = "") {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label} ${extra}`);
  } else {
    console.log(`ok: ${label}`);
  }
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

function carried(refId: string, title: string, kind: WorkCandidate["kind"], track: WorkCandidate["track"], minutes: number): WorkCandidate {
  return {
    refType: "custom",
    refId,
    title,
    kind,
    track,
    minutes,
    originalMinutes: minutes,
    difficulty: "Medium",
    priority: "IMPORTANT",
    carryOverCount: 1,
    sourceDate: "2026-09-24",
    overdueDays: 0,
    openErrors: 0,
    confidence: 3,
    dueDate: null,
    assignedDate: "2026-09-25",
    revisionDue: false,
    whyBase: "carried",
  };
}

// Live reproduction shape: two oversized GATE carries first, one small DSA
// carry behind them (35% cap of 360 = 126m).
const pool = [
  carried("g1", "General Aptitude — Numerical Computation & Quant", "GATE", "GATE", 300),
  carried("g2", "General Aptitude — Verbal Reasoning", "GATE", "GATE", 300),
  carried("r1", "Arrays Fundamentals & Operations", "ROADMAP", "DSA", 35),
];

const m = buildMission(pool, ctx);
const fitted = [...m.carryOver, ...m.easyStart, ...m.hardDeepWork, ...m.easyApply, ...m.recall];
const fittedIds = fitted.map((i) => i.refId);

check("all-carry pool schedules something", m.totalPlannedMinutes > 0, `fitted=${m.totalPlannedMinutes}`);
check(
  "small carry behind oversized carries still fits",
  fittedIds.includes("r1"),
  `fitted: ${fittedIds.join(",")}`
);
check(
  "360 capacity fits the whole pool (nothing lost)",
  ["g1", "g2", "r1"].every((id) =>
    fittedIds.includes(id) || m.deferred.some((d) => d.refId === id)
  ),
  `fitted: ${fittedIds.join(",")} deferred: ${m.deferred.map((d) => d.refId).join(",")}`
);
// Tight capacity: oversized carries must defer (visible queue), never vanish.
const tight = buildMission(pool, { ...ctx, capacity: 100 });
const tightIds = [...tight.carryOver, ...tight.easyStart, ...tight.hardDeepWork, ...tight.easyApply, ...tight.recall].map((i) => i.refId);
check(
  "tight capacity defers oversized carries instead of dropping them",
  tight.deferred.some((d) => d.refId === "g1" || d.refId === "g2"),
  `fitted: ${tightIds.join(",")} deferred: ${tight.deferred.map((d) => d.refId).join(",")}`
);
check(
  "tight capacity loses nothing (fitted ∪ deferred covers the pool)",
  ["g1", "g2", "r1"].every((id) =>
    tightIds.includes(id) || tight.deferred.some((d) => d.refId === id)
  )
);
check(
  "no double-booking across blocks",
  new Set(fittedIds).size === fittedIds.length,
  `fitted: ${fittedIds.join(",")}`
);
check(
  "carry cap still protects the mission (carry block bounded)",
  m.carryOver.reduce((a, i) => a + i.minutes, 0) <= Math.round(360 * 0.35),
  `carryOver minutes: ${m.carryOver.reduce((a, i) => a + i.minutes, 0)}`
);

// Mixed pool: fresh work still schedules alongside carries.
const fresh: WorkCandidate = {
  ...carried("fresh-1", "6 practice problems", "PRACTICE", "DSA", 45),
  carryOverCount: 0,
  sourceDate: null,
};
const m2 = buildMission([...pool, fresh], ctx);
const fitted2 = [...m2.carryOver, ...m2.easyStart, ...m2.hardDeepWork, ...m2.easyApply, ...m2.recall].map((i) => i.refId);
check("fresh work schedules alongside carries", fitted2.includes("fresh-1"), `fitted: ${fitted2.join(",")}`);

if (failures > 0) {
  console.error(`${failures} carry recovery case(s) failed.`);
  process.exit(1);
}
console.log("All carry recovery cases passed.");
