import { useState, useEffect } from "react";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Coffee,
  Cpu,
  Download,
  ExternalLink,
  FileText,
  Flame,
  Globe,
  HardDrive,
  Heart,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListTodo,
  Lock,
  Mail,
  Monitor,
  Moon,
  Play,
  Pause,
  Radio,
  RotateCcw,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Timer,
  Volume2,
  Zap,
  Check,
  ChevronRight,
  Sliders,
  Smile,
  Crown,
} from "lucide-react";
import { Btn, cn } from "../components/ui";
import { APP_VERSION } from "../types";
import type { State } from "../types";
import { useApp } from "../store";
import { toggleThemeModePatch } from "../utils/themes";

interface WelcomeProps {
  onEnter: () => void;
  canDismiss?: boolean;
}

export function WelcomeView({ onEnter, canDismiss = true }: WelcomeProps) {
  let appState: State | null = null;
  let appSet: ((fn: (s: State) => State) => void) | null = null;

  try {
    const app = useApp();
    appState = app.state;
    appSet = app.set;
  } catch {
    // If mounted outside store context
  }

  const isDark = appState?.settings?.themeMode === "dark";

  // Dynamic Dark/Light Mode toggle handler
  const handleToggleTheme = () => {
    if (appSet && appState?.settings) {
      const patch = toggleThemeModePatch(appState.settings);
      appSet((prev: State) => ({
        ...prev,
        settings: {
          ...prev.settings,
          ...patch,
        },
      }));
    } else {
      const current = document.documentElement.dataset.theme;
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
    }
  };

  // Smooth scroll helper that takes sticky header offset into account
  const scrollToSection = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Interactive Simulator State (Dopamine & User Engagement)
  const [simTab, setSimTab] = useState<"tasks" | "timer" | "notes">("tasks");
  const [demoTasks, setDemoTasks] = useState([
    { id: 1, title: "Review daily priority queue & sync calendar", done: true, tag: "Planning", mins: 15 },
    { id: 2, title: "25-min distraction-free focus block on architecture", done: true, tag: "Deep Work", mins: 25 },
    { id: 3, title: "Click me to test LifeLog\x27s instant dopamine hit ✨", done: false, tag: "Quick Win", mins: 5 },
  ]);
  const [timerSeconds, setTimerSeconds] = useState<number>(1498); // ~24:58
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // Timer simulation loop
  useEffect(() => {
    let interval: any = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 1500));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning]);

  const toggleTask = (id: number) => {
    setDemoTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const completedCount = demoTasks.filter((t) => t.done).length;
  const progressPercent = Math.round((completedCount / demoTasks.length) * 100);

  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const pillars = [
    {
      icon: ListTodo,
      title: "Tasks & Dynamic Mentions",
      color: "var(--accent)",
      tag: "Execution",
      desc: "Structured task execution with nested checklists, priority matrices, dynamic @/#/[ mentions, time estimates, and flexible recurring rules.",
      bullets: [
        "Nested subtasks with completion tracking",
        "Dynamic autocomplete for @Tasks, #Projects, [[Notes]]",
        "Drag-and-drop to calendar time grid",
        "Zero-cloud instant SQLite query speeds",
      ],
    },
    {
      icon: Timer,
      title: "Deep Focus Studio",
      color: "#f59e0b",
      tag: "Deep Work",
      desc: "Distraction-free Pomodoro and continuous Flow timers. Includes offline synthesized acoustic bell chimes and strict pause auditing.",
      bullets: [
        "Pomodoro (25/5), Flow & custom countdowns",
        "Offline ambient soundscapes & chimes",
        "Micro-pause duration tracking & audit logs",
        "Direct linkage to active priority tasks",
      ],
    },
    {
      icon: FileText,
      title: "Sovereign Second Brain",
      color: "#3b82f6",
      tag: "Knowledge",
      desc: "Fast, distraction-free Markdown notes with live preview, interactive checkboxes, file attachments, and bi-directional cross-referencing.",
      bullets: [
        "Pure Markdown with live interactive preview",
        "Dynamic Wiki-links and cross-entity mentions",
        "Encrypted local file attachments (<userData>/attachments)",
        "Zero AI scraping or server indexation",
      ],
    },
    {
      icon: Calendar,
      title: "Visual Time Blocking",
      color: "#10b981",
      tag: "Scheduling",
      desc: "Interactive 24-hour Day, 3-Day, and Week calendar grid. Drag tasks onto the grid to reserve focus time, and drag back to tray to unblock.",
      bullets: [
        "Drag & drop visual schedule planner",
        "Habit slot projection with time locking",
        "Drag-to-tray instant unscheduling",
        "Multi-day agenda and timeline views",
      ],
    },
    {
      icon: Flame,
      title: "Habit Streaks & Heatmaps",
      color: "#ef4444",
      tag: "Consistency",
      desc: "Build lasting routines with GitHub-style 12-week density heatmaps, current vs. best streak tracking, and customizable weekly target days.",
      bullets: [
        "12-week visual consistency heatmaps",
        "Current & all-time record streak metrics",
        "Automatic projection to daily checklists",
        "Custom target frequencies per week",
      ],
    },
    {
      icon: BarChart3,
      title: "Calibrated Analytics & PDF",
      color: "#8b5cf6",
      tag: "Calibration",
      desc: "Understand your real work capacity. Track estimate vs. actual completion ratios, hourly energy curves, and export crisp, lag-free executive PDF reports.",
      bullets: [
        "Estimate vs. actual calibration ratios",
        "Zero-lag selective task PDF reporting",
        "Hourly focus density heatmaps",
        "Energy and mood retrospective curves",
      ],
    },
    {
      icon: Radio,
      title: "Cryptographic P2P Sync",
      color: "#06b6d4",
      tag: "Zero-Cloud",
      desc: "Direct encrypted device-to-device synchronization over your local Wi-Fi. Zero relay databases, zero third-party cloud accounts, 100% private.",
      bullets: [
        "Direct WebRTC / DTLS encrypted sockets",
        "Zero cloud databases or intermediary servers",
        "Smart visual differential conflict resolution",
        "Independent cryptographic per-device keys",
      ],
    },
  ];

  const platforms = [
    {
      os: "Windows",
      icon: Monitor,
      type: "64-bit Setup & Portable .exe",
      ext: ".exe",
      size: "223 MB",
      href: "https://github.com/Krrish1411/Lifelog-Releases/releases/latest",
      badge: "Production Ready",
      note: "Instant offline installer with native SQLite WAL",
    },
    {
      os: "macOS",
      icon: Monitor,
      type: "Universal DMG (Apple Silicon & Intel)",
      ext: ".dmg",
      size: "261 MB",
      href: "https://github.com/Krrish1411/Lifelog-Releases/releases/latest",
      badge: "Universal Binary",
      note: "Native arm64 + x64 with full macOS shortcut support",
    },
    {
      os: "Linux",
      icon: Cpu,
      type: "Universal AppImage & Debian .deb",
      ext: ".AppImage",
      size: "350 MB",
      href: "https://github.com/Krrish1411/Lifelog-Releases/releases/latest",
      badge: "Self-Contained",
      note: "Runs on Ubuntu, Fedora, Arch, Debian out-of-the-box",
    },
    {
      os: "Android",
      icon: Smartphone,
      type: "Native Arm64 APK Release",
      ext: ".apk",
      size: "6.8 MB",
      href: "https://github.com/Krrish1411/Lifelog-Releases/releases/latest",
      badge: "Native APK",
      note: "Offline SQLite with local P2P sync across your devices",
    },
  ];

  return (
    <div
      className="fixed inset-0 h-screen w-full overflow-y-auto scroll-smooth bg-[var(--bg)] text-[var(--text)] select-text z-50 overscroll-y-auto cursor-default transition-colors duration-200"
      style={{
        paddingBottom: "max(calc(var(--safe-bottom, 12px) + 40px), 72px)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* Dynamic Ambient Liquid Mesh Background System */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden select-none z-0">
        <div
          className="absolute -top-[15%] -left-[10%] h-[700px] w-[850px] rounded-full blur-[150px] opacity-25 dark:opacity-20 animate-pulse"
          style={{
            background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
            animationDuration: "9s",
          }}
        />
        <div
          className="absolute -top-[10%] -right-[10%] h-[750px] w-[900px] rounded-full blur-[160px] opacity-20 dark:opacity-15"
          style={{
            background: "radial-gradient(circle, rgba(6, 182, 212, 0.45) 0%, rgba(59, 130, 246, 0.25) 50%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-[-15%] left-[20%] h-[650px] w-[900px] rounded-full blur-[170px] opacity-20 dark:opacity-15"
          style={{
            background: "radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, rgba(139, 92, 246, 0.2) 50%, transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--text) 1px, transparent 0)",
            backgroundSize: "36px 36px",
          }}
        />
      </div>

      {/* Top Header Navigation Bar (Sticky Full Width, Zero-Clipped) */}
      <header
        className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--panel)]/95 backdrop-blur-2xl select-none transition-colors shadow-xs"
        style={{ paddingTop: "var(--safe-top, 0px)" }}
      >
        <div className="w-full max-w-[1920px] mx-auto flex items-center justify-between px-4 sm:px-8 md:px-12 lg:px-16 py-3.5">
          {/* Brand Logo & Version Badge */}
          <div className="flex items-center gap-3.5">
            <div className="relative flex items-center justify-center">
              <svg width={40} height={40} viewBox="0 0 32 32" aria-hidden className="shrink-0 drop-shadow-sm">
                <rect width="32" height="32" rx="10" fill="var(--panel2)" stroke="var(--line)" />
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
                <circle cx="16" cy="16" r="3.2" fill="var(--accent)" />
              </svg>
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[var(--ok)] ring-2 ring-[var(--panel)] animate-pulse" />
            </div>

            <div className="flex items-center gap-2.5">
              <span className="font-display text-2xl sm:text-3xl font-black tracking-tight text-[var(--text)]">
                LifeLog
              </span>
              <span className="rounded-full border border-[var(--line)] bg-[var(--panel2)] px-3 py-1 text-xs sm:text-sm font-mono font-bold tracking-wide text-[var(--accent)]">
                v{APP_VERSION} Sovereign
              </span>
            </div>
          </div>

          {/* Center Navigation Links (With Smooth Offset Scrolling) */}
          <nav className="hidden xl:flex items-center gap-8">
            <a
              href="#interactive-demo"
              onClick={(e) => scrollToSection(e, "interactive-demo")}
              className="text-base font-bold text-[var(--text)]/80 hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              Live Sandbox
            </a>
            <a
              href="#pillars"
              onClick={(e) => scrollToSection(e, "pillars")}
              className="text-base font-bold text-[var(--text)]/80 hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              Capabilities
            </a>
            <a
              href="#comparison"
              onClick={(e) => scrollToSection(e, "comparison")}
              className="text-base font-bold text-[var(--text)]/80 hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              Why LifeLog
            </a>
            <a
              href="#downloads"
              onClick={(e) => scrollToSection(e, "downloads")}
              className="text-base font-bold text-[var(--text)]/80 hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              Downloads
            </a>
            <a
              href="#philosophy"
              onClick={(e) => scrollToSection(e, "philosophy")}
              className="text-base font-bold text-[var(--text)]/80 hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              Philosophy
            </a>
          </nav>

          {/* Right Action Items: Dark Mode Toggle + Buy Me a Coffee + Launch Button */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* Dark / Light Mode Toggle Button */}
            <button
              onClick={handleToggleTheme}
              className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel2)] p-2.5 sm:px-3.5 sm:py-2 text-sm font-bold text-[var(--text)] transition-all hover:scale-[1.04] active:scale-[0.96] shadow-xs cursor-pointer"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme mode"
            >
              {isDark ? (
                <>
                  <Sun size={18} className="text-amber-400 shrink-0" />
                  <span className="hidden md:inline font-bold text-xs uppercase tracking-wider">Light</span>
                </>
              ) : (
                <>
                  <Moon size={18} className="text-indigo-600 shrink-0" />
                  <span className="hidden md:inline font-bold text-xs uppercase tracking-wider">Dark</span>
                </>
              )}
            </button>

            {/* Official Buy Me a Coffee Button (Clean Sans UI Font, Matching Philosophy Section) */}
            <a
              href="https://buymeacoffee.com/Krrish1411"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2 text-sm font-bold shadow-xs transition-all hover:scale-[1.03] active:scale-[0.97] border border-black/80 shrink-0 cursor-pointer"
              style={{
                background: "#FFDD00",
                color: "#000000",
              }}
              title="Support independent development on Buy Me a Coffee"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 8h-1V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v10c0 2.2 1.8 4 4 4h10c2.2 0 4-1.8 4-4v-2h1c1.7 0 3-1.3 3-3s-1.3-3-3-3zm-3 8c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V6h14v10zm3-4h-1v-2h1c.6 0 1 .4 1 1s-.4 1-1 1z" fill="#000000"/>
                <path d="M6 9h2v4H6zm4 0h2v4h-2zm4 0h2v4h-2z" fill="#ffffff"/>
              </svg>
              <span className="font-bold tracking-tight">Buy me a coffee</span>
            </a>

            {/* Primary Launch Action */}
            <button
              onClick={onEnter}
              className="inline-flex items-center gap-2 rounded-xl px-4 sm:px-6 py-2.5 text-sm sm:text-base font-bold text-[var(--on-accent)] shadow-lg shadow-[var(--accent)]/30 transition-all hover:scale-[1.03] active:scale-[0.97] cursor-pointer"
              style={{ background: "var(--accent)" }}
            >
              <span>{canDismiss ? "Launch Workspace" : "Enter LifeLog"}</span>
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Utilizing Full Screen Width (Fluid up to 1920px) */}
      <main className="relative z-10 w-full max-w-[1920px] mx-auto px-4 sm:px-8 md:px-12 lg:px-16 xl:px-20 py-8 sm:py-14 space-y-20 sm:space-y-32">
        
        {/* HERO SECTION: 2-Column Responsive Edge-to-Edge Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 xl:gap-20 items-center pt-2 sm:pt-4">
          
          {/* Left Column: Authoritative Message & Psychological Hooks */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-left">
            {/* Trust Pill */}
            <div className="inline-flex flex-wrap items-center gap-2.5 rounded-full border border-[var(--line)] bg-[var(--panel)] px-5 py-2.5 shadow-sm">
              <span className="flex h-2.5 w-2.5 rounded-full bg-[var(--ok)] animate-pulse" />
              <ShieldCheck size={18} className="text-[var(--ok)] shrink-0" />
              <span className="text-sm sm:text-base font-extrabold tracking-wide text-[var(--text)]">
                Zero Telemetry · 100% Offline SQLite WAL · AES-256-GCM · Direct P2P Sync
              </span>
            </div>

            {/* Main Headline (Scaled Up for Widescreen Impact) */}
            <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight leading-[1.04] text-[var(--text)]">
              The Sovereign Personal Operating System.
            </h1>

            {/* Sub-headline (High Contrast, Large Legible Typography) */}
            <p className="text-lg sm:text-xl lg:text-2xl text-[var(--text)]/85 font-normal sm:font-medium leading-relaxed max-w-4xl">
              Take back absolute control over your schedule, deep work, habits, and private second-brain notes. Powered entirely by local SQLite WAL with instant sub-5ms boot speeds. <strong className="text-[var(--text)] font-black">Zero monthly subscriptions, zero third-party cloud lock-in, and zero AI telemetry scraping.</strong>
            </p>

            {/* Psychological Reassurance Banner (Overwhelm Mitigation) */}
            <div className="rounded-3xl border-2 border-[var(--line)] bg-[var(--panel)] p-5 sm:p-7 shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:border-[var(--accent)] group">
              <div className="flex items-start gap-4">
                <div className="p-3.5 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] shrink-0 group-hover:scale-110 transition-transform">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h4 className="text-lg sm:text-xl font-extrabold text-[var(--text)]">
                    Massive Power, Zero Overwhelm
                  </h4>
                  <p className="mt-1.5 text-base sm:text-lg text-[var(--text)]/80 leading-relaxed font-normal">
                    LifeLog includes full-scale modular capabilities, but you don\x27t have to master everything on day one. Start with just 1 priority task today. Toggle features and views only when you feel ready.
                  </p>
                </div>
              </div>
            </div>

            {/* Call to Actions (Large, Tactile, High-Converting) */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={onEnter}
                className="flex items-center gap-3 rounded-2xl px-8 sm:px-10 py-4 sm:py-5 text-base sm:text-lg font-extrabold text-[var(--on-accent)] shadow-2xl shadow-[var(--accent)]/35 transition-all hover:scale-[1.03] active:scale-[0.97] cursor-pointer"
                style={{ background: "var(--accent)" }}
              >
                <span>Launch LifeLog Instantly</span>
                <ArrowRight size={20} />
              </button>

              <a
                href="#downloads"
                onClick={(e) => scrollToSection(e, "downloads")}
                className="flex items-center gap-3 rounded-2xl border-2 border-[var(--line)] bg-[var(--panel)] px-6 sm:px-8 py-4 sm:py-5 text-base sm:text-lg font-extrabold text-[var(--text)] shadow-sm transition-all hover:bg-[var(--panel2)] hover:scale-[1.02] cursor-pointer"
              >
                <Download size={20} className="text-[var(--accent)]" />
                <span>Get Desktop & Mobile Apps</span>
              </a>
            </div>

            {/* 3 Core Value Pillars Strip */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-[var(--line)]">
              <div className="space-y-1">
                <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[var(--mut)]">Engine Speed</div>
                <div className="text-base sm:text-xl font-black text-[var(--text)]">Sub-5ms Boot</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[var(--mut)]">Cryptography</div>
                <div className="text-base sm:text-xl font-black text-[var(--text)]">Hardware AES-256</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[var(--mut)]">Sovereign Cost</div>
                <div className="text-base sm:text-xl font-black text-[var(--ok)]">$0 · No Paywalls</div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Live Sandbox Teaser (Targetable with scroll-mt) */}
          <div id="interactive-demo" className="lg:col-span-5 scroll-mt-28 md:scroll-mt-36">
            <div className="relative rounded-3xl border-2 border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8 shadow-2xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_25px_60px_rgba(var(--accent-rgb),0.18)] hover:border-[var(--accent)] group">
              {/* Simulator Top Header */}
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-3.5 w-3.5 rounded-full bg-red-500/90" />
                  <div className="h-3.5 w-3.5 rounded-full bg-amber-500/90" />
                  <div className="h-3.5 w-3.5 rounded-full bg-emerald-500/90" />
                  <span className="ml-2 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[var(--text)]">
                    Interactive Live Sandbox
                  </span>
                </div>
                <span className="rounded-full bg-[var(--ok)]/15 border border-[var(--ok)]/30 px-3 py-1 text-xs font-black text-[var(--ok)] uppercase tracking-wider animate-pulse">
                  Live Preview
                </span>
              </div>

              {/* Interactive Tabs (Tasks, Pomodoro, Second Brain) */}
              <div className="mt-5 flex rounded-2xl border border-[var(--line)] bg-[var(--panel2)] p-1.5">
                {[
                  { id: "tasks", label: "Tasks & Momentum", icon: ListTodo },
                  { id: "timer", label: "Pomodoro Studio", icon: Timer },
                  { id: "notes", label: "Second Brain", icon: FileText },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = simTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setSimTab(tab.id as any)}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer",
                        isActive
                          ? "bg-[var(--panel)] text-[var(--text)] shadow-sm border border-[var(--line)]"
                          : "text-[var(--text)]/70 hover:text-[var(--text)]"
                      )}
                    >
                      <Icon size={16} className={isActive ? "text-[var(--accent)]" : ""} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Sandbox Interactive Body */}
              <div className="mt-6 min-h-[310px] flex flex-col justify-between">
                {/* TAB 1: Tasks Sandbox */}
                {simTab === "tasks" && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel2)] p-4">
                      <div className="flex items-center justify-between text-sm font-extrabold">
                        <span className="text-[var(--text)]">Today\x27s Momentum</span>
                        <span className="font-mono text-sm sm:text-base text-[var(--accent)]">
                          {completedCount}/{demoTasks.length} Completed ({progressPercent}%)
                        </span>
                      </div>
                      <div className="mt-3 h-3 w-full rounded-full bg-[var(--line)] overflow-hidden">
                        <div
                          className="h-full transition-all duration-500 rounded-full"
                          style={{
                            width: `${progressPercent}%`,
                            background: progressPercent === 100 ? "var(--ok)" : "var(--accent)",
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {demoTasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => toggleTask(t.id)}
                          className={cn(
                            "flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none",
                            t.done
                              ? "border-[var(--ok)]/40 bg-[var(--ok)]/10 text-[var(--text)]"
                              : "border-[var(--line)] bg-[var(--panel)] hover:border-[var(--accent)] hover:shadow-md"
                          )}
                        >
                          <div className="flex items-center gap-3.5">
                            <div
                              className={cn(
                                "flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-all",
                                t.done
                                  ? "bg-[var(--ok)] border-[var(--ok)] text-white"
                                  : "border-[var(--line)] bg-[var(--panel2)]"
                              )}
                            >
                              {t.done && <Check size={15} strokeWidth={3} />}
                            </div>
                            <span
                              className={cn(
                                "text-sm sm:text-base font-semibold transition-all",
                                t.done ? "line-through opacity-70" : "text-[var(--text)]"
                              )}
                            >
                              {t.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="rounded-lg px-2 py-1 text-xs font-mono font-bold bg-[var(--panel2)] text-[var(--text)]">
                              {t.mins}m
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {progressPercent === 100 ? (
                      <div className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--ok)]/15 text-[var(--ok)] text-sm font-extrabold animate-pulse border border-[var(--ok)]/30">
                        <Sparkles size={18} />
                        <span>All goals completed! Pure offline dopamine satisfaction.</span>
                      </div>
                    ) : (
                      <p className="text-center text-xs sm:text-sm text-[var(--text)]/75 font-semibold">
                        👆 Click the unfinished task above to feel the instant checkmark reward!
                      </p>
                    )}
                  </div>
                )}

                {/* TAB 2: Pomodoro Timer Sandbox */}
                {simTab === "timer" && (
                  <div className="space-y-5 text-center">
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel2)] p-6">
                      <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[var(--text)]/70">
                        Deep Work Focus Block (Session 1 of 4)
                      </div>
                      <div className="mt-3 font-mono text-5xl sm:text-6xl font-black tracking-tight text-[var(--text)]">
                        {formatTimer(timerSeconds)}
                      </div>

                      <div className="mt-5 flex items-center justify-center gap-4">
                        <button
                          onClick={() => setTimerRunning(!timerRunning)}
                          className="flex items-center gap-2.5 rounded-xl px-6 py-3 text-sm font-extrabold text-white shadow-lg transition-all hover:scale-[1.04] cursor-pointer"
                          style={{ background: timerRunning ? "var(--warn)" : "var(--accent)" }}
                        >
                          {timerRunning ? <Pause size={16} /> : <Play size={16} />}
                          <span>{timerRunning ? "Pause Focus" : "Start Focus Timer"}</span>
                        </button>
                        <button
                          onClick={() => {
                            setTimerRunning(false);
                            setTimerSeconds(1500);
                          }}
                          className="p-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer"
                          title="Reset"
                        >
                          <RotateCcw size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <Volume2 size={16} className="text-[var(--text)] shrink-0" />
                      <span className="text-xs sm:text-sm font-bold text-[var(--text)]">Offline Soundscapes:</span>
                      {["Rainstorm", "Forest Camp", "Synthesized Bell"].map((sound, sIdx) => (
                        <span
                          key={sIdx}
                          className="rounded-full border border-[var(--line)] bg-[var(--panel2)] px-3 py-1 text-xs font-bold text-[var(--text)]"
                        >
                          {sound}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: Second Brain Notes Sandbox */}
                {simTab === "notes" && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel2)] p-5 text-left">
                      <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 mb-3">
                        <span className="text-sm font-extrabold text-[var(--text)]">
                          📓 Architecture Manifesto.md
                        </span>
                        <span className="text-xs font-mono font-bold text-[var(--accent)]">AES-256 Encrypted</span>
                      </div>
                      <div className="space-y-3 text-sm sm:text-base font-medium leading-relaxed text-[var(--text)]">
                        <p>
                          Sync state across nodes using{" "}
                          <span className="rounded-lg bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-[var(--accent)] font-bold">
                            @P2P-Sync
                          </span>{" "}
                          under project{" "}
                          <span className="rounded-lg bg-blue-500/15 px-2 py-0.5 font-mono text-blue-500 font-bold">
                            #Core-Engine
                          </span>
                          .
                        </p>
                        <p>
                          Related principles captured in{" "}
                          <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 font-mono text-emerald-500 font-bold">
                            [[Local First Sovereignty]]
                          </span>
                          .
                        </p>
                      </div>
                    </div>
                    <p className="text-center text-xs sm:text-sm text-[var(--text)]/75 font-semibold">
                      Type <code className="font-mono text-[var(--accent)] font-bold">@</code> for Tasks,{" "}
                      <code className="font-mono text-blue-500 font-bold">#</code> for Projects, and{" "}
                      <code className="font-mono text-emerald-500 font-bold">[[</code> for Notes anywhere in the app.
                    </p>
                  </div>
                )}

                {/* Bottom Interactive CTA */}
                <div className="pt-5 border-t border-[var(--line)] flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-bold text-[var(--text)]/75">
                    Ready to build your personal sanctuary?
                  </span>
                  <button
                    onClick={onEnter}
                    className="inline-flex items-center gap-2 text-sm sm:text-base font-extrabold text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    <span>Launch Workspace</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* SECTION 2: Why LifeLog vs Big Tech Cloud (Loss Aversion & Privacy Urgency) */}
        <section id="comparison" className="space-y-8 pt-4 scroll-mt-28 md:scroll-mt-36">
          <div className="text-center space-y-3">
            <span className="rounded-full bg-[var(--accent-soft)] px-4 py-1.5 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[var(--accent)]">
              Digital Sovereignty
            </span>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[var(--text)]">
              LifeLog vs. Big Tech Cloud SaaS
            </h2>
            <p className="mx-auto max-w-3xl text-base sm:text-lg lg:text-xl text-[var(--text)]/80 leading-relaxed font-normal">
              Why settle for cloud services that hold your private thoughts hostage, charge perpetual subscriptions, and feed your data to AI algorithms?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* The Old Way: Cloud SaaS */}
            <div className="rounded-3xl border-2 border-red-500/25 bg-[var(--panel)] p-8 sm:p-10 shadow-lg space-y-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-red-500/60">
              <div className="flex items-center justify-between">
                <span className="text-base sm:text-lg font-black uppercase tracking-wider text-red-500">
                  Big Tech Cloud SaaS (Notion, Todoist, Evernote)
                </span>
                <span className="text-2xl">⚠️</span>
              </div>
              <ul className="space-y-4 text-base sm:text-lg text-[var(--text)]/85">
                <li className="flex items-start gap-3">
                  <span className="text-red-500 font-black text-xl shrink-0">✕</span>
                  <span><strong>Perpetual recurring fees:</strong> $8 to $25/month per user that drains your wallet forever.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-500 font-black text-xl shrink-0">✕</span>
                  <span><strong>AI surveillance:</strong> Your private notes and journal reflections are scraped to train LLMs.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-500 font-black text-xl shrink-0">✕</span>
                  <span><strong>Cloud outages lock you out:</strong> If AWS or the vendor\x27s servers go down, your day halts.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-500 font-black text-xl shrink-0">✕</span>
                  <span><strong>Data hostage:</strong> Locked behind closed proprietary databases that cannot be freely exported.</span>
                </li>
              </ul>
            </div>

            {/* The Sovereign Way: LifeLog */}
            <div className="rounded-3xl border-2 border-[var(--ok)]/50 bg-[var(--panel)] p-8 sm:p-10 shadow-xl space-y-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-[var(--ok)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-[var(--ok)]/10 rounded-bl-full pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-base sm:text-lg font-black uppercase tracking-wider text-[var(--ok)]">
                  LifeLog Sovereign System
                </span>
                <span className="text-2xl">🛡️</span>
              </div>
              <ul className="space-y-4 text-base sm:text-lg text-[var(--text)]">
                <li className="flex items-start gap-3">
                  <span className="text-[var(--ok)] font-black text-xl shrink-0">✓</span>
                  <span><strong>100% Free Forever:</strong> Zero subscriptions, zero paywalls, zero locked features.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[var(--ok)] font-black text-xl shrink-0">✓</span>
                  <span><strong>Hardware Encryption:</strong> Device-bound AES-256-GCM cipher with zero remote telemetry.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[var(--ok)] font-black text-xl shrink-0">✓</span>
                  <span><strong>True Offline Independence:</strong> Executes directly against local SQLite WAL in sub-5 milliseconds.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[var(--ok)] font-black text-xl shrink-0">✓</span>
                  <span><strong>Direct P2P Sync:</strong> Encrypted device-to-device synchronization over local Wi-Fi with zero servers.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* SECTION 3: 7 Core Feature Pillars (Full Widescreen Responsive Grid) */}
        <section id="pillars" className="space-y-8 pt-4 scroll-mt-28 md:scroll-mt-36">
          <div className="text-center space-y-3">
            <span className="rounded-full bg-[var(--accent-soft)] px-4 py-1.5 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[var(--accent)]">
              Integrated Capabilities
            </span>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[var(--text)]">
              7 Unified Pillars. Zero Friction.
            </h2>
            <p className="mx-auto max-w-3xl text-base sm:text-lg lg:text-xl text-[var(--text)]/80 leading-relaxed font-normal">
              Every tool works together seamlessly in a single cohesive, privacy-first workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {pillars.map((p, i) => {
              const Icon = p.icon;
              return (
                <div
                  key={i}
                  className="flex flex-col justify-between rounded-3xl border-2 border-[var(--line)] bg-[var(--panel)] p-7 sm:p-9 shadow-md transition-all duration-300 hover:-translate-y-2.5 hover:scale-[1.015] hover:border-[var(--accent)] hover:shadow-2xl group"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:scale-110"
                        style={{
                          background: `color-mix(in srgb, ${p.color} 15%, transparent)`,
                          color: p.color,
                        }}
                      >
                        <Icon size={28} />
                      </div>
                      <span className="rounded-full border border-[var(--line)] bg-[var(--panel2)] px-3.5 py-1 text-xs sm:text-sm font-bold tracking-wider text-[var(--text)]">
                        {p.tag}
                      </span>
                    </div>

                    <h3 className="mt-6 font-display text-xl sm:text-2xl font-black text-[var(--text)]">
                      {p.title}
                    </h3>
                    <p className="mt-2.5 text-base sm:text-lg text-[var(--text)]/80 leading-relaxed font-normal">
                      {p.desc}
                    </p>
                  </div>

                  <div className="mt-8 pt-5 border-t border-[var(--line)]">
                    <ul className="space-y-3">
                      {p.bullets.map((b, bi) => (
                        <li key={bi} className="flex items-start gap-3 text-sm sm:text-base font-semibold text-[var(--text)]">
                          <CheckCircle2 size={18} style={{ color: p.color }} className="shrink-0 mt-0.5" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 4: Cross-Platform Ecosystem & Downloads Hub */}
        <section id="downloads" className="space-y-8 pt-4 scroll-mt-28 md:scroll-mt-36">
          <div className="text-center space-y-3">
            <span className="rounded-full bg-[var(--accent-soft)] px-4 py-1.5 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[var(--accent)]">
              Cross-Platform Ecosystem
            </span>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[var(--text)]">
              Download LifeLog for Your Devices
            </h2>
            <p className="mx-auto max-w-3xl text-base sm:text-lg lg:text-xl text-[var(--text)]/80 leading-relaxed font-normal">
              Pre-built native binaries with verified SHA-256 checksums. Windows, macOS, Linux, and Android APK releases.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {platforms.map((pl, idx) => {
              const Icon = pl.icon;
              return (
                <a
                  key={idx}
                  href={pl.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col justify-between p-7 rounded-3xl border-2 border-[var(--line)] bg-[var(--panel)] shadow-md transition-all duration-300 hover:-translate-y-2.5 hover:scale-[1.02] hover:border-[var(--accent)] hover:shadow-2xl group cursor-pointer"
                >
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="h-14 w-14 rounded-2xl flex items-center justify-center border-2 border-[var(--line)] bg-[var(--panel2)] text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white transition-all">
                        <Icon size={28} />
                      </div>
                      <span className="rounded-full border border-[var(--line)] bg-[var(--panel2)] px-3 py-1 text-xs font-mono font-bold text-[var(--text)]">
                        {pl.badge}
                      </span>
                    </div>

                    <div>
                      <div className="font-display text-xl sm:text-2xl font-black text-[var(--text)]">{pl.os}</div>
                      <div className="text-sm sm:text-base font-bold text-[var(--text)]/85 mt-1">{pl.type}</div>
                      <div className="text-xs sm:text-sm text-[var(--text)]/70 mt-2 font-medium">{pl.note}</div>
                    </div>
                  </div>

                  <div className="mt-8 pt-5 border-t border-[var(--line)] flex items-center justify-between text-sm sm:text-base font-black text-[var(--accent)]">
                    <span>Download {pl.ext}</span>
                    <Download size={18} className="group-hover:translate-y-1 transition-transform" />
                  </div>
                </a>
              );
            })}
          </div>

          <div className="text-center text-sm sm:text-base text-[var(--text)]/80 font-bold">
            All releases include verified SHA-256 checksums. Review releases on the{" "}
            <a
              href="https://github.com/Krrish1411/Lifelog-Releases"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] underline font-black"
            >
              Public Releases Repository
            </a>.
          </div>
        </section>

        {/* SECTION 5: The Sovereign Covenant & Future Pro Roadmap (Honest Funding Architecture) */}
        <section className="pt-4">
          <div className="rounded-3xl border-2 border-[var(--line)] bg-[var(--panel)] p-8 sm:p-12 shadow-xl space-y-6">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-amber-500/15 text-amber-500 shrink-0">
                <Crown size={28} />
              </div>
              <div>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text)]">
                  The Sovereign Covenant & Independent Funding
                </h3>
                <p className="text-sm sm:text-base font-bold text-[var(--text)]/75">
                  How LifeLog stays 100% independent without venture capital or selling your personal data
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="rounded-2xl border-2 border-[var(--ok)]/40 bg-[var(--panel2)]/60 p-6 space-y-3">
                <div className="flex items-center gap-2 text-base font-black text-[var(--ok)]">
                  <CheckCircle2 size={20} />
                  <span>The Core Workspace is Forever Free</span>
                </div>
                <p className="text-sm sm:text-base text-[var(--text)]/85 leading-relaxed">
                  Your daily life system — unlimited tasks, nested subtasks, focus timers, second brain notes, habit streaks, visual time blocking, SQLite database storage, and direct local P2P sync — will <strong className="text-[var(--text)]">never be locked behind a subscription or paywall</strong>.
                </p>
              </div>

              <div className="rounded-2xl border-2 border-amber-500/40 bg-[var(--panel2)]/60 p-6 space-y-3">
                <div className="flex items-center gap-2 text-base font-black text-amber-500">
                  <Zap size={20} />
                  <span>Future Optional Pro Power Extensions</span>
                </div>
                <p className="text-sm sm:text-base text-[var(--text)]/85 leading-relaxed">
                  To sustainably fund continuous updates and research, future specialized power add-ons (such as optional encrypted cloud relay fallback for restrictive firewalls, artisan theme packs, and executive team automation) will be available as optional Pro upgrades. <strong className="text-[var(--text)]">The core remains sovereign and yours for life.</strong>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6: Creator Philosophy & Manifesto */}
        <section id="philosophy" className="pt-4 scroll-mt-28 md:scroll-mt-36">
          <div className="rounded-3xl border-2 border-[var(--line)] bg-[var(--panel)] p-8 sm:p-12 lg:p-16 shadow-xl space-y-8 transition-all duration-300 hover:border-[var(--accent)]">
            <div className="flex items-center gap-5">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl"
                style={{ background: "var(--accent)" }}
              >
                KP
              </div>
              <div>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text)]">
                  Why I Built LifeLog
                </h3>
                <p className="text-sm sm:text-base font-bold text-[var(--mut)]">
                  By Krish Patel · Founder & Solo Architect
                </p>
              </div>
            </div>

            <div className="space-y-5 text-base sm:text-lg lg:text-xl leading-relaxed text-[var(--text)]/85 font-normal">
              <p>
                Modern productivity software has lost its core purpose. Simple daily planners, calendars, and notes have been turned into bloated surveillance engines designed to harvest your telemetry, lock your thoughts behind monthly recurring subscription paywalls, and force your life into closed corporate silos.
              </p>
              <p>
                LifeLog was born out of an uncompromising conviction: <strong className="text-[var(--text)] font-black">your daily schedule, your honest thoughts, your habits, and your creative output belong to you alone.</strong>
              </p>
              <p>
                There are no cloud databases. There are no tracking pixels or advertising algorithms. LifeLog writes directly to local SQLite WAL files on your machine. When you synchronize multiple devices, they communicate directly via encrypted peer-to-peer WebRTC sockets over your own local network.
              </p>
              <p className="pt-3 text-base sm:text-lg lg:text-xl italic text-[var(--text)] font-bold border-l-4 border-[var(--accent)] pl-5">
                "LifeLog is designed to run for decades without requiring a single remote server to stay online. Thank you for choosing sovereign personal computing."
              </p>
            </div>

            {/* Creator Actions & Contact */}
            <div className="pt-8 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-5">
              <div className="flex flex-wrap items-center gap-4">
                {/* Buy Me a Coffee (Matching Clean Sans UI Font) */}
                <a
                  href="https://buymeacoffee.com/Krrish1411"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm sm:text-base font-bold shadow-xs transition-all hover:scale-[1.03] active:scale-[0.97] border border-black/80 cursor-pointer"
                  style={{
                    background: "#FFDD00",
                    color: "#000000",
                  }}
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 8h-1V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v10c0 2.2 1.8 4 4 4h10c2.2 0 4-1.8 4-4v-2h1c1.7 0 3-1.3 3-3s-1.3-3-3-3zm-3 8c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V6h14v10zm3-4h-1v-2h1c.6 0 1 .4 1 1s-.4 1-1 1z" fill="#000000"/>
                    <path d="M6 9h2v4H6zm4 0h2v4h-2zm4 0h2v4h-2z" fill="#ffffff"/>
                  </svg>
                  <span>Buy me a coffee</span>
                </a>

                <a
                  href="mailto:getlifelog@proton.me"
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-[var(--line)] bg-[var(--panel2)] px-5 py-2.5 text-sm sm:text-base font-bold text-[var(--text)] transition-colors hover:bg-[var(--line)] cursor-pointer"
                >
                  <Mail size={18} />
                  <span>getlifelog@proton.me</span>
                </a>
              </div>

              <button
                onClick={onEnter}
                className="flex items-center gap-2.5 rounded-2xl px-8 py-3.5 text-base font-extrabold text-[var(--on-accent)] shadow-xl shadow-[var(--accent)]/25 transition-all hover:scale-[1.03] cursor-pointer"
                style={{ background: "var(--accent)" }}
              >
                <span>Launch LifeLog Now</span>
                <ArrowRight size={18} />
              </button>
            </div>

          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--line)] bg-[var(--panel)] py-10 text-center text-sm sm:text-base font-bold text-[var(--text)]/75">
        <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-8 md:px-12 lg:px-16 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="font-extrabold text-[var(--text)]">LifeLog v{APP_VERSION}</span>
            <span>·</span>
            <span>Created by <strong className="text-[var(--accent)] font-extrabold">Krish Patel</strong></span>
          </div>
          <div>
            100% Offline Sovereign Sanctuary · Zero Telemetry · Open Architecture
          </div>
        </div>
      </footer>
    </div>
  );
}
