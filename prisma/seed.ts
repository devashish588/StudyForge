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

  // 2. User & Settings (flexible scheduling, 8h target / 10h stretch)
  await prisma.user.create({
    data: {
      id: "user_devashish",
      name: "Devashish",
      email: "devashish@studyforge.local",
      dailyTargetHours: 8.0,
      currentStreak: 0,
      longestStreak: 0,
      settings: {
        create: {
          preferredSittings: JSON.stringify([]),
          schedulingMode: "Flexible",
          dailyTargetMinutes: 480,
          stretchTargetMinutes: 600,
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
  const weeksData = [
    {
      weekNumber: 1,
      title: "DSA Foundations",
      startDate: addDaysStr(STUDY_START, 0),
      endDate: addDaysStr(STUDY_START, 6),
      focusArea: "What is DSA, Big O, Arrays, Strings, Searching, Sorting",
      practiceTarget: 25,
      tasks: [
        {
          title: "DSA Introduction & Big O Notation",
          category: "DSA",
          subtopics: JSON.stringify([
            "What is DSA?",
            "Programming & Problem Solving",
            "Time & Space Complexity",
            "Big O, Omega, Theta notation"
          ]),
          estimatedTimeMinutes: 90,
          practiceReq: "Explain Big-O without notes, Analyze 5 code snippets, Solve 2 basic problems",
          status: "TODO",
          block: "Block 1",
          assignedDate: addDaysStr(STUDY_START, 0)
        },
        {
          title: "Arrays Fundamentals & Operations",
          category: "DSA",
          subtopics: JSON.stringify([
            "Array Memory Layout",
            "Traversal, Insertion, Deletion",
            "Linear Search vs Binary Search",
            "Two Pointers technique baseline"
          ]),
          estimatedTimeMinutes: 120,
          practiceReq: "Solve 5 array problems, Implement custom Array class",
          status: "TODO",
          block: "Block 2",
          assignedDate: addDaysStr(STUDY_START, 0)
        },
        {
          title: "Strings & Searching Algorithms",
          category: "DSA",
          subtopics: JSON.stringify([
            "String Immutability & Manipulation",
            "Binary Search Patterns",
            "First & Last occurrence",
            "Rotated Sorted Array search"
          ]),
          estimatedTimeMinutes: 120,
          practiceReq: "Solve 4 String problems, Implement Binary Search from scratch",
          status: "TODO",
          confidence: 3,
          block: "Block 1",
          assignedDate: addDaysStr(STUDY_START, 1)
        },
        {
          title: "Basic Sorting Algorithms",
          category: "DSA",
          subtopics: JSON.stringify([
            "Bubble Sort, Selection Sort, Insertion Sort",
            "Merge Sort recursion tree",
            "Quick Sort partitioning strategy"
          ]),
          estimatedTimeMinutes: 120,
          practiceReq: "Implement Merge Sort and Quick Sort from memory",
          status: "TODO",
          confidence: 3,
          block: "Block 2",
          assignedDate: addDaysStr(STUDY_START, 2)
        }
      ]
    },
    {
      weekNumber: 2,
      title: "Recursion & Linear Data Structures",
      startDate: addDaysStr(STUDY_START, 7),
      endDate: addDaysStr(STUDY_START, 13),
      focusArea: "Recursion, Backtracking, Linked Lists, Stack, Queue",
      practiceTarget: 30,
      tasks: [
        {
          title: "Recursion & Backtracking Foundations",
          category: "DSA",
          subtopics: JSON.stringify(["Call Stack Analysis", "Base Cases", "Subsets", "N-Queens intuition"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Solve 5 recursion problems",
          status: "TODO",
          block: "Block 1",
          assignedDate: addDaysStr(STUDY_START, 7)
        },
        {
          title: "Linked Lists & Fast/Slow Pointer",
          category: "DSA",
          subtopics: JSON.stringify(["Singly/Doubly LL", "Cycle Detection", "Reverse LL", "Middle element"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Solve 5 LL problems",
          status: "TODO",
          block: "Block 2",
          assignedDate: addDaysStr(STUDY_START, 8)
        },
        {
          title: "Stack, Queue & Deque",
          category: "DSA",
          subtopics: JSON.stringify(["Monotonic Stack", "Next Greater Element", "Queue using Stacks", "Circular Queue"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Solve 5 Stack/Queue problems",
          status: "TODO",
          block: "Block 3",
          assignedDate: addDaysStr(STUDY_START, 9)
        }
      ]
    },
    {
      weekNumber: 3,
      title: "Hashing, Two Pointers & Trees",
      startDate: addDaysStr(STUDY_START, 14),
      endDate: addDaysStr(STUDY_START, 20),
      focusArea: "Hashing, Two Pointers, Sliding Window, Binary Trees, BST, Heap",
      practiceTarget: 35,
      tasks: [
        {
          title: "Hashing, HashMap & Sliding Window",
          category: "DSA",
          subtopics: JSON.stringify(["Collision handling", "Frequency counting", "Two Sum", "Variable sliding window"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Solve 6 Sliding Window problems",
          status: "TODO",
          block: "Block 1",
          assignedDate: addDaysStr(STUDY_START, 14)
        },
        {
          title: "Binary Trees & BST",
          category: "DSA",
          subtopics: JSON.stringify(["DFS (Pre/In/Post order)", "BFS Level Order", "BST Validation", "Lowest Common Ancestor"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Solve 6 Tree problems",
          status: "TODO",
          block: "Block 2",
          assignedDate: addDaysStr(STUDY_START, 16)
        },
        {
          title: "Heaps & Priority Queues",
          category: "DSA",
          subtopics: JSON.stringify(["Min Heap & Max Heap", "Heapify", "Top-K Frequent Elements", "Merge K Sorted Lists"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Solve 5 Heap problems",
          status: "TODO",
          block: "Block 3",
          assignedDate: addDaysStr(STUDY_START, 18)
        }
      ]
    },
    {
      weekNumber: 4,
      title: "Graphs & Dynamic Programming",
      startDate: addDaysStr(STUDY_START, 21),
      endDate: addDaysStr(STUDY_START, 27),
      focusArea: "Graphs, Shortest Path, Greedy, DP, Interview Patterns, Mock Interview",
      practiceTarget: 40,
      tasks: [
        {
          title: "Graph Algorithms (BFS/DFS/Dijkstra)",
          category: "DSA",
          subtopics: JSON.stringify(["Adjacency List", "Connected Components", "Cycle Detection in Directed Graph", "Dijkstra"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Solve 6 Graph problems",
          status: "TODO",
          block: "Block 1",
          assignedDate: addDaysStr(STUDY_START, 21)
        },
        {
          title: "Dynamic Programming Foundations",
          category: "DSA",
          subtopics: JSON.stringify(["Memoization vs Tabulation", "0/1 Knapsack", "Climbing Stairs", "House Robber", "Kadane"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Solve 6 DP problems",
          status: "TODO",
          block: "Block 2",
          assignedDate: addDaysStr(STUDY_START, 24)
        },
        {
          title: "Greedy Algorithms & Classic Patterns",
          category: "DSA",
          subtopics: JSON.stringify(["Greedy choice property", "Activity Selection", "Fractional Knapsack", "Huffman Coding", "Greedy vs DP"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Solve 6 Greedy problems",
          status: "TODO",
          block: "Block 3",
          assignedDate: addDaysStr(STUDY_START, 26)
        },
        {
          title: "DSA Interview Patterns & Mock Interview",
          category: "DSA",
          subtopics: JSON.stringify(["Two Pointers, Sliding Window & Prefix Sum patterns", "Top interview problem bank (80–100 problems)", "Timed mock interview", "Complexity narration out loud"]),
          estimatedTimeMinutes: 180,
          practiceReq: "Review 80–100 problem bank, complete 1 timed mock interview",
          status: "TODO",
          block: "Block 4",
          assignedDate: addDaysStr(STUDY_START, 27)
        }
      ]
    },
    {
      weekNumber: 5,
      title: "Full Stack Foundations",
      startDate: addDaysStr(STUDY_START, 28),
      endDate: addDaysStr(STUDY_START, 34),
      focusArea: "Internet & Web Fundamentals, HTTP/HTTPS, HTML5, CSS3, JS ES6+",
      practiceTarget: 15,
      tasks: [
        {
          title: "Web Architecture & HTML5/CSS Grid",
          category: "Full Stack",
          subtopics: JSON.stringify(["Internet & Web Fundamentals (DNS, TCP/IP, Browser Basics)", "HTTP Methods & Headers", "Semantic HTML5", "CSS3 Selectors, Box Model & Animations", "Flexbox vs Grid", "Responsive Design"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Build responsive mini landing page",
          status: "TODO",
          block: "Block 1",
          assignedDate: addDaysStr(STUDY_START, 28)
        },
        {
          title: "JavaScript ES6+ & Functional Programming",
          category: "Full Stack",
          subtopics: JSON.stringify(["Arrow functions", "Destructuring", "map/filter/reduce", "ES Modules"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Write array processing library with JS methods",
          status: "TODO",
          block: "Block 2",
          assignedDate: addDaysStr(STUDY_START, 31)
        }
      ]
    },
    {
      weekNumber: 6,
      title: "Frontend & React Core",
      startDate: addDaysStr(STUDY_START, 35),
      endDate: addDaysStr(STUDY_START, 41),
      focusArea: "DOM, Promises, Async/Await, React Components, Hooks, State",
      practiceTarget: 15,
      tasks: [
        {
          title: "DOM, Async JS & Event Loop",
          category: "Full Stack",
          subtopics: JSON.stringify(["DOM manipulation", "Promises", "Async/Await", "Event Loop & Macro/Microtasks"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Build asynchronous dashboard widget",
          status: "TODO",
          block: "Block 1",
          assignedDate: addDaysStr(STUDY_START, 35)
        },
        {
          title: "React Fundamentals & State Management",
          category: "Full Stack",
          subtopics: JSON.stringify(["JSX", "Props & State", "useEffect & custom hooks", "React Router / Navigation"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Build interactive React web application",
          status: "TODO",
          block: "Block 2",
          assignedDate: addDaysStr(STUDY_START, 38)
        }
      ]
    },
    {
      weekNumber: 7,
      title: "Backend & Database Engineering",
      startDate: addDaysStr(STUDY_START, 42),
      endDate: addDaysStr(STUDY_START, 48),
      focusArea: "Node.js, Express, Middleware, JWT Auth, PostgreSQL, MongoDB",
      practiceTarget: 15,
      tasks: [
        {
          title: "Node.js, Express & REST APIs",
          category: "Full Stack",
          subtopics: JSON.stringify(["Express Router", "Middleware chain", "Error handling middleware", "JWT Authentication"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Build secure Auth API",
          status: "TODO",
          block: "Block 1",
          assignedDate: addDaysStr(STUDY_START, 42)
        },
        {
          title: "Relational SQL (PostgreSQL) & MongoDB",
          category: "Full Stack",
          subtopics: JSON.stringify(["Joins & Indexes", "ACID Transactions", "Mongoose Schemas", "Aggregation pipeline"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Design database schemas with SQL & MongoDB",
          status: "TODO",
          block: "Block 2",
          assignedDate: addDaysStr(STUDY_START, 45)
        },
        {
          title: "ORM/ODM & Data Modeling (Prisma + Mongoose)",
          category: "Full Stack",
          subtopics: JSON.stringify(["Prisma schema & migrations", "Mongoose ODM modeling", "Relations & data modeling patterns", "Seed scripts"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Model app domain with Prisma + Mongoose with migrations",
          status: "TODO",
          block: "Block 3",
          assignedDate: addDaysStr(STUDY_START, 47)
        }
      ]
    },
    {
      weekNumber: 8,
      title: "Deployable Full Stack Project",
      startDate: addDaysStr(STUDY_START, 49),
      endDate: addDaysStr(STUDY_START, 55),
      focusArea: "Full Stack App integration, Postman, Git/GitHub, Testing, Deployment",
      practiceTarget: 10,
      tasks: [
        {
          title: "Full Stack Application Shipping",
          category: "Full Stack",
          subtopics: JSON.stringify(["Frontend-Backend Auth integration", "File Upload", "Postman tests", "Production deployment"]),
          estimatedTimeMinutes: 180,
          practiceReq: "Ship production-ready Full Stack SaaS Project",
          status: "TODO",
          block: "Block 1",
          assignedDate: addDaysStr(STUDY_START, 49)
        },
        {
          title: "Full-Stack Integration, Testing & Demo Day",
          category: "Full Stack",
          subtopics: JSON.stringify(["Frontend-Backend integration", "File Upload & Security hardening", "API/Unit/Integration testing", "Documentation & live demo"]),
          estimatedTimeMinutes: 150,
          practiceReq: "Green test suite + documented live demo",
          status: "TODO",
          block: "Block 2",
          assignedDate: addDaysStr(STUDY_START, 52)
        }
      ]
    },
    {
      weekNumber: 9,
      title: "Machine Learning Foundations",
      startDate: addDaysStr(STUDY_START, 56),
      endDate: addDaysStr(STUDY_START, 62),
      focusArea: "ML Workflow, Data Cleaning, Feature Scaling, Regression & Classification",
      practiceTarget: 15,
      tasks: [
        {
          title: "ML Workflow & Data Preprocessing",
          category: "ML",
          subtopics: JSON.stringify(["Train/Test split", "Missing value imputation", "One-Hot Encoding", "MinMax/Standard Scaling"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Preprocess dataset with Pandas/Scikit-Learn",
          status: "TODO",
          block: "Block 1",
          assignedDate: addDaysStr(STUDY_START, 56)
        },
        {
          title: "Linear & Logistic Regression",
          category: "ML",
          subtopics: JSON.stringify(["Cost function", "Gradient Descent", "Confusion Matrix", "Precision, Recall, F1-Score"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Train and evaluate classification model",
          status: "TODO",
          block: "Block 2",
          assignedDate: addDaysStr(STUDY_START, 59)
        },
        {
          title: "Tree Models, SVM & Clustering",
          category: "ML",
          subtopics: JSON.stringify(["Entropy & Gini Impurity", "Random Forest ensemble", "KNN Classification", "SVM Margins & Kernels", "K-Means Clustering", "Model selection framework", "FastAPI Serving"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Compare KNN vs SVM vs Random Forest; deploy ML prediction API using FastAPI",
          status: "TODO",
          block: "Block 3",
          assignedDate: addDaysStr(STUDY_START, 61)
        },
        {
          title: "Model Evaluation, Tuning & Feature Engineering",
          category: "ML",
          subtopics: JSON.stringify(["Train/Validation/Test splits & Cross-Validation", "Hyperparameter tuning", "Feature engineering & selection", "Overfitting vs Underfitting"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Tune a model + feature ablation report",
          status: "TODO",
          block: "Block 4",
          assignedDate: addDaysStr(STUDY_START, 62)
        }
      ]
    },
    {
      weekNumber: 10,
      title: "Generative AI & LLM Engineering",
      startDate: addDaysStr(STUDY_START, 63),
      endDate: addDaysStr(STUDY_START, 69),
      focusArea: "LLM Fundamentals, Prompt Engineering, Streaming, Function Calling, Chatbot v1",
      practiceTarget: 15,
      tasks: [
        {
          title: "LLMs, Transformers & Prompt Engineering",
          category: "Generative AI",
          subtopics: JSON.stringify(["Tokens & Context Windows", "Attention & Transformer intuition", "Few-shot & System Prompting", "Structured JSON Outputs", "Model APIs & model behavior basics"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Build prompt benchmark suite",
          status: "TODO",
          block: "Block 1",
          assignedDate: addDaysStr(STUDY_START, 63)
        },
        {
          title: "LLM API Integration & Function Calling",
          category: "Generative AI",
          subtopics: JSON.stringify(["Streaming responses", "Conversation memory", "Function calling & structured tool use", "External APIs", "Hallucination handling & output validation", "Chatbot UI"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Build AI Chatbot v1 with streaming & tools",
          status: "TODO",
          block: "Block 2",
          assignedDate: addDaysStr(STUDY_START, 66)
        },
        {
          title: "Token/Cost Optimization & AI Capstone Demo",
          category: "Generative AI",
          subtopics: JSON.stringify(["Token & cost optimization", "Caching & batching strategies", "Model routing & fallbacks", "Latency & reliability basics", "Error handling", "AI project polish", "Recorded demo walkthrough"]),
          estimatedTimeMinutes: 150,
          practiceReq: "Ship optimized AI demo with cost report",
          status: "TODO",
          block: "Block 3",
          assignedDate: addDaysStr(STUDY_START, 68)
        }
      ]
    },
    {
      weekNumber: 11,
      title: "RAG Systems (Retrieval-Augmented Generation)",
      startDate: addDaysStr(STUDY_START, 70),
      endDate: addDaysStr(STUDY_START, 76),
      focusArea: "Embeddings, Vector Databases, Chunking, PDF Chatbot, Retrieval Evaluation",
      practiceTarget: 15,
      tasks: [
        {
          title: "Embeddings, Vector Databases & Chunking",
          category: "RAG",
          subtopics: JSON.stringify(["Embeddings & Cosine Similarity", "Semantic search", "ChromaDB / Pinecone", "Metadata filtering", "Recursive Text Splitting & chunking strategy", "BM25 & hybrid retrieval", "HyDE & Reranking", "Retrieval evaluation basics"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Build PDF Question-Answering RAG system",
          status: "TODO",
          block: "Block 1",
          assignedDate: addDaysStr(STUDY_START, 70)
        },
        {
          title: "RAG Evaluation & Hardening",
          category: "RAG",
          subtopics: JSON.stringify(["Retrieval precision & RAG quality metrics", "Citation grounding", "Latency optimization", "Reranking tuning", "Error analysis"]),
          estimatedTimeMinutes: 150,
          practiceReq: "Evaluation harness + demo video",
          status: "TODO",
          block: "Block 2",
          assignedDate: addDaysStr(STUDY_START, 73)
        }
      ]
    },
    {
      weekNumber: 12,
      title: "Agents + DevOps",
      startDate: addDaysStr(STUDY_START, 77),
      endDate: addDaysStr(STUDY_START, 83),
      focusArea: "Autonomous agents, Git/Linux, Docker, AWS, CI/CD, Observability, K8s basics",
      practiceTarget: 25,
      tasks: [
        {
          title: "Autonomous AI Agents & Multi-Tool Workflows",
          category: "AI Agents",
          subtopics: JSON.stringify(["ReAct Loop", "Planning & task decomposition", "Tool/function calling & structured tool use", "Stateful memory", "LangGraph/orchestration basics", "External APIs", "Human-in-the-loop", "Prompt injection defense", "Tool security & data-leakage safeguards"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Build multi-tool autonomous agentic project",
          status: "TODO",
          block: "Block 1",
          assignedDate: addDaysStr(STUDY_START, 77)
        },
        {
          title: "Containerization & CI/CD Pipelines",
          category: "DevOps",
          subtopics: JSON.stringify(["Dockerfile multi-stage", "Docker Compose microservices", "Networking & Volumes", "GitHub Actions CI/CD", "Redis Caching"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Containerize and deploy AI application to cloud",
          status: "TODO",
          block: "Block 2",
          assignedDate: addDaysStr(STUDY_START, 80)
        },
        {
          title: "Git, Linux & Testing Foundations",
          category: "DevOps",
          subtopics: JSON.stringify(["Git & GitHub workflows", "Linux essentials & shell", "Environment & configuration management", "API/Unit/Integration testing"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Repo with workflows + green test suite + env-based config",
          status: "TODO",
          block: "Block 3",
          assignedDate: addDaysStr(STUDY_START, 78)
        },
        {
          title: "AWS & Production Deployment",
          category: "DevOps",
          subtopics: JSON.stringify(["AWS fundamentals (EC2, S3, IAM, Security Groups)", "Backend & frontend deployment", "Cloud database setup", "Nginx, DNS & HTTPS/SSL"]),
          estimatedTimeMinutes: 150,
          practiceReq: "Deploy full stack to AWS behind HTTPS",
          status: "TODO",
          block: "Block 4",
          assignedDate: addDaysStr(STUDY_START, 81)
        },
        {
          title: "Observability, Scaling & Kubernetes Basics",
          category: "DevOps",
          subtopics: JSON.stringify(["Background jobs & queues", "Monitoring & logging", "Tracing & observability for AI systems", "Rate limiting, security & scaling", "Sensitive-info redaction & access control", "Kubernetes basics (Pods, Deployments, Services)"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Add caching + monitoring + K8s manifests",
          status: "TODO",
          block: "Block 5",
          assignedDate: addDaysStr(STUDY_START, 82)
        }
      ]
    },
    {
      weekNumber: 13,
      title: "Consolidation & GATE Mock Sprints",
      startDate: addDaysStr(STUDY_START, 84),
      endDate: addDaysStr(STUDY_START, 90),
      focusArea: "Weak-area revision, subject + full-length mocks, DSA pattern review",
      practiceTarget: 20,
      tasks: [
        {
          title: "GATE Weak-Area Sprint (DBMS + OS + CN)",
          category: "DSA",
          subtopics: JSON.stringify(["Normalization drills", "CPU scheduling PYQs", "Subnetting practice"]),
          estimatedTimeMinutes: 150,
          practiceReq: "2 subject mocks + error log triage",
          status: "TODO",
          block: "Block 1",
          assignedDate: addDaysStr(STUDY_START, 84)
        },
        {
          title: "DSA Pattern Consolidation",
          category: "DSA",
          subtopics: JSON.stringify(["Sliding window review", "DP patterns", "Graph templates"]),
          estimatedTimeMinutes: 120,
          practiceReq: "Re-solve 10 flagged problems",
          status: "TODO",
          block: "Block 2",
          assignedDate: addDaysStr(STUDY_START, 87)
        },
        {
          title: "Full-Length GATE Mocks & Analysis",
          category: "DSA",
          subtopics: JSON.stringify(["Timed mock", "Error taxonomy", "Formula sheet"]),
          estimatedTimeMinutes: 180,
          practiceReq: "2 full mocks with review",
          status: "TODO",
          block: "Block 3",
          assignedDate: addDaysStr(STUDY_START, 89)
        }
      ]
    },
    {
      weekNumber: 14,
      title: "Final Revision & Portfolio Shipping",
      startDate: addDaysStr(STUDY_START, 91),
      endDate: "2026-12-31",
      focusArea: "Spaced revision sweep, final project, documentation, GATE mock prep",
      practiceTarget: 20,
      tasks: [
        {
          title: "Master Revision Sweep",
          category: "DSA",
          subtopics: JSON.stringify(["All revision queue", "GATE one-pagers", "DSA cheat sheets"]),
          estimatedTimeMinutes: 150,
          practiceReq: "Clear revision backlog",
          status: "TODO",
          block: "Block 1",
          assignedDate: addDaysStr(STUDY_START, 91)
        },
        {
          title: "Master Portfolio Deployment & Interview Revision",
          category: "Projects",
          subtopics: JSON.stringify(["Full Stack + AI + Docker final build", "GitHub Documentation", "Technical Mock Interview"]),
          estimatedTimeMinutes: 180,
          practiceReq: "Present live demo of production system",
          status: "TODO",
          block: "Block 2",
          assignedDate: addDaysStr(STUDY_START, 94)
        },
        {
          title: "Final Production Capstone (DevOps)",
          category: "DevOps",
          subtopics: JSON.stringify(["End-to-end cloud pipeline", "Hardened production deploy", "Monitoring + runbook", "Capstone demo & retrospective"]),
          estimatedTimeMinutes: 180,
          practiceReq: "Live production URL + runbook + demo",
          status: "TODO",
          block: "Block 3",
          assignedDate: addDaysStr(STUDY_START, 96)
        }
      ]
    }
  ];

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
      const taskConfidence = ("confidence" in t && typeof (t as { confidence?: unknown }).confidence === "number") ? (t as { confidence: number }).confidence : 3;
      await prisma.roadmapTask.create({
        data: {
          weekId: createdWeek.id,
          title: t.title,
          category: t.category,
          subtopics: t.subtopics,
          estimatedTimeMinutes: t.estimatedTimeMinutes,
          practiceReq: t.practiceReq,
          status: t.status,
          confidence: taskConfidence,
          sitting: (t as { block: string }).block,
          blockLabel: (t as { block: string }).block,
          plannedMinutes: t.estimatedTimeMinutes,
          actualMinutes: 0,
          assignedDate: t.assignedDate
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
  const gateSubjectsData = [
    {
      name: "Discrete Mathematics",
      icon: "Binary",
      totalTopics: 8,
      totalPYQs: 60,
      solvedPYQs: 42,
      accuracy: 78.5,
      topics: [
        { name: "Propositional and First Order Logic", completed: true, confidence: 4 },
        { name: "Sets, Relations, Functions, Partial Orders", completed: true, confidence: 5 },
        { name: "Monoids, Groups, Lattice", completed: false, confidence: 3 },
        { name: "Graph Theory: Connectivity, Coloring, Matching", completed: true, confidence: 4 },
        { name: "Combinatorics & Generating Functions", completed: false, confidence: 2 }
      ]
    },
    {
      name: "Data Structures",
      icon: "Layers",
      totalTopics: 6,
      totalPYQs: 50,
      solvedPYQs: 35,
      accuracy: 82.0,
      topics: [
        { name: "Arrays, Stacks, Queues, Linked Lists", completed: true, confidence: 5 },
        { name: "Trees: Binary Trees, Binary Search Trees", completed: true, confidence: 4 },
        { name: "Heaps and Priority Queues", completed: true, confidence: 4 }
      ]
    },
    {
      name: "Algorithms",
      icon: "Cpu",
      totalTopics: 7,
      totalPYQs: 65,
      solvedPYQs: 40,
      accuracy: 75.0,
      topics: [
        { name: "Asymptotic Time & Space Complexity", completed: true, confidence: 5 },
        { name: "Divide and Conquer: Searching & Sorting", completed: true, confidence: 4 },
        { name: "Greedy Algorithms & Dynamic Programming", completed: false, confidence: 3 },
        { name: "Graph Traversal, Minimum Spanning Trees, Shortest Path", completed: false, confidence: 3 }
      ]
    },
    {
      name: "DBMS",
      icon: "Database",
      totalTopics: 7,
      totalPYQs: 60,
      solvedPYQs: 42,
      accuracy: 74.0,
      topics: [
        { name: "ER-Model & Relational Algebra", completed: true, confidence: 4 },
        { name: "SQL Queries & Constraints", completed: true, confidence: 5 },
        { name: "Normalization (1NF, 2NF, 3NF, BCNF)", completed: false, confidence: 2 },
        { name: "Transactions & Concurrency Control", completed: false, confidence: 2 },
        { name: "B and B+ Trees Indexing", completed: false, confidence: 3 }
      ]
    },
    {
      name: "Operating Systems",
      icon: "Terminal",
      totalTopics: 6,
      totalPYQs: 55,
      solvedPYQs: 30,
      accuracy: 76.0,
      topics: [
        { name: "Processes, Threads, CPU Scheduling", completed: true, confidence: 4 },
        { name: "Process Synchronization & Deadlocks", completed: false, confidence: 3 },
        { name: "Memory Management & Virtual Memory", completed: false, confidence: 3 }
      ]
    },
    {
      name: "Computer Networks",
      icon: "Globe",
      totalTopics: 6,
      totalPYQs: 50,
      solvedPYQs: 20,
      accuracy: 70.0,
      topics: [
        { name: "OSI & TCP/IP Protocol Stack", completed: true, confidence: 4 },
        { name: "Data Link Layer & Flow Control", completed: false, confidence: 3 },
        { name: "IP Addressing & Subnetting", completed: false, confidence: 3 }
      ]
    },
    {
      name: "Computer Organization / Architecture",
      icon: "HardDrive",
      totalTopics: 5,
      totalPYQs: 45,
      solvedPYQs: 15,
      accuracy: 68.0,
      topics: [
        { name: "Machine Instructions & Addressing Modes", completed: true, confidence: 3 },
        { name: "ALU, Data Path & Control Unit", completed: false, confidence: 2 }
      ]
    },
    {
      name: "Theory of Computation",
      icon: "Code",
      totalTopics: 5,
      totalPYQs: 40,
      solvedPYQs: 12,
      accuracy: 72.0,
      topics: [
        { name: "Regular Expressions & Finite Automata", completed: true, confidence: 4 }
      ]
    },
    {
      name: "Compiler Design",
      icon: "Workflow",
      totalTopics: 4,
      totalPYQs: 30,
      solvedPYQs: 8,
      accuracy: 65.0,
      topics: [
        { name: "Lexical Analysis & Parsing", completed: false, confidence: 2 }
      ]
    },
    {
      name: "Probability & Statistics",
      icon: "Calculator",
      totalTopics: 5,
      totalPYQs: 35,
      solvedPYQs: 18,
      accuracy: 80.0,
      topics: [
        { name: "Conditional Probability & Bayes Theorem", completed: true, confidence: 4 },
        { name: "Random Variables & Probability Distributions", completed: false, confidence: 3 }
      ]
    },
    {
      name: "General Aptitude",
      icon: "Sparkles",
      totalTopics: 4,
      totalPYQs: 40,
      solvedPYQs: 30,
      accuracy: 88.0,
      topics: [
        { name: "Numerical Computation & Quant", completed: true, confidence: 5 },
        { name: "Verbal Reasoning", completed: true, confidence: 5 }
      ]
    }
  ];

  for (const s of gateSubjectsData) {
    const createdSub = await prisma.gateSubject.create({
      data: {
        name: s.name,
        icon: s.icon,
        totalTopics: s.totalTopics,
        totalPYQs: s.totalPYQs,
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
          confidence: 3
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

  // 8. No sample practice problems on a clean install — the Practice page
  // empty state guides the first log.

  // 9. Flagship Projects — clean slate (structure kept, progress zeroed)
  const projectsData = [
    {
      name: "Full Stack SaaS Project",
      description: "Production-grade Full Stack web application with React, Node.js, PostgreSQL, and JWT auth.",
      goal: "Ship full end-to-end deployable SaaS application.",
      techStack: JSON.stringify(["React", "Node.js", "Express", "PostgreSQL", "JWT", "Tailwind CSS"]),
      progress: 35,
      milestoneStage: "Implementation",
      tasks: [
        { milestoneStage: "Planning", title: "User Stories & API Specs", completed: true },
        { milestoneStage: "Architecture", title: "Database ERD & Component Architecture", completed: true },
        { milestoneStage: "Implementation", title: "Express Server Setup & JWT Auth Middleware", completed: true },
        { milestoneStage: "Implementation", title: "React Component Hierarchy & State Management", completed: false },
        { milestoneStage: "Testing", title: "Postman Integration Tests", completed: false },
        { milestoneStage: "Optimization", title: "PostgreSQL Index Optimization", completed: false },
        { milestoneStage: "Deployment", title: "Deploy to Render/Vercel", completed: false },
        { milestoneStage: "Documentation", title: "Write GitHub README & API Docs", completed: false },
        { milestoneStage: "Demo", title: "Record 2-Minute Demo Video", completed: false }
      ]
    },
    {
      name: "ML Prediction API",
      description: "End-to-end ML pipeline with data cleaning, model comparison, evaluation, and FastAPI serving.",
      goal: "Deploy ML Model API with high F1-score.",
      techStack: JSON.stringify(["Python", "Scikit-Learn", "Pandas", "FastAPI", "Uvicorn"]),
      progress: 20,
      milestoneStage: "Architecture",
      tasks: [
        { milestoneStage: "Planning", title: "Problem Definition & Dataset Selection", completed: true },
        { milestoneStage: "Architecture", title: "Preprocessing & Feature Engineering Pipeline", completed: false },
        { milestoneStage: "Implementation", title: "Model Training & Hyperparameter Tuning", completed: false },
        { milestoneStage: "Testing", title: "Confusion Matrix & F1-Score Validation", completed: false },
        { milestoneStage: "Deployment", title: "FastAPI Prediction Endpoint", completed: false }
      ]
    },
    {
      name: "Generative AI Chatbot App",
      description: "AI Chatbot supporting streaming, conversation memory, system prompts, and function calling.",
      goal: "Build streaming AI assistant UI & backend.",
      techStack: JSON.stringify(["Next.js", "TypeScript", "OpenAI / Claude API", "Tailwind CSS"]),
      progress: 0,
      milestoneStage: "Planning",
      tasks: [
        { milestoneStage: "Planning", title: "System Prompt & Tool Definitions", completed: false },
        { milestoneStage: "Implementation", title: "Streaming Response Handler", completed: false }
      ]
    },
    {
      name: "Production-Style RAG Application",
      description: "Document ingestion, embeddings, vector database search, chunking strategy, and PDF chatbot.",
      goal: "PDF chatbot with high precision retrieval.",
      techStack: JSON.stringify(["Python", "LangChain", "ChromaDB", "OpenAI Embeddings", "Streamlit"]),
      progress: 0,
      milestoneStage: "Planning",
      tasks: [
        { milestoneStage: "Planning", title: "RAG Chunking Strategy & Evaluation Metrics", completed: false }
      ]
    },
    {
      name: "Autonomous Agentic AI Project",
      description: "Multi-tool autonomous agent with task decomposition, stateful memory, and security injection safeguards.",
      goal: "Build autonomous multi-step workflow agent.",
      techStack: JSON.stringify(["TypeScript", "Node.js", "AI Agent Framework", "Vector Memory"]),
      progress: 0,
      milestoneStage: "Planning",
      tasks: [
        { milestoneStage: "Planning", title: "Agent Tool Registry & ReAct Loop Architecture", completed: false }
      ]
    },
    {
      name: "Final Containerized Production System",
      description: "Master production build combining Full Stack + AI + Docker + CI/CD + Cloud + Redis + Monitoring.",
      goal: "Deploy containerized high-scalability production system.",
      techStack: JSON.stringify(["Docker", "Docker Compose", "AWS", "GitHub Actions", "Redis", "Prometheus"]),
      progress: 0,
      milestoneStage: "Planning",
      tasks: [
        { milestoneStage: "Planning", title: "Microservices Compose Architecture", completed: false }
      ]
    }
  ];

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
          completed: false
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
