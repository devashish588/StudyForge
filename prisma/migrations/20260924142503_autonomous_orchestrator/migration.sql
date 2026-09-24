-- AlterTable
ALTER TABLE "GateTopic" ADD COLUMN     "carryOverCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "completionPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'CORE',
ADD COLUMN     "remainingMinutes" INTEGER,
ADD COLUMN     "sourceDate" TEXT,
ADD COLUMN     "whySelected" TEXT;

-- AlterTable
ALTER TABLE "PracticeProblem" ADD COLUMN     "carryOverCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "completionPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "remainingMinutes" INTEGER;

-- AlterTable
ALTER TABLE "ProjectTask" ADD COLUMN     "carryOverCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "completionPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dueDate" TEXT,
ADD COLUMN     "estimatedMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'IMPORTANT',
ADD COLUMN     "remainingMinutes" INTEGER;

-- AlterTable
ALTER TABLE "RoadmapTask" ADD COLUMN     "carryOverCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "completionPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "difficulty" TEXT NOT NULL DEFAULT 'Medium',
ADD COLUMN     "prerequisites" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'CORE',
ADD COLUMN     "remainingMinutes" INTEGER,
ADD COLUMN     "sourceDate" TEXT,
ADD COLUMN     "track" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "whySelected" TEXT;

-- AlterTable
ALTER TABLE "StudyDay" ADD COLUMN     "adaptationJson" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "carryOverJson" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "journeyDay" INTEGER,
ADD COLUMN     "missedRecovery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rebalanceJson" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "scheduleRiskJson" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "stretchMinutes" INTEGER NOT NULL DEFAULT 600;

-- AlterTable
ALTER TABLE "StudySession" ADD COLUMN     "blockType" TEXT NOT NULL DEFAULT 'EASY_APPLY',
ADD COLUMN     "difficultyRating" TEXT,
ADD COLUMN     "pausedAt" TEXT,
ADD COLUMN     "planItemId" TEXT,
ADD COLUMN     "remainingMinutes" INTEGER;
