import React, { useState, useEffect } from "react";
import {
  Inbox,
  CalendarPlus,
  ListChecks,
  Plus,
  ChevronDown,
  ChevronRight,
  Flame,
  X,
  CheckSquare,
  Trash2,
  Pencil,
} from "lucide-react";
import type { Priority, Project, ViewId } from "../types";
import { useApp } from "../store";
import { triggerHaptic } from "../utils/native";
import { normalizeHex } from "../utils/core";
import { scrollToPageTop, useBodyScrollLock } from "../utils/scrollLock";
import { Btn, ColorPicker, EmojiPicker, Labeled, Modal, TextInput, cn } from "./ui";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  currentView?: ViewId;
  onSelectView?: (view: ViewId) => void;
  onSelectTaskFilter?: (filter: "inbox" | "today" | "all" | { project: string } | { tag: string } | { priority: Priority }) => void;
  selectedTaskFilter?: string; // string key e.g. "inbox", "today", "all", "p:id", "t:tag", "pr:priority"
  onNewProject?: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  open,
  onClose,
  currentView,
  onSelectView,
  onSelectTaskFilter,
  selectedTaskFilter,
  onNewProject,
}) => {
  const { state, set, confirm, toast, openTaskDialog } = useApp();
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [prioritiesExpanded, setPrioritiesExpanded] = useState(false);

  // Editing state for projects
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projName, setProjName] = useState("");
  const [projEmoji, setProjEmoji] = useState("📁");
  const [projColor, setProjColor] = useState("#4fa3a5");

  // Editing state for tags
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#e8a33d");

  useBodyScrollLock(open);

  if (!open) return null;

  const openTasks = state.tasks.filter((t) => !t.done);
  const inboxCount = openTasks.filter((t) => !t.due).length;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = openTasks.filter(
    (t) => t.due && t.due <= today && (!t.snoozedUntil || t.snoozedUntil <= Date.now())
  ).length;

  // Extract all unique tags
  const allTags = Array.from(new Set(state.tasks.flatMap((t) => t.tags))).filter(Boolean);

  const handleSmartView = (filterKey: "inbox" | "today" | "all") => {
    triggerHaptic("light");
    scrollToPageTop("auto");
    onSelectView?.("tasks");
    onSelectTaskFilter?.(filterKey);
    onClose();
  };

  const handleProjectClick = (projectId: string) => {
    triggerHaptic("light");
    scrollToPageTop("auto");
    onSelectView?.("tasks");
    onSelectTaskFilter?.({ project: projectId });
    onClose();
  };

  const handleTagClick = (tag: string) => {
    triggerHaptic("light");
    scrollToPageTop("auto");
    onSelectView?.("tasks");
    onSelectTaskFilter?.({ tag });
    onClose();
  };

  const handlePriorityClick = (priority: Priority) => {
    triggerHaptic("light");
    scrollToPageTop("auto");
    onSelectView?.("tasks");
    onSelectTaskFilter?.({ priority });
    onClose();
  };

  const handleDeleteProject = async (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    triggerHaptic("warning");
    const count = state.tasks.filter((t) => t.projectId === p.id).length;
    const ok = await confirm({
      title: `Delete project "${p.name}"?`,
      body: `This project and its ${count} task(s) will be permanently deleted. Tracked time history remains in reports.`,
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
    toast(`Deleted project "${p.name}"`, "warn");
  };

  const handleDeleteTag = async (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    triggerHaptic("warning");
    const count = state.tasks.filter((t) => t.tags.includes(tag)).length;
    const ok = await confirm({
      title: `Delete tag "#${tag}"?`,
      body: `This tag will be removed from ${count} task(s). The tasks themselves stay intact.`,
      confirmLabel: "Delete tag",
      danger: true,
    });
    if (!ok) return;
    set((s) => {
      const tagColors = { ...s.tagColors };
      delete tagColors[tag];
      return {
        ...s,
        tagColors,
        tasks: s.tasks.map((t) =>
          t.tags.includes(tag) ? { ...t, tags: t.tags.filter((x) => x !== tag) } : t
        ),
      };
    });
    toast(`Deleted tag "#${tag}"`, "warn");
  };


  const openEditProject = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    triggerHaptic("light");
    setEditingProject(p);
    setProjName(p.name);
    setProjEmoji(p.emoji || "📁");
    setProjColor(p.color || "#4fa3a5");
  };

  const saveEditProject = () => {
    if (!projName.trim()) return toast("Project needs a name", "err");
    if (!editingProject) return;
    set((s) => ({
      ...s,
      projects: s.projects.map((p) =>
        p.id === editingProject.id
          ? { ...p, name: projName.trim(), emoji: projEmoji, color: projColor }
          : p
      ),
    }));
    toast("Project updated", "ok");
    setEditingProject(null);
  };

  const openEditTag = (e: React.MouseEvent, t: string) => {
    e.stopPropagation();
    triggerHaptic("light");
    setEditingTag(t);
    setTagName(t);
    setTagColor(state.tagColors[t] ?? "#e8a33d");
  };

  const saveEditTag = () => {
    const old = editingTag;
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
    toast(next === old ? "Tag colour updated" : `Tag renamed to “${next}”`, "ok");
    setEditingTag(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex overscroll-contain" role="dialog" aria-modal="true" aria-label="Task navigation drawer">
      {/* Dimmed touch backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer content panel */}
      <aside
        className="relative z-10 flex h-full w-[290px] max-w-[85vw] flex-col border-r bg-[var(--panel)] shadow-2xl transition-transform animate-in slide-in-from-left duration-250 select-none overscroll-contain"
        style={{
          borderColor: "var(--line)",
          paddingTop: "max(calc(var(--safe-top) + 8px), 16px)",
          paddingBottom: "max(var(--safe-bottom), 16px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center gap-2">
            <CheckSquare size={18} style={{ color: "var(--accent)" }} />
            <span className="font-display text-[15px] font-bold tracking-tight">Tasks & Filters</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--mut)] hover:bg-[var(--panel2)] hover:text-[var(--text)] transition-colors cursor-pointer"
            aria-label="Close drawer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 overscroll-contain">
          {/* Section 1: Standard Smart Views */}
          <div className="space-y-0.5">
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--mut)]">
              Focus Views
            </div>
            
            {/* Inbox */}
            <button
              type="button"
              onClick={() => handleSmartView("inbox")}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px] font-bold transition-all cursor-pointer text-left",
                currentView === "tasks" && selectedTaskFilter === "inbox"
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text)] hover:bg-[var(--panel2)]"
              )}
            >
              <Inbox size={17} className={selectedTaskFilter === "inbox" ? "text-[var(--accent)]" : "text-[var(--mut)]"} />
              <span className="flex-1 truncate">Inbox</span>
              {inboxCount > 0 && (
                <span className="rounded-full bg-[var(--panel2)] px-2 py-0.5 text-[11px] font-bold text-[var(--mut)]">
                  {inboxCount}
                </span>
              )}
            </button>

            {/* Today */}
            <button
              type="button"
              onClick={() => handleSmartView("today")}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px] font-bold transition-all cursor-pointer text-left",
                currentView === "tasks" && selectedTaskFilter === "today"
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text)] hover:bg-[var(--panel2)]"
              )}
            >
              <CalendarPlus size={17} className={selectedTaskFilter === "today" ? "text-[var(--accent)]" : "text-[var(--mut)]"} />
              <span className="flex-1 truncate">Today</span>
              {todayCount > 0 && (
                <span className="rounded-full bg-[var(--accent)] text-[var(--on-accent)] px-2 py-0.5 text-[11px] font-bold">
                  {todayCount}
                </span>
              )}
            </button>

            {/* All Tasks */}
            <button
              type="button"
              onClick={() => handleSmartView("all")}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px] font-bold transition-all cursor-pointer text-left",
                currentView === "tasks" && selectedTaskFilter === "all"
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text)] hover:bg-[var(--panel2)]"
              )}
            >
              <ListChecks size={17} className={selectedTaskFilter === "all" ? "text-[var(--accent)]" : "text-[var(--mut)]"} />
              <span className="flex-1 truncate">All Tasks</span>
              <span className="rounded-full bg-[var(--panel2)] px-2 py-0.5 text-[11px] font-bold text-[var(--mut)]">
                {openTasks.length}
              </span>
            </button>
          </div>

          {/* Section 2: Projects (Collapsible + Add Project) */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-2.5 py-1">
              <button
                type="button"
                onClick={() => setProjectsExpanded((v) => !v)}
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--mut)] hover:text-[var(--text)] cursor-pointer"
              >
                {projectsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>Projects ({state.projects.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("medium");
                  onNewProject?.();
                  onClose();
                }}
                className="rounded-md p-1 text-[var(--mut)] hover:bg-[var(--panel2)] hover:text-[var(--text)] active:scale-95 cursor-pointer"
                title="Create Project"
                aria-label="Create project"
              >
                <Plus size={14} />
              </button>
            </div>

            {projectsExpanded && (
              <div className="space-y-0.5 pl-1">
                {state.projects.length === 0 && (
                  <div className="px-3 py-2 text-[11.5px] font-medium text-[var(--mut)]">
                    No projects yet. Tap + to add one.
                  </div>
                )}
                {state.projects.map((p) => {
                  const pCount = openTasks.filter((t) => t.projectId === p.id).length;
                  const isSel = currentView === "tasks" && selectedTaskFilter === `p:${p.id}`;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "group flex w-full items-center justify-between gap-1.5 rounded-xl px-2.5 py-1.5 text-[13px] font-bold transition-all cursor-pointer",
                        isSel
                          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "text-[var(--text)] hover:bg-[var(--panel2)]"
                      )}
                      onClick={() => handleProjectClick(p.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-[14px]">{p.emoji || "📁"}</span>
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
                        <span className="truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {pCount > 0 && (
                          <span className="rounded-full px-2 py-0.2 text-[10.5px] font-bold text-[var(--mut)]">
                            {pCount}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => openEditProject(e, p)}
                          className="opacity-70 hover:opacity-100 p-1.5 rounded-md text-[var(--mut)] hover:text-[var(--text)] hover:bg-[var(--panel2)] transition-all cursor-pointer"
                          title={`Edit "${p.name}"`}
                          aria-label={`Edit ${p.name}`}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteProject(e, p)}
                          className="opacity-70 hover:opacity-100 p-1.5 rounded-md text-[var(--mut)] hover:text-[var(--danger)] hover:bg-[var(--panel2)] transition-all cursor-pointer"
                          title={`Delete "${p.name}"`}
                          aria-label={`Delete ${p.name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: Tags / Labels (Collapsible) */}
          {allTags.length > 0 && (
            <div className="space-y-0.5">
              <div className="flex items-center justify-between px-2.5 py-1">
                <button
                  type="button"
                  onClick={() => setTagsExpanded((v) => !v)}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--mut)] hover:text-[var(--text)] cursor-pointer"
                >
                  {tagsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span>Tags ({allTags.length})</span>
                </button>
              </div>

              {tagsExpanded && (
                <div className="space-y-0.5 pl-1">
                  {allTags.map((t) => {
                    const tCount = openTasks.filter((x) =>
                      x.tags.some((y) => y.toLowerCase() === t.toLowerCase())
                    ).length;
                    const isSel = currentView === "tasks" && selectedTaskFilter === `t:${t}`;
                    return (
                      <div
                        key={t}
                        className={cn(
                          "group flex w-full items-center justify-between gap-1.5 rounded-xl px-2.5 py-1.5 text-[13px] font-bold transition-all cursor-pointer",
                          isSel
                            ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "text-[var(--text)] hover:bg-[var(--panel2)]"
                        )}
                        onClick={() => handleTagClick(t)}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ background: state.tagColors[t] ?? "var(--accent)" }}
                          />
                          <span className="truncate">#{t}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {tCount > 0 && (
                            <span className="rounded-full px-2 py-0.2 text-[10.5px] font-bold text-[var(--mut)]">
                              {tCount}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => openEditTag(e, t)}
                            className="opacity-70 hover:opacity-100 p-1.5 rounded-md text-[var(--mut)] hover:text-[var(--text)] hover:bg-[var(--panel2)] transition-all cursor-pointer"
                            title={`Edit tag "#${t}"`}
                            aria-label={`Edit tag ${t}`}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTag(e, t)}
                            className="opacity-70 hover:opacity-100 p-1.5 rounded-md text-[var(--mut)] hover:text-[var(--danger)] hover:bg-[var(--panel2)] transition-all cursor-pointer"
                            title={`Delete tag "#${t}"`}
                            aria-label={`Delete tag ${t}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Section 4: Priority Filters (Collapsible) */}
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => setPrioritiesExpanded((v) => !v)}
              className="flex w-full items-center justify-between px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--mut)] hover:text-[var(--text)] cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                {prioritiesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>Priorities</span>
              </div>
            </button>

            {prioritiesExpanded && (
              <div className="space-y-0.5 pl-1">
                {(["urgent", "high", "medium", "low"] as const).map((pr) => {
                  const pCount = openTasks.filter((t) => t.priority === pr).length;
                  const isSel = currentView === "tasks" && selectedTaskFilter === `pr:${pr}`;
                  const meta = {
                    urgent: { label: "Urgent", color: "#d66853", icon: "🔴" },
                    high: { label: "High", color: "#e0b457", icon: "🟠" },
                    medium: { label: "Medium", color: "#6fbf8e", icon: "🟡" },
                    low: { label: "Low", color: "#8b93a5", icon: "⚪" },
                  }[pr];
                  return (
                    <button
                      key={pr}
                      type="button"
                      onClick={() => handlePriorityClick(pr)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] font-bold transition-all cursor-pointer text-left",
                        isSel
                          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "text-[var(--text)] hover:bg-[var(--panel2)]"
                      )}
                    >
                      <span className="text-[12px]">{meta.icon}</span>
                      <span className="flex-1 truncate">{meta.label} Priority</span>
                      {pCount > 0 && (
                        <span className="rounded-full px-2 py-0.2 text-[10.5px] font-bold text-[var(--mut)]">
                          {pCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Drawer Bottom Bar: Quick Create Task */}
        <div className="border-t p-3 flex flex-col gap-2" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("medium");
              openTaskDialog();
              onClose();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-white shadow-sm transition-transform active:scale-95 cursor-pointer"
            style={{ background: "var(--accent)" }}
          >
            <Plus size={15} strokeWidth={2.8} />
            <span>Create New Task</span>
          </button>
          <div className="text-center text-[10.5px] font-semibold text-[var(--mut)] opacity-75 select-none">
            LifeLog • Crafted by Krish Patel
          </div>
        </div>
      </aside>

      {/* ================= project edit modal ================= */}
      <Modal
        open={!!editingProject}
        onClose={() => setEditingProject(null)}
        title="Edit project"
        width={480}
        footer={
          <>
            <Btn
              variant="danger"
              className="mr-auto"
              onClick={async () => {
                if (!editingProject) return;
                const p = editingProject;
                setEditingProject(null);
                const count = state.tasks.filter((t) => t.projectId === p.id).length;
                const ok = await confirm({
                  title: `Delete project "${p.name}"?`,
                  body: `This project and its ${count} task(s) will be permanently deleted. Tracked time history remains in reports.`,
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
                toast(`Deleted project "${p.name}"`, "warn");
              }}
            >
              <Trash2 size={13} /> Delete project
            </Btn>
            <Btn variant="ghost" onClick={() => setEditingProject(null)}>
              Cancel
            </Btn>
            <Btn variant="primary" onClick={saveEditProject}>
              Save
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

      {/* ================= tag edit modal ================= */}
      <Modal
        open={!!editingTag}
        onClose={() => setEditingTag(null)}
        title={
          <>
            Edit tag —{" "}
            <span style={{ color: state.tagColors[editingTag ?? ""] ?? "var(--accent)" }}>
              #{editingTag}
            </span>
          </>
        }
        width={440}
        footer={
          <>
            <Btn
              variant="danger"
              className="mr-auto"
              onClick={async () => {
                if (!editingTag) return;
                const tag = editingTag;
                setEditingTag(null);
                const count = state.tasks.filter((t) => t.tags.includes(tag)).length;
                const ok = await confirm({
                  title: `Delete tag "#${tag}"?`,
                  body: `This tag will be removed from ${count} task(s). The tasks themselves stay intact.`,
                  confirmLabel: "Delete tag",
                  danger: true,
                });
                if (!ok) return;
                set((s) => {
                  const tagColors = { ...s.tagColors };
                  delete tagColors[tag];
                  return {
                    ...s,
                    tagColors,
                    tasks: s.tasks.map((t) =>
                      t.tags.includes(tag) ? { ...t, tags: t.tags.filter((x) => x !== tag) } : t
                    ),
                  };
                });
                toast(`Deleted tag "#${tag}"`, "warn");
              }}
            >
              <Trash2 size={13} /> Delete tag
            </Btn>
            <Btn variant="ghost" onClick={() => setEditingTag(null)}>
              Cancel
            </Btn>
            <Btn variant="primary" onClick={saveEditTag}>
              Save
            </Btn>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Labeled label="Name" hint="casing is preserved exactly">
            <TextInput
              autoFocus
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder="tag name"
            />
          </Labeled>
          <Labeled label="Colour">
            <ColorPicker value={tagColor} onChange={setTagColor} />
          </Labeled>
        </div>
      </Modal>
    </div>
  );
};
