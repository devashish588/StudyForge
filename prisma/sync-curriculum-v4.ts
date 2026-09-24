// One-off curriculum V4 sync: applies prisma/curriculum-v4.ts to the LIVE database.
// - Matches RoadmapTask/GateTopic/ProjectTask/PracticeProblem by title (never deletes,
//   except the 2 untouched legacy Probability-duplicate topics consolidated into Eng Math).
// - Preserves user progress: completed/confidence/actualMinutes/completionDate untouched.
// - Old→new title renames reuse existing IDs.
// Run: npx ts-node --compiler-options {"module":"CommonJS"} prisma/sync-curriculum-v4.ts
// (PowerShell: use single quotes around the JSON.)

import { PrismaClient } from "@prisma/client";
import {
  GATE_TOPICS, GATE_NEW_SUBJECTS, GATE_CONSOLIDATED_SUBJECT,
  ROADMAP_DSA, ROADMAP_SWE, ROADMAP_AI, ROADMAP_CONSOLIDATION,
  CORE100, PROJECT_TASKS,
} from "./curriculum-v4";

const prisma = new PrismaClient();
const START = "2026-09-24";

function addDays(base: string, n: number): string {
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// Old live title → new spec title (ID-preserving renames for repurposed tasks).
const RENAMES: Record<string, string> = {
  "Web Architecture & HTML5/CSS Grid": "Web Architecture & HTTP Fundamentals",
  "JavaScript ES6+ & Functional Programming": "Modern JavaScript & TypeScript Essentials",
  "DOM, Async JS & Event Loop": "Async JS, Event Loop & DOM Survival Kit",
  "React Fundamentals & State Management": "React Working Knowledge (Experienced Fast-Pass)",
  "Node.js, Express & REST APIs": "Backend APIs: REST, Validation, Auth & RBAC",
  "Relational SQL (PostgreSQL) & MongoDB": "PostgreSQL Depth: Schema → MVCC → Query Plans",
  "ORM/ODM & Data Modeling (Prisma + Mongoose)": "ORM & Data Modeling (Prisma)",
  "Full Stack Application Shipping": "Redis, Queues, Workers & Eventual Consistency",
  "Full-Stack Integration, Testing & Demo Day": "Testing Pyramid: Unit → API → Integration → E2E",
  "ML Workflow & Data Preprocessing": "ML Foundations for AI Engineering",
  "Model Evaluation, Tuning & Feature Engineering": "ML Evaluation, Tuning & Feature Engineering",
  "Linear & Logistic Regression": "Classical Models Reference (Regression → Clustering)",
  "LLMs, Transformers & Prompt Engineering": "Transformers, Tokenization & Attention (Q/K/V, Context)",
  "LLM API Integration & Function Calling": "Function/Tool Calling + MCP Awareness",
  "Token/Cost Optimization & AI Capstone Demo": "Inference Cost & Latency Ops",
  "Embeddings, Vector Databases & Chunking": "Embeddings, Vector Search, BM25 & Hybrid Retrieval",
  "RAG Evaluation & Hardening": "Chunking, Reranking, Query Transform & HyDE",
  "Autonomous AI Agents & Multi-Tool Workflows": "Agents: ReAct, Planning, Memory, LangGraph, HITL",
  "Git, Linux & Testing Foundations": "Linux, Git & Deployment Foundations",
  "AWS & Production Deployment": "Cloud Deployment: AWS, Nginx, HTTPS, Logging",
  "Observability, Scaling & Kubernetes Basics": "Monitoring, Logging & Observability",
};

// Live tasks kept as-is (downgraded, never deleted) when absent from the spec.
const KEEP_DOWNGRADE: Record<string, { priority: string; minutes: number }> = {
  "Tree Models, SVM & Clustering": { priority: "OPTIONAL", minutes: 90 },
};

async function main() {
  const stats = { roadmapUpdated: 0, roadmapCreated: 0, roadmapDowngraded: 0, gateUpdated: 0, gateCreated: 0, gateDeleted: 0, practiceCreated: 0, practiceSkipped: 0, projectUpdated: 0, projectCreated: 0 };
  const specRoadmap = [...ROADMAP_DSA, ...ROADMAP_SWE, ...ROADMAP_AI, ...ROADMAP_CONSOLIDATION];
  const specByTitle = new Map(specRoadmap.map((t) => [t.title, t]));
  const weeks = await prisma.roadmapWeek.findMany({ select: { id: true, weekNumber: true } });
  const weekId = new Map(weeks.map((w) => [w.weekNumber, w.id]));

  const live = await prisma.roadmapTask.findMany({ select: { id: true, title: true, status: true } });
  const liveByTitle = new Map(live.map((t) => [t.title, t]));
  const consumedSpec = new Set<string>();

  for (const [oldTitle, newTitle] of Object.entries(RENAMES)) {
    const row = liveByTitle.get(oldTitle);
    const spec = specByTitle.get(newTitle);
    if (!row || !spec) { console.log(`RENAME SKIP: ${oldTitle}`); continue; }
    if (row.status === "COMPLETED" || row.status === "PRACTICE") { console.log(`RENAME SKIP (completed, preserving): ${oldTitle}`); continue; }
    await prisma.roadmapTask.update({
      where: { id: row.id },
      data: {
        title: spec.title, category: spec.category, subtopics: JSON.stringify(spec.subtopics),
        estimatedTimeMinutes: spec.minutes, plannedMinutes: spec.minutes,
        practiceReq: spec.practiceReq, priority: spec.priority, track: spec.track,
        difficulty: spec.difficulty, prerequisites: JSON.stringify(spec.prerequisites),
        sitting: spec.block, blockLabel: spec.block,
      },
    });
    consumedSpec.add(newTitle);
    stats.roadmapUpdated++;
  }

  // Direct title matches (no rename).
  for (const row of live) {
    if (Object.keys(RENAMES).includes(row.title)) continue;
    const spec = specByTitle.get(row.title);
    if (!spec) continue;
    if (row.status === "COMPLETED" || row.status === "PRACTICE") { console.log(`KEEP (completed, preserving): ${row.title}`); consumedSpec.add(spec.title); continue; }
    await prisma.roadmapTask.update({
      where: { id: row.id },
      data: {
        category: spec.category, subtopics: JSON.stringify(spec.subtopics),
        estimatedTimeMinutes: spec.minutes, plannedMinutes: spec.minutes,
        practiceReq: spec.practiceReq, priority: spec.priority, track: spec.track,
        difficulty: spec.difficulty, prerequisites: JSON.stringify(spec.prerequisites),
        sitting: spec.block, blockLabel: spec.block,
      },
    });
    consumedSpec.add(spec.title);
    stats.roadmapUpdated++;
  }

  // Downgrades (kept, never deleted).
  for (const [title, d] of Object.entries(KEEP_DOWNGRADE)) {
    const row = liveByTitle.get(title);
    if (!row) continue;
    const spec = specByTitle.get(title);
    if (spec) continue; // already handled above (Eval task is in spec by same title)
    await prisma.roadmapTask.update({
      where: { id: row.id },
      data: { priority: d.priority, estimatedTimeMinutes: d.minutes, plannedMinutes: d.minutes, track: "AI_ENGINEERING", difficulty: "Medium" },
    });
    stats.roadmapDowngraded++;
  }

  // Create missing spec tasks.
  for (const spec of specRoadmap) {
    if (consumedSpec.has(spec.title)) continue;
    if (liveByTitle.get(spec.title)) continue;
    const wid = weekId.get(spec.week);
    if (!wid) { console.log(`NO WEEK ${spec.week} for ${spec.title}`); continue; }
    await prisma.roadmapTask.create({
      data: {
        weekId: wid, title: spec.title, category: spec.category,
        subtopics: JSON.stringify(spec.subtopics), estimatedTimeMinutes: spec.minutes,
        practiceReq: spec.practiceReq, status: "TODO", confidence: 3,
        sitting: spec.block, blockLabel: spec.block, plannedMinutes: spec.minutes,
        actualMinutes: 0, assignedDate: addDays(START, spec.dayOffset),
        priority: spec.priority, track: spec.track, difficulty: spec.difficulty,
        prerequisites: JSON.stringify(spec.prerequisites),
      },
    });
    stats.roadmapCreated++;
  }

  // GATE subjects + topics.
  for (const name of GATE_NEW_SUBJECTS) {
    const ex = await prisma.gateSubject.findUnique({ where: { name } });
    if (!ex) {
      await prisma.gateSubject.create({ data: { name, icon: name === "Digital Logic" ? "Cpu" : "Calculator", totalTopics: 5, totalPYQs: 40 } });
      console.log(`SUBJECT CREATED: ${name}`);
    }
  }
  for (const t of GATE_TOPICS) {
    const subj = await prisma.gateSubject.findUnique({ where: { name: t.subject } });
    if (!subj) { console.log(`NO SUBJECT: ${t.subject}`); continue; }
    const ex = await prisma.gateTopic.findFirst({ where: { subjectId: subj.id, name: t.name } });
    if (ex) {
      await prisma.gateTopic.update({ where: { id: ex.id }, data: { estimatedMinutes: t.minutes, difficulty: t.difficulty, priority: t.priority } });
      stats.gateUpdated++;
    } else {
      await prisma.gateTopic.create({ data: { subjectId: subj.id, name: t.name, completed: false, confidence: 3, estimatedMinutes: t.minutes, difficulty: t.difficulty, priority: t.priority } });
      stats.gateCreated++;
    }
  }
  // Consolidate legacy duplicate subject (only untouched rows).
  const legacy = await prisma.gateSubject.findUnique({ where: { name: GATE_CONSOLIDATED_SUBJECT }, include: { topics: true } });
  if (legacy) {
    for (const top of legacy.topics) {
      const qs = await prisma.gateQuestion.count({ where: { subjectId: legacy.id, topicName: top.name } });
      if (!top.completed && qs === 0) {
        await prisma.gateTopic.delete({ where: { id: top.id } });
        stats.gateDeleted++;
        console.log(`CONSOLIDATED (deleted duplicate): ${top.name}`);
      } else console.log(`KEPT (has progress): ${top.name}`);
    }
    const left = await prisma.gateTopic.count({ where: { subjectId: legacy.id } });
    if (left === 0) {
      const sq = await prisma.gateQuestion.count({ where: { subjectId: legacy.id } });
      if (sq === 0) { await prisma.gateSubject.delete({ where: { id: legacy.id } }); console.log("CONSOLIDATED subject row deleted (empty)"); }
    }
  }

  // Core 100.
  for (const p of CORE100) {
    const ex = await prisma.practiceProblem.findFirst({ where: { title: p.title } });
    if (ex) { stats.practiceSkipped++; continue; }
    await prisma.practiceProblem.create({
      data: { title: p.title, platform: "Core100", category: "DSA", pattern: p.pattern, difficulty: p.difficulty, timeMinutes: p.minutes },
    });
    stats.practiceCreated++;
  }

  // Project tasks.
  for (const t of PROJECT_TASKS) {
    const proj = await prisma.project.findFirst({ where: { name: t.project } });
    if (!proj) { console.log(`NO PROJECT: ${t.project}`); continue; }
    const ex = await prisma.projectTask.findFirst({ where: { projectId: proj.id, title: t.title } });
    if (ex) {
      await prisma.projectTask.update({ where: { id: ex.id }, data: { estimatedMinutes: t.minutes, priority: t.priority } });
      stats.projectUpdated++;
    } else {
      await prisma.projectTask.create({ data: { projectId: proj.id, milestoneStage: t.milestoneStage, title: t.title, completed: false, estimatedMinutes: t.minutes, priority: t.priority } });
      stats.projectCreated++;
    }
  }

  // Leftover check: live roadmap tasks not in spec and not renamed/downgraded.
  const specTitles = new Set(specRoadmap.map((t) => t.title));
  const after = await prisma.roadmapTask.findMany({ select: { title: true, priority: true, status: true } });
  const leftovers = after.filter((t) => !specTitles.has(t.title) && !(t.title in KEEP_DOWNGRADE));
  console.log("LEFTOVER roadmap tasks (kept as-is):", leftovers.map((t) => `${t.title} [${t.priority}/${t.status}]`));

  console.log("SYNC STATS:", JSON.stringify(stats));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
