// Track hubs — shared definitions for /ai-engineering, /software-engineering,
// /dsa and /learn. Views only: every group maps to canonical RoadmapTask /
// PracticeProblem rows by exact title. No duplicate curriculum data lives here.

export type TrackKey = "gate" | "ai" | "swe" | "dsa";

export const TRACK_META: Record<TrackKey, { label: string; short: string; href: string; accent: string }> = {
  gate: { label: "GATE", short: "GATE", href: "/gate", accent: "text-purple-300" },
  ai: { label: "AI Engineering", short: "AI", href: "/ai-engineering", accent: "text-indigo-300" },
  swe: { label: "Software Engineering", short: "SWE", href: "/software-engineering", accent: "text-emerald-300" },
  dsa: { label: "DSA", short: "DSA", href: "/dsa", accent: "text-amber-300" },
};

// ---- AI hub groups (14): exact canonical titles, keyword fallback ----
export interface HubGroupDef {
  key: string;
  label: string;
  titles: string[];
  match: RegExp;
}

export const AI_GROUPS: HubGroupDef[] = [
  { key: "foundations", label: "Foundations", titles: ["ML Foundations for AI Engineering", "Classical Models Reference (Regression → Clustering)", "ML Evaluation, Tuning & Feature Engineering", "Tree Models, SVM & Clustering"], match: /ml foundations|classical models|ml evaluation|tree models/i },
  { key: "deep-learning", label: "Deep Learning", titles: ["Deep Learning Foundations"], match: /deep learning foundations/i },
  { key: "transformers", label: "Transformers + LLMs", titles: ["Transformers, Tokenization & Attention (Q/K/V, Context)"], match: /transformers, tokenization/i },
  { key: "prompt", label: "Prompt + Context", titles: ["Prompting, Context Engineering & Structured Output"], match: /prompting, context engineering/i },
  { key: "finetune", label: "Fine-tuning", titles: ["Fine-Tuning: SFT + LoRA/PEFT"], match: /fine-tuning/i },
  { key: "rag", label: "RAG", titles: ["Embeddings, Vector Search, BM25 & Hybrid Retrieval", "Chunking, Reranking, Query Transform & HyDE"], match: /embeddings, vector search|chunking, reranking/i },
  { key: "rag-eval", label: "RAG Evaluation", titles: ["RAG Evaluation Suite (P@K → Faithfulness → Judge)"], match: /rag evaluation suite/i },
  { key: "agents", label: "Agents", titles: ["Agents: ReAct, Planning, Memory, LangGraph, HITL", "Function/Tool Calling + MCP Awareness"], match: /^agents:|function\/tool calling/i },
  { key: "failure", label: "Failure Engineering", titles: ["Failure Engineering (Hallucination → Latency)"], match: /failure engineering/i },
  { key: "inference", label: "Inference/Performance", titles: ["Inference & Serving Awareness", "Inference Cost & Latency Ops"], match: /inference/i },
  { key: "security", label: "Security/Safety", titles: ["AI Security: Injection, Leakage & Tool Safety"], match: /ai security/i },
  { key: "production", label: "Production AI", titles: ["Production AI Systems (FastAPI → CI/CD → Deploy)"], match: /production ai systems/i },
  { key: "system-design", label: "AI System Design", titles: ["AI System Design & Interview Scenarios"], match: /ai system design/i },
  { key: "interviews", label: "AI Interviews", titles: ["AI System Design & Interview Scenarios"], match: /ai system design/i },
];

