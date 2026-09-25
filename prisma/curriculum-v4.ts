// StudyForge Curriculum V4 — Jan-15 feasibility pruning.
//
// Window: Sep 24, 2026 → Jan 15, 2027 (114 calendar days).
// Capacity model: 6h NORMAL floor / 7h GOOD / 8h STRETCH (114×6 = 684h).
// Budgets (focused CORE hours): GATE 320h / AI 175h / DSA 90h / SWE 55h ≈ 640h.
//
// Tiers: CORE (must complete) / IMPORTANT (first-pass + PYQ) / OPTIONAL (awareness only).
// GATE A/B/C maps to CORE/IMPORTANT/OPTIONAL — every official topic stays represented.
// Tables reused: RoadmapTask, GateSubject, GateTopic, PracticeProblem, ProjectTask.
// Nothing is ever deleted by the sync script — pruned items become OPTIONAL.
//
// Resource mapping: Amit Shekhar AI Eng (AI backbone), HF LLM/Agents (supplement),
// Striver A2Z (DSA reference), NeetCode 150 (supplement), Core 100 (primary DSA set),
// roadmap.sh Backend/SysDesign/Docker/Postgres/Redis/AWS (SWE supplement),
// official IIT Madras GATE 2027 syllabus + official PYQs (GATE canonical).

export type Tier = "CORE" | "IMPORTANT" | "OPTIONAL";

export interface SpecTask {
  week: number;
  title: string;
  category: string;
  subtopics: string[];
  minutes: number;
  practiceReq: string;
  priority: Tier;
  track: "AI_ENGINEERING" | "SOFTWARE_ENGINEERING" | "GATE_PREP" | "DSA";
  difficulty: "Easy" | "Medium" | "Hard";
  prerequisites: string[];
  block: string;
  dayOffset: number; // days after Sep 24 (seed assigns dates; sync never moves dates)
}

export interface SpecGateTopic {
  subject: string;
  name: string;
  minutes: number; // concept + PYQ + error repair + revision share
  difficulty: "Easy" | "Medium" | "Hard";
  priority: Tier; // A=CORE, B=IMPORTANT, C=OPTIONAL
}

export interface SpecProblem {
  title: string;
  pattern: string;
  difficulty: "Easy" | "Medium" | "Hard";
  minutes: number;
}

export interface SpecProjectTask {
  project: string;
  milestoneStage: string;
  title: string;
  minutes: number;
  priority: Tier;
}

// ---------------- GATE: official syllabus, A/B/C tiers ----------------
// minutes bundle LEARN → PYQ → ERROR → REVISE per topic (pre-Jan-15).

export const GATE_NEW_SUBJECTS = ["Digital Logic", "Engineering Mathematics"];

