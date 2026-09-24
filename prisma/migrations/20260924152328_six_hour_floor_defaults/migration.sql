-- AlterTable
ALTER TABLE "StudyDay" ALTER COLUMN "stretchMinutes" SET DEFAULT 480;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "dailyTargetHours" SET DEFAULT 6.0;

-- AlterTable
ALTER TABLE "UserSettings" ALTER COLUMN "dailyTargetMinutes" SET DEFAULT 360,
ALTER COLUMN "stretchTargetMinutes" SET DEFAULT 480;
