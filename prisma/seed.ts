import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Active program: Sep 24, 2026 (Day 1) → Dec 31, 2026 (Day 99).
// 14-week curriculum. Production seed starts clean on Sep 24 — no
// pre-start study history. Set SEED_DEMO=1 for clearly-marked demo rows.
const STUDY_START = "2026-09-24";

function addDaysStr(base: string, days: number): string {
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

async function main() {
  console.log("Seeding StudyForge V3 database (Sep 24 → Dec 31, 2026, 99 days, flexible 8–10h)...");

  // 1. Clean existing records
  await prisma.userSettings.deleteMany();
  await prisma.user.deleteMany();
  await prisma.studySession.deleteMany();
  await prisma.studyDay.deleteMany();
  await prisma.roadmapTask.deleteMany();
  await prisma.roadmapWeek.deleteMany();
  await prisma.gateQuestion.deleteMany();
  await prisma.gateTopic.deleteMany();
  await prisma.gateSubject.deleteMany();
  await prisma.gateErrorLog.deleteMany();
  await prisma.gateMockTest.deleteMany();
  await prisma.revisionItem.deleteMany();
  await prisma.practiceProblem.deleteMany();
  await prisma.projectTask.deleteMany();
  await prisma.project.deleteMany();
  await prisma.note.deleteMany();
  await prisma.backlogItem.deleteMany();
  await prisma.weeklyReview.deleteMany();
  await prisma.monthlyReview.deleteMany();

  // 2. User & Settings (6h normal floor / 7h good / 8h stretch — Jan-15 window)
  await prisma.user.create({
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
          primaryGoal: "Both"
        }
      }
    }
  });

  // 3. Roadmap Weeks & Tasks (Sep 24 → Dec 31, 2026 — 14 weeks, 99 days)
  // Full curriculum preserved, consolidated from 19 weeks: ML weeks merged,
  // RAG/Agents/DevOps sprints folded into their build weeks, mock + revision
  // sprints consolidated, final ship week kept.
  const weeksData = buildWeeks();
  function buildWeeks() {
    const { ROADMAP_DSA, ROADMAP_SWE, ROADMAP_AI, ROADMAP_CONSOLIDATION }: Record<string, { week: number; title: string; category: string; subtopics: string[]; minutes: number; practiceReq: string; priority: string; track: string; difficulty: string; prerequisites: string[]; block: string; dayOffset: number }[]> = require("./curriculum-v4");
    const shells = [
      { weekNumber: 1, title: "DSA Foundations", focusArea: "Big O, Arrays, Strings, Sorting", practiceTarget: 25, start: 0, end: 6 },
      { weekNumber: 2, title: "Recursion & Linear Data Structures", focusArea: "Recursion, Backtracking, Linked Lists, Stack, Queue", practiceTarget: 30, start: 7, end: 13 },
      { weekNumber: 3, title: "Hashing, Two Pointers & Trees", focusArea: "Hashing, Sliding Window, Trees, BST, Heap", practiceTarget: 35, start: 14, end: 20 },
      { weekNumber: 4, title: "Graphs & Dynamic Programming", focusArea: "Graphs, DP, Greedy, Interview Patterns", practiceTarget: 40, start: 21, end: 27 },
      { weekNumber: 5, title: "Backend Foundations (Pruned Fast-Pass)", focusArea: "HTTP/REST, Modern JS/TS essentials", practiceTarget: 15, start: 28, end: 34 },
      { weekNumber: 6, title: "Async, APIs & Working Frontend Knowledge", focusArea: "Event loop, API-driven UI", practiceTarget: 15, start: 35, end: 41 },
      { weekNumber: 7, title: "Backend & Database Engineering", focusArea: "REST/Auth/RBAC, PostgreSQL depth, Resilience, ORM", practiceTarget: 15, start: 42, end: 48 },
      { weekNumber: 8, title: "Distributed Basics & Testing", focusArea: "Redis/Queues, Testing pyramid", practiceTarget: 10, start: 49, end: 55 },
      { weekNumber: 9, title: "Machine Learning Foundations", focusArea: "ML workflow, DL foundations, Evaluation", practiceTarget: 15, start: 56, end: 62 },
      { weekNumber: 10, title: "Generative AI & LLM Engineering", focusArea: "Transformers, Prompting, Tools, Fine-tuning, Cost ops", practiceTarget: 15, start: 63, end: 69 },
      { weekNumber: 11, title: "RAG Systems", focusArea: "Hybrid retrieval, Advanced retrieval, RAG evaluation", practiceTarget: 15, start: 70, end: 76 },
      { weekNumber: 12, title: "Agents + Production", focusArea: "Agents, Failures, Serving, Security, Production AI", practiceTarget: 25, start: 77, end: 83 },
      { weekNumber: 13, title: "Consolidation & GATE Mock Sprints", focusArea: "Weak areas, System design, AI design, Mocks", practiceTarget: 20, start: 84, end: 90 },
      { weekNumber: 14, title: "Final Revision & Portfolio Shipping", focusArea: "Revision sweep, Portfolio, Capstone", practiceTarget: 20, start: 91, end: 98 },
    ];
    const all = [...ROADMAP_DSA, ...ROADMAP_SWE, ...ROADMAP_AI, ...ROADMAP_CONSOLIDATION];
    return shells.map((sh) => ({
      weekNumber: sh.weekNumber, title: sh.title,
      startDate: addDaysStr(STUDY_START, sh.start), endDate: sh.weekNumber === 14 ? "2026-12-31" : addDaysStr(STUDY_START, sh.end),
      focusArea: sh.focusArea, practiceTarget: sh.practiceTarget,
      tasks: all.filter((t) => t.week === sh.weekNumber).map((t) => ({
        title: t.title, category: t.category, subtopics: JSON.stringify(t.subtopics),
        estimatedTimeMinutes: t.minutes, practiceReq: t.practiceReq, status: "TODO",
        block: t.block, assignedDate: addDaysStr(STUDY_START, t.dayOffset),
        priority: t.priority, track: t.track, difficulty: t.difficulty, prerequisites: JSON.stringify(t.prerequisites),
      })),
    }));
  }


  for (const w of weeksData) {
    const createdWeek = await prisma.roadmapWeek.create({
      data: {
        weekNumber: w.weekNumber,
        title: w.title,
        startDate: w.startDate,
        endDate: w.endDate,
        focusArea: w.focusArea,
        practiceTarget: w.practiceTarget,
      }
    });

    for (const t of w.tasks) {
      await prisma.roadmapTask.create({
        data: {
          weekId: createdWeek.id,
          title: t.title,
          category: t.category,
          subtopics: t.subtopics,
          estimatedTimeMinutes: t.estimatedTimeMinutes,
          practiceReq: t.practiceReq,
          status: t.status,
          confidence: 3,
          sitting: (t as { block: string }).block,
          blockLabel: (t as { block: string }).block,
          plannedMinutes: t.estimatedTimeMinutes,
          actualMinutes: 0,
          assignedDate: t.assignedDate,
          priority: (t as { priority?: string }).priority ?? "CORE",
          track: (t as { track?: string }).track ?? "",
          difficulty: (t as { difficulty?: string }).difficulty ?? "Medium",
          prerequisites: (t as { prerequisites?: string }).prerequisites ?? "[]",
        }
      });
    }
  }

  // 4. No pre-start study history: the production program starts clean on
  // Sep 24 (Day 1). Real sessions replace this emptiness day by day.
  // Set SEED_DEMO=1 for a clearly-marked demo week (Sep 24–30) used only
  // during development. Demo rows carry [demo] markers and are excluded
  // from streaks, analytics, heatmaps and all active metrics.
  if (process.env.SEED_DEMO === "1") {
    const demoMinutes = [300, 420, 480, 0, 450, 500, 360];
    for (let i = 0; i < demoMinutes.length; i++) {
      const date = addDaysStr(STUDY_START, i);
      const total = demoMinutes[i];
      const rest = total === 0;
      const gate = rest ? 0 : Math.round(total * 0.375);
      const roadmap = rest ? 0 : Math.round(total * 0.375);
      const practice = rest ? 0 : Math.round(total * 0.125);
      const revision = rest ? 0 : total - gate - roadmap - practice;
      const day = await prisma.studyDay.create({
        data: {
          date,
          plannedHours: 8.0,
          targetMinutes: 480,
          availableMinutes: 480,
          actualMinutes: total,
          gateMinutes: gate,
          roadmapMinutes: roadmap,
          practiceMinutes: practice,
          revisionMinutes: revision,
          problemsSolved: rest ? 0 : 5,
          questionsReviewed: rest ? 0 : 4,
          focusPriority: "Balanced",
          coreDayCompleted: !rest && total >= 180,
          restDay: rest,
          notes: "[demo] Sample history for development — excluded from active metrics.",
        }
      });
      if (!rest) {
        const mk = async (title: string, category: string, mins: number, block: string) => {
          await prisma.studySession.create({
            data: {
              studyDayId: day.id,
              date,
              title: `${title} [demo]`,
              category,
              plannedMinutes: mins,
              actualMinutes: mins,
              durationMinutes: mins,
              blockLabel: block,
              completed: true,
            }
          });
        };
        await mk("GATE practice block", "GATE", gate, "Block 1");
        await mk("Roadmap deep work", "Roadmap", roadmap, "Block 2");
        await mk("Practice set", "Practice", practice, "Block 3");
        await mk("Revision recall", "Revision", revision, "Block 4");
      }
    }
    console.log("SEED_DEMO=1: added 7 clearly-marked demo days (Sep 24–30).");
  }

  // 5. GATE 2027 Subjects & Topics — clean slate (targets kept, progress zeroed).
  // Real PYQ attempts build these numbers from Day 1.
  const gateSubjectsData = buildGate();
  function buildGate() {
    const { GATE_TOPICS }: { GATE_TOPICS: { subject: string; name: string; minutes: number; difficulty: string; priority: string }[] } = require("./curriculum-v4");
    const icons: Record<string, string> = { "Discrete Mathematics": "Binary", "Data Structures": "Layers", "Algorithms": "Cpu", "DBMS": "Database", "Operating Systems": "Terminal", "Computer Networks": "Globe", "Computer Organization / Architecture": "HardDrive", "Theory of Computation": "Code", "Compiler Design": "Workflow", "Engineering Mathematics": "Calculator", "Digital Logic": "Cpu", "General Aptitude": "Sparkles" };
    const order = ["General Aptitude", "Discrete Mathematics", "Digital Logic", "Computer Organization / Architecture", "Data Structures", "Algorithms", "Theory of Computation", "Compiler Design", "Operating Systems", "DBMS", "Computer Networks", "Engineering Mathematics"];
    return order.map((name) => ({
      name, icon: icons[name] || "BookOpen",
      topics: GATE_TOPICS.filter((t: { subject: string }) => t.subject === name).map((t: { name: string; minutes: number; difficulty: string; priority: string }) => ({ name: t.name, minutes: t.minutes, difficulty: t.difficulty, priority: t.priority })),
    }));
  }


  for (const s of gateSubjectsData) {
    const createdSub = await prisma.gateSubject.create({
      data: {
        name: s.name,
        icon: s.icon,
        totalTopics: s.topics.length,
        totalPYQs: s.topics.length * 10,
        solvedPYQs: 0,
        accuracy: 0,
      }
    });

    for (const top of s.topics) {
      await prisma.gateTopic.create({
        data: {
          subjectId: createdSub.id,
          name: top.name,
          completed: false,
          confidence: 3,
          estimatedMinutes: (top as { minutes?: number }).minutes ?? 90,
          difficulty: (top as { difficulty?: string }).difficulty ?? "Medium",
          priority: (top as { priority?: string }).priority ?? "CORE",
        }
      });
    }
  }

  // 6. No sample PYQs on a clean install — real attempts build this history.
  // Empty states across GATE pages guide the first log.

  // 7. Revision Items (due from Day 1)
  const revisionItems = [
    { title: "Arrays & Two Pointers", category: "DSA", stage: 1, confidence: 4, nextRevisionDate: STUDY_START },
    { title: "Binary Search Patterns", category: "DSA", stage: 1, confidence: 3, nextRevisionDate: STUDY_START },
    { title: "DBMS Normalization (1NF to BCNF)", category: "GATE", stage: 1, confidence: 2, nextRevisionDate: STUDY_START },
    { title: "Operating Systems CPU Scheduling", category: "GATE", stage: 2, confidence: 4, nextRevisionDate: STUDY_START },
    { title: "Conditional Probability & Bayes Rule", category: "GATE", stage: 1, confidence: 4, nextRevisionDate: STUDY_START }
  ];

  for (const item of revisionItems) {
    await prisma.revisionItem.create({
      data: {
        title: item.title,
        category: item.category,
        stage: item.stage,
        confidence: item.confidence,
        nextRevisionDate: item.nextRevisionDate,
        notes: "Key definitions and memory formulas."
      }
    });
  }

  // 8. DSA Core 100 — the fixed primary interview set (Striver = reference,
  // NeetCode 150 = supplement). Mastery: understand → implement → re-solve → explain.
  const { CORE100 }: { CORE100: { title: string; pattern: string; difficulty: string; minutes: number }[] } = require("./curriculum-v4");
  for (const prob of CORE100) {
    await prisma.practiceProblem.create({
      data: {
        title: prob.title, platform: "Core100", category: "DSA",
        pattern: prob.pattern, difficulty: prob.difficulty, timeMinutes: prob.minutes,
      }
    });
  }

  // 9. Flagship Projects — clean slate (structure kept, progress zeroed)
  const projectsData = buildProjects();
  function buildProjects() {
    const { PROJECT_TASKS }: { PROJECT_TASKS: { project: string; milestoneStage: string; title: string; minutes: number; priority: string }[] } = require("./curriculum-v4");
    const shells = [
      { name: "Full Stack SaaS Project", description: "Production-grade backend (REST/Auth/RBAC/Postgres/Redis) with a working UI.", goal: "Ship hardened backend + deploy.", techStack: JSON.stringify(["Node.js", "Express", "PostgreSQL", "Redis", "JWT", "Docker"]) },
      { name: "ML Prediction API", description: "End-to-end ML pipeline with evaluation and FastAPI serving.", goal: "Deploy ML Model API with high F1-score.", techStack: JSON.stringify(["Python", "Scikit-Learn", "Pandas", "FastAPI", "Uvicorn"]) },
      { name: "Generative AI Chatbot App", description: "AI Chatbot with streaming, memory, tools and cost logging.", goal: "Build streaming tool-using assistant.", techStack: JSON.stringify(["Next.js", "TypeScript", "OpenAI / Claude API", "Tailwind CSS"]) },
      { name: "Production-Style RAG Application", description: "Hybrid retrieval + eval harness + hardened deploy.", goal: "PDF chatbot with measured retrieval quality.", techStack: JSON.stringify(["Python", "LangChain", "ChromaDB", "OpenAI Embeddings", "Streamlit"]) },
      { name: "Autonomous Agentic AI Project", description: "Multi-tool agent with memory, HITL and failure tests.", goal: "Build autonomous multi-step workflow agent.", techStack: JSON.stringify(["TypeScript", "Node.js", "AI Agent Framework", "Vector Memory"]) },
      { name: "Final Containerized Production System", description: "Traced, cost-guarded production AI deploy.", goal: "Deploy observable production AI system.", techStack: JSON.stringify(["Docker", "Docker Compose", "AWS", "GitHub Actions", "Redis", "Prometheus"]) },
    ];
    return shells.map((sh) => ({
      ...sh, progress: 0, milestoneStage: "Planning",
      tasks: PROJECT_TASKS.filter((t: { project: string }) => t.project === sh.name).map((t: { milestoneStage: string; title: string; minutes: number; priority: string }) => ({ milestoneStage: t.milestoneStage, title: t.title, completed: false, minutes: t.minutes, priority: t.priority })),
    }));
  }


  for (const proj of projectsData) {
    const createdProj = await prisma.project.create({
      data: {
        name: proj.name,
        description: proj.description,
        goal: proj.goal,
        techStack: proj.techStack,
        progress: 0,
        milestoneStage: "Planning"
      }
    });

    for (const task of proj.tasks) {
      await prisma.projectTask.create({
        data: {
          projectId: createdProj.id,
          milestoneStage: task.milestoneStage,
          title: task.title,
          completed: false,
          estimatedMinutes: (task as { minutes?: number }).minutes ?? 60,
          priority: (task as { priority?: string }).priority ?? "IMPORTANT",
        }
      });
    }
  }

  // 10. No seeded backlog on a clean install — missed work creates it.

  // 11. Notes
  await prisma.note.create({
    data: {
      title: "Big O Notation & Time Complexity Cheat Sheet",
      content: `# Time Complexity Hierarchy

1. **O(1)** - Constant Time (Array Index lookup)
2. **O(log N)** - Logarithmic (Binary Search)
3. **O(N)** - Linear (Single loop traversal)
4. **O(N log N)** - Linearithmic (Merge Sort, Quick Sort average)
5. **O(N^2)** - Quadratic (Nested loops, Bubble Sort)
6. **O(2^N)** - Exponential (Recursive Fibonacci)

> [!TIP]
> Always check constraints: N <= 10^5 usually requires O(N) or O(N log N).
`,
      tags: JSON.stringify(["DSA", "Complexity", "CheatSheet"]),
      isPinned: true,
      isRevision: true
    }
  });

  console.log("Database successfully seeded (V3: Sep 24 start, 99 days, clean slate, flexible 8–10h)!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
