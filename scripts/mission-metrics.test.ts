// Focused regression tests: mission minute metric semantics.
// totalPlannedMinutes = capacity-FITTED minutes only.
// overflowMinutes     = visible fallback (queued, not scheduled) minutes.
// remainingCapacity   = max(0, capacity - totalPlannedMinutes).
// Scheduling behavior itself is intentionally NOT asserted here beyond
// item preservation (same items, same durations, no duplicates).
// Run: npm run test:mission (exits non-zero on failure).

import { buildMissionPayload, type MissionPayload } from "../src/lib/mission";
import type { PlanItem } from "../src/lib/today-plan";

let failures = 0;

function item(
  id: string,
  title: string,
  kind: PlanItem["kind"],
  minutes: number,
  opts: Partial<PlanItem> = {}
): PlanItem {
  return {
    id, kind, tier: "COULD", title, minutes,
    why: "", done: false,
    difficulty: "Medium", priority: "IMPORTANT",
    ...opts,
  } as PlanItem;
}

function runCase(
  name: string,
  capacity: number,
  items: PlanItem[],
  expected: { total: number; overflow: number; remaining: number }
): MissionPayload {
  const plan: any = {
    date: "2026-09-25",
    targetMinutes: capacity,
    items,
    pace: { currentTopicsPerDay: 0, driftTopicsPerDay: 0 },
    horizons: { phase: "build" },
  };
  const input: any = {
    date: "2026-09-25",
    settings: { syllabusDeadline: "2027-01-15" },
    gateTopics: [],
    roadmapTasks: [],
    projects: [],
    practiceRemainingMinutes: 0,
    days: [],
    adaptation: undefined,
  };
  const out: MissionPayload = buildMissionPayload(plan, input, 480);

  const check = (label: string, actual: number, want: number) => {
    if (actual !== want) {
      failures++;
      console.error(`FAIL ${name}: ${label} = ${actual}, want ${want}`);
    } else {
      console.log(`ok ${name}: ${label} = ${actual}`);
    }
  };
  check("totalPlannedMinutes", out.totalPlannedMinutes, expected.total);
  check("overflowMinutes", out.overflowMinutes, expected.overflow);
  check("remainingCapacity", out.remainingCapacity, expected.remaining);

  // Item preservation: same titles survive exactly once each (no loss, no
  // duplicates). Minutes are unchanged EXCEPT the single hard-deep slot,
  // which the builder legitimately resizes into its [120,150] window.
  const outItems = [...out.carryOver, ...out.easyStart, ...out.hardDeepWork, ...out.easyApply, ...out.recall];
  const inTitles = items.map((i) => i.title).sort().join(";");
  const outTitles = outItems.map((i) => i.title).sort().join(";");
  if (inTitles !== outTitles) {
    failures++;
    console.error(`FAIL ${name}: item composition changed.\n  in:  ${inTitles}\n  out: ${outTitles}`);
  } else {
    console.log(`ok ${name}: ${outItems.length} items preserved, none lost/duplicated`);
  }
  const hardSized = out.hardDeepWork.filter(
    (i) => {
      const src = items.find((x) => x.title === i.title);
      return src && src.minutes !== i.minutes;
    }
  );
  const badResize = outItems.filter((i) => {
    const src = items.find((x) => x.title === i.title);
    if (!src || src.minutes === i.minutes) return false;
    const isHardResize = i.block === "HARD_DEEP" && i.minutes >= 120 && i.minutes <= 150;
    return !isHardResize;
  });
  if (badResize.length > 0 || hardSized.length > 1) {
    failures++;
    console.error(`FAIL ${name}: unexpected duration changes: ${badResize.map((i) => i.title).join(",")}`);
  } else {
    console.log(`ok ${name}: durations unchanged except legitimate hard-slot resize`);
  }
  return out;
}

// CASE 1 — Sep-25 reproduction shape: fitted 360, overflow 565.
runCase(
  "case1/sep25",
  360,
  [
    item("g1", "GATE Hard Topic", "GATE", 480, { difficulty: "Hard", priority: "CORE", tier: "MUST" }),
    item("g2", "GATE Medium Topic", "GATE", 420, { difficulty: "Medium", priority: "CORE", tier: "MUST" }),
    item("r1", "DSA Primer A", "ROADMAP", 60, { difficulty: "Easy", priority: "CORE" }),
    item("r2", "DSA Primer B", "ROADMAP", 45, { difficulty: "Easy", priority: "CORE" }),
    item("r3", "DSA Primer C", "ROADMAP", 45, { difficulty: "Easy", priority: "CORE" }),
    item("v1", "Revision A", "REVISION", 20),
    item("v2", "Revision B", "REVISION", 20),
    item("q1", "PYQ Set", "GATE", 60),
    item("p1", "Project Milestone", "PROJECT", 60),
    item("x1", "Practice Set", "PRACTICE", 45),
  ],
  { total: 360, overflow: 565, remaining: 0 }
);

// CASE 2 — fits with room to spare, nothing queued.
runCase(
  "case2/spare",
  360,
  [
    item("r1", "Easy Warmup", "ROADMAP", 60, { difficulty: "Easy", priority: "CORE" }),
    item("g1", "Deep Topic", "GATE", 200, { difficulty: "Hard", priority: "CORE" }),
    item("r2", "Apply Task", "ROADMAP", 90, { difficulty: "Medium", priority: "CORE" }),
  ],
  { total: 300, overflow: 0, remaining: 60 }
);

// CASE 3 — exactly full, nothing queued.
runCase(
  "case3/exact",
  360,
  [
    item("r1", "Easy Warmup", "ROADMAP", 60, { difficulty: "Easy", priority: "CORE" }),
    item("g1", "Deep Topic", "GATE", 200, { difficulty: "Hard", priority: "CORE" }),
    item("r2", "Apply Task", "ROADMAP", 90, { difficulty: "Medium", priority: "CORE" }),
    item("v1", "Recall Item", "REVISION", 60),
  ],
  { total: 360, overflow: 0, remaining: 0 }
);

// CASE 4 — nothing fits (tiny capacity), everything visible as overflow.
runCase(
  "case4/all-overflow",
  20,
  [
    item("g1", "Huge Topic", "GATE", 420, { difficulty: "Hard", priority: "CORE", tier: "MUST" }),
  ],
  { total: 0, overflow: 420, remaining: 20 }
);

if (failures > 0) {
  console.error(`${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("All mission metric cases passed.");