export const GATE_TOPICS: SpecGateTopic[] = [
  // General Aptitude (B)
  { subject: "General Aptitude", name: "Numerical Computation & Quant", minutes: 300, difficulty: "Medium", priority: "CORE" },
  { subject: "General Aptitude", name: "Verbal Reasoning", minutes: 300, difficulty: "Medium", priority: "CORE" },
  { subject: "General Aptitude", name: "GA PYQ Drill + Error Repair", minutes: 180, difficulty: "Medium", priority: "IMPORTANT" },
  // Discrete Mathematics (A, groups C)
  { subject: "Discrete Mathematics", name: "Propositional and First Order Logic", minutes: 480, difficulty: "Hard", priority: "CORE" },
  { subject: "Discrete Mathematics", name: "Sets, Relations, Functions, Partial Orders", minutes: 420, difficulty: "Medium", priority: "CORE" },
  { subject: "Discrete Mathematics", name: "Monoids, Groups, Lattice", minutes: 180, difficulty: "Hard", priority: "OPTIONAL" },
  { subject: "Discrete Mathematics", name: "Graph Theory: Connectivity, Coloring, Matching", minutes: 420, difficulty: "Medium", priority: "CORE" },
  { subject: "Discrete Mathematics", name: "Combinatorics & Generating Functions", minutes: 480, difficulty: "Hard", priority: "CORE" },
  { subject: "Discrete Mathematics", name: "Discrete Math PYQ Drill + Error Repair", minutes: 240, difficulty: "Medium", priority: "IMPORTANT" },
  // Digital Logic (A-)
  { subject: "Digital Logic", name: "Boolean Algebra & Minimization (K-Map)", minutes: 360, difficulty: "Medium", priority: "CORE" },
  { subject: "Digital Logic", name: "Combinational Circuits (Mux, Decoder, PLA)", minutes: 360, difficulty: "Medium", priority: "CORE" },
  { subject: "Digital Logic", name: "Sequential Circuits (Flip-Flops, Counters, Registers)", minutes: 300, difficulty: "Hard", priority: "CORE" },
  { subject: "Digital Logic", name: "Number Systems & Computer Arithmetic", minutes: 240, difficulty: "Easy", priority: "IMPORTANT" },
  { subject: "Digital Logic", name: "Digital Logic PYQ Drill + Error Repair", minutes: 180, difficulty: "Medium", priority: "IMPORTANT" },
  // Computer Organization / Architecture (A-)
  { subject: "Computer Organization / Architecture", name: "Machine Instructions & Addressing Modes", minutes: 300, difficulty: "Medium", priority: "CORE" },
  { subject: "Computer Organization / Architecture", name: "ALU, Data Path & Control Unit", minutes: 360, difficulty: "Hard", priority: "CORE" },
  { subject: "Computer Organization / Architecture", name: "Memory Hierarchy & Cache Organization", minutes: 420, difficulty: "Hard", priority: "CORE" },
  { subject: "Computer Organization / Architecture", name: "Pipelining & I/O Organization", minutes: 300, difficulty: "Medium", priority: "IMPORTANT" },
  { subject: "Computer Organization / Architecture", name: "COA PYQ Drill + Error Repair", minutes: 180, difficulty: "Medium", priority: "IMPORTANT" },
  // Data Structures (A)
  { subject: "Data Structures", name: "Arrays, Stacks, Queues, Linked Lists", minutes: 360, difficulty: "Medium", priority: "CORE" },
  { subject: "Data Structures", name: "Trees: Binary Trees, Binary Search Trees", minutes: 420, difficulty: "Medium", priority: "CORE" },
  { subject: "Data Structures", name: "Heaps and Priority Queues", minutes: 300, difficulty: "Medium", priority: "CORE" },
  { subject: "Data Structures", name: "Hashing & Collision Resolution", minutes: 240, difficulty: "Medium", priority: "CORE" },
  { subject: "Data Structures", name: "Graph Representations & Traversals", minutes: 300, difficulty: "Medium", priority: "CORE" },
  { subject: "Data Structures", name: "DS PYQ Drill + Error Repair", minutes: 240, difficulty: "Medium", priority: "IMPORTANT" },
  // Algorithms (A)
  { subject: "Algorithms", name: "Asymptotic Time & Space Complexity", minutes: 300, difficulty: "Medium", priority: "CORE" },
  { subject: "Algorithms", name: "Divide and Conquer: Searching & Sorting", minutes: 360, difficulty: "Medium", priority: "CORE" },
  { subject: "Algorithms", name: "Greedy Algorithms & Dynamic Programming", minutes: 540, difficulty: "Hard", priority: "CORE" },
  { subject: "Algorithms", name: "Graph Traversal, Minimum Spanning Trees, Shortest Path", minutes: 420, difficulty: "Hard", priority: "CORE" },
  { subject: "Algorithms", name: "Algorithms PYQ Drill + Error Repair", minutes: 240, difficulty: "Medium", priority: "IMPORTANT" },
  // Theory of Computation (A-)
  { subject: "Theory of Computation", name: "Regular Expressions & Finite Automata", minutes: 420, difficulty: "Medium", priority: "CORE" },
  { subject: "Theory of Computation", name: "Context-Free Grammars & Pushdown Automata", minutes: 420, difficulty: "Hard", priority: "CORE" },
  { subject: "Theory of Computation", name: "Turing Machines & Undecidability", minutes: 360, difficulty: "Hard", priority: "CORE" },
  { subject: "Theory of Computation", name: "TOC PYQ Drill + Error Repair", minutes: 180, difficulty: "Medium", priority: "IMPORTANT" },
  // Compiler Design (B/C)
  { subject: "Compiler Design", name: "Lexical Analysis & Parsing", minutes: 480, difficulty: "Hard", priority: "CORE" },
  { subject: "Compiler Design", name: "Syntax-Directed Translation & Code Generation", minutes: 240, difficulty: "Hard", priority: "OPTIONAL" },
  { subject: "Compiler Design", name: "Compiler PYQ Drill + Error Repair", minutes: 120, difficulty: "Medium", priority: "IMPORTANT" },
  // Operating Systems (A, files C)
  { subject: "Operating Systems", name: "Processes, Threads, CPU Scheduling", minutes: 420, difficulty: "Medium", priority: "CORE" },
  { subject: "Operating Systems", name: "Process Synchronization & Deadlocks", minutes: 480, difficulty: "Hard", priority: "CORE" },
  { subject: "Operating Systems", name: "Memory Management & Virtual Memory", minutes: 420, difficulty: "Hard", priority: "CORE" },
  { subject: "Operating Systems", name: "File Systems & I/O Systems", minutes: 180, difficulty: "Medium", priority: "OPTIONAL" },
  { subject: "Operating Systems", name: "OS PYQ Drill + Error Repair", minutes: 240, difficulty: "Medium", priority: "IMPORTANT" },
  // DBMS (A, files B)
  { subject: "DBMS", name: "ER-Model & Relational Algebra", minutes: 480, difficulty: "Medium", priority: "CORE" },
  { subject: "DBMS", name: "SQL Queries & Constraints", minutes: 420, difficulty: "Medium", priority: "CORE" },
  { subject: "DBMS", name: "Normalization (1NF, 2NF, 3NF, BCNF)", minutes: 420, difficulty: "Hard", priority: "CORE" },
  { subject: "DBMS", name: "Transactions & Concurrency Control", minutes: 480, difficulty: "Hard", priority: "CORE" },
  { subject: "DBMS", name: "B and B+ Trees Indexing", minutes: 300, difficulty: "Medium", priority: "IMPORTANT" },
  { subject: "DBMS", name: "DBMS PYQ Drill + Error Repair", minutes: 240, difficulty: "Medium", priority: "IMPORTANT" },
  // Computer Networks (A-)
  { subject: "Computer Networks", name: "OSI & TCP/IP Protocol Stack", minutes: 300, difficulty: "Easy", priority: "CORE" },
  { subject: "Computer Networks", name: "Data Link Layer & Flow Control", minutes: 360, difficulty: "Medium", priority: "CORE" },
  { subject: "Computer Networks", name: "IP Addressing & Subnetting", minutes: 360, difficulty: "Medium", priority: "CORE" },
  { subject: "Computer Networks", name: "Routing, TCP/UDP & Application Layer", minutes: 300, difficulty: "Medium", priority: "CORE" },
  { subject: "Computer Networks", name: "CN PYQ Drill + Error Repair", minutes: 180, difficulty: "Medium", priority: "IMPORTANT" },
  // Engineering Mathematics (A-)
  { subject: "Engineering Mathematics", name: "Linear Algebra (Rank, Eigenvalues, Systems)", minutes: 420, difficulty: "Medium", priority: "CORE" },
  { subject: "Engineering Mathematics", name: "Calculus (Limits, Continuity, Maxima, Integration)", minutes: 360, difficulty: "Medium", priority: "CORE" },
  { subject: "Engineering Mathematics", name: "Probability & Statistics (Distributions, Bayes)", minutes: 480, difficulty: "Medium", priority: "CORE" },
  { subject: "Engineering Mathematics", name: "Math PYQ Drill + Error Repair", minutes: 180, difficulty: "Medium", priority: "IMPORTANT" },
];
// NOTE: legacy "Probability & Statistics" subject rows (2 topics) are CONSOLIDATED
// into Engineering Mathematics (same official coverage, single canonical row).
// The sync script deletes exactly those 2 untouched duplicate rows — nothing else.
export const GATE_CONSOLIDATED_SUBJECT = "Probability & Statistics";

// ---------------- ROADMAP: DSA primers (Core-100 companions) ----------------
// Pattern primers stay CORE at 45–90m; Striver A2Z = reference, Core 100 = the set.
// Advanced topics (segment/Fenwick/HLD/suffix/max-flow/geometry) intentionally absent.

