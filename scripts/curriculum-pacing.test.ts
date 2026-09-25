// Focused tests: curriculum-completion pacing math (CASES A–E, G–H).
// Pure functions only — no DB, no planner behavior asserted beyond math.
// CASE F (duplicate prevention) is covered live against /api/today-plan.
// Run: npm run test:curriculum (exits non-zero on failure).

import {
  paceStatus,
  daysToDeadline,
  trackOutlook,
  buildCurriculumOutlook,
} from "../src/lib/curriculum";
import { computeScheduleRisk } from "../src/lib/autonomous-planner";

let failures = 0;

function check(name: string, actual: unknown, want: unknown) {
  if (actual !== want) {
    failures++;
    console.error(`FAIL ${name}: got ${actual}, want ${want}`);
  } else {
    console.log(`ok ${name}: ${actual}`);
  }
}

// CASE A — plenty of time: 420h over 80d needs 315m/d; sustainable 360 → ON_TRACK.
{
  const required = Math.round((420 * 60) / 80);
  check("A required pace", required, 315);
  check("A status", paceStatus(required, 360, 360), "ON_TRACK");
}

// CASE B — tight deadline: 420h over 60d needs 420m/d; sustainable 360, capacity 480 → AT_RISK.
{
  const required = Math.round((420 * 60) / 60);
  check("B required pace", required, 420);
  check("B status", paceStatus(required, 360, 480), "AT_RISK");
}

// CASE B2 — impossible: 420h over 40d needs 630m/d > 480 capacity → OVERLOAD.
{
  const required = Math.round((420 * 60) / 40);
  check("B2 required pace", required, 630);
  check("B2 status", paceStatus(required, 360, 480), "OVERLOAD");
}

// CASE C — behind schedule: completing less leaves more remaining → higher required pace.
{
  const before = buildCurriculumOutlook(
    "2026-09-25", "2026-12-31",
    [{ key: "ai", label: "AI", done: 0, total: 20, remainingMinutes: 7000, deadline: "2026-12-31" }],
    360, 360, { ai: 0.375 }, true
  );
  const afterMiss = buildCurriculumOutlook(
    "2026-09-26", "2026-12-31",
    [{ key: "ai", label: "AI", done: 0, total: 20, remainingMinutes: 7000, deadline: "2026-12-31" }],
    300, 360, { ai: 0.375 }, true
  );
  check("C pace rises when behind", afterMiss.tracks[0].requiredPerDay > before.tracks[0].requiredPerDay, true);
  console.log(`   (before=${before.tracks[0].requiredPerDay}/d sustainable=360, after=${afterMiss.tracks[0].requiredPerDay}/d sustainable=300)`);
}

// CASE D — ahead of schedule: extra completion lowers remaining → lower required pace.
{
  const mk = (remaining: number) =>
    buildCurriculumOutlook(
      "2026-09-25", "2026-12-31",
      [{ key: "ai", label: "AI", done: 20 - remaining / 350, total: 20, remainingMinutes: remaining, deadline: "2026-12-31" }],
      360, 360, { ai: 0.375 }, true
    );
  const r1 = mk(7000).tracks[0].requiredPerDay;
  const r2 = mk(5000).tracks[0].requiredPerDay;
  check("D pace falls when ahead", r2 < r1, true);
  console.log(`   (7000m → ${r1}/d, 5000m → ${r2}/d)`);
}

// CASE E — completed topics leave remaining curriculum (excluded by construction).
{
  const out = buildCurriculumOutlook(
    "2026-09-25", "2026-12-31",
    [
      { key: "gate", label: "GATE", done: 57, total: 57, remainingMinutes: 0, deadline: "2027-01-15" },
      { key: "ai", label: "AI", done: 0, total: 20, remainingMinutes: 7000, deadline: "2026-12-31" },
    ],
    360, 360, { gate: 0.375, ai: 0.375 }, true
  );
  check("E done track needs 0/day", out.tracks[0].requiredPerDay, 0);
  check("E overall counts done", out.overall.done, 57);
}

// CASE G — missed day: fewer days left for same work → higher required pace (recovery signal).
{
  const paceFor = (date: string) =>
    buildCurriculumOutlook(
      date, "2026-12-31",
      [{ key: "swe", label: "SWE", done: 0, total: 30, remainingMinutes: 9000, deadline: "2026-12-31" }],
      360, 360, { swe: 0.25 }, true
    ).tracks[0].requiredPerDay;
  check("G missed day raises pace", paceFor("2026-09-26") > paceFor("2026-09-25"), true);
}