// ---- SWE hub groups (15) ----
export const SWE_GROUPS: HubGroupDef[] = [
  { key: "programming", label: "Programming/CS", titles: ["DSA Introduction & Big O Notation", "Arrays Fundamentals & Operations", "Strings & Searching Algorithms", "Basic Sorting Algorithms", "Recursion & Backtracking Foundations", "Linked Lists & Fast/Slow Pointer", "Stack, Queue & Deque", "Hashing, HashMap & Sliding Window", "Binary Trees & BST", "Heaps & Priority Queues", "Graph Algorithms (BFS/DFS/Dijkstra)", "Dynamic Programming Foundations", "Greedy Algorithms & Classic Patterns", "DSA Interview Patterns & Mock Interview", "DSA Pattern Consolidation"], match: /^(dsa |arrays|strings|basic sorting|recursion|linked lists|stack,|hashing|binary trees|heaps|graph algorithms|dynamic programming|greedy algorithms)/i },
  { key: "web", label: "Web/HTTP", titles: ["Web Architecture & HTTP Fundamentals", "Async JS, Event Loop & DOM Survival Kit"], match: /web architecture|async js/i },
  { key: "backend", label: "Backend", titles: ["Backend APIs: REST, Validation, Auth & RBAC"], match: /backend apis/i },
  { key: "postgres", label: "PostgreSQL", titles: ["PostgreSQL Depth: Schema → MVCC → Query Plans", "ORM & Data Modeling (Prisma)"], match: /postgresql depth|^orm &/i },
  { key: "redis", label: "Redis/Queues", titles: ["Redis, Queues, Workers & Eventual Consistency"], match: /redis, queues/i },
  { key: "resilience", label: "API Resilience", titles: ["API Resilience: Rate Limits, Retries, Timeouts"], match: /api resilience/i },
  { key: "testing", label: "Testing", titles: ["Testing Pyramid: Unit → API → Integration → E2E"], match: /testing pyramid/i },
  { key: "linux", label: "Linux/Git", titles: ["Linux, Git & Deployment Foundations"], match: /linux, git/i },
  { key: "docker", label: "Docker", titles: ["Containerization & CI/CD Pipelines"], match: /containerization/i },
  { key: "cicd", label: "CI/CD", titles: ["Final Production Capstone (DevOps)"], match: /final production capstone/i },
  { key: "cloud", label: "Cloud/Deployment", titles: ["Cloud Deployment: AWS, Nginx, HTTPS, Logging", "Master Portfolio Deployment & Interview Revision"], match: /cloud deployment|master portfolio/i },
  { key: "observability", label: "Observability", titles: ["Monitoring, Logging & Observability"], match: /monitoring, logging/i },
  { key: "distributed", label: "Distributed Systems", titles: [], match: /$^/ }, // lens group: links only, no owned tasks
  { key: "sysdesign", label: "System Design", titles: ["System Design Core (Interviews)"], match: /system design core/i },
  { key: "prodeng", label: "Production Engineering", titles: ["Master Portfolio Deployment & Interview Revision"], match: /master portfolio/i },
];

// Links shown inside the Distributed Systems lens (canonical task ids resolved server-side by title).
export const DISTRIBUTED_LINK_TITLES = [
  "Redis, Queues, Workers & Eventual Consistency",
  "API Resilience: Rate Limits, Retries, Timeouts",
  "PostgreSQL Depth: Schema → MVCC → Query Plans",
];

// ---- DSA pattern order (spec sequence; DB patterns fold in) ----
export interface DsaPatternDef {
  key: string;
  label: string;
  dbPatterns: string[];
}

export const DSA_PATTERNS: DsaPatternDef[] = [
  { key: "arrays-hashing", label: "Arrays/Hashing", dbPatterns: ["Arrays", "Hashing"] },
  { key: "two-pointers", label: "Two Pointers", dbPatterns: ["Two Pointers"] },
  { key: "sliding-window", label: "Sliding Window", dbPatterns: ["Sliding Window", "Prefix Sums"] },
  { key: "stack", label: "Stack", dbPatterns: ["Stacks"] },
  { key: "binary-search", label: "Binary Search", dbPatterns: ["Binary Search"] },
  { key: "linked-list", label: "Linked List", dbPatterns: ["Linked Lists"] },
  { key: "trees", label: "Trees", dbPatterns: ["Trees"] },
  { key: "bst", label: "BST", dbPatterns: ["BST"] },
  { key: "heap", label: "Heap", dbPatterns: ["Heaps"] },
  { key: "backtracking", label: "Backtracking", dbPatterns: ["Backtracking"] },
  { key: "trie", label: "Trie", dbPatterns: ["Trie"] },
  { key: "graphs", label: "Graphs", dbPatterns: ["BFS/DFS"] },
  { key: "topo", label: "Topological Sort", dbPatterns: ["Topo/Union-Find"] },
  { key: "union-find", label: "Union Find", dbPatterns: ["Topo/Union-Find"] },
  { key: "shortest-path", label: "Shortest Path", dbPatterns: ["Shortest Paths"] },
  { key: "greedy", label: "Greedy", dbPatterns: ["Greedy"] },
  { key: "intervals", label: "Intervals", dbPatterns: ["Intervals"] },
  { key: "dp1d", label: "1D DP", dbPatterns: ["DP-1D"] },
  { key: "dp2d", label: "2D DP", dbPatterns: ["DP-2D"] },
  { key: "bit", label: "Bit Manipulation", dbPatterns: ["Bit Manipulation"] },
  { key: "strings", label: "Strings", dbPatterns: ["Strings"] },
  { key: "queues", label: "Queues", dbPatterns: ["Queues"] },
  { key: "mock", label: "Mixed Mocks", dbPatterns: ["Mock-Mixed"] },
];

