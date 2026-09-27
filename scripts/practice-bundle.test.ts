// Practice-bundle guidance tests: the daily practice bundle must name real
// next-up Core-100 problems (informational only). Solving is still recorded
// per problem on the Practice page — checking the bundle must NOT fabricate
// Core-100 progress. Absent input keeps the legacy bare bundle.
// Run: npm run test:practice (exits non-zero on failure).

import { buildTodayPlan } from "../src/lib/today-plan";
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

function engineInput(overrides: Record<string, unknown> = {}): any {
  return {
    date: "2026-09-25",
    availableMinutes: 360,
    priorityMode: "Balanced",
    generatedAt: "2026-09-25T00:00:00.000Z",
    settings: {
      gateAllocation: 0.375, roadmapAllocation: 0.375,
      practiceAllocation: 0.125, revisionAllocation: 0.125,
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
    ...overrides,
  };
}

function practiceItemOf(plan: { items: PlanItem[] }): PlanItem | undefined {
  return plan.items.find((i) => i.kind === "PRACTICE");
}

// 1. Next-up titles flow onto the bundle with the unsolved count.
const withNext = buildTodayPlan(engineInput({
  practiceNextUp: ["Arrays — Two Sum", "Arrays — Remove Duplicates", "Hashing — Valid Anagram", "Extra — Ignored"],
  practiceUnsolved: 100,
}));
const item = practiceItemOf(withNext);
check("bundle carries next-up titles (max 3)", !!item && (item.practiceNextUp ?? []).length === 3);
check(
  "bundle titles are the first three in order",
  !!item && (item.practiceNextUp ?? []).join("|") === "Arrays — Two Sum|Arrays — Remove Duplicates|Hashing — Valid Anagram"
);
check("bundle carries unsolved count", !!item && item.practiceUnsolved === 100);
check("bundle stays plan-scoped (custom ref, DSA track)", !!item && item.refType === "custom" && item.track === "DSA");

// 2. Absent input keeps the legacy bare bundle (backward compatible).
const bare = buildTodayPlan(engineInput({}));
const bareItem = practiceItemOf(bare);
check("bare bundle has no next-up fields", !!bareItem && bareItem.practiceNextUp === undefined && bareItem.practiceUnsolved === undefined);

// 3. Bridge preserves guidance onto the fitted mission item.
const payload = buildMissionPayload(
  { ...withNext, targetMinutes: 360 },
  engineInput({ practiceRemainingMinutes: 0, practiceSolved: 0, practiceTotal: 100 }),
  480
);
const all = [...payload.carryOver, ...payload.easyStart, ...payload.hardDeepWork, ...payload.easyApply, ...payload.recall];
const fittedPractice = all.find((i) => i.kind === "PRACTICE" && i.fitted === true);
check(
  "fitted mission practice keeps next-up titles",
  !!fittedPractice && (fittedPractice.practiceNextUp ?? []).length === 3,
  `got: ${JSON.stringify(fittedPractice?.practiceNextUp)}`
);

if (failures > 0) {
  console.error(`${failures} practice bundle case(s) failed.`);
  process.exit(1);
}
console.log("All practice bundle cases passed.");
