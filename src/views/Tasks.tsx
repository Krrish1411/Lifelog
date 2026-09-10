import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CalendarPlus,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock,
  Inbox,
  ListChecks,
  Pencil,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Trash2,
  Zap,
  Layers,
  FileText,
  ArrowUpDown,
  GripVertical,
  SlidersHorizontal,
  Filter,
} from "lucide-react";
import type { Priority, Project, Subtask, Task } from "../types";
import { useApp } from "../store";
import {
  describeRecurrence,
  fmtClock,
  fmtDayShort,
  fmtDur,
  isoDate,
  normalizeHex,
  sessionMinutes,
  todayIso,
  uid,
} from "../utils/core";
import {
  Btn,
  ColorPicker,
  EmojiPicker,
  EmptyState,
  Labeled,
  Modal,
  SearchInput,
  TextInput,
  cn,
} from "../components/ui";
import { announce } from "../components/LiveAnnouncer";
import { triggerHaptic } from "../utils/native";

const PRIORITY_META: Record<Priority, { label: string; color: string; icon: string }> = {
  urgent: { label: "Urgent", color: "#d66853", icon: "🔴" },
  high: { label: "High", color: "#e0b457", icon: "🟠" },
  medium: { label: "Medium", color: "#6fbf8e", icon: "🟡" },
  low: { label: "Low", color: "#8b93a5", icon: "⚪" },
};
const PRIORITY_ORDER: Priority[] = ["urgent", "high", "medium", "low"];

type SmartView =
  | "inbox"
  | "today"
  | "all"
  | { project: string }
  | { tag: string }
  | { priority: Priority };

function viewKey(v: SmartView): string {
  if (typeof v === "string") return v;
  if ("project" in v) return `p:${v.project}`;
  if ("tag" in v) return `t:${v.tag}`;
  return `pr:${v.priority}`;
}

