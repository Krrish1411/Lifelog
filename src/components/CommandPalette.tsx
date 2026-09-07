import React, { useState, useEffect, useRef, useMemo } from "react";
import type { State, ViewId, Task, Note } from "../types";
import {
  Search,
  CheckSquare,
  FileText,
  Compass,
  Zap,
  Moon,
  Sun,
  Headphones,
  ArrowRight,
  Plus,
} from "lucide-react";
import { announce } from "./LiveAnnouncer";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  state: State;
  currentView: ViewId;
  onNavigate: (view: ViewId) => void;
  onNewTask: () => void;
  onSelectTask?: (task: Task) => void;
  onSelectNote?: (note: Note) => void;
  onToggleTheme?: () => void;
}

interface PaletteItem {
  id: string;
  group: "navigation" | "actions" | "tasks" | "notes";
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  run: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  state,
  currentView,
  onNavigate,
  onNewTask,
  onSelectTask,
  onSelectNote,
  onToggleTheme,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const result: PaletteItem[] = [];

    // 1. Actions
    const actionList: PaletteItem[] = [
      {
        id: "act-new-task",
        group: "actions",
        title: "Create new task",
        subtitle: "Add a task with dates, estimates, or calendar blocks",
        icon: <Plus className="w-4 h-4 text-emerald-500" />,
        run: () => {
          onClose();
          onNewTask();
          announce("Opened new task dialog");
        },
      },
      {
        id: "act-focus",
        group: "actions",
        title: "Start Focus Session",
        subtitle: "Launch Pomodoro, countdown, or flow timer",
        icon: <Zap className="w-4 h-4 text-amber-500" />,
        run: () => {
          onClose();
          onNavigate("focus");
          announce("Navigated to Focus");
        },
      },
    ];