export const ROADMAP_DSA: SpecTask[] = [
  { week: 1, title: "DSA Introduction & Big O Notation", category: "DSA", subtopics: ["What is DSA?", "Time & Space Complexity", "Big O, Omega, Theta"], minutes: 60, practiceReq: "Analyze 5 snippets (Striver reference); Core 100 warm-up ×3", priority: "CORE", track: "DSA", difficulty: "Easy", prerequisites: [], block: "Block 1", dayOffset: 0 },
  { week: 1, title: "Arrays Fundamentals & Operations", category: "DSA", subtopics: ["Traversal, insertion, deletion", "Two Pointers baseline", "Prefix sums"], minutes: 45, practiceReq: "Core 100 arrays ×6", priority: "CORE", track: "DSA", difficulty: "Easy", prerequisites: ["DSA Introduction & Big O Notation"], block: "Block 2", dayOffset: 0 },
  { week: 1, title: "Strings & Searching Algorithms", category: "DSA", subtopics: ["String manipulation", "Binary Search patterns", "Rotated array search"], minutes: 45, practiceReq: "Core 100 strings/binary-search ×6", priority: "CORE", track: "DSA", difficulty: "Easy", prerequisites: ["Arrays Fundamentals & Operations"], block: "Block 1", dayOffset: 1 },
  { week: 1, title: "Basic Sorting Algorithms", category: "DSA", subtopics: ["Merge/Quick Sort", "Sorting complexity narration"], minutes: 45, practiceReq: "Implement Merge + Quick from memory", priority: "CORE", track: "DSA", difficulty: "Easy", prerequisites: ["DSA Introduction & Big O Notation"], block: "Block 2", dayOffset: 2 },
  { week: 2, title: "Recursion & Backtracking Foundations", category: "DSA", subtopics: ["Call stack & base cases", "Subsets/permutations", "N-Queens intuition"], minutes: 60, practiceReq: "Core 100 recursion/backtracking ×5", priority: "CORE", track: "DSA", difficulty: "Medium", prerequisites: ["DSA Introduction & Big O Notation"], block: "Block 1", dayOffset: 7 },
  { week: 2, title: "Linked Lists & Fast/Slow Pointer", category: "DSA", subtopics: ["Singly/doubly LL", "Cycle detection", "Reverse LL"], minutes: 45, practiceReq: "Core 100 linked-list ×5", priority: "CORE", track: "DSA", difficulty: "Medium", prerequisites: ["Arrays Fundamentals & Operations"], block: "Block 2", dayOffset: 8 },
  { week: 2, title: "Stack, Queue & Deque", category: "DSA", subtopics: ["Monotonic stack awareness", "Next Greater Element", "Queue/Deque patterns"], minutes: 45, practiceReq: "Core 100 stack/queue ×5", priority: "CORE", track: "DSA", difficulty: "Medium", prerequisites: ["Arrays Fundamentals & Operations"], block: "Block 3", dayOffset: 9 },
  { week: 3, title: "Hashing, HashMap & Sliding Window", category: "DSA", subtopics: ["Frequency counting", "Fixed/variable sliding window"], minutes: 45, practiceReq: "Core 100 hashing/sliding-window ×6", priority: "CORE", track: "DSA", difficulty: "Medium", prerequisites: ["Arrays Fundamentals & Operations"], block: "Block 1", dayOffset: 14 },
  { week: 3, title: "Binary Trees & BST", category: "DSA", subtopics: ["DFS/BFS traversals", "BST validation", "LCA"], minutes: 45, practiceReq: "Core 100 trees/BST ×6", priority: "CORE", track: "DSA", difficulty: "Medium", prerequisites: ["Recursion & Backtracking Foundations"], block: "Block 2", dayOffset: 16 },
  { week: 3, title: "Heaps & Priority Queues", category: "DSA", subtopics: ["Heapify", "Top-K patterns"], minutes: 45, practiceReq: "Core 100 heaps ×4", priority: "CORE", track: "DSA", difficulty: "Medium", prerequisites: ["Binary Trees & BST"], block: "Block 3", dayOffset: 18 },
  { week: 4, title: "Graph Algorithms (BFS/DFS/Dijkstra)", category: "DSA", subtopics: ["BFS/DFS", "Topological sort", "Union-Find", "Dijkstra/shortest paths", "MST awareness (Kruskal/Prim)"], minutes: 60, practiceReq: "Core 100 graphs ×8", priority: "CORE", track: "DSA", difficulty: "Hard", prerequisites: ["Binary Trees & BST", "Stack, Queue & Deque"], block: "Block 1", dayOffset: 21 },
  { week: 4, title: "Dynamic Programming Foundations", category: "DSA", subtopics: ["Memoization vs tabulation", "1D DP (Climb/Rob/Kadane)", "2D DP (LCS, paths)", "Bit manipulation"], minutes: 60, practiceReq: "Core 100 DP ×8 + bit manipulation ×2", priority: "CORE", track: "DSA", difficulty: "Hard", prerequisites: ["Recursion & Backtracking Foundations"], block: "Block 2", dayOffset: 24 },
  { week: 4, title: "Greedy Algorithms & Classic Patterns", category: "DSA", subtopics: ["Greedy choice", "Intervals", "Trie"], minutes: 45, practiceReq: "Core 100 greedy/intervals/trie ×6", priority: "CORE", track: "DSA", difficulty: "Medium", prerequisites: ["Basic Sorting Algorithms"], block: "Block 3", dayOffset: 26 },
  { week: 4, title: "DSA Interview Patterns & Mock Interview", category: "DSA", subtopics: ["Pattern recall drill", "Timed mock", "Explain-out-loud"], minutes: 90, practiceReq: "Re-solve 10 flagged Core-100; 1 timed mock", priority: "CORE", track: "DSA", difficulty: "Hard", prerequisites: ["Dynamic Programming Foundations", "Graph Algorithms (BFS/DFS/Dijkstra)"], block: "Block 4", dayOffset: 27 },
];

// ---------------- ROADMAP: SWE (pruned basics, backend depth) ----------------
// Full-stack experience assumed: HTML/CSS/JS-basics/React-basics → OPTIONAL.
// CORE = backend + Postgres + distributed/production + testing + system design.

