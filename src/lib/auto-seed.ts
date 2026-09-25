import { prisma } from "./prisma";
import {
  GATE_TOPICS,
  ROADMAP_DSA, ROADMAP_SWE, ROADMAP_AI, ROADMAP_CONSOLIDATION,
  CORE100, PROJECT_TASKS,
} from "../../prisma/curriculum-v4";
import { todayStr } from "./date";

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

export async function autoSeedCurriculumIfNeeded() {
  try {
    const taskCount = await prisma.roadmapTask.count();
    if (taskCount > 0) {
      // Ensure existing DSA tasks in DB carry track = "DSA"
      const dsaSw = await prisma.roadmapTask.count({ where: { category: "DSA", track: "SOFTWARE_ENGINEERING" } });
      if (dsaSw > 0) {
        await prisma.roadmapTask.updateMany({
          where: { category: "DSA" },
          data: { track: "DSA" },
        });
      }
      return;
    }

    console.log("Auto-seeding production database with V4 curriculum...");

    // 1. Create Roadmap Weeks & Tasks
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

    const allRoadmap = [...ROADMAP_DSA, ...ROADMAP_SWE, ...ROADMAP_AI, ...ROADMAP_CONSOLIDATION];

    for (const sh of shells) {
      const exWeek = await prisma.roadmapWeek.findFirst({ where: { weekNumber: sh.weekNumber } });
      const weekId = exWeek ? exWeek.id : (await prisma.roadmapWeek.create({
        data: {
          weekNumber: sh.weekNumber, title: sh.title,
          startDate: addDaysStr(STUDY_START, sh.start),
          endDate: sh.weekNumber === 14 ? "2026-12-31" : addDaysStr(STUDY_START, sh.end),
          focusArea: sh.focusArea, practiceTarget: sh.practiceTarget,
        },
      })).id;

      const weekTasks = allRoadmap.filter((t) => t.week === sh.weekNumber);
      for (const t of weekTasks) {
        const exTask = await prisma.roadmapTask.findFirst({ where: { title: t.title } });
        if (!exTask) {
          await prisma.roadmapTask.create({
            data: {
              weekId, title: t.title, category: t.category, subtopics: JSON.stringify(t.subtopics),
              estimatedTimeMinutes: t.minutes, practiceReq: t.practiceReq, status: "TODO",
              confidence: 3, sitting: t.block, blockLabel: t.block, plannedMinutes: t.minutes,
              actualMinutes: 0, assignedDate: addDaysStr(STUDY_START, t.dayOffset),
              priority: t.priority, track: t.track, difficulty: t.difficulty,
              prerequisites: JSON.stringify(t.prerequisites),
            },
          });
        }
      }
    }

    // 2. GATE Subjects & Topics
    const icons: Record<string, string> = { "Discrete Mathematics": "Binary", "Data Structures": "Layers", "Algorithms": "Cpu", "DBMS": "Database", "Operating Systems": "Terminal", "Computer Networks": "Globe", "Computer Organization / Architecture": "HardDrive", "Theory of Computation": "Code", "Compiler Design": "Workflow", "Engineering Mathematics": "Calculator", "Digital Logic": "Cpu", "General Aptitude": "Sparkles" };
    const order = ["General Aptitude", "Discrete Mathematics", "Digital Logic", "Computer Organization / Architecture", "Data Structures", "Algorithms", "Theory of Computation", "Compiler Design", "Operating Systems", "DBMS", "Computer Networks", "Engineering Mathematics"];

    for (const name of order) {
      let subj = await prisma.gateSubject.findUnique({ where: { name } });
      const topics = GATE_TOPICS.filter((t) => t.subject === name);
      if (!subj) {
        subj = await prisma.gateSubject.create({
          data: { name, icon: icons[name] || "BookOpen", totalTopics: topics.length, totalPYQs: topics.length * 10, solvedPYQs: 0, accuracy: 0 },
        });
      }
      for (const top of topics) {
        const exTop = await prisma.gateTopic.findFirst({ where: { subjectId: subj.id, name: top.name } });
        if (!exTop) {
          await prisma.gateTopic.create({
            data: { subjectId: subj.id, name: top.name, completed: false, confidence: 3, estimatedMinutes: top.minutes, difficulty: top.difficulty, priority: top.priority },
          });
        }
      }
    }

    // 3. Core 100 Practice Problems
    for (const prob of CORE100) {
      const exProb = await prisma.practiceProblem.findFirst({ where: { title: prob.title } });
      if (!exProb) {
        await prisma.practiceProblem.create({
          data: { title: prob.title, platform: "Core100", category: "DSA", pattern: prob.pattern, difficulty: prob.difficulty, timeMinutes: prob.minutes },
        });
      }
    }

    // 4. Projects & Tasks
    const projectShells = [
      { name: "Full Stack SaaS Project", description: "Production-grade backend (REST/Auth/RBAC/Postgres/Redis) with a working UI.", goal: "Ship hardened backend + deploy.", techStack: JSON.stringify(["Node.js", "Express", "PostgreSQL", "Redis", "JWT", "Docker"]) },
      { name: "ML Prediction API", description: "End-to-end ML pipeline with evaluation and FastAPI serving.", goal: "Deploy ML Model API with high F1-score.", techStack: JSON.stringify(["Python", "Scikit-Learn", "Pandas", "FastAPI", "Uvicorn"]) },
      { name: "Generative AI Chatbot App", description: "AI Chatbot with streaming, memory, tools and cost logging.", goal: "Build streaming tool-using assistant.", techStack: JSON.stringify(["Next.js", "TypeScript", "OpenAI / Claude API", "Tailwind CSS"]) },
      { name: "Production-Style RAG Application", description: "Hybrid retrieval + eval harness + hardened deploy.", goal: "PDF chatbot with measured retrieval quality.", techStack: JSON.stringify(["Python", "LangChain", "ChromaDB", "OpenAI Embeddings", "Streamlit"]) },
      { name: "Autonomous Agentic AI Project", description: "Multi-tool agent with memory, HITL and failure tests.", goal: "Build autonomous multi-step workflow agent.", techStack: JSON.stringify(["TypeScript", "Node.js", "AI Agent Framework", "Vector Memory"]) },
      { name: "Final Containerized Production System", description: "Traced, cost-guarded production AI deploy.", goal: "Deploy observable production AI system.", techStack: JSON.stringify(["Docker", "Docker Compose", "AWS", "GitHub Actions", "Redis", "Prometheus"]) },
    ];

    for (const sh of projectShells) {
      let proj = await prisma.project.findFirst({ where: { name: sh.name } });
      if (!proj) {
        proj = await prisma.project.create({ data: { name: sh.name, description: sh.description, goal: sh.goal, techStack: sh.techStack, progress: 0, milestoneStage: "Planning" } });
      }
      const tasks = PROJECT_TASKS.filter((t) => t.project === sh.name);
      for (const t of tasks) {
        const exTask = await prisma.projectTask.findFirst({ where: { projectId: proj.id, title: t.title } });
        if (!exTask) {
          await prisma.projectTask.create({ data: { projectId: proj.id, milestoneStage: t.milestoneStage, title: t.title, completed: false, estimatedMinutes: t.minutes, priority: t.priority } });
        }
      }
    }

    // 5. Revision Items
    const revisionItems = [
      { title: "Arrays & Two Pointers", category: "DSA", stage: 1, confidence: 4, nextRevisionDate: STUDY_START },
      { title: "Binary Search Patterns", category: "DSA", stage: 1, confidence: 3, nextRevisionDate: STUDY_START },
      { title: "DBMS Normalization (1NF to BCNF)", category: "GATE", stage: 1, confidence: 2, nextRevisionDate: STUDY_START },
      { title: "Operating Systems CPU Scheduling", category: "GATE", stage: 2, confidence: 4, nextRevisionDate: STUDY_START },
      { title: "Conditional Probability & Bayes Rule", category: "GATE", stage: 1, confidence: 4, nextRevisionDate: STUDY_START },
    ];
    for (const r of revisionItems) {
      const exRev = await prisma.revisionItem.findFirst({ where: { title: r.title } });
      if (!exRev) {
        await prisma.revisionItem.create({ data: { title: r.title, category: r.category, stage: r.stage, confidence: r.confidence, nextRevisionDate: r.nextRevisionDate, notes: "Key definitions and memory formulas." } });
      }
    }

    // 6. Reset any un-fitted/empty stored StudyDay row for today so fresh plan generates
    const dStr = todayStr();
    const todayRow = await prisma.studyDay.findUnique({ where: { date: dStr } });
    if (todayRow) {
      const must = JSON.parse(todayRow.mustDoJson || "[]");
      const should = JSON.parse(todayRow.shouldDoJson || "[]");
      const could = JSON.parse(todayRow.couldDoJson || "[]");
      const totalItems = must.length + should.length + could.length;
      if (totalItems <= 1 || should.some((i: { detail?: string }) => i.detail?.includes("~47m"))) {
        await prisma.studyDay.update({
          where: { date: dStr },
          data: {
            mustDoJson: "[]",
            shouldDoJson: "[]",
            couldDoJson: "[]",
            planGeneratedAt: null,
            planLocked: false,
          },
        });
      }
    }

    console.log("Auto-seeding complete!");
  } catch (e) {
    console.error("Auto-seed error:", e);
  }
}
