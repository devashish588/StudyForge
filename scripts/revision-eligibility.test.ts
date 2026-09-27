// Revision eligibility: subject-scoped prerequisite gating for GATE PYQs/revisions.
// Defect: prereqBlocked rule 2 blocks a GATE revision/PYQ whenever ANY
// track-level stage-0 topic (Discrete Mathematics) sits in the day's pool —
// even when the candidate's OWN subject first-pass is fully complete.
// Desired: a GATE PYQ/revision is blocked only by incomplete first-pass
// topics of its OWN subject (track-level rule stays as fallback when the
// subject is unknown). Learning of new advanced material keeps full gating.
// Run: npm run test:revision (exits non-zero on failure).

import { prereqBlocked, buildMission, type PlannerContext, type WorkCandidate } from "../src/lib/autonomous-planner";

let failures = 0;

function check(label: string, condition: boolean, extra: string = "") {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label} ${extra}`);
  } else {
    console.log(`ok: ${label}`);
  }
}

function revisionCandidate(title: string, subject: string | null): WorkCandidate {
  return {
    refType: "revisionItem",
    refId: "rev-1",
    title,
    kind: "REVISION",
    track: "GATE",
    minutes: 20,
    originalMinutes: 20,
    difficulty: "Medium",
    priority: "CORE",
    carryOverCount: 0,
    sourceDate: null,
    overdueDays: 0,
    openErrors: 0,
    confidence: 2,
    dueDate: null,
    assignedDate: "2026-09-25",
    revisionDue: true,
    whyBase: "Due for revision",
    ...(subject ? { subjectName: subject } : {}),
  } as WorkCandidate;
}

// Pool: Discrete Math first-pass in progress, DBMS first-pass fully complete.
const poolDmOpen = [
  "Discrete Mathematics — Propositional and First Order Logic",
  "Discrete Mathematics — Sets, Relations, Functions, Partial Orders",
];
const bySubjectDbmsComplete = new Map<string, string[]>([
  ["DBMS", []],
  ["Discrete Mathematics", [...poolDmOpen]],
]);

// 1. DBMS revision must NOT be blocked by unrelated incomplete DM topics
//    when its own subject first-pass is complete.
const dbmsRev = revisionCandidate("DBMS Normalization (1NF to BCNF)", "DBMS");
check(
  "DBMS revision free when own subject complete despite DM open",
  prereqBlocked(dbmsRev, poolDmOpen, bySubjectDbmsComplete) === null,
  `got: ${prereqBlocked(dbmsRev, poolDmOpen, bySubjectDbmsComplete)}`
);

// 2. DBMS revision MUST stay blocked while its own subject has open topics.
const bySubjectDbmsOpen = new Map<string, string[]>([
  ["DBMS", ["DBMS — Normalization (1NF, 2NF, 3NF, BCNF)"]],
  ["Discrete Mathematics", [...poolDmOpen]],
]);
check(
  "DBMS revision blocked while own subject incomplete",
  prereqBlocked(dbmsRev, poolDmOpen, bySubjectDbmsOpen) !== null
);

// 3. Track-level fallback preserved when subject map is absent (current behavior).
check(
  "revision blocked without subject map (fallback)",
  prereqBlocked(dbmsRev, poolDmOpen) !== null
);

// 4. Track-level fallback preserved when candidate subject is unknown.
const unknownRev = revisionCandidate("Some Custom GATE Revision", null);
check(
  "revision without subject stays track-gated",
  prereqBlocked(unknownRev, poolDmOpen, bySubjectDbmsComplete) !== null
);

// 5. DM revision still blocked by DM foundations (same-subject protection intact).
const dmRev = revisionCandidate("Discrete Math Logic Drill", "Discrete Mathematics");
check(
  "DM revision blocked while DM incomplete",
  prereqBlocked(dmRev, poolDmOpen, bySubjectDbmsComplete) !== null
);

// 6. Non-GATE tracks keep pure track-level gating (DSA revision + DSA intro in pool).
const dsaRev = revisionCandidate("Arrays & Two Pointers Drill", "DSA");
const dsaPool = ["DSA Introduction & Big O Notation"];
check(
  "DSA revision blocked by DSA foundations (track rule unchanged)",
  prereqBlocked({ ...dsaRev, track: "DSA" }, dsaPool, new Map([["DSA", []]])) !== null
);

// 7. Subject absent from the curriculum map → legacy track-level fallback
//    (protection never silently disappears for unrecognized subjects).
const mysteryRev = revisionCandidate("Mystery GATE Revision", "NoSuchSubject");
check(
  "unknown subject stays track-gated",
  prereqBlocked(mysteryRev, poolDmOpen, bySubjectDbmsComplete) !== null
);

// 8. Kernel level: subject-complete DBMS revision flows through buildMission
//    (eligible, scheduled) instead of being deferred by unrelated DM topics.
const kernelCtx: PlannerContext = {
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
  incompleteBySubject: bySubjectDbmsComplete,
};
const kernelCandidates = [
  {
    ...dbmsRev,
    refId: "rev-dbms",
    minutes: 20,
    originalMinutes: 20,
    assignedDate: "2026-09-25",
  },
];
const kernelMission = buildMission(kernelCandidates, kernelCtx);
const kernelScheduled = [...kernelMission.easyStart, ...kernelMission.hardDeepWork, ...kernelMission.easyApply, ...kernelMission.recall];
check(
  "kernel schedules subject-complete DBMS revision",
  kernelScheduled.some((i) => i.refId === "rev-dbms"),
  `deferred: ${kernelMission.deferred.map((d) => d.refId).join(",")}`
);

if (failures > 0) {
  console.error(`${failures} revision eligibility case(s) failed.`);
  process.exit(1);
}
console.log("All revision eligibility cases passed.");
