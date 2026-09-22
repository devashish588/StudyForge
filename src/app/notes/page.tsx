"use client";

import React, { useState, useEffect, useMemo } from "react";
import { FileText, Pin, Repeat, Plus, Save, Trash2, Search } from "lucide-react";
import { PageShell, PageHeader, StatusBadge, ErrorState, PageSkeleton } from "@/components/study/ui";
import { cn } from "@/lib/cn";

interface Note {
  id: string; title: string; content: string; tags: string;
  isPinned: boolean; isRevision: boolean; createdAt: string; updatedAt: string;
  subjectId?: string | null; projectId?: string | null;
}

const safeTags = (s: string): string[] => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("All");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [isRevision, setIsRevision] = useState(false);
  const [linkSubject, setLinkSubject] = useState("");
  const [linkProject, setLinkProject] = useState("");
  const [linkOptions, setLinkOptions] = useState<{ subjects: { id: string; name: string }[]; projects: { id: string; name: string }[] }>({ subjects: [], projects: [] });
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchNotes = async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/notes");
      if (!res.ok) throw new Error("Notes failed to load");
      const data = await res.json();
      setNotes(data || []);
      if (data?.length && !selectedId) select(data[0], data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotes(); }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/gate").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/projects").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([g, p]) => {
      setLinkOptions({
        subjects: (g?.subjects || []).map((s: any) => ({ id: s.id, name: s.name })),
        projects: (p || []).map((x: any) => ({ id: x.id, name: x.name })),
      });
    });
  }, []);

  const select = (n: Note, list: Note[] = notes) => {
    void list;
    setSelectedId(n.id);
    setTitle(n.title); setContent(n.content);
    setIsPinned(n.isPinned); setIsRevision(n.isRevision);
    setLinkSubject(n.subjectId || ""); setLinkProject(n.projectId || "");
    setTagInput(safeTags(n.tags).join(", "));
    setDirty(false);
  };

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const n of notes) for (const t of safeTags(n.tags)) s.add(t);
    return ["All", ...[...s].sort()];
  }, [notes]);

  const filtered = notes.filter((n) => {
    const q = query.toLowerCase();
    const matchQ = !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
    const matchT = tagFilter === "All" || safeTags(n.tags).includes(tagFilter);
    return matchQ && matchT;
  });

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  const createNew = () => {
    setSelectedId(null);
    setTitle("New Topic Note");
    setContent("# Notes Title\n\n- Key point 1\n- Key point 2\n");
    setTagInput("");
    setIsPinned(false); setIsRevision(false);
    setLinkSubject(""); setLinkProject("");
    setDirty(true);
  };

  const save = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      if (selected) {
        const res = await fetch("/api/notes", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selected.id, title, content, isPinned, isRevision, subjectId: linkSubject || null, projectId: linkProject || null }),
        });
        if (!res.ok) throw new Error("Save failed");
      } else {
        const res = await fetch("/api/notes", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content, tags: tagInput.split(",").map((t) => t.trim()).filter(Boolean), isPinned, isRevision, subjectId: linkSubject || undefined, projectId: linkProject || undefined }),
        });
        if (!res.ok) throw new Error("Save failed");
        const created = await res.json();
        setSelectedId(created.id);
      }
      setDirty(false);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
      const res = await fetch("/api/notes");
      if (res.ok) setNotes(await res.json());
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const removeNote = async () => {
    if (!selected || saving) return;
    if (!window.confirm(`Delete "${selected.title}"?`)) return;
    try {
      const res = await fetch(`/api/notes?id=${selected.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setNotes((ns) => ns.filter((n) => n.id !== selected.id));
      setSelectedId(null); setTitle(""); setContent(""); setDirty(false);
    } catch (e) { console.error(e); }
  };

  if (loading) return <PageSkeleton />;
  if (loadError) return <PageShell wide><ErrorState message={loadError} onRetry={fetchNotes} /></PageShell>;

  return (
    <PageShell wide>
      <PageHeader
        icon={<FileText className="w-7 h-7 text-accent" />}
        title="Notes"
        sub="Linked study cards — pin the critical ones, push formulas into revision."
        actions={
          <button onClick={createNew} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-accent-hover">
            <Plus className="w-4 h-4" /> New Note
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* List pane */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-border/30 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-gray-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes…" aria-label="Search notes"
              className="w-full bg-transparent text-xs text-card-foreground placeholder:text-gray-500 focus:outline-none" />
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {allTags.map((t) => (
              <button key={t} onClick={() => setTagFilter(t)}
                className={cn("rounded-lg border px-2 py-1 text-[10px] font-bold transition",
                  tagFilter === t ? "border-accent bg-accent text-white" : "border-border bg-border/20 text-gray-400")}>
                {t}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[11px] font-bold text-gray-500">{filtered.length} notes{dirty && !selected ? " • unsaved draft" : ""}</p>
          <div className="max-h-[480px] space-y-2 overflow-y-auto">
            {filtered.map((n) => (
              <button key={n.id} onClick={() => select(n)}
                className={cn("w-full rounded-xl border p-3 text-left transition",
                  selectedId === n.id ? "border-accent bg-accent/10" : "border-border/40 bg-border/20 hover:border-gray-500")}>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-bold text-card-foreground">{n.title}</span>
                  {n.isPinned && <Pin className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                </span>
                <span className="mt-1 line-clamp-2 block text-[11px] text-gray-400">{n.content.replace(/[#*]/g, "")}</span>
                <span className="mt-1.5 flex flex-wrap gap-1">
                  {safeTags(n.tags).slice(0, 3).map((t) => <StatusBadge key={t} tone="gray">{t}</StatusBadge>)}
                  {n.isRevision && <StatusBadge tone="green">revision</StatusBadge>}
                  {n.subjectId && <StatusBadge tone="purple">{linkOptions.subjects.find((s) => s.id === n.subjectId)?.name || "GATE"}</StatusBadge>}
                  {n.projectId && <StatusBadge tone="indigo">{linkOptions.projects.find((p) => p.id === n.projectId)?.name || "project"}</StatusBadge>}
                </span>
              </button>
            ))}
            {filtered.length === 0 && <p className="py-6 text-center text-xs text-gray-500">No notes match. Create one above.</p>}
          </div>
        </div>

        {/* Editor pane */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4 lg:col-span-2">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} placeholder="Note title…"
              className="flex-1 rounded-xl border border-border bg-border/30 px-3.5 py-2 text-sm font-bold text-card-foreground placeholder:text-gray-500 focus:outline-none focus:border-accent" />
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => { setIsPinned(!isPinned); setDirty(true); }}
                className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                  isPinned ? "border-amber-500 bg-amber-500/20 text-amber-400" : "border-border bg-border/20 text-gray-400")}>
                <Pin className="h-3.5 w-3.5" /> {isPinned ? "Pinned" : "Pin"}
              </button>
              <button type="button" onClick={() => { setIsRevision(!isRevision); setDirty(true); }}
                className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                  isRevision ? "border-emerald-500 bg-emerald-500/20 text-emerald-400" : "border-border bg-border/20 text-gray-400")}>
                <Repeat className="h-3.5 w-3.5" /> {isRevision ? "In Revision" : "+ Revision"}
              </button>
            </div>
          </div>

          <input value={tagInput} onChange={(e) => { setTagInput(e.target.value); setDirty(true); }} placeholder="Tags, comma separated (e.g. DSA, Formulas)"
            aria-label="Tags" className="w-full rounded-xl border border-border bg-border/30 px-3.5 py-2 text-xs text-card-foreground placeholder-gray-500 focus:outline-none focus:border-accent" />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-gray-500" htmlFor="note-subject">Linked GATE subject (optional)</label>
              <select id="note-subject" value={linkSubject} onChange={(e) => { setLinkSubject(e.target.value); setDirty(true); }}
                className="w-full rounded-xl border border-border bg-border/30 px-3 py-2 text-xs text-card-foreground focus:outline-none focus:border-accent">
                <option value="">No subject link</option>
                {linkOptions.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-gray-500" htmlFor="note-project">Linked project (optional)</label>
              <select id="note-project" value={linkProject} onChange={(e) => { setLinkProject(e.target.value); setDirty(true); }}
                className="w-full rounded-xl border border-border bg-border/30 px-3 py-2 text-xs text-card-foreground focus:outline-none focus:border-accent">
                <option value="">No project link</option>
                {linkOptions.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <textarea rows={14} value={content} onChange={(e) => { setContent(e.target.value); setDirty(true); }} placeholder="Write Markdown notes here…"
            className="w-full rounded-xl border border-border bg-border/30 p-4 font-mono text-xs text-card-foreground placeholder-gray-500 focus:outline-none focus:border-accent" />

          <div className="flex items-center justify-between">
            {selected ? (
              <button onClick={removeNote} className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-gray-500 transition hover:border-rose-500/40 hover:text-rose-400">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            ) : <span />}
            <button onClick={save} disabled={saving || !title.trim()}
              className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-accent-hover disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving ? "Saving…" : savedTick ? "Saved ✓" : dirty ? "Save*" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
