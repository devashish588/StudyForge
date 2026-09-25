// Unit tests for beginner prerequisite gating & track progression chains.
// Verifies that PYQs/revisions or advanced topics are held in check when
// foundational topics are incomplete for any track (DSA, GATE, AI, SWE).

import { prereqBlocked, priorityScore, type WorkCandidate } from "../src/lib/autonomous-planner";

let failures = 0;

function check(label: string, condition: boolean, msg: string = "") {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label} ${msg}`);
  } else {
    console.log(`ok: ${label}`);
  }
}

// 1. Beginner protection: GATE 10 PYQs blocked when Discrete Math is incomplete
const gatePyqCandidate: WorkCandidate = {
  refType: "gateTopic",
  refId: "gate-pyq-1",
  title: "Algorithms — 10 PYQs",
  kind: "GATE",
  track: "GATE",
  minutes: 60,
  originalMinutes: 60,
  difficulty: "Medium",
  priority: "CORE",
  carryOverCount: 0,
  sourceDate: null,
  overdueDays: 0,
  openErrors: 0,
  confidence: 3,
  dueDate: null,
  assignedDate: "2026-09-25",
  revisionDue: true,
  whyBase: "Due for revision",
};

const incompleteWithFoundations = [
  "Discrete Mathematics — Propositional and First Order Logic",
  "Algorithms — 10 PYQs",
];

const blockedReason = prereqBlocked(gatePyqCandidate, incompleteWithFoundations);
check(
  "GATE PYQs blocked by incomplete Discrete Math foundation",
  blockedReason !== null && blockedReason.includes("Discrete Math & Logic"),
  `Got: ${blockedReason}`
);

// 2. Beginner protection: PYQ unblocked once foundation is completed (not in incompleteTitles)
const incompleteWithoutFoundations = [
  "Algorithms — 10 PYQs",
];

const unblockedReason = prereqBlocked(gatePyqCandidate, incompleteWithoutFoundations);
check(
  "GATE PYQs allowed once foundation is completed",
  unblockedReason === null,
  `Got: ${unblockedReason}`
);

// 3. DSA Advanced Trees blocked when DSA Foundations & Big-O is incomplete
const dsaTreeCandidate: WorkCandidate = {
  refType: "roadmapTask",
  refId: "dsa-tree-1",
  title: "Trees & Binary Search Trees",
  kind: "PRACTICE",
  track: "DSA",
  minutes: 60,
  originalMinutes: 60,
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
  whyBase: "Roadmap progression",
};

const dsaIncomplete = [
  "DSA Introduction & Big-O Basics",
  "Trees & Binary Search Trees",
];

const dsaBlockedReason = prereqBlocked(dsaTreeCandidate, dsaIncomplete);
check(
  "DSA Advanced Trees blocked by incomplete DSA Foundations",
  dsaBlockedReason !== null && dsaBlockedReason.includes("DSA Foundations & Big-O"),
  `Got: ${dsaBlockedReason}`
);

// 4. Priority score foundation bonus test: stage 0 gets higher priority than advanced
const foundationCandidate: WorkCandidate = {
  ...dsaTreeCandidate,
  title: "DSA Introduction & Big-O Basics",
  refId: "dsa-found-1",
};

const ctx: any = { daysToGateDeadline: 98, gateBehind: false, aiBehind: false, sweBehind: false };
const scoreFound = priorityScore(foundationCandidate, ctx);
const scoreTree = priorityScore(dsaTreeCandidate, ctx);

check(
  "Foundational topic receives higher priority (-20 bonus) than advanced topic",
  scoreFound[1] < scoreTree[1],
  `Found score: ${scoreFound[1]}, Tree score: ${scoreTree[1]}`
);

if (failures > 0) {
  console.error(`${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("All prerequisite gating test cases passed successfully.");
