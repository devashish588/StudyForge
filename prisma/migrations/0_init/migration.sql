-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL DEFAULT 'user_devashish',
    "name" TEXT NOT NULL DEFAULT 'Devashish',
    "email" TEXT NOT NULL DEFAULT 'devashish@studyforge.local',
    "dailyTargetHours" DOUBLE PRECISION NOT NULL DEFAULT 8.0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredSittings" TEXT NOT NULL DEFAULT '[]',
    "schedulingMode" TEXT NOT NULL DEFAULT 'Flexible',
    "dailyTargetMinutes" INTEGER NOT NULL DEFAULT 480,
    "stretchTargetMinutes" INTEGER NOT NULL DEFAULT 600,
    "gateAllocation" DOUBLE PRECISION NOT NULL DEFAULT 0.375,
    "roadmapAllocation" DOUBLE PRECISION NOT NULL DEFAULT 0.375,
    "revisionAllocation" DOUBLE PRECISION NOT NULL DEFAULT 0.125,
    "practiceAllocation" DOUBLE PRECISION NOT NULL DEFAULT 0.125,
    "revisionIntervals" TEXT NOT NULL DEFAULT '[1,7,21,45]',
    "notifyReminders" BOOLEAN NOT NULL DEFAULT true,
    "primaryGoal" TEXT NOT NULL DEFAULT 'Both',
    "gateSyllabusDeadline" TEXT NOT NULL DEFAULT '2027-01-15',
    "gateExamWindowStart" TEXT NOT NULL DEFAULT '2027-02-06',
    "gateExamWindowEnd" TEXT NOT NULL DEFAULT '2027-02-21',
    "gatePaperDate" TEXT,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyDay" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "plannedHours" DOUBLE PRECISION NOT NULL DEFAULT 8.0,
    "targetMinutes" INTEGER NOT NULL DEFAULT 480,
    "availableMinutes" INTEGER NOT NULL DEFAULT 480,
    "actualMinutes" INTEGER NOT NULL DEFAULT 0,
    "gateMinutes" INTEGER NOT NULL DEFAULT 0,
    "roadmapMinutes" INTEGER NOT NULL DEFAULT 0,
    "practiceMinutes" INTEGER NOT NULL DEFAULT 0,
    "revisionMinutes" INTEGER NOT NULL DEFAULT 0,
    "problemsSolved" INTEGER NOT NULL DEFAULT 0,
    "questionsReviewed" INTEGER NOT NULL DEFAULT 0,
    "focusPriority" TEXT NOT NULL DEFAULT 'Balanced',
    "dailyReflection" TEXT,
    "tomorrowPriority" TEXT,
    "struggleNotes" TEXT,
    "planJson" TEXT NOT NULL DEFAULT '{}',
    "dailyGoal" TEXT,
    "mustDoJson" TEXT NOT NULL DEFAULT '[]',
    "shouldDoJson" TEXT NOT NULL DEFAULT '[]',
    "couldDoJson" TEXT NOT NULL DEFAULT '[]',
    "notebookContent" TEXT,
    "doubtsJson" TEXT NOT NULL DEFAULT '[]',
    "planGeneratedAt" TEXT,
    "planLocked" BOOLEAN NOT NULL DEFAULT false,
    "planFeedback" TEXT,
    "coreDayCompleted" BOOLEAN NOT NULL DEFAULT false,
    "restDay" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "studyDayId" TEXT NOT NULL,
    "date" TEXT NOT NULL DEFAULT '2026-08-24',
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "taskId" TEXT,
    "subjectId" TEXT,
    "plannedMinutes" INTEGER NOT NULL DEFAULT 60,
    "actualMinutes" INTEGER NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "clockStart" TEXT,
    "clockEnd" TEXT,
    "blockLabel" TEXT NOT NULL DEFAULT 'Block 1',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "interruptions" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapWeek" (
    "id" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "focusArea" TEXT NOT NULL,
    "practiceTarget" INTEGER NOT NULL DEFAULT 25,

    CONSTRAINT "RoadmapWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapTask" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subtopics" TEXT NOT NULL DEFAULT '[]',
    "estimatedTimeMinutes" INTEGER NOT NULL DEFAULT 60,
    "practiceReq" TEXT NOT NULL DEFAULT '',
    "projectAssoc" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "completionDate" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 3,
    "notes" TEXT,
    "sitting" TEXT NOT NULL DEFAULT 'Block 1',
    "blockLabel" TEXT NOT NULL DEFAULT 'Block 1',
    "plannedMinutes" INTEGER NOT NULL DEFAULT 60,
    "actualMinutes" INTEGER NOT NULL DEFAULT 0,
    "assignedDate" TEXT NOT NULL DEFAULT '2026-08-24',

    CONSTRAINT "RoadmapTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateSubject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'BookOpen',
    "totalTopics" INTEGER NOT NULL DEFAULT 10,
    "targetDate" TEXT NOT NULL DEFAULT '2027-02-01',
    "totalPYQs" INTEGER NOT NULL DEFAULT 50,
    "solvedPYQs" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0.0,

    CONSTRAINT "GateSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateTopic" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "confidence" INTEGER NOT NULL DEFAULT 3,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 90,
    "difficulty" TEXT NOT NULL DEFAULT 'Medium',
    "pyqTarget" INTEGER NOT NULL DEFAULT 10,
    "lastStudied" TEXT,
    "completedAt" TEXT,

    CONSTRAINT "GateTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateQuestion" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "topicName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "questionNo" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'GATE PYQ',
    "difficulty" TEXT NOT NULL DEFAULT 'Medium',
    "attempted" BOOLEAN NOT NULL DEFAULT false,
    "correct" BOOLEAN NOT NULL DEFAULT false,
    "timeMinutes" INTEGER NOT NULL DEFAULT 5,
    "confidence" INTEGER NOT NULL DEFAULT 3,
    "mistakeType" TEXT,
    "explanation" TEXT,
    "revisitDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GateQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateErrorLog" (
    "id" TEXT NOT NULL,
    "questionId" TEXT,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "mistakeType" TEXT NOT NULL,
    "rootCause" TEXT NOT NULL,
    "correctConcept" TEXT NOT NULL,
    "retryDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GateErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateMockTest" (
    "id" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 180,
    "attempted" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "incorrect" INTEGER NOT NULL DEFAULT 0,
    "marks" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "weakAreas" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "GateMockTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'ROADMAP',
    "stage" INTEGER NOT NULL DEFAULT 1,
    "confidence" INTEGER NOT NULL DEFAULT 3,
    "lastRevisedDate" TEXT,
    "nextRevisionDate" TEXT NOT NULL,
    "notes" TEXT,
    "history" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "RevisionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeProblem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'LeetCode',
    "url" TEXT,
    "category" TEXT NOT NULL DEFAULT 'DSA',
    "pattern" TEXT NOT NULL DEFAULT 'Arrays',
    "difficulty" TEXT NOT NULL DEFAULT 'Medium',
    "attempted" BOOLEAN NOT NULL DEFAULT false,
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "hintsUsed" BOOLEAN NOT NULL DEFAULT false,
    "solutionViewed" BOOLEAN NOT NULL DEFAULT false,
    "timeMinutes" INTEGER NOT NULL DEFAULT 15,
    "notes" TEXT,
    "retryDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "techStack" TEXT NOT NULL DEFAULT '[]',
    "repoUrl" TEXT,
    "deployUrl" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "milestoneStage" TEXT NOT NULL DEFAULT 'Planning',

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneStage" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isRevision" BOOLEAN NOT NULL DEFAULT false,
    "topicId" TEXT,
    "subjectId" TEXT,
    "projectId" TEXT,
    "questionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacklogItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Roadmap',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 60,
    "originalDate" TEXT NOT NULL,
    "overdueDays" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "BacklogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "id" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "roadmapCompleted" INTEGER NOT NULL DEFAULT 0,
    "roadmapTotal" INTEGER NOT NULL DEFAULT 0,
    "gateHours" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "pyqsSolved" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "topicsDue" INTEGER NOT NULL DEFAULT 0,
    "topicsCompleted" INTEGER NOT NULL DEFAULT 0,
    "textWhatWentWell" TEXT NOT NULL DEFAULT '',
    "textWhatWentBad" TEXT NOT NULL DEFAULT '',
    "textWhatToChange" TEXT NOT NULL DEFAULT '',
    "textWeakTopics" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "WeeklyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyReview" (
    "id" TEXT NOT NULL,
    "monthName" TEXT NOT NULL,
    "completedTopics" INTEGER NOT NULL DEFAULT 0,
    "pyqsSolved" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "summaryNotes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MonthlyReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyDay_date_key" ON "StudyDay"("date");

-- CreateIndex
CREATE INDEX "StudyDay_date_idx" ON "StudyDay"("date");

-- CreateIndex
CREATE INDEX "StudySession_date_idx" ON "StudySession"("date");

-- CreateIndex
CREATE INDEX "StudySession_category_idx" ON "StudySession"("category");

-- CreateIndex
CREATE INDEX "StudySession_studyDayId_idx" ON "StudySession"("studyDayId");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapWeek_weekNumber_key" ON "RoadmapWeek"("weekNumber");

-- CreateIndex
CREATE INDEX "RoadmapTask_status_idx" ON "RoadmapTask"("status");

-- CreateIndex
CREATE INDEX "RoadmapTask_assignedDate_idx" ON "RoadmapTask"("assignedDate");

-- CreateIndex
CREATE INDEX "RoadmapTask_category_idx" ON "RoadmapTask"("category");

-- CreateIndex
CREATE INDEX "RoadmapTask_weekId_idx" ON "RoadmapTask"("weekId");

-- CreateIndex
CREATE UNIQUE INDEX "GateSubject_name_key" ON "GateSubject"("name");

-- CreateIndex
CREATE INDEX "GateQuestion_subjectId_idx" ON "GateQuestion"("subjectId");

-- CreateIndex
CREATE INDEX "GateQuestion_revisitDate_idx" ON "GateQuestion"("revisitDate");

-- CreateIndex
CREATE INDEX "GateQuestion_attempted_idx" ON "GateQuestion"("attempted");

-- CreateIndex
CREATE INDEX "RevisionItem_nextRevisionDate_idx" ON "RevisionItem"("nextRevisionDate");

-- CreateIndex
CREATE INDEX "RevisionItem_category_idx" ON "RevisionItem"("category");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReview_weekNumber_key" ON "WeeklyReview"("weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyReview_monthName_key" ON "MonthlyReview"("monthName");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_studyDayId_fkey" FOREIGN KEY ("studyDayId") REFERENCES "StudyDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapTask" ADD CONSTRAINT "RoadmapTask_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "RoadmapWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateTopic" ADD CONSTRAINT "GateTopic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "GateSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateQuestion" ADD CONSTRAINT "GateQuestion_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "GateSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