// ---- competency derivation (honest mapping from canonical statuses) ----
// TODO → Understand · IN_PROGRESS → Build · PRACTICE/REVISION → Evaluate ·
// COMPLETED → Interview-ready · NEEDS_REVISIT anywhere → Failure-repair flag.
const STAGE_RANK: Record<string, number> = {
  TODO: 0, IN_PROGRESS: 1, PRACTICE: 2, REVISION: 2, NEEDS_REVISIT: 2, COMPLETED: 3,
};

export const COMPETENCY = ["Understand", "Build", "Evaluate", "Interview-ready"] as const;

export function groupStage(statuses: string[]): { stage: (typeof COMPETENCY)[number]; needsRepair: boolean } {
  let rank = 0;
  for (const s of statuses) rank = Math.max(rank, STAGE_RANK[s] ?? 0);
  return {
    stage: COMPETENCY[Math.min(3, rank)],
    needsRepair: statuses.includes("NEEDS_REVISIT"),
  };
}

export function readinessLabel(solvedPct: number): string {
  if (solvedPct >= 80) return "Interview-ready";
  if (solvedPct >= 50) return "Building";
  if (solvedPct > 0) return "Foundations";
  return "Not started";
}

// ---- Today badges: derive track from plan item (prefers stored track) ----
export interface PlanItemLike {
  kind: string;
  track?: string;
  detail?: string;
  subjectName?: string;
  title: string;
}

const AI_HINT = /(generative ai|\bml\b|rag|ai agents|transformer|llm|embedding|prompt|agent|hugging|langchain|vector|diffusion|pytorch)/i;
const DSA_HINT = /(dsa|array|linked list|tree\b|bst|heap|graph|dynamic programming|recursion|sorting|binary search|sliding window|two pointers|backtracking|trie|greedy|intervals|bit manip|stack|queue|hashing)/i;

export function trackOfPlanItem(item: PlanItemLike): TrackKey {
  if (item.track === "GATE" || item.track === "GATE_PREP") return "gate";
  if (item.track === "AI_ENGINEERING") return "ai";
  if (item.track === "DSA") return "dsa";
  if (item.track === "SOFTWARE_ENGINEERING") {
    const hay = `${item.detail ?? ""} ${item.title}`;
    if (AI_HINT.test(hay)) return "ai";
    if (/(dsa|core 100|neetcode|striver)/i.test(hay) || (item.kind === "ROADMAP" && DSA_HINT.test(item.title))) return "dsa";
    return "swe";
  }
  if (item.kind === "GATE") return "gate";
  if (item.kind === "PRACTICE") {
    const hay = `${item.detail ?? ""} ${item.title}`;
    return /gate|pyq/i.test(hay) ? "gate" : "dsa";
  }
  if (item.kind === "PROJECT") {
    const hay = `${item.detail ?? ""} ${item.title}`;
    return AI_HINT.test(hay) ? "ai" : "swe";
  }
  if (item.kind === "REVISION" || item.kind === "BACKLOG" || item.kind === "CUSTOM") {
    const hay = `${item.detail ?? ""} ${item.subjectName ?? ""} ${item.title}`;
    if (/gate|pyq|dbms|\bos\b|cn\b|toc|compiler|discrete/i.test(hay)) return "gate";
    if (AI_HINT.test(hay)) return "ai";
    if (DSA_HINT.test(hay)) return "dsa";
    return "swe";
  }
  // ROADMAP without stored track: derive from detail/category text.
  const hay = `${item.detail ?? ""} ${item.title}`;
  if (AI_HINT.test(hay)) return "ai";
  if (DSA_HINT.test(hay)) return "dsa";
  return "swe";
}
