import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Calendar,
  Check,
  FileClock,
  FileText,
  Flame,
  LayoutDashboard,
  ListTodo,
  Menu,
  ExternalLink,
  Maximize2,
  Minimize2,
  Moon,
  Pause,
  PenLine,
  Play,
  Plus,
  Quote,
  Radio,
  Search,
  Settings,
  SlidersHorizontal,
  Square,
  Sun,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import type { Priority, TokenKey, ViewId } from "../types";
import { FONT_PAIRS, QUOTES, SHORTCUT_ACTIONS } from "../types";
import { useApp } from "../store";
import { syncEngine } from "../sync/syncEngine";
import {
  ensureContrast,
  fmtDateLong,
  fmtDur,
  fmtHMS,
  greetingFor,
  mix,
  normalizeHex,
  readableOn,
  sessionSeconds,
  streakStats,
  todayIso,
  trackedByDay,
} from "../utils/core";
import { playTimerChime } from "../utils/audio";
import { CUSTOM_FONT_FAMILY } from "../utils/fonts";
import { toggleThemeModePatch } from "../utils/themes";
import { useApplyTheme } from "../utils/useApplyTheme";
import { Btn, Modal, TextInput, Toggle, cn } from "./ui";
import { TaskDialog } from "./TaskDialog";
import { SyncDialog } from "./SyncDialog";
import { CommandPalette } from "./CommandPalette";
import { LiveAnnouncer } from "./LiveAnnouncer";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileMoreSheet } from "./MobileMoreSheet";
import { MobileDrawer } from "./MobileDrawer";
import { scrollToPageTop } from "../utils/scrollLock";
import {
  initHardwareBackButton,
  configureStatusBar,
  initNativeSystemBars,
  triggerHaptic,
  initNotificationChannels,
  initRunningTimerTrayListener,
  isTauri,
  updateDesktopTray,
  sendDesktopNotification,
  initDesktopQuickAdd,
  openTimerPopout,
} from "../utils/native";
import { Dashboard } from "../views/Dashboard";
import { TasksView } from "../views/Tasks";
import { FocusView } from "../views/Focus";
import { CalendarView } from "../views/Calendar";
import { HabitsView } from "../views/Habits";
import { NotesView } from "../views/Notes";
import { DayLogView } from "../views/DayLog";
import { ReportsView } from "../views/Reports";
import { ReviewView } from "../views/Review";
import { SettingsView } from "../views/Settings";
import { WelcomeView } from "../views/Welcome";

export interface NavSection {
  title: string;
  items: { id: ViewId; label: string; icon: typeof Timer }[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Daily Focus",
    items: [
      { id: "dashboard", label: "Today", icon: LayoutDashboard },
      { id: "tasks", label: "Tasks", icon: ListTodo },
      { id: "focus", label: "Focus", icon: Timer },
      { id: "calendar", label: "Calendar", icon: Calendar },
    ],
  },
  {
    title: "Personal Hub",
    items: [
      { id: "habits", label: "Habits", icon: Flame },
      { id: "notes", label: "Notes", icon: FileText },
      { id: "daylog", label: "Day Log", icon: FileClock },
    ],
  },
  {
    title: "Insights & Config",
    items: [
      { id: "reports", label: "Reports", icon: BarChart3 },
      { id: "review", label: "Review", icon: PenLine },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

export const ALL_NAV = NAV_SECTIONS.flatMap((s) => s.items);

function Clock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = (n: number) => String(n).padStart(2, "0");
  if (compact) {
    return (
      <div className="text-center font-mono text-[12px] font-semibold tnum" style={{ color: "var(--mut)" }}>
        <div style={{ color: "var(--text)" }}>
          {p(now.getHours())}:{p(now.getMinutes())}
        </div>
        <div className="text-[10px]">{p(now.getSeconds())}</div>
      </div>
    );
  }
  return (
    <div className="flex items-baseline gap-2.5 select-none">
      <span className="font-mono text-[17px] font-semibold tnum" style={{ color: "var(--text)" }}>
        {p(now.getHours())}:{p(now.getMinutes())}
        <span style={{ color: "var(--mut)" }}>:{p(now.getSeconds())}</span>
      </span>
      <span className="text-[12px] font-semibold" style={{ color: "var(--mut)" }}>
        {fmtDateLong(now)}
      </span>
    </div>
  );
}

function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <svg width={small ? 26 : 30} height={small ? 26 : 30} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--panel2)" stroke="var(--line)" />
        <circle
          cx="16"
          cy="16"
          r="9"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="42 15"
          transform="rotate(-90 16 16)"
        />
        <circle cx="16" cy="16" r="3" fill="var(--accent)" />
      </svg>
      {!small && (
        <div className="leading-none">
          <div className="font-display text-[16px] font-bold tracking-tight">LifeLog</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--mut)" }}>
            your day, remembered
          </div>
        </div>
      )}
    </div>
  );
}

function todayIsoOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ================================================================ */
export function Shell() {
  const app = useApp();
  const { state, set, view, setView, openTaskDialog, openSyncDialog, toast } = app;
  const layout = state.settings.layout;
  const [greeting, setGreeting] = useState(false);
  const [zenConfig, setZenConfig] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState(syncEngine.getStatus());
  const [taskFilter, setTaskFilter] = useState<
    "inbox" | "today" | "all" | { project: string } | { tag: string } | { priority: Priority }
  >("today");

  // Sync engine connection status listener
  useEffect(() => {
    return syncEngine.onStatusChange((s) => setSyncStatus(s));
  }, []);


  // Desktop Global Shortcut (Ctrl+Shift+Space / Cmd+Shift+Space) Quick Add
  useEffect(() => {
    return initDesktopQuickAdd(() => {
      openTaskDialog();
    });
  }, [openTaskDialog]);

  // Android Native Status Bar & System Bars Sync
  useEffect(() => {
    initNativeSystemBars();
    configureStatusBar(state.settings.themeMode === "dark");
    initNotificationChannels();
  }, [state.settings.themeMode]);

  // Android Running Timer Notification in notification shade tray on minimize
  useEffect(() => {
    const cleanup = initRunningTimerTrayListener(() => {
      const sess = state.sessions.find((s) => s.status === "running" && !s.endedAt);
      if (!sess) return null;
      const isPaused = sess.pauses.length > 0 && !sess.pauses[sess.pauses.length - 1].resumeAt;
      if (isPaused) return null;
      const task = state.tasks.find((t) => t.id === sess.taskId);
      const remainingSec = sess.plannedMin
        ? Math.max(0, sess.plannedMin * 60 - sessionSeconds(sess))
        : undefined;
      return {
        running: true,
        taskTitle: task?.title ?? "Focus Session",
        mode: sess.mode,
        remainingSec,
      };
    });
    return cleanup;
  }, [state.sessions, state.tasks]);

  // Sync view with URL hash
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace(/^#/, "") as ViewId;
      if (hash && ALL_NAV.some((n) => n.id === hash)) {
        setView(hash);
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [setView]);

  useEffect(() => {
    if (window.location.hash.replace(/^#/, "") !== view) {
      window.location.hash = `#${view}`;
    }
  }, [view]);

  // Reset scroll to top when switching views
  useEffect(() => {
    scrollToPageTop("auto");
  }, [view]);

  /* ---------- theme variables: customizable, contrast-checked ---------- */
  useApplyTheme(state.settings);

  /* ---------- launch greeting ---------- */
  useEffect(() => {
    const today = todayIso();
    if (state.settings.greeting === "every" || state.meta.lastGreetingDay !== today) setGreeting(true);
  }, []);
  const closeGreeting = () => {
    setGreeting(false);
    set((s) => ({ ...s, meta: { ...s.meta, lastGreetingDay: todayIso() } }));
  };

  /* ---------- global session watchdog: finish countdowns wherever you are ---------- */
  const lastTrayTitleRef = useRef<string>("");
  const lastTrayTooltipRef = useRef<string>("");

  useEffect(() => {
    const t = setInterval(() => {
      const running = state.sessions.find((s) => s.status === "running");

      // Live Desktop System Tray Countdown (deduplicated to prevent IPC event-loop flooding)
      if (isTauri) {
        let title = "LifeLog";
        let tooltip = "LifeLog — Focus & Productivity";
        if (running) {
          const secs = sessionSeconds(running);
          const remaining = running.plannedMin ? Math.max(0, running.plannedMin * 60 - secs) : secs;
          const mm = Math.floor(remaining / 60);
          const ss = remaining % 60;
          const timeStr = `${mm}:${ss < 10 ? "0" : ""}${ss}`;
          const prefix = running.mode === "break" ? "☕" : "🍅";
          title = `${prefix} ${timeStr}`;
          tooltip = `LifeLog: ${running.mode === "break" ? "Break" : "Focus"} (${timeStr} remaining)`;
        }
        if (title !== lastTrayTitleRef.current || tooltip !== lastTrayTooltipRef.current) {
          lastTrayTitleRef.current = title;
          lastTrayTooltipRef.current = tooltip;
          updateDesktopTray(title, tooltip);
        }
      }

      if (!running || running.mode === "flow" || !running.plannedMin) return;
      if (sessionSeconds(running) >= running.plannedMin * 60) {
        set((st) => ({
          ...st,
          sessions: st.sessions.map((x) =>
            x.id === running.id
              ? {
                  ...x,
                  endedAt: Date.now(),
                  status: "done",
                  pauses: x.pauses.map((p) => (p.resumeAt ? p : { ...p, resumeAt: Date.now() })),
                }
              : x
          ),
        }));
        playTimerChime(running.mode === "break" ? "break" : "complete");
        if (state.settings.notifyEnabled) {
          if (isTauri) {
            sendDesktopNotification(
              running.mode === "break" ? "Break Finished ☕" : "LifeLog Timer Complete 🎯",
              running.mode === "break"
                ? "Break is over — ready to focus again."
                : "Focus session finished and saved to your log."
            );
          } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              new Notification(running.mode === "break" ? "Break Finished" : "LifeLog Timer Complete", {
                body:
                  running.mode === "break"
                    ? "Break is over — ready to focus again."
                    : "Focus session finished and saved to your log.",
              });
            } catch {}
          }
        }
        toast(running.mode === "break" ? "Break over — back to it" : "Timer complete — session saved to your log", "warn");
      }
    }, 1000);
    return () => clearInterval(t);
  }, [state.sessions, state.settings.notifyEnabled, toast, set]);

  const toggleTheme = () => {
    const patch = toggleThemeModePatch(state.settings);
    set((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
    toast(`Switched to ${patch.themeMode} mode`, "ok");
  };

  const today = todayIso();
  const dueToday = useMemo(
    () =>
      state.tasks.filter(
        (t) => !t.done && t.due && t.due <= today && (!t.snoozedUntil || t.snoozedUntil <= Date.now())
      ).length,
    [state.tasks, today]
  );
  const tracked = useMemo(() => trackedByDay(state.sessions), [state.sessions]);
  const bestStreak = useMemo(
    () => Math.max(0, ...state.habits.map((h) => streakStats(h.completions).current)),
    [state.habits]
  );

  const selectedTaskFilterKey = useMemo(() => {
    if (typeof taskFilter === "string") return taskFilter;
    if ("project" in taskFilter) return `p:${taskFilter.project}`;
    if ("tag" in taskFilter) return `t:${taskFilter.tag}`;
    return `pr:${taskFilter.priority}`;
  }, [taskFilter]);

  const activeViewContent = useMemo(() => {
    switch (view) {
      case "dashboard":
        return layout === "zen" ? <ZenHome /> : <Dashboard />;
      case "tasks":
        return (
          <TasksView
            filter={taskFilter}
            onFilterChange={setTaskFilter}
            onOpenDrawer={() => setMobileNavOpen(true)}
          />
        );
      case "focus":
        return <FocusView />;
      case "calendar":
        return <CalendarView />;
      case "habits":
        return <HabitsView />;
      case "notes":
        return <NotesView />;
      case "daylog":
        return <DayLogView />;
      case "reports":
        return <ReportsView />;
      case "review":
        return <ReviewView />;
      case "settings":
        return <SettingsView />;
      default:
        return <Dashboard />;
    }
  }, [view, layout, taskFilter]);

  if (state.meta && !state.meta.hasSeenWelcome) {
    return (
      <WelcomeView
        onEnter={() => {
          set((s) => ({ ...s, meta: { ...s.meta, hasSeenWelcome: true } }));
        }}
      />
    );
  }

  const activeNavLabel = ALL_NAV.find((n) => n.id === view)?.label ?? "LifeLog";

  const navButton = (n: (typeof ALL_NAV)[number], opts: { iconOnly?: boolean; horizontal?: boolean } = {}) => {
    const active = view === n.id;
    const Icon = n.icon;
    if (opts.iconOnly) {
      return (
        <button
          key={n.id}
          onClick={() => {
            scrollToPageTop("auto");
            setView(n.id);
          }}
          title={n.label}
          className="group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all"
          style={
            active
              ? { background: "var(--accent-soft)", color: "var(--accent)" }
              : { color: "var(--mut)", cursor: "pointer" }
          }
        >
          <Icon size={17} />
          {active && <span className="absolute -left-2.5 h-5 w-[3px] rounded-full" style={{ background: "var(--accent)" }} />}
          <span
            className="pointer-events-none absolute left-[52px] z-50 hidden whitespace-nowrap rounded-lg border px-2 py-1 text-[11px] font-bold group-hover:block shadow-lg"
            style={{ background: "var(--panel2)", borderColor: "var(--line)", color: "var(--text)" }}
          >
            {n.label}
          </span>
        </button>
      );
    }
    return (
      <button
        key={n.id}
        onClick={() => {
          scrollToPageTop("auto");
          setView(n.id);
        }}
        className={cn(
          "flex items-center gap-2.5 font-bold transition-all",
          opts.horizontal ? "rounded-lg px-2.5 py-1.5 text-[12.5px]" : "w-full rounded-xl px-3 py-2 text-[13px]"
        )}
        style={
          active
            ? { background: "var(--accent-soft)", color: "var(--accent)" }
            : { color: "var(--mut)", cursor: "pointer" }
        }
        onMouseEnter={(e) => {
          if (!active) e.currentTarget.style.color = "var(--text)";
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.color = "var(--mut)";
        }}
      >
        <Icon size={16} />
        <span>{n.label}</span>
        {n.id === "tasks" && dueToday > 0 && !opts.horizontal && (
          <span
            className="ml-auto rounded-full px-1.5 py-px font-mono text-[10.5px] font-bold tnum"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          >
            {dueToday}
          </span>
        )}
      </button>
    );
  };



  /* Mobile Top App Bar (< md) */
  const isLiquidMobile = (state.settings.mobileLayout ?? "classic") === "liquid";
  const mobileBar = (
    <header
      className="fixed top-0 inset-x-0 z-40 flex flex-col border-b select-none transition-colors md:hidden"
      style={{
        background: isLiquidMobile
          ? (state.settings.themeMode === "dark"
              ? "color-mix(in srgb, var(--panel) 75%, transparent)"
              : "color-mix(in srgb, var(--panel) 82%, transparent)")
          : "var(--panel)",
        backdropFilter: isLiquidMobile ? "blur(28px) saturate(200%)" : "none",
        WebkitBackdropFilter: isLiquidMobile ? "blur(28px) saturate(200%)" : "none",
        borderColor: isLiquidMobile
          ? (state.settings.themeMode === "dark"
              ? "color-mix(in srgb, var(--text) 12%, transparent)"
              : "color-mix(in srgb, var(--line) 85%, transparent)")
          : "var(--line)",
        boxShadow: isLiquidMobile
          ? (state.settings.themeMode === "dark"
              ? "inset 0 -1px 0 color-mix(in srgb, var(--accent) 15%, transparent), 0 8px 24px -10px rgba(0,0,0,0.5)"
              : "inset 0 -1px 0 rgba(255,255,255,0.7), 0 6px 20px -10px rgba(0,0,0,0.06)")
          : "0 1px 3px rgba(0,0,0,0.05)",
        paddingTop: "var(--safe-top)",
      }}
    >
      <div className="flex h-14 items-center justify-between px-3.5">
        <div className="flex items-center gap-2 min-w-0">
          {view === "tasks" && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setMobileNavOpen(true);
              }}
              className="rounded-xl p-2 transition-colors hover:bg-[var(--panel2)] active:scale-95 cursor-pointer text-[var(--text)] shrink-0"
              title="Task filters & projects"
              aria-label="Open task filters"
            >
              <Menu size={20} />
            </button>
          )}
          {view === "notes" && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                window.dispatchEvent(new CustomEvent("lifelog:open-notes-drawer"));
              }}
              className="rounded-xl p-2 transition-colors hover:bg-[var(--panel2)] active:scale-95 cursor-pointer text-[var(--text)] shrink-0"
              title="Folders & Notes"
              aria-label="Open folders and notes"
            >
              <Menu size={20} />
            </button>
          )}
          <Logo small />
          <span className="font-display text-[16px] font-bold truncate max-w-[150px] sm:max-w-[220px] text-[var(--text)]">
            {activeNavLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* P2P Sync button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              openSyncDialog();
            }}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border transition-transform active:scale-95 cursor-pointer"
            style={{
              borderColor: syncStatus === "connected" ? "rgba(16, 185, 129, 0.5)" : "var(--line)",
              color: syncStatus === "connected" ? "#10b981" : "var(--mut)",
              background: syncStatus === "connected" ? "rgba(16, 185, 129, 0.1)" : "var(--panel2)",
            }}
            title={syncStatus === "connected" ? "P2P Sync: Connected" : "Device-to-Device Sync"}
            aria-label="Device Sync"
          >
            <Radio size={15} className={syncStatus === "connected" ? "animate-pulse text-emerald-400" : ""} />
            {syncStatus === "connected" && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-[var(--panel)]" />
            )}
          </button>

          {/* Theme quick toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-xl border transition-transform active:scale-95 cursor-pointer"
            style={{ borderColor: "var(--line)", color: "var(--mut)", background: "var(--panel2)" }}
            title="Toggle dark/light theme"
            aria-label="Toggle theme"
          >
            {state.settings.themeMode === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Search / Palette */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              setPaletteOpen(true);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border transition-transform active:scale-95 cursor-pointer"
            style={{ borderColor: "var(--line)", color: "var(--mut)", background: "var(--panel2)" }}
            title="Search"
            aria-label="Search"
          >
            <Search size={15} />
          </button>

          {/* Quick Add Task */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("medium");
              openTaskDialog();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl transition-transform active:scale-95 cursor-pointer shadow-xs"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            title="New task"
            aria-label="New task"
          >
            <Plus size={17} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </header>
  );

  const mobileDrawer = (
    <MobileDrawer
      open={mobileNavOpen}
      onClose={() => setMobileNavOpen(false)}
      currentView={view}
      onSelectView={(v) => {
        setView(v);
        window.location.hash = v;
      }}
      onSelectTaskFilter={(f) => {
        setTaskFilter(f);
        setView("tasks");
        window.location.hash = "tasks";
      }}
      selectedTaskFilter={selectedTaskFilterKey}
    />
  );

  /* ============================ 1. PLANIFY ENGINE (Icon Rail) ============================ */
  if (layout === "planify") {
    return (
      <div className="relative min-h-screen">
        {mobileBar}
        {mobileDrawer}
        <aside
          className="fixed inset-y-0 left-0 z-40 hidden w-[74px] flex-col items-center gap-1.5 border-r py-5 md:flex md:w-[84px] select-none glass-regular overflow-y-auto overflow-x-hidden scrollbar-none"
          style={{ borderColor: "var(--line)" }}
        >
          <Logo small />

          {/* Top Desktop Action Buttons */}
          <div className="mt-3 flex flex-col items-center gap-2">
            <button
              onClick={openSyncDialog}
              title={syncStatus === "connected" ? "P2P Sync Connected" : "Device-to-Device Sync"}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all hover:scale-105 cursor-pointer"
              style={{
                borderColor: syncStatus === "connected" ? "rgba(16, 185, 129, 0.5)" : "var(--line)",
                color: syncStatus === "connected" ? "#10b981" : "var(--mut)",
                background: syncStatus === "connected" ? "rgba(16, 185, 129, 0.1)" : "var(--panel2)",
              }}
            >
              <Radio size={16} className={syncStatus === "connected" ? "animate-pulse text-emerald-400" : ""} />
              {syncStatus === "connected" && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-500" />
              )}
            </button>
            <button
              onClick={toggleTheme}
              title="Toggle theme"
              className="flex h-9 w-9 items-center justify-center rounded-xl border transition-all hover:scale-105 cursor-pointer"
              style={{ borderColor: "var(--line)", color: "var(--mut)", background: "var(--panel2)" }}
            >
              {state.settings.themeMode === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={() => setPaletteOpen(true)}
              title="Command Palette (Ctrl+K / K)"
              className="flex h-9 w-9 items-center justify-center rounded-xl border transition-all hover:scale-105 cursor-pointer"
              style={{ borderColor: "var(--line)", color: "var(--mut)", background: "var(--panel2)" }}
            >
              <Search size={15} />
            </button>
          </div>

          <div className="mt-4 flex w-full flex-col items-center gap-1 px-2">
            {NAV_SECTIONS.map((sec, sIdx) => (
              <div key={sec.title} className="flex w-full flex-col items-center gap-1">
                {sIdx > 0 && <div className="my-1.5 w-6 border-b" style={{ borderColor: "var(--line)" }} />}
                {sec.items.map((n) => navButton(n, { iconOnly: true }))}
              </div>
            ))}
          </div>

          <div className="mt-auto flex flex-col items-center gap-3">
            <Clock compact />
            <button
              onClick={() => openTaskDialog()}
              className="flex h-10 w-10 items-center justify-center rounded-2xl transition-transform hover:scale-105 shadow-md cursor-pointer"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
              title="New task (Ctrl+N)"
            >
              <Plus size={18} />
            </button>
          </div>
        </aside>

        <main className="zoomable relative z-10 ml-0 w-full px-3.5 pt-[calc(68px+var(--safe-top,0px))] pb-28 md:ml-[84px] md:w-[calc(100%-84px)] md:px-6 md:py-6">
          <div className="w-full">{activeViewContent}</div>
        </main>

        <Overlays
          greeting={greeting}
          closeGreeting={closeGreeting}
          paletteOpen={paletteOpen}
          setPaletteOpen={setPaletteOpen}
          onToggleTheme={toggleTheme}
        />
        <MiniTimer />
      </div>
    );
  }

  /* ============================ 2. CONTROL ENGINE (Command Bar + Status Bar) ============================ */
  if (layout === "control") {
    return (
      <div className="relative flex min-h-screen flex-col">
        {mobileBar}
        {mobileDrawer}
        <header
          className="fixed top-0 inset-x-0 z-40 hidden h-[56px] items-center gap-3 border-b px-5 md:flex select-none glass-regular"
          style={{ borderColor: "var(--line)" }}
        >
          <Logo small />
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {NAV_SECTIONS.map((sec, sIdx) => (
              <div key={sec.title} className="flex items-center gap-1">
                {sIdx > 0 && <div className="mx-1.5 h-4 border-r" style={{ borderColor: "var(--line)" }} />}
                {sec.items.map((n) => navButton(n, { horizontal: true }))}
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={openSyncDialog}
              title={syncStatus === "connected" ? "P2P Sync Connected" : "Device-to-Device Sync"}
              className="relative flex h-8 px-2.5 items-center gap-1.5 rounded-lg border text-xs font-bold transition-all hover:scale-105 cursor-pointer"
              style={{
                borderColor: syncStatus === "connected" ? "rgba(16, 185, 129, 0.5)" : "var(--line)",
                color: syncStatus === "connected" ? "#10b981" : "var(--mut)",
                background: syncStatus === "connected" ? "rgba(16, 185, 129, 0.1)" : "var(--panel2)",
              }}
            >
              <Radio size={13} className={syncStatus === "connected" ? "animate-pulse text-emerald-400" : ""} />
              <span>{syncStatus === "connected" ? "Synced" : "Sync"}</span>
            </button>

            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-lg border transition-all cursor-pointer"
              style={{ borderColor: "var(--line)", color: "var(--mut)", background: "var(--panel2)" }}
              title="Toggle theme"
            >
              {state.settings.themeMode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <button
              onClick={() => setPaletteOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border transition-all cursor-pointer"
              style={{ borderColor: "var(--line)", color: "var(--mut)", background: "var(--panel2)" }}
              title="Search (Ctrl+K / K)"
            >
              <Search size={14} />
            </button>

            <Clock />

            <Btn variant="primary" size="sm" onClick={() => openTaskDialog()}>
              <Plus size={13} /> Task
            </Btn>
          </div>
        </header>

        <main className="zoomable relative z-10 min-h-0 w-full flex-1 px-3.5 pt-[calc(68px+var(--safe-top,0px))] pb-28 md:pt-[72px] md:px-6 md:pb-20">
          <div className="w-full">{activeViewContent}</div>
        </main>

        <StatusBar
          dueToday={dueToday}
          todayMin={tracked.get(today) ?? 0}
          bestStreak={bestStreak}
          goFocus={() => setView("focus")}
        />

        <Overlays
          greeting={greeting}
          closeGreeting={closeGreeting}
          paletteOpen={paletteOpen}
          setPaletteOpen={setPaletteOpen}
          onToggleTheme={toggleTheme}
        />
        <MiniTimer />
      </div>
    );
  }

  /* ============================ 3. DESK ENGINE (Workspace Sidebar + Status Bar) ============================ */
  if (layout === "desk") {
    return (
      <div className="relative min-h-screen">
        {mobileBar}
        {mobileDrawer}
        <aside
          className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col border-r p-4 md:flex select-none glass-regular overflow-y-auto overflow-x-hidden scrollbar-none"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="flex items-center justify-between">
            <Logo />
          </div>

          <div className="mt-3.5 flex items-center gap-1.5 pb-2 border-b" style={{ borderColor: "var(--line)" }}>
            <button
              onClick={openSyncDialog}
              title={syncStatus === "connected" ? "P2P Sync Connected" : "Device-to-Device Sync"}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-bold transition-all hover:scale-[1.02] cursor-pointer"
              style={{
                borderColor: syncStatus === "connected" ? "rgba(16, 185, 129, 0.5)" : "var(--line)",
                color: syncStatus === "connected" ? "#10b981" : "var(--mut)",
                background: syncStatus === "connected" ? "rgba(16, 185, 129, 0.1)" : "var(--panel2)",
              }}
            >
              <Radio size={13} className={syncStatus === "connected" ? "animate-pulse text-emerald-400" : ""} />
              <span>{syncStatus === "connected" ? "P2P Live" : "Sync Pair"}</span>
            </button>

            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-lg border transition-all cursor-pointer"
              style={{ borderColor: "var(--line)", color: "var(--mut)", background: "var(--panel2)" }}
              title="Toggle theme"
            >
              {state.settings.themeMode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <button
              onClick={() => setPaletteOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border transition-all cursor-pointer"
              style={{ borderColor: "var(--line)", color: "var(--mut)", background: "var(--panel2)" }}
              title="Search (Ctrl+K / K)"
            >
              <Search size={14} />
            </button>
          </div>

          <nav className="mt-3 flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
            {NAV_SECTIONS.map((sec) => (
              <div key={sec.title} className="flex flex-col gap-1">
                <div className="px-3 pt-2 text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--mut)" }}>
                  {sec.title}
                </div>
                {sec.items.map((n) => navButton(n))}
              </div>
            ))}
          </nav>

          <div className="mt-auto rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
            <Clock />
            <Btn variant="primary" className="mt-2.5 w-full" size="sm" onClick={() => openTaskDialog()}>
              <Plus size={14} /> New task
            </Btn>
            <div className="mt-2.5 text-center text-[10px] font-bold tracking-wider opacity-70" style={{ color: "var(--mut)" }}>
              Crafted by Krish Patel
            </div>
          </div>
        </aside>

        <main className="zoomable relative z-10 ml-0 w-full px-3.5 pt-[calc(68px+var(--safe-top,0px))] pb-28 md:ml-[236px] md:w-[calc(100%-236px)] md:px-8 md:pt-6 md:pb-20">
          <div className="w-full">{activeViewContent}</div>
        </main>
        <StatusBarDesk
          dueToday={dueToday}
          todayMin={tracked.get(today) ?? 0}
          bestStreak={bestStreak}
          goFocus={() => setView("focus")}
        />

        <Overlays
          greeting={greeting}
          closeGreeting={closeGreeting}
          paletteOpen={paletteOpen}
          setPaletteOpen={setPaletteOpen}
          onToggleTheme={toggleTheme}
        />
        <MiniTimer />
      </div>
    );
  }

  /* ============================ 4. ZEN ENGINE (Full-screen Cockpit) ============================ */
  if (layout === "zen") {
    return (
      <div className="relative min-h-screen">
        {mobileBar}
        {mobileDrawer}
        <div className="ambient" style={{ opacity: 0.5 }}>
          <div className="grid-lines" />
        </div>
        <aside
          className="fixed inset-y-0 left-0 z-40 hidden w-[68px] flex-col items-center gap-1.5 border-r py-4 backdrop-blur-md md:flex select-none overflow-y-auto overflow-x-hidden scrollbar-none"
          style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)", borderColor: "var(--line)" }}
        >
          <Logo small />

          <div className="mt-3 flex flex-col items-center gap-2">
            <button
              onClick={openSyncDialog}
              title={syncStatus === "connected" ? "P2P Sync Connected" : "Device-to-Device Sync"}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all hover:scale-105 cursor-pointer"
              style={{
                borderColor: syncStatus === "connected" ? "rgba(16, 185, 129, 0.5)" : "var(--line)",
                color: syncStatus === "connected" ? "#10b981" : "var(--mut)",
                background: syncStatus === "connected" ? "rgba(16, 185, 129, 0.1)" : "var(--panel2)",
              }}
            >
              <Radio size={15} className={syncStatus === "connected" ? "animate-pulse text-emerald-400" : ""} />
            </button>

            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer"
              style={{ borderColor: "var(--line)", color: "var(--mut)", background: "var(--panel2)" }}
              title="Toggle theme"
            >
              {state.settings.themeMode === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>

          <div className="mt-3 flex w-full flex-col items-center gap-1 px-1.5">
            {NAV_SECTIONS.map((sec, sIdx) => (
              <div key={sec.title} className="flex w-full flex-col items-center gap-1">
                {sIdx > 0 && <div className="my-1.5 w-6 border-b" style={{ borderColor: "var(--line)" }} />}
                {sec.items.map((n) => navButton(n, { iconOnly: true }))}
              </div>
            ))}
          </div>

          <div className="mt-auto flex flex-col items-center gap-2.5">
            {view === "dashboard" && (
              <button
                onClick={() => setZenConfig((v) => !v)}
                title="Customise zen panels"
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-all cursor-pointer"
                style={{ color: zenConfig ? "var(--accent)" : "var(--mut)" }}
              >
                <SlidersHorizontal size={16} />
              </button>
            )}
            <Clock compact />
          </div>
        </aside>

        <div className="relative z-10 ml-0 w-full min-h-screen md:ml-[68px] md:w-[calc(100%-68px)]">
          {view === "dashboard" && zenConfig && (
            <div
              className="pop mx-4 mt-4 flex flex-wrap items-center gap-4 rounded-2xl border px-4 py-2.5 md:mx-6 shadow-xl"
              style={{ background: "var(--panel2)", borderColor: "var(--line)" }}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>
                Zen panels
              </span>
              {(["plan", "timer", "checkin", "insights"] as const).map((k) => (
                <Toggle
                  key={k}
                  checked={state.settings.zenPanels[k]}
                  onChange={(v) =>
                    set((s) => ({
                      ...s,
                      settings: { ...s.settings, zenPanels: { ...s.settings.zenPanels, [k]: v } },
                    }))
                  }
                  label={k === "checkin" ? "check-in" : k}
                />
              ))}
              <button
                onClick={() => setZenConfig(false)}
                className="ml-auto text-[11.5px] font-bold cursor-pointer hover:opacity-80"
                style={{ color: "var(--mut)" }}
              >
                Done
              </button>
            </div>
          )}
          <main className="zoomable relative z-10 min-h-0 w-full flex-1 px-3.5 pt-[calc(68px+var(--safe-top,0px))] pb-28 md:px-7 md:py-6">
            <div className="w-full">{activeViewContent}</div>
          </main>
        </div>

        <Overlays
          greeting={greeting}
          closeGreeting={closeGreeting}
          paletteOpen={paletteOpen}
          setPaletteOpen={setPaletteOpen}
          onToggleTheme={toggleTheme}
        />
        <MiniTimer />
      </div>
    );
  }

  /* ============================ 5. LIQUID GLASS ENGINE (Default) ============================ */
  return (
    <div className="relative min-h-screen">
      {mobileBar}
      {mobileDrawer}
      <div className="liquid-field">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
        <div className="blob b4" />
      </div>

      <aside
        className="fixed inset-y-4 left-4 z-40 hidden w-[256px] flex-col rounded-3xl border p-4 backdrop-blur-2xl md:flex select-none"
        style={{
          background: state.settings.themeMode === "dark"
            ? "color-mix(in srgb, var(--panel) 58%, transparent)"
            : "color-mix(in srgb, var(--panel) 76%, transparent)",
          borderColor: state.settings.themeMode === "dark"
            ? "color-mix(in srgb, var(--text) 14%, transparent)"
            : "color-mix(in srgb, var(--line) 85%, transparent)",
          boxShadow: state.settings.themeMode === "dark"
            ? "inset 0 1px 0.5px 0 rgba(255, 255, 255, 0.16), inset 0 -1px 0 0 color-mix(in srgb, var(--accent) 20%, transparent), 0 24px 60px -30px rgba(0, 0, 0, 0.75)"
            : "inset 0 1px 0.5px 0 rgba(255, 255, 255, 0.9), 0 20px 48px -20px rgba(0, 0, 0, 0.08)",
        }}
      >
        <Logo />

        <div className="mt-3.5 flex items-center gap-1.5 pb-2 border-b" style={{ borderColor: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
          <button
            onClick={openSyncDialog}
            title={syncStatus === "connected" ? "P2P Sync Connected" : "Device-to-Device Sync"}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-1.5 text-xs font-bold transition-all hover:scale-[1.02] cursor-pointer"
            style={{
              borderColor: syncStatus === "connected" ? "rgba(16, 185, 129, 0.5)" : "var(--line)",
              color: syncStatus === "connected" ? "#10b981" : "var(--mut)",
              background: syncStatus === "connected" ? "rgba(16, 185, 129, 0.1)" : "var(--panel2)",
            }}
          >
            <Radio size={13} className={syncStatus === "connected" ? "animate-pulse text-emerald-400" : ""} />
            <span>{syncStatus === "connected" ? "P2P Live" : "Sync"}</span>
          </button>

          <button
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-xl border transition-all cursor-pointer"
            style={{ borderColor: "var(--line)", color: "var(--mut)", background: "var(--panel2)" }}
            title="Toggle theme"
          >
            {state.settings.themeMode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <button
            onClick={() => setPaletteOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border transition-all cursor-pointer"
            style={{ borderColor: "var(--line)", color: "var(--mut)", background: "var(--panel2)" }}
            title="Search (Ctrl+K)"
          >
            <Search size={14} />
          </button>
        </div>

        <nav className="mt-3 flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {NAV_SECTIONS.map((sec) => (
            <div key={sec.title} className="flex flex-col gap-1">
              <div className="px-3 pt-2 text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--mut)" }}>
                {sec.title}
              </div>
              {sec.items.map((n) => navButton(n))}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          <div
            className="rounded-2xl border px-3 py-2.5 backdrop-blur-xl"
            style={{
              borderColor: state.settings.themeMode === "dark"
                ? "color-mix(in srgb, var(--text) 12%, transparent)"
                : "color-mix(in srgb, var(--line) 85%, transparent)",
              background: state.settings.themeMode === "dark"
                ? "color-mix(in srgb, var(--panel2) 55%, transparent)"
                : "color-mix(in srgb, var(--panel2) 75%, transparent)",
              boxShadow: state.settings.themeMode === "dark"
                ? "inset 0 1px 0 rgba(255,255,255,0.08)"
                : "inset 0 1px 0 rgba(255,255,255,0.7)",
            }}
          >
            <Clock />
          </div>
          <Btn variant="primary" onClick={() => openTaskDialog()}>
            <Plus size={14} /> New task
          </Btn>
          <div className="text-center text-[10px] font-bold tracking-wider opacity-70" style={{ color: "var(--mut)" }}>
            Crafted by Krish Patel
          </div>
        </div>
      </aside>

      <main className="zoomable relative z-10 ml-0 w-full px-3.5 pt-[calc(68px+var(--safe-top,0px))] pb-28 md:ml-[280px] md:w-[calc(100%-280px)] md:px-8 md:py-6">
        <div className="w-full">{activeViewContent}</div>
      </main>

      <Overlays
        greeting={greeting}
        closeGreeting={closeGreeting}
        paletteOpen={paletteOpen}
        setPaletteOpen={setPaletteOpen}
        onToggleTheme={toggleTheme}
      />
      <MiniTimer />
    </div>
  );
}

/* ============================ ZEN HOME COCKPIT ============================ */
function ZenHome() {
  const { state, set, setView, requestFocus, toggleDone, openTaskDialog, toast } = useApp();
  const today = todayIso();
  const p = state.settings.zenPanels;
  const tracked = useMemo(() => trackedByDay(state.sessions), [state.sessions]);
  const todayMin = tracked.get(today) ?? 0;
  const dueTasks = useMemo(
    () =>
      state.tasks
        .filter((t) => !t.done && t.due && t.due <= today && (!t.snoozedUntil || t.snoozedUntil <= Date.now()))
        .sort((a, b) => (a.dueTime ? 0 : 1) - (b.dueTime ? 0 : 1) || (a.due ?? "").localeCompare(b.due ?? "")),
    [state.tasks, today]
  );
  const doneToday = state.tasks.filter((t) => t.done && t.doneAt && todayIsoOf(t.doneAt) === today).length;
  const running = state.sessions.find((s) => s.status === "running");
  const log = state.dayLogs[today];
  const [energy, setEnergy] = useState(log?.energy ?? 3);
  const EMOJIS = ["😫", "😕", "😐", "🙂", "😄", "🤩"];
  const [moodEmoji, setMoodEmoji] = useState(log?.moodEmoji ?? "");
  const hour = new Date().getHours();
  const name = state.settings.profileName.trim();

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">
            {greetingFor(hour)}
            {name ? `, ${name}` : ""}.
          </h1>
          <p className="text-[13px] font-semibold" style={{ color: "var(--mut)" }}>
            {fmtDateLong(new Date())} · {fmtDur(todayMin)} tracked · {dueTasks.length} due · {doneToday} done
          </p>
        </div>
        <div className="flex gap-2">
          <Btn variant="soft" onClick={() => setView("daylog")}>
            <FileClock size={13} /> Day log
          </Btn>
          <Btn variant="primary" onClick={() => requestFocus(null)}>
            <Play size={13} /> Start focus
          </Btn>
        </div>
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-3" style={{ gridAutoRows: "minmax(120px, auto)" }}>
        {p.plan && (
          <div className="card card-hover flex flex-col p-4 lg:row-span-2">
            <div className="flex items-center justify-between">
              <span className="font-display text-[15px] font-bold">Today’s plan</span>
              <Btn size="sm" variant="ghost" onClick={() => openTaskDialog({ presetDate: today })}>
                <Plus size={12} /> Add
              </Btn>
            </div>
            <div className="mt-2.5 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
              {dueTasks.length === 0 && (
                <div
                  className="rounded-xl border border-dashed px-3 py-6 text-center text-[12.5px]"
                  style={{ borderColor: "var(--line)", color: "var(--mut)" }}
                >
                  Clear runway. Pull a task onto today or enjoy the quiet.
                </div>
              )}
              {dueTasks.map((t) => {
                const proj = state.projects.find((x) => x.id === t.projectId);
                return (
                  <div
                    key={t.id}
                    className="group flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-all hover:translate-x-[2px]"
                    style={{ borderColor: "var(--line)", background: "var(--bg)" }}
                  >
                    <button
                      onClick={() => toggleDone(t.id)}
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-all hover:scale-110 cursor-pointer"
                      style={{ borderColor: proj?.color ?? "var(--accent)" }}
                      aria-label="Complete"
                    >
                      <Check size={11} className="opacity-0 transition-opacity group-hover:opacity-60" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold">
                        {t.emoji ? `${t.emoji} ` : ""}
                        {t.title}
                      </div>
                      <div className="text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>
                        {proj?.name}
                        {t.dueTime ? ` · ${t.dueTime}` : ""}
                        {t.due && t.due < today ? " · overdue" : ""}
                      </div>
                    </div>
                    <Btn size="sm" variant="soft" onClick={() => requestFocus(t.id)}>
                      <Play size={11} />
                    </Btn>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {p.timer && (
          <div className="card card-hover relative overflow-hidden p-4">
            <div
              className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-25"
              style={{ background: "var(--accent)", filter: "blur(34px)" }}
            />
            <span className="font-display text-[15px] font-bold">Focus</span>
            {running ? (
              <div className="mt-3">
                <div className="stage-num font-mono text-[38px] font-bold" style={{ color: "var(--accent)" }}>
                  {fmtHMS(sessionSeconds(running))}
                </div>
                <div className="mt-0.5 truncate text-[12px] font-semibold" style={{ color: "var(--mut)" }}>
                  {running.mode} · {state.tasks.find((t) => t.id === running.taskId)?.title ?? "break"}
                </div>
                <Btn variant="primary" className="mt-3" onClick={() => setView("focus")}>
                  Open session
                </Btn>
              </div>
            ) : (
              <div className="mt-3">
                <div className="text-[12.5px] font-semibold" style={{ color: "var(--mut)" }}>
                  Pomodoro, countdown or open flow — the counter takes over the screen once you start.
                </div>
                <div className="mt-3 flex gap-2">
                  <Btn variant="primary" onClick={() => requestFocus(null)}>
                    <Timer size={13} /> Open Focus
                  </Btn>
                  <Btn variant="soft" onClick={() => setView("calendar")}>
                    <Calendar size={13} /> Calendar
                  </Btn>
                </div>
              </div>
            )}
          </div>
        )}

        {p.insights && (
          <div className="card card-hover p-4">
            <span className="font-display text-[15px] font-bold">Today at a glance</span>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { k: "Tracked", v: fmtDur(todayMin) },
                { k: "Done", v: String(doneToday) },
                { k: "Due", v: String(dueTasks.length) },
                {
                  k: "Top streak",
                  v: `${Math.max(0, ...state.habits.map((h) => streakStats(h.completions).current))}d`,
                },
              ].map((x) => (
                <div
                  key={x.k}
                  className="rounded-xl border px-3 py-2.5"
                  style={{ borderColor: "var(--line)", background: "var(--bg)" }}
                >
                  <div className="font-mono text-[17px] font-bold tnum" style={{ color: "var(--accent)" }}>
                    {x.v}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>
                    {x.k}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {p.checkin && (
          <div className="card card-hover p-4">
            <div className="flex items-center justify-between">
              <span className="font-display text-[15px] font-bold">
                {hour < 14 ? "Morning check-in" : "Evening check-in"}
              </span>
              <Btn
                size="sm"
                variant="primary"
                onClick={() => {
                  set((s) => ({
                    ...s,
                    dayLogs: {
                      ...s.dayLogs,
                      [today]: {
                        energy,
                        moodEmoji,
                        mood: s.dayLogs[today]?.mood ?? "",
                        updatedAt: Date.now(),
                      },
                    },
                  }));
                  toast("Check-in saved", "ok");
                }}
              >
                <Check size={12} /> Save
              </Btn>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="font-mono text-[20px] font-bold tnum" style={{ color: "var(--accent)" }}>
                {energy}/5
              </span>
              <input
                type="range"
                min={1}
                max={5}
                value={energy}
                onChange={(e) => setEnergy(parseInt(e.target.value, 10))}
                className="energy flex-1 cursor-pointer"
              />
            </div>
            <div className="mt-2.5 flex gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setMoodEmoji(moodEmoji === e ? "" : e)}
                  className="flex h-9 flex-1 items-center justify-center rounded-xl border text-[17px] transition-all hover:scale-105"
                  style={
                    moodEmoji === e
                      ? { borderColor: "var(--accent)", background: "var(--accent-soft)" }
                      : { borderColor: "var(--line)", cursor: "pointer", opacity: 0.75 }
                  }
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ CONTROL / DESK STATUS BAR ============================ */
function StatusBar({
  dueToday,
  todayMin,
  bestStreak,
  goFocus,
}: {
  dueToday: number;
  todayMin: number;
  bestStreak: number;
  goFocus: () => void;
}) {
  const { state } = useApp();
  const running = state.sessions.find((s) => s.status === "running");
  const [, force] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => force((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [running]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 hidden h-[52px] items-center gap-4 border-t px-5 backdrop-blur-md md:flex select-none"
      style={{ background: "color-mix(in srgb, var(--panel) 92%, transparent)", borderColor: "var(--line)" }}
    >
      <span className="chip !py-0.5 text-[11px]">
        <Flame size={11} style={{ color: "var(--accent)" }} /> {fmtDur(todayMin)} today
      </span>
      <span className="chip !py-0.5 text-[11px]">
        <ListTodo size={11} style={{ color: "var(--mut)" }} /> {dueToday} due
      </span>
      <span className="chip !py-0.5 text-[11px]">
        <Check size={11} style={{ color: "var(--ok)" }} /> streak {bestStreak}d
      </span>

      {running && (
        <button
          onClick={goFocus}
          className="ml-auto flex items-center gap-2 rounded-lg px-2.5 py-1 font-mono text-[12.5px] font-bold tnum transition-all hover:opacity-80 cursor-pointer"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <span className="h-[7px] w-[7px] rounded-full" style={{ background: "var(--ok)", animation: "nowpulse 1.6s infinite" }} />
          {running.mode} · {fmtHMS(sessionSeconds(running))}
        </button>
      )}

      <span
        className={cn("ml-auto text-[10.5px] font-bold tracking-wider", running && "ml-0")}
        style={{ color: "var(--mut)" }}
      >
        Crafted by Krish Patel · AES-256 Local Only
      </span>
    </div>
  );
}

/* Desk engine status bar: positioned right of 236px sidebar */
function StatusBarDesk({
  dueToday,
  todayMin,
  bestStreak,
  goFocus,
}: {
  dueToday: number;
  todayMin: number;
  bestStreak: number;
  goFocus: () => void;
}) {
  const { state } = useApp();
  const running = state.sessions.find((s) => s.status === "running");
  const [, force] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => force((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [running]);

  return (
    <div
      className="fixed bottom-0 right-0 z-40 hidden h-[52px] items-center gap-4 border-l border-t px-5 glass-regular md:flex select-none"
      style={{
        borderColor: "var(--line)",
        left: "236px",
      }}
    >
      <span className="chip !py-0.5 text-[11px]">
        <Flame size={11} style={{ color: "var(--accent)" }} /> {fmtDur(todayMin)} today
      </span>
      <span className="chip !py-0.5 text-[11px]">
        <ListTodo size={11} style={{ color: "var(--mut)" }} /> {dueToday} due
      </span>
      <span className="chip !py-0.5 text-[11px]">
        <Check size={11} style={{ color: "var(--ok)" }} /> streak {bestStreak}d
      </span>

      {running && (
        <button
          onClick={goFocus}
          className="ml-auto flex items-center gap-2 rounded-lg px-2.5 py-1 font-mono text-[12.5px] font-bold tnum transition-all hover:opacity-80 cursor-pointer"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <span className="h-[7px] w-[7px] rounded-full" style={{ background: "var(--ok)", animation: "nowpulse 1.6s infinite" }} />
          {running.mode} · {fmtHMS(sessionSeconds(running))}
        </button>
      )}

      <span
        className={cn("ml-auto text-[10.5px] font-bold tracking-wider", running && "ml-0")}
        style={{ color: "var(--mut)" }}
      >
        Crafted by Krish Patel · AES-256 Local Only
      </span>
    </div>
  );
}

/* ============================ FLOATING MINI-TIMER ============================ */
function MiniTimer() {
  const { state, set, view, setView, toast } = useApp();
  const [, force] = useState(0);
  const [minimized, setMinimized] = useState(() => {
    try {
      return localStorage.getItem("lifelog.minitimer.minimized") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 250);
    return () => clearInterval(t);
  }, []);

  const toggleMinimize = () => {
    setMinimized((m) => {
      const next = !m;
      try {
        localStorage.setItem("lifelog.minitimer.minimized", next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const popOutDesktopTimer = () => {
    openTimerPopout();
  };

  // Never show floating mini-timer when user is already viewing the full Focus view
  if (view === "focus") return null;

  const running = state.sessions.find((s) => s.status === "running");
  if (!running) return null;

  const openPause = running.pauses.length > 0 && running.pauses[running.pauses.length - 1].resumeAt === null;
  const elapsedSec = sessionSeconds(running);
  const remainingSec = running.plannedMin ? Math.max(0, running.plannedMin * 60 - elapsedSec) : null;
  const task = state.tasks.find((t) => t.id === running.taskId);
  const label = running.mode === "break" ? "Break" : task?.title ?? "Focus session";
  const pct = remainingSec !== null ? Math.min(100, (elapsedSec / (running.plannedMin! * 60)) * 100) : null;

  const togglePause = () => {
    set((s) => ({
      ...s,
      sessions: s.sessions.map((x) => {
        if (x.id !== running.id) return x;
        if (openPause) {
          return {
            ...x,
            pauses: x.pauses.map((p, i) => (i === x.pauses.length - 1 ? { ...p, resumeAt: Date.now() } : p)),
          };
        }
        return { ...x, pauses: [...x.pauses, { at: Date.now(), resumeAt: null }] };
      }),
    }));
    toast(openPause ? "Resumed" : "Paused — timestamps kept", "ok");
  };

  const stop = () => {
    triggerHaptic("medium");
    const ts = Date.now();
    set((s) => ({
      ...s,
      sessions: s.sessions.map((x) =>
        x.id === running.id
          ? {
              ...x,
              endedAt: ts,
              status: "stopped",
              pauses: x.pauses.map((p) => (p.resumeAt ? p : { ...p, resumeAt: ts })),
            }
          : x
      ),
    }));
    toast(`Stopped — ${fmtDur(Math.max(1, Math.round(elapsedSec / 60)))} saved to your log`, "ok");
  };

  const big = remainingSec !== null ? fmtHMS(remainingSec) : fmtHMS(elapsedSec);

  return (
    <div
      className={cn(
        "mini-timer fixed z-[60] right-3.5 sm:right-4 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none overflow-hidden",
        minimized
          ? "w-[165px] px-3 py-2 hover:scale-[1.03]"
          : "w-[calc(100%-28px)] sm:w-[295px] p-3"
      )}
      style={{
        bottom: "calc(74px + var(--safe-bottom, 12px))",
        background: state.settings.themeMode === "dark"
          ? "color-mix(in srgb, var(--panel) 70%, transparent)"
          : "color-mix(in srgb, var(--panel) 82%, transparent)",
        borderColor: minimized
          ? "color-mix(in srgb, var(--accent) 55%, var(--line))"
          : "color-mix(in srgb, var(--accent) 45%, var(--line))",
        boxShadow: state.settings.themeMode === "dark"
          ? "inset 0 1px 0.5px 0 rgba(255, 255, 255, 0.16), inset 0 -1px 0 0 color-mix(in srgb, var(--accent) 25%, transparent), 0 20px 48px -15px rgba(0, 0, 0, 0.75)"
          : "inset 0 1px 0.5px 0 rgba(255, 255, 255, 0.9), 0 16px 36px -12px rgba(0, 0, 0, 0.12)",
      }}
      title={minimized ? `${label} · Click to expand` : undefined}
    >
      {/* Top row: Always present, smoothly transforms */}
      <div className="flex items-center gap-2">
        <span
          className={cn("h-[8.5px] w-[8.5px] rounded-full shrink-0", !openPause && "ring-pulse")}
          style={{ background: openPause ? "var(--warn)" : "var(--ok)" }}
        />

        {!minimized && (
          <span
            className="text-[10px] font-bold uppercase tracking-[0.14em] truncate transition-opacity duration-200"
            style={{ color: "var(--accent)" }}
          >
            {openPause ? "Paused" : running.mode === "break" ? "Break" : running.mode}
          </span>
        )}

        <span
          className={cn(
            "font-mono font-bold tnum cursor-pointer transition-all duration-200",
            minimized ? "text-[13.5px]" : "ml-auto text-[18px]"
          )}
          onClick={toggleMinimize}
          style={{ color: "var(--text)" }}
        >
          {big}
        </span>

        {minimized && (
          <button
            type="button"
            onClick={togglePause}
            className="p-1 text-[var(--accent)] hover:opacity-75 transition-opacity cursor-pointer ml-0.5"
            title={openPause ? "Resume" : "Pause"}
            aria-label={openPause ? "Resume" : "Pause"}
          >
            {openPause ? <Play size={12} /> : <Pause size={12} />}
          </button>
        )}

        <div className="flex items-center gap-0.5 ml-auto sm:ml-1">
          {!minimized && (
            <button
              type="button"
              onClick={popOutDesktopTimer}
              className="p-1 rounded text-[var(--mut)] hover:text-[var(--accent)] hover:bg-[var(--panel)] transition-colors cursor-pointer"
              title="Pop out desktop timer window"
              aria-label="Desktop popout"
            >
              <ExternalLink size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={toggleMinimize}
            className="p-1 rounded text-[var(--mut)] hover:text-[var(--text)] hover:bg-[var(--panel)] transition-all duration-200 cursor-pointer active:scale-90"
            title={minimized ? "Expand mini timer" : "Minimize mini timer"}
            aria-label={minimized ? "Expand mini timer" : "Minimize mini timer"}
          >
            {minimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
          </button>
        </div>
      </div>

      {/* Expanded body with smooth height/opacity collapse */}
      <div
        className={cn(
          "transition-all duration-300 ease-in-out",
          minimized
            ? "max-h-0 opacity-0 pointer-events-none mt-0"
            : "max-h-[140px] opacity-100 mt-1"
        )}
      >
        <div className="truncate text-[12px] font-bold" title={label}>
          {label}
        </div>
        {pct !== null && (
          <div className="mt-1.5 h-[5px] overflow-hidden rounded-full" style={{ background: "var(--bg)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--accent)" }} />
          </div>
        )}
        <div className="mt-2 flex gap-1.5">
          <Btn size="sm" variant="soft" className="flex-1" onClick={togglePause}>
            {openPause ? <Play size={12} /> : <Pause size={12} />} {openPause ? "Resume" : "Pause"}
          </Btn>
          <Btn size="sm" variant="danger" onClick={stop}>
            <Square size={11} /> Stop
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => setView("focus")} title="Open full counter">
            <Timer size={12} />
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ============================ GREETING + CONFIRM + SHORTCUTS OVERLAYS ============================ */
function Overlays({
  greeting,
  closeGreeting,
  paletteOpen,
  setPaletteOpen,
  drawerOpen,
  onCloseDrawer,
  onToggleTheme,
}: {
  greeting: boolean;
  closeGreeting: () => void;
  paletteOpen: boolean;
  setPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  drawerOpen?: boolean;
  onCloseDrawer?: () => void;
  onToggleTheme: () => void;
}) {
  const {
    state,
    set,
    toast,
    view,
    setView,
    openTaskDialog,
    taskDialog,
    closeTaskDialog,
    confirmReq,
    resolveConfirm,
    syncDialogOpen,
    closeSyncDialog,
  } = useApp();
  const [confirmText, setConfirmText] = useState("");
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [namePromptInput, setNamePromptInput] = useState(state.settings.profileName || "");
  const showNamePrompt = Boolean(state.meta && state.meta.hasSeenWelcome && !state.meta.hasCompletedNamePrompt);

  const submitNamePrompt = (skip = false) => {
    const trimmed = skip ? "" : namePromptInput.trim();
    set((s) => ({
      ...s,
      settings: trimmed ? { ...s.settings, profileName: trimmed } : s.settings,
      meta: { ...s.meta, hasCompletedNamePrompt: true },
    }));
    triggerHaptic("success");
    if (!skip && trimmed) {
      toast(`Welcome to LifeLog, ${trimmed}! 👋`, "ok");
    }
  };

  // Android Native Hardware Back Button Handler
  useEffect(() => {
    return initHardwareBackButton(() => {
      if (confirmReq?.open) {
        resolveConfirm(false);
        return true;
      }
      if (taskDialog.open) {
        closeTaskDialog();
        return true;
      }
      if (syncDialogOpen) {
        closeSyncDialog();
        return true;
      }
      if (paletteOpen) {
        setPaletteOpen(false);
        return true;
      }
      if (help) {
        setHelp(false);
        return true;
      }
      if (moreSheetOpen) {
        setMoreSheetOpen(false);
        return true;
      }
      if (drawerOpen) {
        onCloseDrawer?.();
        return true;
      }
      if (greeting) {
        closeGreeting();
        return true;
      }
      if (view !== "dashboard") {
        setView("dashboard");
        return true;
      }
      return false;
    });
  }, [paletteOpen, moreSheetOpen, help, confirmReq?.open, taskDialog.open, closeTaskDialog, syncDialogOpen, closeSyncDialog, greeting, view, setView, closeGreeting, resolveConfirm, setPaletteOpen, drawerOpen, onCloseDrawer]);

  useEffect(() => setConfirmText(""), [confirmReq]);
  const blocked = !!confirmReq?.requireText && confirmText !== confirmReq.requireText;
  const hour = new Date().getHours();
  const name = state.settings.profileName.trim();

  /* Global keyboard shortcuts (Space, Ctrl+N, etc.) */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        openTaskDialog();
        return;
      }
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const sc = state.settings.shortcuts ?? {};
      const k = e.key === " " ? "space" : e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const action = Object.entries(sc).find(([, key]) => (key || "").toLowerCase() === k.toLowerCase())?.[0];
      if (!action) return;
      e.preventDefault();
      switch (action) {
        case "commandPalette":
          setPaletteOpen((prev) => !prev);
          break;
        case "newTask":
          openTaskDialog();
          break;
        case "newNote":
          setView("notes");
          window.location.hash = "notes";
          setTimeout(() => window.dispatchEvent(new CustomEvent("lifelog:new-note")), 60);
          break;
        case "openDashboard":
          setView("dashboard");
          window.location.hash = "dashboard";
          break;
        case "openTasks":
          setView("tasks");
          window.location.hash = "tasks";
          break;
        case "openFocus":
          setView("focus");
          window.location.hash = "focus";
          break;
        case "openCalendar":
          setView("calendar");
          window.location.hash = "calendar";
          break;
        case "openHabits":
          setView("habits");
          window.location.hash = "habits";
          break;
        case "openNotes":
          setView("notes");
          window.location.hash = "notes";
          break;
        case "openDayLog":
          setView("daylog");
          window.location.hash = "daylog";
          break;
        case "openReports":
          setView("reports");
          window.location.hash = "reports";
          break;
        case "openReview":
          setView("review");
          window.location.hash = "review";
          break;
        case "openSettings":
          setView("settings");
          window.location.hash = "settings";
          break;
        case "help":
          setHelp(true);
          break;
        case "togglePause": {
          const live = state.sessions.find((s) => s.status === "running");
          if (!live) {
            toast("No timer running", "warn");
            break;
          }
          const lp = live.pauses[live.pauses.length - 1];
          const isPaused = !!lp && lp.resumeAt === null;
          set((st) => ({
            ...st,
            sessions: st.sessions.map((x) =>
              x.id === live.id
                ? isPaused
                  ? { ...x, pauses: x.pauses.map((p, i) => (i === x.pauses.length - 1 ? { ...p, resumeAt: Date.now() } : p)) }
                  : { ...x, pauses: [...x.pauses, { at: Date.now(), resumeAt: null }] }
                : x
            ),
          }));
          toast(isPaused ? "Timer resumed" : "Timer paused", "ok");
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [state.settings.shortcuts, state.sessions, openTaskDialog, setPaletteOpen, setView, toast, set]);

  const quote = useMemo(() => {
    const pool = [...QUOTES, ...state.settings.customQuotes.filter((q) => q.trim())];
    return pool[Math.floor(Math.random() * pool.length)] ?? QUOTES[0];
  }, [greeting, state.settings.customQuotes]);

  return (
    <>
      {/* Daily Launch Greeting */}
      <Modal open={greeting} onClose={closeGreeting} title="LifeLog" width={520}>
        <div className="relative flex flex-col items-start gap-4">
          <div className="h-1 -mt-4 -mx-4 sm:-mx-5 w-[calc(100%+32px)] sm:w-[calc(100%+40px)] rounded-t-3xl shrink-0"
               style={{ background: "linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 30%, transparent), transparent)" }} />
          <div>
            <div className="font-display text-[27px] font-bold leading-tight tracking-tight">
              {greetingFor(hour)}
              {name ? `, ${name}` : ""}.
            </div>
            <div className="mt-1 text-[13px] font-semibold" style={{ color: "var(--mut)" }}>
              {fmtDateLong(new Date())}
            </div>
          </div>
          <div className="w-full rounded-2xl border p-4 border-l-4 shadow-sm bg-[var(--panel2)]" style={{ borderColor: "var(--line)", borderLeftColor: "var(--accent)" }}>
            <div className="flex items-start gap-3">
              <Quote size={20} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
              <p className="font-display text-[15.5px] font-semibold leading-relaxed" style={{ color: "var(--text)" }}>
                {quote}
              </p>
            </div>
          </div>
          <div className="flex w-full items-center justify-between gap-2 pt-1">
            <Btn variant="ghost" onClick={closeGreeting}>
              Skip
            </Btn>
            <Btn variant="primary" onClick={closeGreeting} className="flex-1 sm:flex-initial sm:min-w-[170px]">
              Let’s log the day →
            </Btn>
          </div>
        </div>
      </Modal>

      {/* First-time User Name Prompt */}
      <Modal
        open={showNamePrompt}
        onClose={() => submitNamePrompt(true)}
        title="Welcome to LifeLog"
        width={460}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-display text-[18px] font-bold">What should LifeLog call you?</h3>
            <p className="text-[13px] text-[var(--mut)]">
              This will personalise your daily greeting and check-in reflections. You can always change it later in
              Settings.
            </p>
          </div>

          <div>
            <TextInput
              autoFocus
              value={namePromptInput}
              onChange={(e) => setNamePromptInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitNamePrompt(false);
                }
              }}
              placeholder="e.g. Krish Patel"
            />
          </div>

          <div className="flex w-full justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => submitNamePrompt(true)}>
              Skip
            </Btn>
            <Btn variant="primary" onClick={() => submitNamePrompt(false)}>
              Continue
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Confirmation Dialog */}
      <Modal
        open={!!confirmReq?.open}
        onClose={() => resolveConfirm(false)}
        title={
          confirmReq?.danger ? (
            <span className="flex items-center gap-2" style={{ color: "var(--accent)" }}>
              <Trash2 size={16} />
              {confirmReq?.title ?? "Confirm"}
            </span>
          ) : (
            confirmReq?.title ?? ""
          )
        }
        width={confirmReq?.compact ? 360 : 440}
        compact={confirmReq?.compact}
        zIndex={95}
        footer={
          <>
            <Btn variant="ghost" onClick={() => resolveConfirm(false)} size={confirmReq?.compact ? "sm" : "md"}>
              {confirmReq?.cancelLabel ?? "Cancel"}
            </Btn>
            <Btn
              variant="primary"
              disabled={blocked}
              size={confirmReq?.compact ? "sm" : "md"}
              onClick={() => resolveConfirm(true)}
            >
              {confirmReq?.confirmLabel ?? "Confirm"}
            </Btn>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text)" }}>
          {confirmReq?.body}
        </p>
        {confirmReq?.requireText && (
          <div className="mt-3">
            <span className="lbl">Type “{confirmReq.requireText}” to confirm</span>
            <TextInput
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={confirmReq.requireText}
            />
          </div>
        )}
      </Modal>

      <TaskDialog />
      <SyncDialog open={syncDialogOpen} onClose={closeSyncDialog} />
      <LiveAnnouncer />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        state={state}
        currentView={view}
        onNavigate={(v) => {
          setView(v);
          window.location.hash = v;
        }}
        onNewTask={() => openTaskDialog()}
        onSelectTask={(t) => openTaskDialog({ taskId: t.id })}
        onSelectNote={(note) => {
          setView("notes");
          window.location.hash = "notes";
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("lifelog:open-note", { detail: { noteId: note.id } }));
          }, 60);
        }}
        onToggleTheme={onToggleTheme}
      />

      {/* Keyboard Shortcuts Modal */}
      <Modal open={help} onClose={() => setHelp(false)} title="Keyboard Shortcuts Cheat Sheet" width={480}>
        <div className="flex flex-col gap-3.5 select-none">
          {/* Hero Banner: Command Palette */}
          <div
            className="flex items-center justify-between rounded-2xl p-3.5 glass-clear border"
            style={{ borderColor: "color-mix(in srgb, var(--accent) 35%, var(--line))" }}
          >
            <div className="flex items-center gap-2.5">
              <Search size={16} style={{ color: "var(--accent)" }} />
              <div>
                <div className="text-[13px] font-bold">Universal Command Palette</div>
                <div className="text-[10.5px]" style={{ color: "var(--mut)" }}>
                  Search tasks, switch views, trigger actions instantly
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="rounded-lg border px-2 py-0.5 font-mono text-[11px] font-bold bg-[var(--panel2)] border-[var(--line)]">
                Ctrl
              </kbd>
              <span className="text-[11px] font-bold opacity-60">+</span>
              <kbd className="rounded-lg border px-2 py-0.5 font-mono text-[11px] font-bold bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)]">
                K
              </kbd>
            </div>
          </div>

          {/* Group 1: Navigation */}
          <div className="flex flex-col gap-1">
            <div className="px-1 text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--mut)" }}>
              Navigation
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { action: "openDashboard", label: "Dashboard" },
                { action: "openTasks", label: "Tasks" },
                { action: "openFocus", label: "Focus & Timer" },
                { action: "openCalendar", label: "Calendar" },
                { action: "openHabits", label: "Habits" },
                { action: "openNotes", label: "Notes" },
                { action: "openDayLog", label: "Day Log" },
                { action: "openReports", label: "Reports" },
                { action: "openReview", label: "Review" },
                { action: "openSettings", label: "Settings" },
              ].map((item) => {
                const keyVal = state.settings.shortcuts[item.action] ?? "";
                return (
                  <div
                    key={item.action}
                    className="flex items-center justify-between rounded-xl border px-2.5 py-1.5 glass-regular"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <span className="text-[12px] font-bold truncate pr-1">{item.label}</span>
                    <kbd className="rounded-md border px-1.5 py-0.2 font-mono text-[10.5px] font-bold shrink-0 bg-[var(--panel2)] border-[var(--line)]">
                      {keyVal ? keyVal.toUpperCase() : "—"}
                    </kbd>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Group 2: Creation & Action */}
          <div className="flex flex-col gap-1">
            <div className="px-1 text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--mut)" }}>
              Actions & Creation
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { action: "newTask", label: "New task / Log entry" },
                { action: "newNote", label: "New note" },
                { action: "togglePause", label: "Pause / Resume timer" },
                { action: "help", label: "Shortcut cheat sheet" },
              ].map((item) => {
                const keyVal = state.settings.shortcuts[item.action] ?? "";
                return (
                  <div
                    key={item.action}
                    className="flex items-center justify-between rounded-xl border px-2.5 py-1.5 glass-regular"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <span className="text-[12px] font-bold truncate pr-1">{item.label}</span>
                    <kbd className="rounded-md border px-1.5 py-0.2 font-mono text-[10.5px] font-bold shrink-0 bg-[var(--panel2)] border-[var(--line)]">
                      {keyVal === "space" ? "␣ space" : keyVal ? keyVal.toUpperCase() : "—"}
                    </kbd>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-1 text-[11px] font-medium text-center" style={{ color: "var(--mut)" }}>
            Remap any key anytime in <span className="font-bold text-[var(--text)]">Settings → Shortcuts</span>. Disabled inside text inputs.
          </div>
        </div>
      </Modal>

      {/* Mobile Android Bottom Dock & Hub Sheet (< md) */}
      <MobileBottomNav
        currentView={view}
        onSelectView={(v) => {
          setView(v);
          window.location.hash = v;
        }}
        onOpenNewTask={() => openTaskDialog()}
        onOpenMore={() => setMoreSheetOpen((o) => !o)}
        moreOpen={moreSheetOpen}
        mobileLayout={state.settings.mobileLayout ?? "classic"}
      />

      <MobileMoreSheet
        open={moreSheetOpen}
        onClose={() => setMoreSheetOpen(false)}
        currentView={view}
        onSelectView={(v) => {
          setView(v);
          window.location.hash = v;
        }}
      />
    </>
  );
}