    if (onToggleTheme) {
      actionList.push({
        id: "act-theme",
        group: "actions",
        title: `Switch to ${state.settings.themeMode === "dark" ? "Light" : "Dark"} Mode`,
        subtitle: "Toggle visual color theme",
        icon:
          state.settings.themeMode === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-400" />
          ),
        run: () => {
          onClose();
          onToggleTheme();
          announce(`Theme switched to ${state.settings.themeMode === "dark" ? "light" : "dark"}`);
        },
      });
    }

    // 2. Navigation
    const navViews: { id: ViewId; label: string; desc: string }[] = [
      { id: "dashboard", label: "Dashboard", desc: "Overview, stats & quick actions" },
      { id: "tasks", label: "Tasks", desc: "All tasks, projects & manual ordering" },
      { id: "focus", label: "Focus Timer", desc: "Deep work, pomodoro & ambient sounds" },
      { id: "calendar", label: "Calendar", desc: "Timeline scheduling & time blocks" },
      { id: "habits", label: "Habits", desc: "Daily streaks & consistency heatmap" },
      { id: "notes", label: "Notes", desc: "Encrypted thoughts & linked references" },
      { id: "daylog", label: "Day Log", desc: "Daily mood, energy & focus summary" },
      { id: "reports", label: "Reports", desc: "Analytics & calibration metrics" },
      { id: "review", label: "Review", desc: "End of day / weekly recap" },
      { id: "settings", label: "Settings", desc: "Preferences, shortcuts & backups" },
    ];

    const navItems: PaletteItem[] = navViews.map((v) => ({
      id: `nav-${v.id}`,
      group: "navigation",
      title: `Go to ${v.label}`,
      subtitle: v.desc,
      icon: <Compass className="w-4 h-4 text-accent" />,
      run: () => {
        onClose();
        onNavigate(v.id);
        announce(`Navigated to ${v.label}`);
      },
    }));

    // Filtered actions & navigation
    actionList.forEach((a) => {
      if (!q || a.title.toLowerCase().includes(q) || a.subtitle?.toLowerCase().includes(q)) {
        result.push(a);
      }
    });

    navItems.forEach((n) => {
      if (!q || n.title.toLowerCase().includes(q) || n.subtitle?.toLowerCase().includes(q)) {
        result.push(n);
      }
    });

    // 3. Search Active Tasks
    if (q) {
      const matchedTasks = state.tasks
        .filter((t) => !t.done)
        .filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.tags.some((tg) => tg.toLowerCase().includes(q)) ||
            (t.notes && t.notes.toLowerCase().includes(q))
        )
        .slice(0, 8);

      matchedTasks.forEach((t) => {
        const proj = state.projects.find((p) => p.id === t.projectId);
        result.push({
          id: `task-${t.id}`,
          group: "tasks",
          title: t.title,
          subtitle: `${proj ? proj.emoji + " " + proj.name : "Inbox"}${
            t.estimateMin ? ` · ${t.estimateMin}m` : ""
          }${t.timeBlocks?.length ? ` · ${t.timeBlocks.length} blocks` : ""}`,
          icon: <CheckSquare className="w-4 h-4 text-blue-500" />,
          run: () => {
            onClose();
            if (onSelectTask) onSelectTask(t);
            else onNavigate("tasks");
            announce(`Selected task ${t.title}`);
          },
        });
      });

      // 4. Search Notes
      const matchedNotes = state.notes
        .filter((n) => n.title.toLowerCase().includes(q))
        .slice(0, 5);

      matchedNotes.forEach((n) => {
        result.push({
          id: `note-${n.id}`,
          group: "notes",
          title: n.title || "Untitled note",
          subtitle: n.daily ? "Daily note" : "Encrypted note",
          icon: <FileText className="w-4 h-4 text-amber-500" />,
          run: () => {
            onClose();
            if (onSelectNote) onSelectNote(n);
            else onNavigate("notes");
            announce(`Opened note ${n.title}`);
          },
        });
      });
    }

    return result;
  }, [query, state, currentView, onNavigate, onNewTask, onSelectTask, onSelectNote, onToggleTheme]);

  // Adjust selection if items length changes
  useEffect(() => {
    if (selectedIndex >= items.length) {
      setSelectedIndex(Math.max(0, items.length - 1));
    }
  }, [items.length, selectedIndex]);

  // Scroll active item into view
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;
    const activeEl = listEl.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Handle keys
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + items.length) % Math.max(1, items.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = items[selectedIndex];
      if (current) current.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-black/50 backdrop-blur-md transition-all"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--panel)] border border-[var(--line)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[72vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        {/* Search header */}
        <div className="flex items-center px-4 py-3.5 border-b border-[var(--line)] gap-3 bg-[var(--panel)]">
          <Search className="w-5 h-5 text-[var(--color-mut)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, task title, note, or view name..."
            className="w-full bg-transparent border-none text-[var(--color-text)] placeholder-[var(--color-mut)] text-base focus:outline-none"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs font-mono text-[var(--color-mut)] bg-[var(--panel2)] rounded border border-[var(--line)]">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="overflow-y-auto p-2 space-y-1">
          {items.length === 0 ? (
            <div className="py-12 text-center text-[var(--color-mut)] text-sm">
              No matching commands, tasks, or notes found.
            </div>
          ) : (
            items.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const prevItem = items[idx - 1];
              const showGroupHeader = !prevItem || prevItem.group !== item.group;

              return (
                <React.Fragment key={item.id}>
                  {showGroupHeader && (
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-mut)] px-3 pt-2.5 pb-1">
                      {item.group === "actions"
                        ? "Quick Actions"
                        : item.group === "navigation"
                        ? "Views & Navigation"
                        : item.group === "tasks"
                        ? "Active Tasks"
                        : "Notes"}
                    </div>
                  )}
                  <div
                    data-index={idx}
                    onClick={() => item.run()}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? "bg-[var(--accent-soft)] text-[var(--color-text)] border-[var(--accent)]/30 shadow-xs"
                        : "border-transparent text-[var(--color-text)] hover:bg-[var(--panel2)]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`p-1.5 rounded-lg shrink-0 border transition-all ${
                          isSelected
                            ? "bg-[var(--panel)] text-[var(--accent)] border-[var(--accent)]/30"
                            : "bg-[var(--panel2)] text-[var(--color-mut)] border-[var(--line)]"
                        }`}
                      >
                        {item.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{item.title}</div>
                        {item.subtitle && (
                          <div className="text-xs truncate text-[var(--color-mut)]">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-mut)] px-2 py-0.5 rounded bg-[var(--panel2)] border border-[var(--line)]/50">
                        {item.group}
                      </span>
                      <ArrowRight
                        className={`w-4 h-4 shrink-0 transition-transform ${
                          isSelected
                            ? "opacity-100 translate-x-0 text-[var(--accent)]"
                            : "opacity-0 -translate-x-1 text-[var(--color-mut)]"
                        }`}
                      />
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-[var(--panel2)] border-t border-[var(--line)] text-xs text-[var(--color-mut)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-[var(--panel)] px-1.5 py-0.5 rounded border border-[var(--line)] text-[11px]">
                ↑
              </kbd>{" "}
              <kbd className="font-mono bg-[var(--panel)] px-1.5 py-0.5 rounded border border-[var(--line)] text-[11px]">
                ↓
              </kbd>{" "}
              to navigate
            </span>
            <span>
              <kbd className="font-mono bg-[var(--panel)] px-1.5 py-0.5 rounded border border-[var(--line)] text-[11px]">
                ↵
              </kbd>{" "}
              to select
            </span>
          </div>
          <span className="text-[11px] font-medium">LifeLog Quick Palette</span>
        </div>
      </div>
    </div>
  );
};
