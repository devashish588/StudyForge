// Workload-integrity tests: single shared roadmap-bucket rule and strict
// deadline validation. The mission bridge, dashboard, planner and track hubs
// must attribute every roadmap task identically, and malformed deadlines must
// be rejectable before they poison pace math with NaN.
// Run: npm run test:workload (exits non-zero on failure).

import { classifyRoadmapBucket, buildCurriculumOutlook } from "../src/lib/curriculum";
import { isValidDateStr, diffDays } from "../src/lib/date";

let failures = 0;

function check(label: string, condition: boolean, extra: string = "") {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label} ${extra}`);
  } else {
    console.log(`ok: ${label}`);
  }
}

// Explicit stored track always wins.
check("track DSA wins", classifyRoadmapBucket("DSA", "Full Stack", "Backend APIs") === "DSA");
check("track AI wins", classifyRoadmapBucket("AI_ENGINEERING", "DSA", "Weird Title") === "AI");
check("track SWE wins", classifyRoadmapBucket("SOFTWARE_ENGINEERING", "DSA", "Weird Title") === "SWE");
check("track GATE_PREP wins", classifyRoadmapBucket("GATE_PREP", "DSA", "GATE Weak-Area Sprint") === "GATEPREP");

// GATE_PREP precedence over DSA category (exam-prep paces with GATE everywhere).
check(
  "GATE_PREP beats DSA category",
  classifyRoadmapBucket("GATE_PREP", "DSA", "Full-Length GATE Mocks & Analysis") === "GATEPREP"
);

// Untracked DSA-category rows pace with DSA, never SWE.
check("untracked DSA category → DSA", classifyRoadmapBucket("", "DSA", "Strings & Searching Algorithms") === "DSA");
check("null track DSA category → DSA", classifyRoadmapBucket(null, "DSA", "Strings & Searching Algorithms") === "DSA");

// Keyword fallback mirrors the legacy per-surface behavior.
check("fallback AI keywords → AI", classifyRoadmapBucket("", "ML", "ML Foundations for AI Engineering") === "AI");
check("fallback DSA keywords → DSA", classifyRoadmapBucket("", "Full Stack", "Core 100 arrays drill") === "DSA");
check("fallback default → SWE", classifyRoadmapBucket("", "Full Stack", "Backend APIs: REST, Validation, Auth & RBAC") === "SWE");
check("fallback unknown → SWE", classifyRoadmapBucket(undefined, "DevOps", "Linux, Git & Deployment Foundations") === "SWE");

// Malformed deadlines must be detectable (diffDays yields NaN → JSON null pace).
check("malformed deadline diff is NaN", Number.isNaN(diffDays("2026-09-25", "not-a-date")));
check("empty deadline diff is NaN", Number.isNaN(diffDays("2026-09-25", "")));
check("rejects garbage", isValidDateStr("not-a-date") === false);
check("rejects empty", isValidDateStr("") === false);
check("rejects bad month", isValidDateStr("2026-13-01") === false);
check("rejects bad day", isValidDateStr("2026-02-30") === false);
check("rejects wrong shape", isValidDateStr("2026-9-5") === false);
check("rejects non-string", isValidDateStr(null) === false && isValidDateStr(123) === false);
check("accepts curriculum deadline", isValidDateStr("2026-12-31") === true);
check("accepts syllabus deadline", isValidDateStr("2027-01-15") === true);
check("accepts leap day", isValidDateStr("2028-02-29") === true);

// Cross-surface status contract: identical workload/date inputs must yield
// the identical status on every surface. Regression: the planner once passed
// capacity (360) as the stretch band, collapsing AT_RISK into OVERLOAD
// while Today/Dashboard (stretch 480) reported AT_RISK on the same state.
function outlookWithStretch(stretch: number) {
  return buildCurriculumOutlook(
    "2026-09-25",
    "2026-12-31",
    [
      { key: "gate", label: "GATE", done: 0, total: 57, remainingMinutes: 18840, deadline: "2027-01-15" },
      { key: "ai", label: "AI Engineering", done: 0, total: 19, remainingMinutes: 10440, deadline: "2026-12-31" },
      { key: "swe", label: "Software Engineering", done: 0, total: 17, remainingMinutes: 3840, deadline: "2026-12-31" },
      { key: "dsa", label: "DSA", done: 0, total: 100, remainingMinutes: 5555, deadline: "2026-12-31" },
    ],
    null,
    360,
    { gate: 0.375, ai: 0.375, swe: 0.25, dsa: 0.25 },
    false,
    stretch
  );
}
check("stretch 480 → AT_RISK (Today/Dashboard/planner agree)", outlookWithStretch(480).overall.status === "AT_RISK");
check(
  "stretch band is load-bearing (360 would say OVERLOAD)",
  outlookWithStretch(360).overall.status === "OVERLOAD"
);

if (failures > 0) {
  console.error(`${failures} workload integrity case(s) failed.`);
  process.exit(1);
}
console.log("All workload integrity cases passed.");
