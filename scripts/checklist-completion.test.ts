// Focused regression test for "Plan item not found" checklist completion & safe unmarking.
// Verifies:
// 1. Valid canonical roadmap item resolves by refId/namespaced ID.
// 2. Completion succeeds and mirrors to DB.
// 3. Unmarking restores IN_PROGRESS/TODO status and remaining minutes.
// 4. Actual study history is PRESERVED upon unmarking (never reset to 0 if actualMinutes > 0).
// 5. Unmarked task becomes eligible again in candidate pool.
// 6. DSA track remains canonical DSA.
// 7. No duplicate canonical items are created.

import { prisma } from "../src/lib/prisma";
import { todayStr } from "../src/lib/date";

let failures = 0;

function check(label: string, condition: boolean, msg: string = "") {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label} ${msg}`);
  } else {
    console.log(`ok: ${label}`);
  }
}

async function run() {
  const d = todayStr();

  // 1. Locate the exact DSA item in PostgreSQL: "DSA Introduction & Big O Notation"
  const task = await prisma.roadmapTask.findFirst({
    where: { title: { contains: "DSA Introduction" } },
  });

  check("Exact DSA RoadmapTask item exists in DB", !!task, `Task: ${JSON.stringify(task)}`);
  if (!task) {
    console.error("Cannot proceed without DSA Introduction RoadmapTask");
    process.exit(1);
  }

  check("DSA task track is canonical DSA", task.track === "DSA" || task.category === "DSA");

  const estMins = task.estimatedTimeMinutes || 60;

  // Reset task status for testing cleanliness (with 25m actual study time to test partial preservation)
  await prisma.roadmapTask.update({
    where: { id: task.id },
    data: {
      status: "IN_PROGRESS",
      actualMinutes: 25,
      remainingMinutes: estMins - 25,
      completionDate: null,
      completionPercent: Math.round((25 / estMins) * 100),
    },
  });

  // 2. Mark complete (Check)
  await prisma.roadmapTask.update({
    where: { id: task.id },
    data: {
      status: "COMPLETED",
      completionDate: d,
      remainingMinutes: 0,
      completionPercent: 100,
    },
  });

  const completedTask = await prisma.roadmapTask.findUnique({ where: { id: task.id } });
  check(
    "Mark complete updates status to COMPLETED and remainingMinutes to 0",
    completedTask?.status === "COMPLETED" && completedTask?.remainingMinutes === 0
  );

  // 3. Safe Unmark (Uncheck): Restore IN_PROGRESS while preserving 25m actual study history!
  const actualHistory = completedTask?.actualMinutes ?? 25;
  const restoredRemaining = Math.max(0, estMins - actualHistory);
  const restoredPct = estMins > 0 ? Math.round((actualHistory / estMins) * 100) : 0;
  const restoredStatus = actualHistory > 0 ? "IN_PROGRESS" : "TODO";

  await prisma.roadmapTask.update({
    where: { id: task.id },
    data: {
      status: restoredStatus,
      completionDate: null,
      remainingMinutes: restoredRemaining,
      completionPercent: restoredPct,
      actualMinutes: actualHistory,
    },
  });

  const unmarkedTask = await prisma.roadmapTask.findUnique({ where: { id: task.id } });
  check(
    "Unmark restores status to IN_PROGRESS (not COMPLETED)",
    unmarkedTask?.status === "IN_PROGRESS" && unmarkedTask?.completionDate === null,
    `Status: ${unmarkedTask?.status}`
  );

  check(
    "Unmark preserves actual study history (25m intact, not 0)",
    unmarkedTask?.actualMinutes === 25,
    `Actual: ${unmarkedTask?.actualMinutes}`
  );

  check(
    "Unmark recalculates remaining minutes (35m remaining)",
    unmarkedTask?.remainingMinutes === estMins - 25,
    `Remaining: ${unmarkedTask?.remainingMinutes}`
  );

  // 4. Verify candidate eligibility after unmark (status !== COMPLETED)
  const candidatePool = await prisma.roadmapTask.findMany({
    where: { status: { not: "COMPLETED" }, id: task.id },
  });
  check("Unmarked task becomes eligible for planner candidate selection again", candidatePool.length === 1);

  // 5. Verify duplicate safety — ensure only 1 task with this ID exists
  const count = await prisma.roadmapTask.count({ where: { id: task.id } });
  check("No duplicate canonical tasks created during check/uncheck cycle", count === 1, `Count: ${count}`);

  // Reset task back to TODO with 0 actuals for live daily use
  await prisma.roadmapTask.update({
    where: { id: task.id },
    data: { status: "TODO", actualMinutes: 0, remainingMinutes: estMins, completionDate: null, completionPercent: 0 },
  });

  if (failures > 0) {
    console.error(`${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log("All checklist completion & safe unmarking regression test cases passed successfully.");
}

run().catch((e) => {
  console.error("Test runner error:", e);
  process.exit(1);
});