export const ROADMAP_SWE: SpecTask[] = [
  { week: 5, title: "Web Architecture & HTTP Fundamentals", category: "Full Stack", subtopics: ["DNS/TCP/IP/browser", "HTTP methods/headers/status", "REST constraints"], minutes: 60, practiceReq: "Design a REST resource map (roadmap.sh Backend supplement)", priority: "IMPORTANT", track: "SOFTWARE_ENGINEERING", difficulty: "Easy", prerequisites: [], block: "Block 1", dayOffset: 28 },
  { week: 5, title: "Modern JavaScript & TypeScript Essentials", category: "Full Stack", subtopics: ["ES6+ idioms", "Async/await", "TS types for APIs"], minutes: 60, practiceReq: "Type 3 API contracts in TS", priority: "OPTIONAL", track: "SOFTWARE_ENGINEERING", difficulty: "Easy", prerequisites: [], block: "Block 2", dayOffset: 31 },
  { week: 6, title: "Async JS, Event Loop & DOM Survival Kit", category: "Full Stack", subtopics: ["Event loop micro/macro", "Promises", "Minimal DOM for debugging"], minutes: 90, practiceReq: "Explain event-loop ordering ×5", priority: "IMPORTANT", track: "SOFTWARE_ENGINEERING", difficulty: "Medium", prerequisites: [], block: "Block 1", dayOffset: 35 },
  { week: 6, title: "React Working Knowledge (Experienced Fast-Pass)", category: "Full Stack", subtopics: ["Hooks mental model", "Data fetching patterns"], minutes: 60, practiceReq: "Ship one data-driven view", priority: "OPTIONAL", track: "SOFTWARE_ENGINEERING", difficulty: "Easy", prerequisites: [], block: "Block 2", dayOffset: 38 },
  { week: 7, title: "Backend APIs: REST, Validation, Auth & RBAC", category: "Full Stack", subtopics: ["REST design", "Input validation", "JWT auth", "Authorization & RBAC", "Pagination", "Idempotency"], minutes: 300, practiceReq: "Build auth + RBAC + pagination API", priority: "CORE", track: "SOFTWARE_ENGINEERING", difficulty: "Hard", prerequisites: ["Web Architecture & HTTP Fundamentals"], block: "Block 1", dayOffset: 42 },
  { week: 7, title: "PostgreSQL Depth: Schema → MVCC → Query Plans", category: "Full Stack", subtopics: ["Schema design", "Indexes", "Joins", "Transactions & isolation", "Locks & MVCC", "EXPLAIN plans", "Pooling", "Migrations"], minutes: 480, practiceReq: "Schema + index + isolation lab (roadmap.sh PostgreSQL)", priority: "CORE", track: "SOFTWARE_ENGINEERING", difficulty: "Hard", prerequisites: ["Backend APIs: REST, Validation, Auth & RBAC"], block: "Block 2", dayOffset: 45 },
  { week: 7, title: "API Resilience: Rate Limits, Retries, Timeouts", category: "Full Stack", subtopics: ["Rate limiting", "Retries/backoff", "Timeouts & circuit breaker"], minutes: 120, practiceReq: "Add rate-limit + retry harness to auth API", priority: "CORE", track: "SOFTWARE_ENGINEERING", difficulty: "Medium", prerequisites: ["Backend APIs: REST, Validation, Auth & RBAC"], block: "Block 3", dayOffset: 47 },
  { week: 7, title: "ORM & Data Modeling (Prisma)", category: "Full Stack", subtopics: ["Prisma schema/migrations", "Relations & modeling"], minutes: 90, practiceReq: "Model one domain with migrations", priority: "IMPORTANT", track: "SOFTWARE_ENGINEERING", difficulty: "Medium", prerequisites: ["PostgreSQL Depth: Schema → MVCC → Query Plans"], block: "Block 3", dayOffset: 47 },
  { week: 8, title: "Redis, Queues, Workers & Eventual Consistency", category: "Full Stack", subtopics: ["Redis caching", "Queues & workers", "Retries & DLQ", "Eventual consistency"], minutes: 360, practiceReq: "Queue-backed worker (roadmap.sh Redis)", priority: "CORE", track: "SOFTWARE_ENGINEERING", difficulty: "Hard", prerequisites: ["PostgreSQL Depth: Schema → MVCC → Query Plans"], block: "Block 1", dayOffset: 49 },
  { week: 8, title: "Testing Pyramid: Unit → API → Integration → E2E", category: "Full Stack", subtopics: ["Unit", "API contract", "Integration", "E2E smoke", "Regression"], minutes: 240, practiceReq: "Green suite for auth API", priority: "CORE", track: "SOFTWARE_ENGINEERING", difficulty: "Medium", prerequisites: ["Backend APIs: REST, Validation, Auth & RBAC"], block: "Block 2", dayOffset: 52 },
  { week: 12, title: "Linux, Git & Deployment Foundations", category: "DevOps", subtopics: ["Linux essentials & shell", "Git workflows", "Env/config management"], minutes: 240, practiceReq: "Repo with CI-ready config", priority: "CORE", track: "SOFTWARE_ENGINEERING", difficulty: "Medium", prerequisites: [], block: "Block 3", dayOffset: 78 },
  { week: 12, title: "Containerization & CI/CD Pipelines", category: "DevOps", subtopics: ["Multi-stage Dockerfile", "Compose services", "GitHub Actions CI/CD"], minutes: 240, practiceReq: "Containerize auth API + CI (roadmap.sh Docker/AWS)", priority: "CORE", track: "SOFTWARE_ENGINEERING", difficulty: "Medium", prerequisites: ["Linux, Git & Deployment Foundations"], block: "Block 2", dayOffset: 80 },
  { week: 12, title: "Cloud Deployment: AWS, Nginx, HTTPS, Logging", category: "DevOps", subtopics: ["EC2/S3/IAM basics", "Nginx + DNS + HTTPS", "Structured logging"], minutes: 240, practiceReq: "Deploy behind HTTPS with logs", priority: "CORE", track: "SOFTWARE_ENGINEERING", difficulty: "Hard", prerequisites: ["Containerization & CI/CD Pipelines"], block: "Block 4", dayOffset: 81 },
  { week: 12, title: "Monitoring, Logging & Observability", category: "DevOps", subtopics: ["Metrics/logs/traces", "Alerts & dashboards", "K8s awareness (Pods/Deployments/Services)"], minutes: 240, practiceReq: "Add health metrics + alert rule", priority: "CORE", track: "SOFTWARE_ENGINEERING", difficulty: "Medium", prerequisites: ["Cloud Deployment: AWS, Nginx, HTTPS, Logging"], block: "Block 5", dayOffset: 82 },
  { week: 13, title: "System Design Core (Interviews)", category: "Full Stack", subtopics: ["Scalability/availability", "Caching & queues", "DB choices", "Rate limiting", "Security & cost trade-offs"], minutes: 360, practiceReq: "3 design reps: URL shortener, feed, rate limiter", priority: "CORE", track: "SOFTWARE_ENGINEERING", difficulty: "Hard", prerequisites: ["Redis, Queues, Workers & Eventual Consistency", "PostgreSQL Depth: Schema → MVCC → Query Plans"], block: "Block 2", dayOffset: 87 },
];

