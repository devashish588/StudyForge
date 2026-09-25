"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, X, CheckSquare, Clock, Plus, BookOpen, Repeat, AlertCircle, BarChart3, CalendarCheck, Sparkles, MoonStar } from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (isOpen) setSearch("");
  }, [isOpen]);

  if (!isOpen) return null;

  const go = (href: string) => { router.push(href); onClose(); };

  const commands: { group: "Study" | "Navigate" | "Create" | "GATE" | "System"; title: string; icon: any; action: () => void }[] = [
    { group: "Study", title: "Start Session (Today)", icon: Clock, action: () => go("/today") },
    { group: "Study", title: "Generate My Day", icon: Sparkles, action: () => go("/dashboard") },
    { group: "Study", title: "Daily Wrap-Up", icon: MoonStar, action: () => go("/today") },
    { group: "Study", title: "Open Study Board", icon: Clock, action: () => go("/board") },
    { group: "Navigate", title: "Open Today's Plan", icon: CheckSquare, action: () => go("/today") },
    { group: "Navigate", title: "Open Dashboard", icon: CalendarCheck, action: () => go("/dashboard") },
    { group: "Navigate", title: "Open Planner (Day/Week/Month)", icon: CalendarCheck, action: () => go("/planner") },
    { group: "Navigate", title: "Open Learn Hub", icon: BookOpen, action: () => go("/learn") },
    { group: "Navigate", title: "Open AI Engineering", icon: BookOpen, action: () => go("/ai-engineering") },
    { group: "Navigate", title: "Open Software Engineering", icon: BookOpen, action: () => go("/software-engineering") },
    { group: "Navigate", title: "Open DSA Hub", icon: BookOpen, action: () => go("/dsa") },
    { group: "Navigate", title: "Open Roadmap", icon: BookOpen, action: () => go("/roadmap") },
    { group: "Navigate", title: "Open Spaced Revision", icon: Repeat, action: () => go("/revision") },
    { group: "Navigate", title: "Open Analytics", icon: BarChart3, action: () => go("/analytics") },
    { group: "Navigate", title: "Open Streak", icon: CalendarCheck, action: () => go("/streak") },
    { group: "Navigate", title: "Open Calendar", icon: CalendarCheck, action: () => go("/calendar") },
    { group: "Navigate", title: "Open Reviews", icon: BookOpen, action: () => go("/reviews") },
    { group: "Create", title: "Add Practice Problem", icon: Plus, action: () => go("/practice") },
    { group: "Create", title: "Add Note", icon: Plus, action: () => go("/notes") },
    { group: "GATE", title: "Open GATE Dashboard", icon: BookOpen, action: () => go("/gate") },
    { group: "GATE", title: "Open GATE Error Log", icon: AlertCircle, action: () => go("/gate/errors") },
    { group: "GATE", title: "Log GATE PYQ", icon: Plus, action: () => go("/gate/questions") },
    { group: "Study", title: "Complete Current Task (Today)", icon: CheckSquare, action: () => go("/today") },
    { group: "System", title: "Open Settings", icon: Search, action: () => go("/settings") },
  ];

  const filtered = commands.filter((c) => `${c.group} ${c.title}`.toLowerCase().includes(search.toLowerCase()));
  const groups = ["Study", "Navigate", "Create", "GATE", "System"] as const;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-20 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-gray-400 mr-2" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command or search… (try: session, wrap-up, PYQ)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered[0]) { filtered[0].action(); }
              if (e.key === "Escape") onClose();
            }}
            className="w-full bg-transparent text-sm text-card-foreground placeholder-gray-500 focus:outline-none"
          />
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close commands">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-500 p-4 text-center">No commands found.</p>
          ) : (
            groups.map((g) => {
              const inGroup = filtered.filter((c) => c.group === g);
              if (inGroup.length === 0) return null;
              return (
                <div key={g}>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-500">{g}</p>
                  {inGroup.map((cmd, idx) => {
                    const Icon = cmd.icon;
                    return (
                      <button
                        key={`${g}-${idx}`}
                        onClick={() => cmd.action()}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium text-gray-300 hover:bg-accent/20 hover:text-white transition"
                      >
                        <Icon className="w-4 h-4 text-accent" />
                        <span>{cmd.title}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