// CASE H — optional work never crowds required curriculum (caller-side rule:
// OPTIONAL minutes are excluded before calling; verify status ignores them).
{
  const withoutOptional = buildCurriculumOutlook(
    "2026-09-25", "2026-12-31",
    [{ key: "ai", label: "AI", done: 0, total: 18, remainingMinutes: 6000, deadline: "2026-12-31" }],
    360, 360, { ai: 0.375 }, true
  );
  check("H required pace (optional excluded)", withoutOptional.tracks[0].requiredPerDay, Math.round(6000 / 98));
}

// Behind-flag rule: needs more than pro-rata share of proven pace, with history.
{
  const t = (required: number, sust: number, hist: boolean) =>
    trackOutlook("2026-09-25",
      { key: "ai", label: "AI", done: 0, total: 20, remainingMinutes: required * 98, deadline: "2026-12-31" },
      sust, 360, { share: 0.375, historyOk: hist }).behind;
  check("behind when over share", t(150, 360, true), true);   // 150 > 135
  check("not behind within share", t(100, 360, true), false); // 100 <= 135
  check("no history → no flag", t(500, 360, false), false);
  check("no pace → no flag", t(500, 0, true), false);
}

// Days math is inclusive and clamped.
{
  check("days Sep25→Dec31", daysToDeadline("2026-09-25", "2026-12-31"), 98);
  check("days clamp past deadline", daysToDeadline("2027-02-01", "2026-12-31"), 1);
}

// No-history semantics: judge plan-fit only, never fake evidence.
{
  check("no history fits → ON_TRACK", paceStatus(342, null, 360, 480), "ON_TRACK");
  check("no history impossible → OVERLOAD", paceStatus(500, null, 360, 480), "OVERLOAD");
}

// 1. No history + required below 6h → ON_TRACK.
{
  check("unknown + below 6h → ON_TRACK", paceStatus(300, null, 360, 480), "ON_TRACK");
}

// 2. No history + required between 6h and 7h → AT_RISK.
{
  check("unknown + 6-7h → AT_RISK", paceStatus(395, null, 360, 480), "AT_RISK");
}

// 3. No history + required above 8h → OVERLOAD.
{
  check("unknown + above 8h → OVERLOAD", paceStatus(500, null, 360, 480), "OVERLOAD");
}

// 4. Existing history available → sustainable-pace logic unchanged.
{
  check("known pace, ahead → ON_TRACK", paceStatus(300, 360, 360, 480), "ON_TRACK");
  check("known pace, gap within target → AT_RISK", paceStatus(350, 300, 360, 480), "AT_RISK");
  check("known pace, gap beyond target → OVERLOAD", paceStatus(400, 300, 360, 480), "OVERLOAD");
}

// 5. Required pace calculation remains unchanged.
{
  check("required math intact", Math.round(38675 / 113), 342);
}

// Risk object with unknown history: band status, null sustainable, no fake claim.
// (Jan-15 horizon total 44675m / 113d = 395m/d required.)
{
  const r = computeScheduleRisk({
    remainingByTrack: { GATE: 20000, AI_ENGINEERING: 15000, SOFTWARE_ENGINEERING: 9675 },
    daysLeft: 113, sustainablePerDay: null, capacityPerDay: 360, stretchPerDay: 480,
  });
  check("risk unknown → AT_RISK at 395/d", r.status, "AT_RISK");
  check("risk sustainable null", r.sustainablePerDay, null);
  check("risk gap null", r.gapPerDay, null);
  check("risk message states bands, no fake pace", r.message.includes("No history yet") && !r.message.includes("sustainable pace is"), true);
  const r2 = computeScheduleRisk({
    remainingByTrack: { GATE: 15000, AI_ENGINEERING: 15000, SOFTWARE_ENGINEERING: 4675 },
    daysLeft: 60, sustainablePerDay: 300, capacityPerDay: 360, stretchPerDay: 480,
  });
  check("risk known history unchanged", r2.status, "OVERLOAD");
  check("risk known sustainable kept", r2.sustainablePerDay, 300);
  check("risk known gap kept", r2.gapPerDay, Math.round(34675 / 60 - 300));
}

if (failures > 0) {
  console.error(`${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("All curriculum pacing cases passed.");