// ---------------- ROADMAP: AI Engineering (Amit Shekhar backbone, pruned) ----------------
// 71-item CORE (understand → build → failure → evaluate → interview).
// IMPORTANT = serving-depth explanations; OPTIONAL = awareness only, never core capacity.

export const ROADMAP_AI: SpecTask[] = [
  { week: 9, title: "ML Foundations for AI Engineering", category: "ML", subtopics: ["ML workflow", "Preprocessing & feature engineering", "Model selection", "Evaluation & CV", "Overfitting control"], minutes: 540, practiceReq: "Preprocess + select + evaluate one dataset end-to-end", priority: "CORE", track: "AI_ENGINEERING", difficulty: "Medium", prerequisites: [], block: "Block 1", dayOffset: 56 },
  { week: 9, title: "Classical Models Reference (Regression → Clustering)", category: "ML", subtopics: ["Linear/logistic regression", "Trees/forests/SVM/KNN", "K-Means"], minutes: 180, practiceReq: "Compare 3 models on one dataset", priority: "IMPORTANT", track: "AI_ENGINEERING", difficulty: "Medium", prerequisites: [], block: "Block 2", dayOffset: 59 },
  { week: 9, title: "Deep Learning Foundations", category: "ML", subtopics: ["MLP & backprop intuition", "Optimizers", "Regularization", "CNN/RNN awareness"], minutes: 480, practiceReq: "Train MLP; explain backprop without notes", priority: "CORE", track: "AI_ENGINEERING", difficulty: "Hard", prerequisites: ["ML Foundations for AI Engineering"], block: "Block 3", dayOffset: 61 },
  { week: 9, title: "ML Evaluation, Tuning & Feature Engineering", category: "ML", subtopics: ["Metrics & ablations", "Hyperparameter tuning", "Feature pipelines", "FastAPI serving"], minutes: 360, practiceReq: "Tune + serve one model via FastAPI", priority: "CORE", track: "AI_ENGINEERING", difficulty: "Medium", prerequisites: ["ML Foundations for AI Engineering"], block: "Block 4", dayOffset: 62 },
  { week: 10, title: "Transformers, Tokenization & Attention (Q/K/V, Context)", category: "Generative AI", subtopics: ["Tokenization", "Embeddings intro", "Attention & Q/K/V", "Transformer blocks", "Context windows", "LLM generation"], minutes: 540, practiceReq: "Diagram + narrate a forward pass (HF reference)", priority: "CORE", track: "AI_ENGINEERING", difficulty: "Hard", prerequisites: ["Deep Learning Foundations"], block: "Block 1", dayOffset: 63 },
  { week: 10, title: "Prompting, Context Engineering & Structured Output", category: "Generative AI", subtopics: ["System/few-shot prompting", "Context engineering", "Structured JSON outputs", "Model APIs & behavior"], minutes: 420, practiceReq: "Prompt benchmark suite ×10 cases", priority: "CORE", track: "AI_ENGINEERING", difficulty: "Medium", prerequisites: ["Transformers, Tokenization & Attention (Q/K/V, Context)"], block: "Block 2", dayOffset: 65 },
  { week: 10, title: "Function/Tool Calling + MCP Awareness", category: "Generative AI", subtopics: ["Tool schemas", "Structured tool use", "External APIs", "MCP awareness", "Conversation memory"], minutes: 360, practiceReq: "Chatbot v1 with 3 tools + streaming", priority: "CORE", track: "AI_ENGINEERING", difficulty: "Medium", prerequisites: ["Prompting, Context Engineering & Structured Output"], block: "Block 2", dayOffset: 66 },
  { week: 10, title: "Fine-Tuning: SFT + LoRA/PEFT", category: "Generative AI", subtopics: ["SFT", "LoRA/PEFT", "Eval before/after", "DPO/GRPO/distillation awareness"], minutes: 480, practiceReq: "LoRA-fine-tune small model + eval delta", priority: "CORE", track: "AI_ENGINEERING", difficulty: "Hard", prerequisites: ["Transformers, Tokenization & Attention (Q/K/V, Context)"], block: "Block 3", dayOffset: 68 },
  { week: 10, title: "Inference Cost & Latency Ops", category: "Generative AI", subtopics: ["Token/cost optimization", "Model routing & fallbacks", "Retries", "Caching & batching", "Rate limiting"], minutes: 420, practiceReq: "Ship cost report + fallback demo", priority: "CORE", track: "AI_ENGINEERING", difficulty: "Medium", prerequisites: ["Function/Tool Calling + MCP Awareness"], block: "Block 3", dayOffset: 68 },
  { week: 11, title: "Embeddings, Vector Search, BM25 & Hybrid Retrieval", category: "RAG", subtopics: ["Embeddings & cosine similarity", "Semantic search", "Vector DBs (Chroma/Pinecone)", "BM25", "Hybrid retrieval", "Metadata filtering"], minutes: 480, practiceReq: "Hybrid search notebook (HF + Chroma)", priority: "CORE", track: "AI_ENGINEERING", difficulty: "Hard", prerequisites: ["Transformers, Tokenization & Attention (Q/K/V, Context)"], block: "Block 1", dayOffset: 70 },
  { week: 11, title: "Chunking, Reranking, Query Transform & HyDE", category: "RAG", subtopics: ["Chunking strategy", "Reranking", "Query transformation", "HyDE"], minutes: 420, practiceReq: "Ablate chunking ×3 + reranker on/off", priority: "CORE", track: "AI_ENGINEERING", difficulty: "Hard", prerequisites: ["Embeddings, Vector Search, BM25 & Hybrid Retrieval"], block: "Block 2", dayOffset: 72 },
  { week: 11, title: "RAG Evaluation Suite (P@K → Faithfulness → Judge)", category: "RAG", subtopics: ["Precision@K/Recall@K", "MRR/nDCG", "Context precision/recall", "Faithfulness", "Ground-truth datasets", "Human eval", "LLM-as-a-Judge"], minutes: 480, practiceReq: "Eval harness + scored report on PDF chatbot", priority: "CORE", track: "AI_ENGINEERING", difficulty: "Hard", prerequisites: ["Chunking, Reranking, Query Transform & HyDE"], block: "Block 2", dayOffset: 73 },
  { week: 12, title: "Agents: ReAct, Planning, Memory, LangGraph, HITL", category: "AI Agents", subtopics: ["ReAct loop", "Planning & decomposition", "Memory & state", "LangGraph/orchestration", "Human-in-the-loop"], minutes: 540, practiceReq: "Multi-tool agent with memory (HF Agents supplement)", priority: "CORE", track: "AI_ENGINEERING", difficulty: "Hard", prerequisites: ["Function/Tool Calling + MCP Awareness", "RAG Evaluation Suite (P@K → Faithfulness → Judge)"], block: "Block 1", dayOffset: 77 },
  { week: 12, title: "Failure Engineering (Hallucination → Latency)", category: "AI Agents", subtopics: ["Agent failure handling", "Hallucination", "Retrieval/context failures", "Cost/latency failures"], minutes: 420, practiceReq: "Failure-mode test matrix ×6", priority: "CORE", track: "AI_ENGINEERING", difficulty: "Hard", prerequisites: ["Agents: ReAct, Planning, Memory, LangGraph, HITL"], block: "Block 1", dayOffset: 78 },
  { week: 12, title: "Inference & Serving Awareness", category: "AI Agents", subtopics: ["Quantization (explain)", "KV cache", "Batching/throughput/TTFT", "vLLM & SGLang awareness", "Multimodal/diffusion awareness", "Multi-agent & advanced frameworks awareness"], minutes: 240, practiceReq: "One-page brief per concept (explain, don't implement)", priority: "IMPORTANT", track: "AI_ENGINEERING", difficulty: "Medium", prerequisites: ["Transformers, Tokenization & Attention (Q/K/V, Context)"], block: "Block 2", dayOffset: 79 },
  { week: 12, title: "AI Security: Injection, Leakage & Tool Safety", category: "AI Agents", subtopics: ["Prompt injection defense", "Data leakage & redaction", "Tool security", "Output validation", "Access control"], minutes: 300, practiceReq: "Red-team own chatbot ×5 attacks", priority: "CORE", track: "AI_ENGINEERING", difficulty: "Medium", prerequisites: ["Agents: ReAct, Planning, Memory, LangGraph, HITL"], block: "Block 3", dayOffset: 80 },
  { week: 12, title: "Frontier Topics Awareness (No Core Capacity)", category: "AI Agents", subtopics: ["Speculative decoding/Medusa/EAGLE (what/where)", "TensorRT-LLM/GPU kernels (what/where)", "JEPA/world models/RSI (what/where)", "Deep multimodal specialization (map only)"], minutes: 120, practiceReq: "Fit-map: one line per topic", priority: "OPTIONAL", track: "AI_ENGINEERING", difficulty: "Easy", prerequisites: [], block: "Block 4", dayOffset: 81 },
  { week: 12, title: "Production AI Systems (FastAPI → CI/CD → Deploy)", category: "DevOps", subtopics: ["FastAPI design", "PostgreSQL & Redis", "Queues/workers", "Docker & CI/CD", "Deployment & runbook"], minutes: 540, practiceReq: "Deploy RAG service with eval + runbook", priority: "CORE", track: "AI_ENGINEERING", difficulty: "Hard", prerequisites: ["RAG Evaluation Suite (P@K → Faithfulness → Judge)", "Containerization & CI/CD Pipelines"], block: "Block 4", dayOffset: 82 },
  { week: 13, title: "AI System Design & Interview Scenarios", category: "Projects", subtopics: ["RAG system design", "Agentic system design", "Eval/observability story", "Cost/latency trade-offs", "Interview reps"], minutes: 360, practiceReq: "2 full design reps out loud", priority: "CORE", track: "AI_ENGINEERING", difficulty: "Hard", prerequisites: ["Production AI Systems (FastAPI → CI/CD → Deploy)", "Failure Engineering (Hallucination → Latency)"], block: "Block 2", dayOffset: 88 },
];

