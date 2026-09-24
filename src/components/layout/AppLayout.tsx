"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  Map,
  BookOpen,
  Brain,
  Server,
  Code2,
  Repeat,
  FolderGit2,
  Calendar,
  BarChart3,
  FileText,
  FileSpreadsheet,
  Settings,
  Printer,
  Monitor,
  Search,
  Flame,
  Sun,
  Moon,
  Clock,
  Menu,
  X,
  MoreHorizontal,
  GraduationCap,
  CurlyBraces
} from "lucide-react";
import CommandPalette from "@/components/ui/CommandPalette";
import TimerModal from "@/components/ui/TimerModal";
import { testDayNumber, TEST_DAYS } from "@/lib/testmode";

const mainNav = [
  { name: "Today", href: "/today", icon: CalendarCheck },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Roadmap", href: "/roadmap", icon: Map },
  { name: "GATE 2027", href: "/gate", icon: BookOpen },
  { name: "AI Engineering", href: "/ai-engineering", icon: Brain },
  { name: "Software Engineering", href: "/software-engineering", icon: Server },
  { name: "DSA", href: "/dsa", icon: CurlyBraces },
  { name: "Practice", href: "/practice", icon: Code2 },
  { name: "Revision", href: "/revision", icon: Repeat },
  { name: "Projects", href: "/projects", icon: FolderGit2 },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

const secondaryNav = [
  { name: "Streak", href: "/streak", icon: Flame },
  { name: "Notes", href: "/notes", icon: FileText },
  { name: "Reviews", href: "/reviews", icon: FileSpreadsheet },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Print Planner", href: "/print", icon: Printer },
  { name: "Wall Mode", href: "/wall-mode", icon: Monitor },
];

const navItems = [...mainNav, ...secondaryNav];

const PAGE_LABELS: Record<string, string> = {
  "/today": "Today",
  "/dashboard": "Dashboard",
  "/roadmap": "Roadmap",
  "/gate": "GATE 2027",
  "/ai-engineering": "AI Engineering",
  "/software-engineering": "Software Engineering",
  "/dsa": "DSA",
  "/learn": "Learn",
  "/practice": "Practice",
  "/revision": "Revision",
  "/projects": "Projects",
  "/calendar": "Calendar",
  "/analytics": "Analytics",
  "/notes": "Notes",
  "/reviews": "Reviews",
  "/streak": "Streak",
  "/settings": "Settings",
  "/print": "Print Planner",
  "/wall-mode": "Wall Mode",
  "/board": "Study Board",
};

function pageLabel(pathname: string): string {
  if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname];
  if (pathname.startsWith("/gate/")) return "GATE Subject";
  if (pathname.startsWith("/roadmap/")) return "Roadmap Task";
  if (pathname.startsWith("/projects/")) return "Project";
  return "StudyForge";
}

const bottomTabs = [
  { name: "Today", href: "/today", icon: CalendarCheck },
  { name: "Learn", href: "/learn", icon: GraduationCap },
  { name: "Build", href: "/projects", icon: FolderGit2 },
  { name: "Review", href: "/revision", icon: Repeat },
];

const LEARN_PATHS = ["/learn", "/gate", "/ai-engineering", "/software-engineering", "/dsa", "/roadmap", "/practice"];

const moreItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Roadmap", href: "/roadmap", icon: Map },
  { name: "GATE 2027", href: "/gate", icon: BookOpen },
  { name: "AI Engineering", href: "/ai-engineering", icon: Brain },
  { name: "Software Engineering", href: "/software-engineering", icon: Server },
  { name: "DSA", href: "/dsa", icon: CurlyBraces },
  { name: "Practice", href: "/practice", icon: Code2 },
  { name: "Projects", href: "/projects", icon: FolderGit2 },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Notes", href: "/notes", icon: FileText },
  { name: "Reviews", href: "/reviews", icon: FileSpreadsheet },
  { name: "Streak", href: "/streak", icon: Flame },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      try {
        if (window.localStorage.getItem("sf-theme") === "light") {
          document.documentElement.classList.add("light");
          return "light";
        }
      } catch { /* noop */ }
    }
    return "dark";
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    // Streak indicator: cached 60s to avoid refetching the full dashboard payload
    // on every navigation.
    try {
      const cached = sessionStorage.getItem("sf:streak-cache");
      if (cached) {
        const { value, at } = JSON.parse(cached);
        if (Date.now() - at < 60000) {
          setStreak(value);
          return;
        }
      }
    } catch { /* noop */ }
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d?.streak) {
          setStreak(d.streak.current);
          try { sessionStorage.setItem("sf:streak-cache", JSON.stringify({ value: d.streak.current, at: Date.now() })); } catch { /* noop */ }
        }
      })
      .catch(() => {});
  }, [pathname]);

  // Real-world test mode: lightweight local usage log (route + timestamp, no content).
  useEffect(() => {
    try {
      if (window.localStorage.getItem("sf:testmode") !== "on") return;
      const raw = window.localStorage.getItem("sf:usage");
      const log = raw ? JSON.parse(raw) : [];
      log.push({ route: pathname, at: Date.now() });
      window.localStorage.setItem("sf:usage", JSON.stringify(log.slice(-2000)));
    } catch { /* noop */ }
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // PWA: register the offline shell service worker (production only).
  useEffect(() => {
    try {
      if (process.env.NODE_ENV !== "production") return;
      if (!("serviceWorker" in navigator)) return;
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    } catch { /* noop */ }
  }, []);

  const toggleTheme = () => {
    const isLight = document.documentElement.classList.contains("light");
    const nextTheme = isLight ? "dark" : "light";
    setTheme(nextTheme);
    if (nextTheme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
    try { window.localStorage.setItem("sf-theme", nextTheme); } catch { /* noop */ }
  };

  return (
    <div className={`min-h-screen ${theme === "light" ? "light" : ""} bg-background text-foreground flex flex-col md:flex-row`}>
      {/* Desktop Sidebar */}
      <aside className="no-print hidden md:flex flex-col w-64 border-r border-border bg-card p-4 shrink-0 sticky top-0 h-screen overflow-y-auto">
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <Link href="/today" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-lg shadow-md">
              S
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight leading-none text-card-foreground">StudyForge</h1>
              <p className="text-[10px] text-muted-foreground text-gray-400 mt-0.5">Master GATE • Ship Projects</p>
            </div>
          </Link>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="space-y-2 mb-4">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-border/40 hover:bg-border transition text-gray-300"
          >
            <span className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-gray-400" /> Search...
            </span>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-card border border-border rounded text-gray-400">Ctrl+K</kbd>
          </button>

          <button
            onClick={() => setTimerOpen(true)}
            className="w-full flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-accent/10 border border-accent/20 text-accent font-medium hover:bg-accent/20 transition"
          >
            <Clock className="w-3.5 h-3.5" /> Start Focus Session
          </button>
        </div>

        {/* Nav Links — primary */}
        <nav className="flex-1 space-y-1" aria-label="Primary">
          {mainNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition ${
                  isActive
                    ? "bg-accent text-white shadow-sm"
                    : "text-gray-400 hover:text-foreground hover:bg-border/30"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Nav Links — secondary */}
        <nav className="mt-2 space-y-1 border-t border-border/60 pt-3" aria-label="Secondary">
          {secondaryNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition ${
                  isActive
                    ? "bg-accent text-white shadow-sm"
                    : "text-gray-400 hover:text-foreground hover:bg-border/30"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer User & Theme Toggle */}
        <div className="pt-4 border-t border-border mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-accent to-purple-500 flex items-center justify-center text-white text-xs font-bold">
              D
            </div>
            <div>
              <p className="text-xs font-semibold text-card-foreground">Devashish</p>
              <Link href="/streak" className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium hover:underline">
                <Flame className="w-3 h-3 fill-emerald-400" /> 🔥 {streak === null ? "…" : `${streak} Day`} Streak
              </Link>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg border border-border hover:bg-border text-gray-400 hover:text-foreground transition"
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="no-print pt-safe md:hidden flex items-center justify-between p-4 bg-card border-b border-border sticky top-0 z-40">
        <Link href="/today" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-sm">
            S
          </div>
          <span className="font-bold text-sm text-card-foreground">StudyForge</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTimerOpen(true)}
            className="p-2 rounded-lg bg-accent/10 border border-accent/20 text-accent"
          >
            <Clock className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg border border-border text-gray-300"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="no-print md:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-md p-6 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
            <span className="font-bold text-lg text-card-foreground">StudyForge Navigation</span>
            <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-gray-400">
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                    pathname === item.href ? "bg-accent text-white" : "text-gray-300 hover:bg-border/30"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto min-h-screen p-4 pb-20 md:p-8 md:pb-8">
        {/* Minimal desktop top bar: page · streak · search · profile */}
        <div className="no-print mb-6 hidden items-center justify-between md:flex">
          <p className="text-sm font-semibold text-gray-400">
            <Link href="/today" className="hover:text-gray-200">StudyForge</Link>
            <span className="mx-2 text-gray-600">/</span>
            <span className="text-gray-200">{pageLabel(pathname)}</span>
          </p>
          <div className="flex items-center gap-2">
            <Link href="/streak" className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-orange-300 transition hover:border-orange-500/40" aria-label={`${streak ?? 0} day streak`}>
              <Flame className="h-3.5 w-3.5 fill-orange-400 text-orange-400" /> {streak === null ? "…" : streak}
            </Link>
            <button onClick={() => setCommandPaletteOpen(true)} aria-label="Search and commands"
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-gray-400 transition hover:text-gray-200">
              <Search className="h-3.5 w-3.5" />
              <kbd className="rounded border border-border bg-border/40 px-1.5 py-0.5 text-[10px]">Ctrl+K</kbd>
            </button>
            <Link href="/settings" aria-label="Profile and settings"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-accent to-purple-500 text-xs font-bold text-white">
              D
            </Link>
          </div>
        </div>
        <TestModeBanner />
        <NetworkStatus />
        {children}
      </main>

      {/* Mobile Bottom Navigation: Today / Learn / Build / Review / More */}
      <nav className="no-print pb-safe md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex items-center justify-around py-2 px-1">
        {bottomTabs.map((t) => {
          const Icon = t.icon;
          const active = t.href === "/learn"
            ? LEARN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
            : t.href === "/projects"
              ? pathname.startsWith("/projects")
              : t.href === "/revision"
                ? pathname.startsWith("/revision")
                : pathname === t.href;
          return (
            <Link key={t.href} href={t.href} className={`flex flex-col items-center gap-0.5 text-[10px] min-w-[56px] py-1 ${active ? "text-accent font-bold" : "text-gray-400"}`}>
              <Icon className="w-4 h-4" />
              <span>{t.name}</span>
            </Link>
          );
        })}
        <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-0.5 text-[10px] min-w-[56px] py-1 text-gray-400">
          <MoreHorizontal className="w-4 h-4" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile More sheet */}
      {moreOpen && (
        <div className="no-print md:hidden fixed inset-0 z-50 flex items-end" role="dialog" aria-label="More navigation">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMoreOpen(false)} />
          <div className="relative w-full bg-card border-t border-border rounded-t-2xl p-4 pb-8 pb-safe animate-fadeIn max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-card-foreground">More</span>
              <button onClick={() => setMoreOpen(false)} className="p-2 text-gray-400" aria-label="Close more menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
  // Study Board renders chromeless (no sidebar/topbar/bottom nav) for far-view display.
  if (pathname === "/board") {
    return <div className={`min-h-screen ${theme === "light" ? "light" : ""} bg-background text-foreground`}>{children}</div>;
  }

  return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-border/20 px-2 py-3 text-[11px] font-semibold text-gray-300"
                  >
                    <Icon className="w-5 h-5 text-accent" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <TimerModal isOpen={timerOpen} onClose={() => setTimerOpen(false)} />
    </div>
  );
}

function NetworkStatus() {
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    setOnline(navigator.onLine);
    const goOff = () => setOnline(false);
    const goOn = () => setOnline(true);
    window.addEventListener("offline", goOff);
    window.addEventListener("online", goOn);
    return () => {
      window.removeEventListener("offline", goOff);
      window.removeEventListener("online", goOn);
    };
  }, []);
  if (online) return null;
  return (
    <div className="no-print fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full border border-amber-500/40 bg-card px-4 py-2 text-xs font-bold text-amber-300 shadow-lg md:bottom-6" role="status">
      Offline — reads work from cache, writes will sync when you reconnect
    </div>
  );
}

function TestModeBanner() {
  const [day, setDay] = React.useState<number | null>(null);
  React.useEffect(() => { setDay(testDayNumber()); }, []);
  if (day === null) return null;
  return (
    <div className="no-print mb-4 flex items-center justify-between rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-xs">
      <span className="font-bold text-indigo-200">REAL-WORLD TEST MODE — DAY {day} OF {TEST_DAYS}</span>
      <Link href="/reviews" className="font-bold text-indigo-300 hover:underline">7-day report →</Link>
    </div>
  );
}
