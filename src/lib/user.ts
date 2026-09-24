import { prisma } from "./prisma";

/**
 * Ensure the single bootstrap user row exists, creating it with the exact
 * canonical values from prisma/seed.ts when the database is empty.
 *
 * The whole app assumes exactly one user (dashboard greets by name, settings
 * persist against it, plans read its allocations). Fresh databases — e.g. a
 * newly migrated production Postgres with no seed applied yet — would
 * otherwise return `user: null` and crash clients dereferencing it.
 * This is idempotent: on seeded databases it is a single findFirst no-op.
 */
export async function ensureUser() {
  const existing = await prisma.user.findFirst({ include: { settings: true } });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      id: "user_devashish",
      name: "Devashish",
      email: "devashish@studyforge.local",
      dailyTargetHours: 6.0,
      currentStreak: 0,
      longestStreak: 0,
      settings: {
        create: {
          preferredSittings: JSON.stringify([]),
          schedulingMode: "Flexible",
          dailyTargetMinutes: 360,
          stretchTargetMinutes: 480,
          gateAllocation: 0.375,
          roadmapAllocation: 0.375,
          revisionAllocation: 0.125,
          practiceAllocation: 0.125,
          revisionIntervals: JSON.stringify([1, 7, 21, 45]),
          notifyReminders: true,
          primaryGoal: "Both",
        },
      },
    },
    include: { settings: true },
  });
}