// ---------------- DSA CORE 100 (fixed interview set, ~78h) ----------------
// E=30m ×30, M=50m ×50, H=65m ×20 → 4700m. Striver A2Z = reference, NeetCode = supplement.
// Mastery: understand → implement → easy → medium → re-solve → explain.
// Weak patterns only after Core 100. No segment/Fenwick/HLD/suffix/max-flow.

const P = (pattern: string, title: string, difficulty: "Easy" | "Medium" | "Hard"): SpecProblem => ({
  title: `${pattern} — ${title}`,
  pattern,
  difficulty,
  minutes: difficulty === "Easy" ? 30 : difficulty === "Medium" ? 50 : 65,
});

export const CORE100: SpecProblem[] = [
  P("Arrays", "Two Sum", "Easy"), P("Arrays", "Remove Duplicates", "Easy"), P("Arrays", "Best Time to Buy/Sell Stock", "Easy"),
  P("Arrays", "Product of Array Except Self", "Medium"), P("Arrays", "3Sum", "Medium"), P("Arrays", "Maximum Product Subarray", "Hard"),
  P("Hashing", "Valid Anagram", "Easy"), P("Hashing", "Group Anagrams", "Medium"), P("Hashing", "Longest Consecutive Sequence", "Medium"), P("Hashing", "First Missing Positive", "Hard"),
  P("Strings", "Valid Palindrome", "Easy"), P("Strings", "Longest Common Prefix", "Easy"), P("Strings", "Longest Palindromic Substring", "Medium"), P("Strings", "Minimum Window Substring", "Hard"),
  P("Two Pointers", "Move Zeroes", "Easy"), P("Two Pointers", "Two Sum II", "Easy"), P("Two Pointers", "Sort Colors", "Medium"), P("Two Pointers", "Trapping Rain Water", "Hard"),
  P("Sliding Window", "Max Average Subarray", "Easy"), P("Sliding Window", "Longest Substring Without Repeat", "Medium"), P("Sliding Window", "Longest Repeating Replacement", "Medium"), P("Sliding Window", "Permutation in String", "Medium"), P("Sliding Window", "Sliding Window Maximum", "Hard"),
  P("Prefix Sums", "Running Sum", "Easy"), P("Prefix Sums", "Subarray Sum Equals K", "Medium"), P("Prefix Sums", "Range Sum Query 2D", "Medium"),
  P("Stacks", "Valid Parentheses", "Easy"), P("Stacks", "Min Stack", "Medium"), P("Stacks", "Daily Temperatures", "Medium"), P("Stacks", "Largest Rectangle (Monotonic)", "Hard"),
  P("Queues", "Queue via Stacks", "Easy"), P("Queues", "Rotting Oranges", "Medium"),
  P("Binary Search", "Binary Search", "Easy"), P("Binary Search", "Sqrt(x)", "Easy"), P("Binary Search", "First Bad Version", "Easy"), P("Binary Search", "Search Rotated Array", "Medium"), P("Binary Search", "Median of Two Sorted Arrays", "Hard"),
  P("Linked Lists", "Reverse Linked List", "Easy"), P("Linked Lists", "Middle of Linked List", "Easy"), P("Linked Lists", "Merge Two Sorted Lists", "Easy"), P("Linked Lists", "Reorder List", "Medium"), P("Linked Lists", "Remove Nth Node", "Medium"), P("Linked Lists", "Merge K Sorted Lists", "Hard"),
  P("Trees", "Maximum Depth", "Easy"), P("Trees", "Same Tree", "Easy"), P("Trees", "Level Order Traversal", "Medium"), P("Trees", "Diameter of Tree", "Medium"), P("Trees", "Construct from Preorder/Inorder", "Medium"), P("Trees", "Serialize/Deserialize", "Hard"),
  P("BST", "LCA of BST", "Easy"), P("BST", "Kth Smallest Element", "Medium"), P("BST", "Validate BST", "Medium"),
  P("Heaps", "Kth Largest in Stream", "Easy"), P("Heaps", "Top K Frequent Elements", "Medium"), P("Heaps", "Task Scheduler", "Medium"), P("Heaps", "Find Median from Stream", "Hard"), P("Heaps", "IPO (Capital Maximization)", "Hard"),
  P("Backtracking", "Subsets", "Medium"), P("Backtracking", "Permutations", "Medium"), P("Backtracking", "Combination Sum", "Medium"), P("Backtracking", "Palindrome Partitioning", "Medium"), P("Backtracking", "N-Queens", "Hard"),
  P("Trie", "Implement Trie", "Easy"), P("Trie", "Add and Search Words", "Medium"), P("Trie", "Word Search II", "Hard"),
  P("BFS/DFS", "Flood Fill", "Easy"), P("BFS/DFS", "Number of Islands", "Medium"), P("BFS/DFS", "Clone Graph", "Medium"), P("BFS/DFS", "Word Search", "Medium"), P("BFS/DFS", "Word Ladder", "Hard"),
  P("Topo/Union-Find", "Course Schedule", "Medium"), P("Topo/Union-Find", "Number of Provinces", "Medium"), P("Topo/Union-Find", "Alien Dictionary", "Hard"),
  P("Shortest Paths", "Network Delay Time", "Medium"), P("Shortest Paths", "Cheapest Flights Within K", "Medium"), P("Shortest Paths", "Path With Minimum Effort", "Medium"),
  P("Greedy", "Assign Cookies", "Easy"), P("Greedy", "Jump Game", "Medium"), P("Greedy", "Gas Station", "Medium"), P("Greedy", "Candy", "Hard"),
  P("Intervals", "Meeting Rooms", "Easy"), P("Intervals", "Merge Intervals", "Medium"), P("Intervals", "Non-overlapping Intervals", "Medium"), P("Intervals", "Employee Free Time", "Hard"),
  P("DP-1D", "Climbing Stairs", "Easy"), P("DP-1D", "House Robber", "Easy"), P("DP-1D", "Coin Change", "Medium"), P("DP-1D", "Partition Equal Subset Sum", "Medium"), P("DP-1D", "Longest Increasing Subsequence", "Hard"),
  P("DP-2D", "Unique Paths", "Medium"), P("DP-2D", "Longest Common Subsequence", "Medium"), P("DP-2D", "Longest Palindromic Subsequence", "Medium"), P("DP-2D", "Edit Distance", "Hard"), P("DP-2D", "Regular Expression Matching", "Hard"),
  P("Bit Manipulation", "Number of 1 Bits", "Easy"), P("Bit Manipulation", "Hamming Distance", "Easy"),
  P("Mock-Mixed", "LRU Cache", "Medium"), P("Mock-Mixed", "Design Twitter", "Medium"), P("Mock-Mixed", "Design Leaderboard", "Medium"), P("Mock-Mixed", "Snapshot Array", "Medium"),
];