export function TasksView({
  filter,
  onFilterChange,
  onOpenDrawer,
  projModalOpen,
  setProjModalOpen,
}: {
  filter?: SmartView | { project: string } | { tag: string } | { priority: Priority };
  onFilterChange?: (f: any) => void;
  onOpenDrawer?: () => void;
  projModalOpen?: boolean;
  setProjModalOpen?: (v: boolean) => void;
} = {}) {
  const app = useApp();
  const { state, set, toast, confirm, openTaskDialog, requestFocus, toggleDone } = app;
  const today = todayIso();
  const [internalSel, setInternalSel] = useState<SmartView | { project: string } | { tag: string } | { priority: Priority }>("today");
  const sel = filter ?? internalSel;
  const setSel = (newSel: any) => {
    setInternalSel(newSel);
    onFilterChange?.(newSel);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [sel]);

  useEffect(() => {
    if (projModalOpen) {
      setProjDialog({ open: true, project: null });
      setProjModalOpen?.(false);
    }
  }, [projModalOpen, setProjModalOpen]);

  const [query, setQuery] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [completedLimit, setCompletedLimit] = useState(25);
  const [sortMode, setSortMode] = useState<"manual" | "due" | "priority">(
    state.settings.taskSortMode ?? "manual"
  );

  const [projDialog, setProjDialog] = useState<{ open: boolean; project: Project | null }>({
    open: false,
    project: null,
  });
  const [projName, setProjName] = useState("");
  const [projEmoji, setProjEmoji] = useState("🌐");
  const [projColor, setProjColor] = useState("#4fa3a5");

  const [tagMgr, setTagMgr] = useState<{ open: boolean; tag: string | null }>({
    open: false,
    tag: null,
  });
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#e8a33d");
  const [activeDragTask, setActiveDragTask] = useState<string | null>(null);
  const [activeDragProj, setActiveDragProj] = useState<string | null>(null);
  const [activeDragTag, setActiveDragTag] = useState<string | null>(null);

  const trackedByTask = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of state.sessions)
      if (s.taskId) m.set(s.taskId, (m.get(s.taskId) ?? 0) + sessionMinutes(s));
    return m;
  }, [state.sessions]);

  // Tag list with respect to tagOrder setting
  const allTags = useMemo(() => {
    const s = new Set<string>();
    state.tasks.forEach((t) => t.tags.forEach((x) => s.add(x)));
    const discovered = [...s];
    const order = state.settings.tagOrder ?? [];
    return discovered.sort((a, b) => {
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [state.tasks, state.settings.tagOrder]);

  const openTasks = useMemo(() => state.tasks.filter((t) => !t.done), [state.tasks]);
  const inboxCount = openTasks.filter((t) => !t.due).length;
  const todayCount = openTasks.filter(
    (t) => t.due && t.due <= today && (!t.snoozedUntil || t.snoozedUntil <= Date.now())
  ).length;
  const allCount = openTasks.length;

  const list = useMemo(() => {
    let base = openTasks;
    if (sel === "inbox") base = base.filter((t) => !t.due);
    else if (sel === "today")
      base = base.filter(
        (t) => t.due && t.due <= today && (!t.snoozedUntil || t.snoozedUntil <= Date.now())
      );
    else if (typeof sel === "object" && "project" in sel)
      base = base.filter((t) => t.projectId === sel.project);
    else if (typeof sel === "object" && "tag" in sel)
      base = base.filter((t) => t.tags.some((x) => x.toLowerCase() === sel.tag.toLowerCase()));
    else if (typeof sel === "object" && "priority" in sel)
      base = base.filter((t) => t.priority === sel.priority);

    const q = query.trim().toLowerCase();
    if (q)
      base = base.filter((t) =>
        `${t.title} ${t.notes} ${t.tags.join(" ")}`.toLowerCase().includes(q)
      );

    if (sortMode === "manual") {
      // Respect manual ordering (index in state.tasks)
      return [...base];
    } else if (sortMode === "due") {
      return [...base].sort((a, b) => {
        if (a.due && b.due && a.due !== b.due) return a.due.localeCompare(b.due);
        if (a.due && !b.due) return -1;
        if (!a.due && b.due) return 1;
        return 0;
      });
    } else {
      const pw = { urgent: 0, high: 1, medium: 2, low: 3 };
      return [...base].sort((a, b) => pw[a.priority] - pw[b.priority]);
    }
  }, [openTasks, sel, query, today, sortMode]);

  const completed = useMemo(() => {
    let base = state.tasks.filter((t) => t.done);
    if (typeof sel === "object" && "project" in sel)
      base = base.filter((t) => t.projectId === sel.project);
    else if (typeof sel === "object" && "tag" in sel)
      base = base.filter((t) => t.tags.some((x) => x.toLowerCase() === sel.tag.toLowerCase()));
    else if (typeof sel === "object" && "priority" in sel)
      base = base.filter((t) => t.priority === sel.priority);
    return base.sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  }, [state.tasks, sel]);

  const selTitle = useMemo(() => {
    if (sel === "inbox") return "Inbox";
    if (sel === "today") return "Today";
    if (sel === "all") return "All tasks";
    if ("project" in sel)
      return state.projects.find((p) => p.id === sel.project)?.name ?? "Project";
    if ("tag" in sel) return sel.tag;
    return PRIORITY_META[sel.priority].label;
  }, [sel, state.projects]);

  /* ---------------- reordering actions ---------------- */
  const moveTask = (taskId: string, dir: "top" | "up" | "down" | "bottom") => {
    const all = [...state.tasks];
    const idx = all.findIndex((t) => t.id === taskId);
    if (idx === -1) return;
    const item = all[idx];

    if (dir === "top") {
      all.splice(idx, 1);
      all.unshift(item);
      announce(`Moved "${item.title}" to top`);
      toast(`Moved to top`, "ok");
    } else if (dir === "bottom") {
      all.splice(idx, 1);
      all.push(item);
      announce(`Moved "${item.title}" to bottom`);
      toast(`Moved to bottom`, "ok");
    } else if (dir === "up" && idx > 0) {
      all[idx] = all[idx - 1];
      all[idx - 1] = item;
      announce(`Moved "${item.title}" up`);
    } else if (dir === "down" && idx < all.length - 1) {
      all[idx] = all[idx + 1];
      all[idx + 1] = item;
      announce(`Moved "${item.title}" down`);
    }
    set((s) => ({ ...s, tasks: all }));
  };

  const moveProject = (projId: string, dir: "top" | "up" | "down" | "bottom") => {
    const all = [...state.projects];
    const idx = all.findIndex((p) => p.id === projId);
    if (idx === -1) return;
    const item = all[idx];

    if (dir === "top") {
      all.splice(idx, 1);
      all.unshift(item);
    } else if (dir === "bottom") {
      all.splice(idx, 1);
      all.push(item);
    } else if (dir === "up" && idx > 0) {
      all[idx] = all[idx - 1];
      all[idx - 1] = item;
    } else if (dir === "down" && idx < all.length - 1) {
      all[idx] = all[idx + 1];
      all[idx + 1] = item;
    }
    set((s) => ({ ...s, projects: all }));
  };

  const moveTag = (tag: string, dir: "top" | "up" | "down" | "bottom") => {
    const cur = [...allTags];
    const idx = cur.indexOf(tag);
    if (idx === -1) return;
    const item = cur[idx];

    if (dir === "top") {
      cur.splice(idx, 1);
      cur.unshift(item);
    } else if (dir === "bottom") {
      cur.splice(idx, 1);
      cur.push(item);
    } else if (dir === "up" && idx > 0) {
      cur[idx] = cur[idx - 1];
      cur[idx - 1] = item;
    } else if (dir === "down" && idx < cur.length - 1) {
      cur[idx] = cur[idx + 1];
      cur[idx + 1] = item;
    }
    set((s) => ({ ...s, settings: { ...s.settings, tagOrder: cur } }));
  };

  /* Dynamic live drag-and-slide reordering (Super Productivity style) */
  const handleTaskLiveReorder = (targetId: string, clientY: number, targetRect: DOMRect) => {
    if (!activeDragTask || activeDragTask === targetId) return;
    const all = [...state.tasks];
    const srcIdx = all.findIndex((t) => t.id === activeDragTask);
    const tgtIdx = all.findIndex((t) => t.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;

    const isMovingDown = srcIdx < tgtIdx;
    const threshold = isMovingDown
      ? targetRect.top + targetRect.height * 0.35
      : targetRect.top + targetRect.height * 0.65;

    if ((isMovingDown && clientY > threshold) || (!isMovingDown && clientY < threshold)) {
      const [moved] = all.splice(srcIdx, 1);
      all.splice(tgtIdx, 0, moved);
      triggerHaptic("light");
      set((s) => ({ ...s, tasks: all }));
    }
  };

  const handleProjectLiveReorder = (targetId: string, clientY: number, targetRect: DOMRect) => {
    if (!activeDragProj || activeDragProj === targetId) return;
    const all = [...state.projects];
    const srcIdx = all.findIndex((p) => p.id === activeDragProj);
    const tgtIdx = all.findIndex((p) => p.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;

    const isMovingDown = srcIdx < tgtIdx;
    const threshold = isMovingDown
      ? targetRect.top + targetRect.height * 0.35
      : targetRect.top + targetRect.height * 0.65;

    if ((isMovingDown && clientY > threshold) || (!isMovingDown && clientY < threshold)) {
      const [moved] = all.splice(srcIdx, 1);
      all.splice(tgtIdx, 0, moved);
      triggerHaptic("light");
      set((s) => ({ ...s, projects: all }));
    }
  };

  const handleTagLiveReorder = (targetTag: string, clientY: number, targetRect: DOMRect) => {
    if (!activeDragTag || activeDragTag === targetTag) return;
    const cur = [...allTags];
    const srcIdx = cur.indexOf(activeDragTag);
    const tgtIdx = cur.indexOf(targetTag);
    if (srcIdx === -1 || tgtIdx === -1) return;

    const isMovingDown = srcIdx < tgtIdx;
    const threshold = isMovingDown
      ? targetRect.top + targetRect.height * 0.35
      : targetRect.top + targetRect.height * 0.65;

    if ((isMovingDown && clientY > threshold) || (!isMovingDown && clientY < threshold)) {
      const [moved] = cur.splice(srcIdx, 1);
      cur.splice(tgtIdx, 0, moved);
      triggerHaptic("light");
      set((s) => ({
        ...s,
        settings: { ...s.settings, tagOrder: cur },
      }));
    }
  };

  const reorderTasks = (sourceId: string, targetId: string, position: "before" | "after") => {
    if (sourceId === targetId) return;
    const all = [...state.tasks];
    const srcIdx = all.findIndex((t) => t.id === sourceId);
    const tgtIdx = all.findIndex((t) => t.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;

    const [moved] = all.splice(srcIdx, 1);
    const newTgtIdx = all.findIndex((t) => t.id === targetId);
    const insertIdx = position === "before" ? newTgtIdx : newTgtIdx + 1;
    all.splice(insertIdx, 0, moved);

    set((s) => ({ ...s, tasks: all }));
    announce(`Moved "${moved.title}" ${position} "${all[newTgtIdx]?.title || ""}"`);
    toast(`Task reordered`, "ok");
  };

  const reorderProjects = (sourceId: string, targetId: string, position: "before" | "after") => {
    if (sourceId === targetId) return;
    const all = [...state.projects];
    const srcIdx = all.findIndex((p) => p.id === sourceId);
    const tgtIdx = all.findIndex((p) => p.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;

    const [moved] = all.splice(srcIdx, 1);
    const newTgtIdx = all.findIndex((p) => p.id === targetId);
    const insertIdx = position === "before" ? newTgtIdx : newTgtIdx + 1;
    all.splice(insertIdx, 0, moved);

    set((s) => ({ ...s, projects: all }));
    toast(`Project reordered`, "ok");
  };

  const reorderTags = (sourceTag: string, targetTag: string, position: "before" | "after") => {
    if (sourceTag === targetTag) return;
    const cur = [...allTags];
    const srcIdx = cur.indexOf(sourceTag);
    const tgtIdx = cur.indexOf(targetTag);
    if (srcIdx === -1 || tgtIdx === -1) return;

    const [moved] = cur.splice(srcIdx, 1);
    const newTgtIdx = cur.indexOf(targetTag);
    const insertIdx = position === "before" ? newTgtIdx : newTgtIdx + 1;
    cur.splice(insertIdx, 0, moved);

    set((s) => ({
      ...s,
      settings: { ...s.settings, tagOrder: cur },
    }));
    toast(`Tag reordered`, "ok");
  };

  /* ---------------- projects ---------------- */
  const openProject = (p: Project | null) => {
    setProjDialog({ open: true, project: p });
    setProjName(p?.name ?? "");
    setProjEmoji(p?.emoji ?? "🌐");
    setProjColor(p?.color ?? "#4fa3a5");
  };
  const saveProject = () => {
    if (!projName.trim()) return toast("Project needs a name", "err");
    if (projDialog.project) {
      set((s) => ({
        ...s,
        projects: s.projects.map((p) =>
          p.id === projDialog.project!.id
            ? { ...p, name: projName.trim(), emoji: projEmoji, color: projColor }
            : p
        ),
      }));
      toast("Project updated", "ok");
    } else {
      const id = uid();
      set((s) => ({
        ...s,
        projects: [
          ...s.projects,
          { id, name: projName.trim(), emoji: projEmoji, color: projColor, createdAt: Date.now() },
        ],
      }));
      setSel({ project: id });
      toast("Project created", "ok");
    }
    setProjDialog({ open: false, project: null });
  };
  const deleteProject = async (projToDelete?: Project | null) => {
    const p = projToDelete ?? projDialog.project;
    if (!p) return;
    const taskCount = state.tasks.filter((t) => t.projectId === p.id).length;
    const ok = await confirm({
      title: `Delete project "${p.name}"?`,
      body: `“${p.name}” and its ${taskCount} task(s) will be permanently deleted. Tracked history stays in reports. This cannot be undone.`,
      confirmLabel: "Delete project",
      danger: true,
      requireText: p.name,
    });
    if (!ok) return;
    set((s) => ({
      ...s,
      projects: s.projects.filter((x) => x.id !== p.id),
      tasks: s.tasks.filter((t) => t.projectId !== p.id),
    }));
    setProjDialog({ open: false, project: null });
    setSel("today");
    toast(`Deleted project "${p.name}"`, "warn");
  };

  /* ---------------- tag manager ---------------- */
  const openTagMgr = (tag: string) => {
    setTagMgr({ open: true, tag });
    setTagName(tag);
    setTagColor(state.tagColors[tag] ?? "#e8a33d");
  };
  const saveTag = () => {
    const old = tagMgr.tag;
    const next = tagName.trim();
    if (!old) return;
    if (!next) return toast("Tag needs a name", "err");
    set((s) => {
      const tagColors = { ...s.tagColors };
      delete tagColors[old];
      tagColors[next] = normalizeHex(tagColor) ?? tagColor;
      return {
        ...s,
        tagColors,
        tasks:
          next === old
            ? s.tasks
            : s.tasks.map((t) =>
                t.tags.includes(old)
                  ? { ...t, tags: t.tags.map((x) => (x === old ? next : x)) }
                  : t
              ),
      };
    });
    if (typeof sel === "object" && "tag" in sel && sel.tag === old) setSel({ tag: next });
    setTagMgr({ open: false, tag: null });
    toast(next === old ? "Tag colour updated" : `Tag renamed to “${next}”`, "ok");
  };
  const deleteTag = async (tagToDelete?: string | null) => {
    const old = tagToDelete ?? tagMgr.tag;
    if (!old) return;
    const usedBy = state.tasks.filter((t) => t.tags.includes(old)).length;
    const ok = await confirm({
      title: `Delete tag "#${old}"?`,
      body: `“${old}” will be removed from ${usedBy} task(s). The tasks themselves stay.`,
      confirmLabel: "Delete tag",
      danger: true,
    });
    if (!ok) return;
    set((s) => {
      const tagColors = { ...s.tagColors };
      delete tagColors[old];
      return {
        ...s,
        tagColors,
        tasks: s.tasks.map((t) =>
          t.tags.includes(old) ? { ...t, tags: t.tags.filter((x) => x !== old) } : t
        ),
      };
    });
    if (typeof sel === "object" && "tag" in sel && sel.tag === old) setSel("all");
    setTagMgr({ open: false, tag: null });
    toast(`Deleted tag "#${old}"`, "warn");
  };

  const activeProject =
    typeof sel === "object" && "project" in sel
      ? state.projects.find((p) => p.id === sel.project) ?? null
      : null;
  const activeTag =
    typeof sel === "object" && "tag" in sel ? sel.tag : null;

  return (
    <div className="flex w-full max-w-full items-start gap-4">
      {/* Desktop Docked Sidebar (hidden on mobile, visible on lg+) */}
      <aside
        className="hidden lg:flex w-[230px] shrink-0 flex-col gap-3 sticky top-4 self-start rounded-2xl border bg-[var(--panel)] p-3 select-none"
        style={{ borderColor: "var(--line)" }}
      >
        {/* Smart Views */}
        <div className="flex flex-col gap-0.5">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--mut)" }}>
            Smart Views
          </div>
          {[
            { id: "today", label: "Today", icon: CalendarPlus, count: todayCount },
            { id: "inbox", label: "Inbox", icon: Inbox, count: inboxCount },
            { id: "all", label: "All Tasks", icon: ListChecks, count: allCount },
          ].map((sv) => {
            const active = typeof sel === "string" && sel === sv.id;
            const Icon = sv.icon;
            return (
              <button
                key={sv.id}
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setSel(sv.id as SmartView);
                }}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[12.5px] font-bold transition-all cursor-pointer text-left",
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--text)] hover:bg-[var(--panel2)]"
                )}
              >
                <Icon size={15} className={active ? "text-[var(--accent)]" : "text-[var(--mut)]"} />
                <span className="flex-1 truncate">{sv.label}</span>
                {sv.count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 font-mono text-[10.5px] font-bold tnum shrink-0",
                      active ? "bg-[var(--accent)] text-[var(--on-accent)]" : "bg-[var(--panel2)] text-[var(--mut)]"
                    )}
                  >
                    {sv.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Projects */}
        <div className="flex flex-col gap-0.5 border-t pt-2.5" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--mut)" }}>
              Projects
            </span>
            <button
              type="button"
              onClick={() => openProject(null)}
              className="text-[11px] font-bold text-[var(--accent)] hover:opacity-80 cursor-pointer"
              title="Add project"
            >
              <Plus size={13} />
            </button>
          </div>
          <div className="flex flex-col gap-0.5 max-h-[160px] overflow-y-auto pr-0.5">
            {state.projects.length === 0 && (
              <div className="px-2 py-1 text-[11px] text-[var(--mut)]">No projects yet</div>
            )}
            {state.projects.map((p) => {
              const active = typeof sel === "object" && "project" in sel && sel.project === p.id;
              const pCount = state.tasks.filter((t) => !t.done && t.projectId === p.id).length;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setSel({ project: p.id });
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12.5px] font-bold transition-all cursor-pointer text-left group",
                    active
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--text)] hover:bg-[var(--panel2)]"
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color || "#4fa3a5" }} />
                  <span className="flex-1 truncate">{p.name}</span>
                  {pCount > 0 && (
                    <span className="text-[10.5px] text-[var(--mut)] tnum">{pCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex flex-col gap-0.5 border-t pt-2.5" style={{ borderColor: "var(--line)" }}>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--mut)" }}>
              Tags
            </div>
            <div className="flex flex-wrap gap-1 px-1 max-h-[120px] overflow-y-auto">
              {allTags.map((tag) => {
                const active = typeof sel === "object" && "tag" in sel && sel.tag === tag;
                const tagColor = state.tagColors[tag] || "var(--accent)";
                const count = state.tasks.filter((t) => !t.done && t.tags.includes(tag)).length;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setSel({ tag });
                    }}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all cursor-pointer",
                      active
                        ? "bg-[var(--accent)] text-[var(--on-accent)]"
                        : "border border-[var(--line)] bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--panel2)]"
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? "#ffffff" : tagColor }} />
                    <span>#{tag}</span>
                    <span className="text-[9.5px] opacity-70 tnum">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Priority */}
        <div className="flex flex-col gap-0.5 border-t pt-2.5" style={{ borderColor: "var(--line)" }}>
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--mut)" }}>
            Priority
          </div>
          {PRIORITY_ORDER.map((pr) => {
            const active = typeof sel === "object" && "priority" in sel && sel.priority === pr;
            const meta = PRIORITY_META[pr];
            const count = state.tasks.filter((t) => !t.done && t.priority === pr).length;
            return (
              <button
                key={pr}
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setSel({ priority: pr });
                }}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-2.5 py-1 text-[12px] font-bold transition-all cursor-pointer text-left",
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--text)] hover:bg-[var(--panel2)]"
                )}
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: meta.color }} />
                <span className="flex-1 truncate">{meta.label}</span>
                {count > 0 && <span className="text-[10px] text-[var(--mut)] tnum">{count}</span>}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main Task List Area */}
      <div className="flex flex-1 min-w-0 flex-col gap-3.5 overflow-x-hidden">
        {/* Task list header & controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
          <div className="flex items-center justify-between w-full sm:w-auto gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {onOpenDrawer && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("medium");
                    onOpenDrawer();
                  }}
                  className="flex lg:hidden items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border bg-[var(--panel)] text-[var(--accent)] border-[var(--line)] shadow-xs hover:bg-[var(--panel2)] active:scale-95"
                  title="Open sidebar to filter tasks by project, tag or priority"
                >
                  <Filter size={13} />
                  <span>Filters</span>
                </button>
              )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-[20px] sm:text-[24px] font-bold tracking-tight truncate">
                  {selTitle}
                </h1>
                {activeProject && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openProject(activeProject)}
                      className="p-1.5 rounded-lg text-[var(--mut)] hover:text-[var(--text)] hover:bg-[var(--panel2)] transition-colors cursor-pointer"
                      title="Edit project"
                      aria-label="Edit project"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProject(activeProject)}
                      className="p-1.5 rounded-lg text-[var(--mut)] hover:text-[var(--danger)] hover:bg-[var(--panel2)] transition-colors cursor-pointer"
                      title="Delete project"
                      aria-label="Delete project"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
                {activeTag && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openTagMgr(activeTag)}
                      className="p-1.5 rounded-lg text-[var(--mut)] hover:text-[var(--text)] hover:bg-[var(--panel2)] transition-colors cursor-pointer"
                      title="Edit tag"
                      aria-label="Edit tag"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTag(activeTag)}
                      className="p-1.5 rounded-lg text-[var(--mut)] hover:text-[var(--danger)] hover:bg-[var(--panel2)] transition-colors cursor-pointer"
                      title="Delete tag"
                      aria-label="Delete tag"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[12px] font-semibold" style={{ color: "var(--mut)" }}>
                {list.length} open · {completed.length} completed
              </p>
            </div>
          </div>

          {/* Sort selector for mobile */}
          <div className="flex items-center gap-0.5 bg-[var(--panel2)] p-0.5 rounded-xl border border-[var(--line)] text-xs shrink-0 sm:hidden">
            {(["manual", "due", "priority"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSortMode(m)}
                className="px-2 py-0.5 rounded-[9px] font-bold whitespace-nowrap transition-all cursor-pointer text-[11px]"
                style={
                  sortMode === m
                    ? { background: "var(--accent)", color: "var(--on-accent)" }
                    : { color: "var(--mut)", background: "transparent" }
                }
              >
                {m === "manual" ? "Manual" : m === "due" ? "Due" : "Priority"}
              </button>
            ))}
          </div>
        </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Sort selector for desktop */}
            <div className="hidden sm:flex items-center gap-0.5 bg-[var(--panel2)] p-0.5 rounded-xl border border-[var(--line)] text-xs shrink-0">
              <ArrowUpDown size={12} className="text-[var(--color-mut)] mx-1" />
              {(["manual", "due", "priority"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSortMode(m)}
                  className="px-2.5 py-1 rounded-[9px] font-bold whitespace-nowrap transition-all cursor-pointer text-xs"
                  style={
                    sortMode === m
                      ? { background: "var(--accent)", color: "var(--on-accent)" }
                      : { color: "var(--mut)", background: "transparent" }
                  }
                >
                  {m === "manual" ? "Manual" : m === "due" ? "Due" : "Priority"}
                </button>
              ))}
            </div>

            <div className="flex-1 min-w-0">
              <SearchInput value={query} onChange={setQuery} placeholder="Search tasks…" />
            </div>

            <Btn
              variant="primary"
              onClick={() =>
                openTaskDialog({
                  projectId: typeof sel === "object" && "project" in sel ? sel.project : undefined,
                })
              }
              className="shrink-0"
            >
              <Plus size={13} /> <span>Task</span>
            </Btn>
          </div>
        </div>

        <div className="stagger mt-4 flex flex-col gap-2">
          {/* Top Drop Target for dropping to the very top in manual mode */}
          {sortMode === "manual" && list.length > 0 && (
            <div
              onDragOver={(e) => {
                if (!activeDragTask) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const first = list[0];
                if (first && activeDragTask !== first.id) {
                  const all = [...state.tasks];
                  const srcIdx = all.findIndex((t) => t.id === activeDragTask);
                  const firstIdx = all.findIndex((t) => t.id === first.id);
                  if (srcIdx !== -1 && firstIdx !== -1 && srcIdx > firstIdx) {
                    const [moved] = all.splice(srcIdx, 1);
                    all.splice(firstIdx, 0, moved);
                    set((s) => ({ ...s, tasks: all }));
                  }
                }
              }}
              className="h-2 -my-1 rounded-full transition-all bg-accent/20"
              title="Drag here to move to top"
            />
          )}

          {list.length === 0 && (
            <div className="card">
              <EmptyState
                icon={sel === "inbox" ? Inbox : ListChecks}
                title={sel === "inbox" ? "Inbox zero" : `Nothing in “${selTitle}”`}
                body={
                  query
                    ? "No tasks match your search."
                    : sel === "inbox"
                    ? "Tasks without a date land here. Give them a day or schedule them on the calendar."
                    : "Add a task and it will show up here."
                }
              >
                <Btn variant="primary" onClick={() => openTaskDialog()}>
                  <Plus size={13} /> New task
                </Btn>
              </EmptyState>
            </div>
          )}
          {list.map((t, idx) => (
            <TaskCard
              key={t.id}
              t={t}
              idx={idx}
              totalInList={list.length}
              sortMode={sortMode}
              tracked={trackedByTask.get(t.id) ?? 0}
              today={today}
              isDragging={activeDragTask === t.id}
              onDragStartTask={() => setActiveDragTask(t.id)}
              onDragEndTask={() => setActiveDragTask(null)}
              onLiveReorderTask={handleTaskLiveReorder}
              onToggle={() => toggleDone(t.id)}
              onEdit={() => openTaskDialog({ taskId: t.id })}
              onFocus={() => requestFocus(t.id)}
              onMove={(dir) => moveTask(t.id, dir)}
              onReorder={reorderTasks}
            />
          ))}
        </div>

        {/* Chunked Completed Tasks */}
        {completed.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setShowCompleted((v) => !v)}
              className="text-[12.5px] font-bold inline-flex items-center gap-1.5"
              style={{ color: "var(--mut)", cursor: "pointer" }}
            >
              {showCompleted ? "▾" : "▸"} {completed.length} completed — shown exactly as they were,
              with completion date
            </button>
            {showCompleted && (
              <div className="stagger mt-2 flex flex-col gap-2">
                {completed.slice(0, completedLimit).map((t) => (
                  <TaskCard
                    key={t.id}
                    t={t}
                    idx={0}
                    totalInList={1}
                    sortMode="due"
                    tracked={trackedByTask.get(t.id) ?? 0}
                    today={today}
                    completedAt={t.doneAt}
                    onToggle={() => toggleDone(t.id)}
                    onEdit={() => openTaskDialog({ taskId: t.id })}
                    onFocus={() => requestFocus(t.id)}
                    onMove={() => {}}
                  />
                ))}
                {completed.length > completedLimit && (
                  <div className="text-center py-2">
                    <Btn
                      variant="ghost"
                      size="sm"
                      onClick={() => setCompletedLimit((prev) => prev + 25)}
                    >
                      Load {Math.min(25, completed.length - completedLimit)} more completed tasks (
                      {completed.length - completedLimit} remaining)
                    </Btn>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      {/* ================= project dialog ================= */}
      <Modal
        open={projDialog.open}
        onClose={() => setProjDialog({ open: false, project: null })}
        title={projDialog.project ? "Edit project" : "New project"}
        width={480}
        footer={
          <>
            {projDialog.project && (
              <Btn variant="danger" className="mr-auto" onClick={() => deleteProject()}>
                <Trash2 size={13} /> Delete project
              </Btn>
            )}
            <Btn variant="ghost" onClick={() => setProjDialog({ open: false, project: null })}>
              Cancel
            </Btn>
            <Btn variant="primary" onClick={saveProject}>
              {projDialog.project ? "Save" : "Create"}
            </Btn>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Labeled label="Name">
            <TextInput
              autoFocus
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              placeholder="e.g. Side project"
            />
          </Labeled>
          <Labeled label="Emoji">
            <EmojiPicker value={projEmoji} onChange={setProjEmoji} />
          </Labeled>
          <Labeled label="Colour" hint="custom hex always available">
            <ColorPicker value={projColor} onChange={setProjColor} />
          </Labeled>
        </div>
      </Modal>

      {/* ================= tag manager dialog ================= */}
      <Modal
        open={tagMgr.open}
        onClose={() => setTagMgr({ open: false, tag: null })}
        title={
          <>
            Edit tag —{" "}
            <span style={{ color: state.tagColors[tagMgr.tag ?? ""] ?? "var(--accent)" }}>
              {tagMgr.tag}
            </span>
          </>
        }
        width={440}
        footer={
          <>
            <Btn variant="danger" className="mr-auto" onClick={() => deleteTag()}>
              <Trash2 size={13} /> Delete tag
            </Btn>
            <Btn variant="ghost" onClick={() => setTagMgr({ open: false, tag: null })}>
              Cancel
            </Btn>
            <Btn variant="primary" onClick={saveTag}>
              Save
            </Btn>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Labeled label="Name" hint="casing is preserved exactly">
            <TextInput autoFocus value={tagName} onChange={(e) => setTagName(e.target.value)} />
          </Labeled>
          <Labeled label="Colour" hint="shown in the sidebar and on task chips">
            <ColorPicker value={tagColor} onChange={setTagColor} />
          </Labeled>
          <div
            className="rounded-xl border p-3 text-[12px]"
            style={{ borderColor: "var(--line)", color: "var(--mut)" }}
          >
            Used by{" "}
            {state.tasks.filter((t) => t.tags.includes(tagMgr.tag ?? "\u0000")).length} task(s).
            Renaming updates every task; deleting removes the tag but keeps the tasks.
          </div>
        </div>
      </Modal>
      </div>
    </div>
  );
}

/* ================= task card with chained subtasks, multi-block badges & reordering ================= */
function TaskCard({
  t,
  idx,
  totalInList,
  sortMode,
  tracked,
  today,
  completedAt,
  isDragging,
  onDragStartTask,
  onDragEndTask,
  onLiveReorderTask,
  onToggle,
  onEdit,
  onFocus,
  onMove,
  onReorder,
}: {
  t: Task;
  idx: number;
  totalInList: number;
  sortMode: "manual" | "due" | "priority";
  tracked: number;
  today: string;
  completedAt?: number | null;
  isDragging?: boolean;
  onDragStartTask?: () => void;
  onDragEndTask?: () => void;
  onLiveReorderTask?: (targetId: string, clientY: number, targetRect: DOMRect) => void;
  onToggle: () => void;
  onEdit: () => void;
  onFocus: () => void;
  onMove?: (dir: "top" | "up" | "down" | "bottom") => void;
  onReorder?: (sourceId: string, targetId: string, position: "before" | "after") => void;
}) {
  const { state, set, toast } = useApp();
  const [chainOpen, setChainOpen] = useState(t.subtasks.length > 0);
  const [newSub, setNewSub] = useState("");
  const proj = state.projects.find((p) => p.id === t.projectId);
  const done = !!completedAt;
  const overdue = !done && !!t.due && t.due < today;
  const snoozed = !!t.snoozedUntil && t.snoozedUntil > Date.now();
  const subDone = t.subtasks.filter((s) => s.done).length;

  const timeBlocks = t.timeBlocks ?? [];
  const completedBlocks = timeBlocks.filter((b) => b.done).length;

  const addSub = () => {
    const v = newSub.trim();
    if (!v) return;
    const sub: Subtask = { id: uid(), title: v, done: false, doneAt: null };
    set((s) => ({
      ...s,
      tasks: s.tasks.map((x) => (x.id === t.id ? { ...x, subtasks: [...x.subtasks, sub] } : x)),
    }));
    setNewSub("");
    setChainOpen(true);
  };
  const toggleSub = (sid: string) => {
    set((s) => ({
      ...s,
      tasks: s.tasks.map((x) =>
        x.id === t.id
          ? {
              ...x,
              subtasks: x.subtasks.map((y) =>
                y.id === sid ? { ...y, done: !y.done, doneAt: !y.done ? Date.now() : null } : y
              ),
            }
          : x
      ),
    }));
  };
  const removeSub = (sid: string) => {
    set((s) => ({
      ...s,
      tasks: s.tasks.map((x) =>
        x.id === t.id ? { ...x, subtasks: x.subtasks.filter((y) => y.id !== sid) } : x
      ),
    }));
    toast("Subtask removed", "warn");
  };

  return (
    <div
      draggable={!done && sortMode === "manual"}
      onDragStart={(e) => {
        if (done || sortMode !== "manual") return;
        e.dataTransfer.setData("application/x-lifelog-task", t.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStartTask?.();
      }}
      onDragEnd={() => {
        onDragEndTask?.();
      }}
      onDragOver={(e) => {
        if (done || sortMode !== "manual") return;
        if (!e.dataTransfer.types.includes("application/x-lifelog-task")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = e.currentTarget.getBoundingClientRect();
        onLiveReorderTask?.(t.id, e.clientY, rect);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDragEndTask?.();
      }}
      className={cn(
        "card card-hover overflow-hidden group/card transition-all duration-150 relative w-full min-w-0",
        isDragging && "opacity-40 scale-[0.98] ring-2 ring-[var(--accent)] shadow-md"
      )}
      style={done ? { opacity: 0.92 } : undefined}
    >
      {/* completion strip */}
      {done && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold"
          style={{
            background: "color-mix(in srgb, var(--ok) 14%, transparent)",
            color: "var(--ok)",
          }}
        >
          <Check size={12} /> Completed {fmtDayShort(isoDate(new Date(completedAt!)))} at{" "}
          {fmtClock(completedAt!)}
          <button
            onClick={onToggle}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-all hover:opacity-75"
            style={{ cursor: "pointer", color: "var(--mut)" }}
          >
            <RotateCcw size={11} /> Reopen
          </button>
        </div>
      )}
      <div className="flex flex-col p-2.5 sm:p-3 gap-1.5 w-full max-w-full min-w-0">
        {/* Row 1: Left Checkbox + Middle Title (full width) + Right Actions */}
        <div className="flex items-start gap-2.5 w-full min-w-0">
          {/* Reordering in manual mode */}
          {!done && sortMode === "manual" && (
            <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
              <div
                className="cursor-grab active:cursor-grabbing p-1 rounded text-[var(--color-mut)] hover:text-accent hover:bg-[var(--panel2)] transition-opacity opacity-0 group-hover/card:opacity-100 shrink-0 hidden md:block"
                title="Drag to reorder task"
              >
                <GripVertical size={13} />
              </div>
              {onMove && (
                <div className="flex flex-col md:hidden -my-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic("light");
                      onMove("up");
                    }}
                    className="p-0.5 rounded text-[var(--color-mut)] active:text-[var(--accent)] active:bg-[var(--panel2)] disabled:opacity-15 cursor-pointer"
                    title="Move up"
                    aria-label="Move task up"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === totalInList - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic("light");
                      onMove("down");
                    }}
                    className="p-0.5 rounded text-[var(--color-mut)] active:text-[var(--accent)] active:bg-[var(--panel2)] disabled:opacity-15 cursor-pointer"
                    title="Move down"
                    aria-label="Move task down"
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Todoist-Style Circular Priority Checkbox */}
          <div className="flex items-center justify-center shrink-0 pt-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic("medium");
                onToggle();
              }}
              className={cn(
                "group/check relative flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-[2px] transition-all active:scale-90 hover:scale-105"
              )}
              style={{
                borderColor: done ? "var(--ok)" : PRIORITY_META[t.priority]?.color ?? "var(--accent)",
                background: done ? "var(--ok)" : "transparent",
                cursor: "pointer",
                opacity: snoozed ? 0.5 : 1,
              }}
              title={done ? "Reopen task" : `Complete task (${PRIORITY_META[t.priority].label})`}
              aria-label="Toggle done"
            >
              {done ? (
                <Check size={11} strokeWidth={3} style={{ color: "var(--on-accent)" }} />
              ) : (
                <Check
                  size={10}
                  strokeWidth={2.8}
                  className="opacity-0 group-hover/check:opacity-80 transition-opacity"
                  style={{ color: PRIORITY_META[t.priority]?.color ?? "var(--accent)" }}
                />
              )}
            </button>
          </div>

          {/* Full-width Title Area: multiline, clear typography */}
          <div className="min-w-0 flex-1 cursor-pointer" onClick={onEdit}>
            <div className="flex items-start gap-1.5">
              {t.emoji && <span className="text-[14px] shrink-0">{t.emoji}</span>}
              <p
                className={cn(
                  "text-[13.5px] sm:text-[14px] font-semibold leading-snug break-words text-[var(--text)]",
                  done && "line-through opacity-60"
                )}
              >
                {t.title}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--mut)] hover:bg-[var(--panel2)] hover:text-[var(--text)] active:scale-90 cursor-pointer transition-colors"
              aria-label="Edit task"
              title="Edit task"
            >
              <Pencil size={13} />
            </button>
            {!done && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocus();
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--accent)] bg-[var(--accent-soft)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)] transition-all active:scale-90 cursor-pointer"
                title="Start focus session (Pomodoro)"
                aria-label="Start focus"
              >
                <Play size={12} fill="currentColor" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Metadata Badges (Project, Due Date, Priority, Tags, Subtasks, Time) */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] font-medium pt-0.5">
          {/* Due date chip with smart Todoist coloring */}
          {t.due && (
            <span
              className={cn(
                "chip !py-0.5 text-[10.5px] flex items-center gap-1",
                overdue
                  ? "!border-red-500/40 !bg-red-500/10 text-red-600 dark:text-red-400 font-bold"
                  : t.due === today
                    ? "!border-amber-500/40 !bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold"
                    : "text-[var(--mut)]"
              )}
            >
              <Calendar size={10} className="shrink-0" />
              <span>
                {overdue ? "Overdue: " : t.due === today ? "Today" : fmtDayShort(t.due)}
                {t.dueTime ? ` · ${t.dueTime}` : ""}
              </span>
            </span>
          )}

          {/* Priority chip */}
          {t.priority === "urgent" ? (
            <span
              className="chip !py-0.5 text-[10px]"
              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            >
              <Zap size={9} /> urgent
            </span>
          ) : (
            <span
              className="chip !py-0.5 text-[10px]"
              style={{ color: PRIORITY_META[t.priority].color }}
            >
              {PRIORITY_META[t.priority].icon} {PRIORITY_META[t.priority].label}
            </span>
          )}

          {/* Project chip */}
          {proj && (
            <span className="chip !py-0.5 text-[10.5px] flex items-center gap-1">
              <span className="h-[6px] w-[6px] rounded-full shrink-0" style={{ background: proj.color }} />
              <span className="font-semibold text-[var(--mut)]">#{proj.name}</span>
            </span>
          )}

          {/* Tag chips */}
          {t.tags.map((tag) => (
            <span
              key={tag}
              className="chip !py-0.5 text-[10px]"
              style={{
                borderColor: `color-mix(in srgb, ${state.tagColors[tag] ?? "var(--accent)"} 45%, var(--line))`,
              }}
            >
              <span
                className="h-[6px] w-[6px] rounded-full"
                style={{ background: state.tagColors[tag] ?? "var(--accent)" }}
              />
              @{tag}
            </span>
          ))}

          {/* Subtasks steps chip */}
          {t.subtasks.length > 0 && (
            <button
              type="button"
              onClick={() => setChainOpen((v) => !v)}
              className="chip shrink-0 !py-0.5 text-[10.5px] cursor-pointer hover:bg-[var(--panel2)] active:scale-95 flex items-center gap-1"
              style={{
                color: subDone === t.subtasks.length ? "var(--ok)" : "var(--mut)",
                borderColor: subDone === t.subtasks.length ? "var(--ok)" : undefined,
              }}
              title="Toggle subtasks checklist"
            >
              <CheckSquare size={10} />
              <span>{subDone}/{t.subtasks.length}</span>
              {chainOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            </button>
          )}

          {/* Recurrence chip */}
          {t.recurrence && (
            <span className="chip !py-0.5 text-[10.5px] text-[var(--accent)] flex items-center gap-1">
              <Repeat size={9} /> {describeRecurrence(t.recurrence)}
            </span>
          )}

          {/* Super Productivity Unified Time Tracking & Estimate Badge */}
          {(tracked > 0 || t.estimateMin > 0) && (
            <span
              className={cn(
                "chip !py-0.5 text-[10.5px] font-mono font-medium tnum flex items-center gap-1",
                tracked > 0 ? "text-[var(--accent)] border-[var(--accent)]/30" : "text-[var(--mut)]"
              )}
              title={`Tracked: ${fmtDur(tracked || 0)} · Planned: ${t.estimateMin > 0 ? fmtDur(t.estimateMin) : "none"}`}
            >
              <Clock size={10} className="shrink-0" />
              <span>{fmtDur(tracked || 0)}</span>
              {t.estimateMin > 0 && (
                <>
                  <span className="opacity-40">/</span>
                  <span className="text-[var(--mut)]">{fmtDur(t.estimateMin)}</span>
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {/* subtask chain */}
      {chainOpen && (
        <div
          className="border-t px-3 py-2.5"
          style={{
            borderColor: "var(--line)",
            background: "color-mix(in srgb, var(--bg) 55%, var(--panel))",
          }}
        >
          <div className="chain flex flex-col gap-1">
            {t.subtasks.map((s) => (
              <div
                key={s.id}
                className="chain-item group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--panel2)]"
              >
                <button
                  onClick={() => toggleSub(s.id)}
                  className="group/subcheck flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all hover:scale-110"
                  style={{
                    borderColor: s.done ? "var(--ok)" : "var(--line)",
                    background: s.done ? "var(--ok)" : "transparent",
                    cursor: "pointer",
                  }}
                  aria-label="Toggle subtask"
                >
                  {s.done ? (
                    <Check size={9} strokeWidth={3} style={{ color: "var(--on-accent)" }} />
                  ) : (
                    <Check size={8} strokeWidth={2.5} className="opacity-0 group-hover/subcheck:opacity-60 text-[var(--mut)]" />
                  )}
                </button>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[12.5px] font-semibold",
                    s.done && "line-through opacity-55"
                  )}
                >
                  {s.title}
                </span>
                {s.done && s.doneAt && (
                  <span className="tnum text-[10px] font-bold" style={{ color: "var(--mut)" }}>
                    {fmtClock(s.doneAt)}
                  </span>
                )}
                {!done && (
                  <button
                    onClick={() => removeSub(s.id)}
                    className="hidden group-hover:block"
                    style={{ color: "var(--mut)", cursor: "pointer" }}
                    aria-label="Remove subtask"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
            {!done && (
              <div className="chain-item flex items-center gap-2 px-2 py-1">
                <Circle size={13} style={{ color: "var(--mut)" }} />
                <input
                  className="inp !border-0 !bg-transparent !p-0 text-[12.5px] !shadow-none"
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSub()}
                  placeholder="Add a step… (Enter)"
                />
                {newSub.trim() && (
                  <Btn size="sm" variant="primary" onClick={addSub}>
                    <Plus size={11} />
                  </Btn>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