// ---------------- PROJECT tasks: estimates + priority ----------------

export const PROJECT_TASKS: SpecProjectTask[] = [
  { project: "Full Stack SaaS Project", milestoneStage: "Planning", title: "User Stories & API Specs", minutes: 60, priority: "CORE" },
  { project: "Full Stack SaaS Project", milestoneStage: "Architecture", title: "Database ERD & Component Architecture", minutes: 90, priority: "CORE" },
  { project: "Full Stack SaaS Project", milestoneStage: "Implementation", title: "Express Server Setup & JWT Auth Middleware", minutes: 120, priority: "CORE" },
  { project: "Full Stack SaaS Project", milestoneStage: "Implementation", title: "React Component Hierarchy & State Management", minutes: 60, priority: "IMPORTANT" },
  { project: "Full Stack SaaS Project", milestoneStage: "Testing", title: "Postman Integration Tests", minutes: 60, priority: "CORE" },
  { project: "Full Stack SaaS Project", milestoneStage: "Optimization", title: "PostgreSQL Index Optimization", minutes: 60, priority: "CORE" },
  { project: "Full Stack SaaS Project", milestoneStage: "Deployment", title: "Deploy to Render/Vercel", minutes: 60, priority: "CORE" },
  { project: "Full Stack SaaS Project", milestoneStage: "Documentation", title: "Write GitHub README & API Docs", minutes: 30, priority: "IMPORTANT" },
  { project: "Full Stack SaaS Project", milestoneStage: "Demo", title: "Record 2-Minute Demo Video", minutes: 30, priority: "IMPORTANT" },
  { project: "ML Prediction API", milestoneStage: "Planning", title: "Problem Definition & Dataset Selection", minutes: 60, priority: "CORE" },
  { project: "ML Prediction API", milestoneStage: "Architecture", title: "Preprocessing & Feature Engineering Pipeline", minutes: 120, priority: "CORE" },
  { project: "ML Prediction API", milestoneStage: "Implementation", title: "Model Training & Hyperparameter Tuning", minutes: 180, priority: "CORE" },
  { project: "ML Prediction API", milestoneStage: "Testing", title: "Confusion Matrix & F1-Score Validation", minutes: 120, priority: "CORE" },
  { project: "ML Prediction API", milestoneStage: "Deployment", title: "FastAPI Prediction Endpoint", minutes: 120, priority: "CORE" },
  { project: "Generative AI Chatbot App", milestoneStage: "Planning", title: "System Prompt & Tool Definitions", minutes: 120, priority: "CORE" },
  { project: "Generative AI Chatbot App", milestoneStage: "Implementation", title: "Streaming Response Handler", minutes: 240, priority: "CORE" },
  { project: "Generative AI Chatbot App", milestoneStage: "Testing", title: "Tool-Use Eval + Cost Log", minutes: 120, priority: "CORE" },
  { project: "Production-Style RAG Application", milestoneStage: "Planning", title: "RAG Chunking Strategy & Evaluation Metrics", minutes: 60, priority: "CORE" },
  { project: "Production-Style RAG Application", milestoneStage: "Implementation", title: "Ingestion + Hybrid Retrieval Build", minutes: 360, priority: "CORE" },
  { project: "Production-Style RAG Application", milestoneStage: "Testing", title: "Eval Harness + Hardening (P@K, Faithfulness)", minutes: 240, priority: "CORE" },
  { project: "Production-Style RAG Application", milestoneStage: "Deployment", title: "Deploy + Demo Walkthrough", minutes: 120, priority: "CORE" },
  { project: "Autonomous Agentic AI Project", milestoneStage: "Planning", title: "Agent Tool Registry & ReAct Loop Architecture", minutes: 60, priority: "CORE" },
  { project: "Autonomous Agentic AI Project", milestoneStage: "Implementation", title: "Memory + Human-in-the-Loop + Failure Tests", minutes: 300, priority: "CORE" },
  { project: "Autonomous Agentic AI Project", milestoneStage: "Demo", title: "Multi-Step Demo + Evaluation", minutes: 180, priority: "CORE" },
  { project: "Final Containerized Production System", milestoneStage: "Planning", title: "Microservices Compose Architecture", minutes: 60, priority: "CORE" },
  { project: "Final Containerized Production System", milestoneStage: "Deployment", title: "Tracing, Cost Guards + Production Deploy", minutes: 420, priority: "CORE" },
];

// ---------------- CONSOLIDATION weeks (W13–W14, IMPORTANT, track-tagged) ----------------

export const ROADMAP_CONSOLIDATION: SpecTask[] = [
  { week: 13, title: "GATE Weak-Area Sprint (DBMS + OS + CN)", category: "DSA", subtopics: ["Normalization drills", "CPU scheduling PYQs", "Subnetting practice"], minutes: 150, practiceReq: "2 subject mocks + error log triage", priority: "IMPORTANT", track: "GATE_PREP", difficulty: "Medium", prerequisites: [], block: "Block 1", dayOffset: 84 },
  { week: 13, title: "DSA Pattern Consolidation", category: "DSA", subtopics: ["Sliding window review", "DP patterns", "Graph templates"], minutes: 120, practiceReq: "Re-solve 10 flagged Core-100", priority: "IMPORTANT", track: "DSA", difficulty: "Medium", prerequisites: [], block: "Block 2", dayOffset: 87 },
  { week: 13, title: "Full-Length GATE Mocks & Analysis", category: "DSA", subtopics: ["Timed mock", "Error taxonomy", "Formula sheet"], minutes: 180, practiceReq: "2 full mocks with review", priority: "IMPORTANT", track: "GATE_PREP", difficulty: "Hard", prerequisites: [], block: "Block 3", dayOffset: 89 },
  { week: 14, title: "Master Revision Sweep", category: "DSA", subtopics: ["All revision queue", "GATE one-pagers", "DSA cheat sheets"], minutes: 150, practiceReq: "Clear revision backlog", priority: "IMPORTANT", track: "GATE_PREP", difficulty: "Medium", prerequisites: [], block: "Block 1", dayOffset: 91 },
  { week: 14, title: "Master Portfolio Deployment & Interview Revision", category: "Projects", subtopics: ["Demo polish (builds done in projects)", "GitHub documentation", "Technical mock interview"], minutes: 90, practiceReq: "Live demo of production system", priority: "IMPORTANT", track: "SOFTWARE_ENGINEERING", difficulty: "Medium", prerequisites: [], block: "Block 2", dayOffset: 94 },
  { week: 14, title: "Final Production Capstone (DevOps)", category: "DevOps", subtopics: ["Pipeline reuse from W12 tasks", "Runbook + capstone demo"], minutes: 120, practiceReq: "Live production URL + runbook + demo", priority: "IMPORTANT", track: "SOFTWARE_ENGINEERING", difficulty: "Hard", prerequisites: [], block: "Block 3", dayOffset: 96 },
];



