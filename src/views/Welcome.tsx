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
  Play,
  Pause,
  Radio,
  RotateCcw,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Timer,
  Volume2,
  Zap,
  Check,
  ChevronRight,
  Sliders,
  Smile,
} from "lucide-react";
import { Btn, cn } from "../components/ui";
import { APP_VERSION } from "../types";

interface WelcomeProps {
  onEnter: () => void;
  canDismiss?: boolean;
}

export function WelcomeView({ onEnter, canDismiss = true }: WelcomeProps) {
  // Interactive Simulator State (Dopamine & User Engagement)
  const [simTab, setSimTab] = useState<"tasks" | "timer" | "notes" | "layouts">("tasks");
  const [demoTasks, setDemoTasks] = useState([
    { id: 1, title: "Review daily priority queue & sync calendar", done: true, tag: "Planning", mins: 15 },
    { id: 2, title: "25-min distraction-free focus block", done: true, tag: "Deep Work", mins: 25 },
    { id: 3, title: "Click me to test LifeLog's instant dopamine hit ✨", done: false, tag: "Quick Win", mins: 5 },
  ]);
  const [timerSeconds, setTimerSeconds] = useState<number>(1498); // ~24:58
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [activeLayoutTeaser, setActiveLayoutTeaser] = useState<string>("Glassmorphic");

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
      className="fixed inset-0 h-screen w-full overflow-y-auto bg-[var(--bg)] text-[var(--text)] select-text z-50 overscroll-y-auto cursor-default"
      style={{
        paddingBottom: "max(calc(var(--safe-bottom, 12px) + 36px), 64px)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* Dynamic Liquid Mesh Background System */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden select-none z-0">
        {/* Liquid Orb 1 (Top Left Accent Glow) */}
        <div
          className="absolute -top-[15%] -left-[10%] h-[600px] w-[700px] rounded-full blur-[140px] opacity-35 animate-pulse"
          style={{
            background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
            animationDuration: "8s",
          }}
        />
        {/* Liquid Orb 2 (Top Right Cyan/Blue Glow) */}
        <div
          className="absolute -top-[10%] -right-[10%] h-[650px] w-[750px] rounded-full blur-[150px] opacity-30"
          style={{
            background: "radial-gradient(circle, rgba(6, 182, 212, 0.45) 0%, rgba(59, 130, 246, 0.25) 50%, transparent 70%)",
          }}
        />
        {/* Liquid Orb 3 (Bottom Amber/Purple Glow) */}
        <div
          className="absolute bottom-[-15%] left-[20%] h-[550px] w-[750px] rounded-full blur-[160px] opacity-25"
          style={{
            background: "radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, rgba(139, 92, 246, 0.2) 50%, transparent 70%)",
          }}
        />
        {/* Subtle Liquid Grid Overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--text) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Top Header Navigation Bar */}
      <header
        className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--panel)]/80 backdrop-blur-xl select-none transition-colors"
        style={{ paddingTop: "var(--safe-top, 0px)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-8 py-3.5">
          {/* Brand Logo & Version Badge */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <svg width={36} height={36} viewBox="0 0 32 32" aria-hidden className="shrink-0 drop-shadow-sm">
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
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--ok)] ring-2 ring-[var(--panel)] animate-pulse" />
            </div>

            <div className="flex items-center gap-2.5">
              <span className="font-display text-xl sm:text-2xl font-black tracking-tight">LifeLog</span>
              <span className="rounded-full border border-[var(--line)] bg-[var(--panel2)] px-2.5 py-0.5 text-xs font-mono font-bold tracking-wide text-[var(--accent)]">
                v{APP_VERSION} Sovereign
              </span>
            </div>
          </div>

          {/* Nav Links & Actions */}
          <div className="flex items-center gap-3 sm:gap-6">
            <nav className="hidden lg:flex items-center gap-6">
              <a
                href="#interactive-demo"
                className="text-sm font-semibold text-[var(--mut)] hover:text-[var(--text)] transition-colors"
              >
                Live Sandbox
              </a>
              <a
                href="#pillars"
                className="text-sm font-semibold text-[var(--mut)] hover:text-[var(--text)] transition-colors"
              >
                Features
              </a>
              <a
                href="#comparison"
                className="text-sm font-semibold text-[var(--mut)] hover:text-[var(--text)] transition-colors"
              >
                Why LifeLog
              </a>
              <a
                href="#downloads"
                className="text-sm font-semibold text-[var(--mut)] hover:text-[var(--text)] transition-colors"
              >
                Downloads
              </a>
              <a
                href="#philosophy"
                className="text-sm font-semibold text-[var(--mut)] hover:text-[var(--text)] transition-colors"
              >
                Philosophy
              </a>
            </nav>

            <div className="flex items-center gap-2.5">
              {/* Buy Me a Coffee Button (Standard Sans UI Font) */}
              <a
                href="https://buymeacoffee.com/Krrish1411"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-bold shadow-xs transition-all hover:scale-[1.03] active:scale-[0.97] border border-black/80 shrink-0"
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
                <span className="hidden xs:inline">Buy me a coffee</span>
              </a>

              {/* Primary Launch Action */}
              <button
                onClick={onEnter}
                className="inline-flex items-center gap-2 rounded-xl px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-[var(--on-accent)] shadow-md shadow-[var(--accent)]/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "var(--accent)" }}
              >
                <span>{canDismiss ? "Launch Workspace" : "Enter LifeLog"}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Utilizing Full Width (max-w-7xl) */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-8 py-8 sm:py-12 space-y-16 sm:space-y-24">
        
        {/* Hero Section: 2-Column Responsive Widescreen Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center pt-2 sm:pt-6">
          
          {/* Left Column: Authoritative Message & Psychological Hooks */}
          <div className="lg:col-span-7 space-y-6 text-left">
            
            {/* Trust Pill */}
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)]/90 px-4 py-2 shadow-xs backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-[var(--ok)] animate-pulse" />
              <ShieldCheck size={16} className="text-[var(--ok)] shrink-0" />
              <span className="text-xs sm:text-sm font-bold tracking-wide text-[var(--text)]">
                Zero Telemetry · 100% Offline SQLite · AES-256-GCM · Direct P2P Sync
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08]">
              The Sovereign Personal Operating System.
            </h1>

            {/* Sub-headline */}
            <p className="text-base sm:text-lg text-[var(--mut)] font-normal leading-relaxed max-w-2xl">
              Take back control of your schedule, deep work, habits, and encrypted notes. Built entirely on local SQLite WAL with sub-5ms speed. <strong className="text-[var(--text)] font-semibold">Zero monthly subscriptions, zero third-party cloud lock-in, and zero AI telemetry scraping.</strong>
            </p>

            {/* Psychological Reassurance Banner */}
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel2)]/60 p-4 sm:p-5 backdrop-blur-sm">
              <div className="flex items-start gap-3.5">
                <div className="p-2 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] shrink-0">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text)]">Massive Power, Zero Overwhelm</h4>
                  <p className="mt-1 text-xs sm:text-sm text-[var(--mut)] leading-normal">
                    LifeLog includes full-scale modular capabilities, but you don't have to learn everything at once. Start with just 1 priority task today. Toggle layouts and modules only when you're ready.
                  </p>
                </div>
              </div>
            </div>

            {/* Call to Actions */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
              <button
                onClick={onEnter}
                className="flex items-center gap-2.5 rounded-2xl px-6 sm:px-8 py-3.5 sm:py-4 text-base font-bold text-[var(--on-accent)] shadow-xl shadow-[var(--accent)]/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "var(--accent)" }}
              >
                <span>Launch LifeLog Instantly</span>
                <ArrowRight size={18} />
              </button>

              <a
                href="#downloads"
                className="flex items-center gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-5 sm:px-6 py-3.5 sm:py-4 text-sm sm:text-base font-bold text-[var(--text)] shadow-xs transition-all hover:bg-[var(--panel2)] hover:scale-[1.01]"
              >
                <Download size={18} className="text-[var(--accent)]" />
                <span>Get Desktop & Mobile Apps</span>
              </a>
            </div>

            {/* 3 Value Badges */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[var(--line)]">
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--mut)]">Speed</div>
                <div className="text-sm sm:text-base font-bold text-[var(--text)]">Sub-5ms Boot</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--mut)]">Privacy</div>
                <div className="text-sm sm:text-base font-bold text-[var(--text)]">Hardware AES-256</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--mut)]">Cost</div>
                <div className="text-sm sm:text-base font-bold text-[var(--ok)]">$0 · No Paywalls</div>
              </div>
            </div>

          </div>

          {/* Right Column: Interactive Live Sandbox Teaser */}
          <div id="interactive-demo" className="lg:col-span-5">
            <div className="relative rounded-3xl border border-[var(--line)] bg-[var(--panel)]/90 p-5 sm:p-6 shadow-2xl backdrop-blur-2xl transition-all">
              
              {/* Simulator Header */}
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500/80" />
                  <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 text-xs font-bold uppercase tracking-wider text-[var(--mut)]">
                    Interactive Live Sandbox
                  </span>
                </div>
                <span className="rounded-full bg-[var(--ok)]/15 px-2.5 py-0.5 text-xs font-bold text-[var(--ok)]">
                  Active Demo
                </span>
              </div>

              {/* Interactive Tabs */}
              <div className="mt-4 flex rounded-xl border border-[var(--line)] bg-[var(--panel2)] p-1">
                {[
                  { id: "tasks", label: "Tasks", icon: ListTodo },
                  { id: "timer", label: "Pomodoro", icon: Timer },
                  { id: "notes", label: "Second Brain", icon: FileText },
                  { id: "layouts", label: "5 Layouts", icon: Layers },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = simTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setSimTab(tab.id as any)}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer",
                        isActive
                          ? "bg-[var(--panel)] text-[var(--text)] shadow-xs"
                          : "text-[var(--mut)] hover:text-[var(--text)]"
                      )}
                    >
                      <Icon size={14} className={isActive ? "text-[var(--accent)]" : ""} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Sandbox Body Content */}
              <div className="mt-5 min-h-[290px] flex flex-col justify-between">
                
                {/* TAB 1: Tasks Sandbox */}
                {simTab === "tasks" && (
                  <div className="space-y-4">
                    {/* Momentum Meter */}
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel2)]/70 p-3.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-[var(--text)]">Today's Momentum</span>
                        <span className="font-mono text-[var(--accent)]">
                          {completedCount}/{demoTasks.length} Completed ({progressPercent}%)
                        </span>
                      </div>
                      <div className="mt-2 h-2.5 w-full rounded-full bg-[var(--line)] overflow-hidden">
                        <div
                          className="h-full transition-all duration-500 rounded-full"
                          style={{
                            width: `${progressPercent}%`,
                            background: progressPercent === 100 ? "var(--ok)" : "var(--accent)",
                          }}
                        />
                      </div>
                    </div>

                    {/* Interactive Task Rows */}
                    <div className="space-y-2">
                      {demoTasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => toggleTask(t.id)}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none",
                            t.done
                              ? "border-[var(--ok)]/30 bg-[var(--ok)]/5 opacity-80"
                              : "border-[var(--line)] bg-[var(--panel)] hover:border-[var(--accent)] hover:shadow-xs"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "flex h-5 w-5 items-center justify-center rounded-md border transition-all",
                                t.done
                                  ? "bg-[var(--ok)] border-[var(--ok)] text-white"
                                  : "border-[var(--line)] bg-[var(--panel2)]"
                              )}
                            >
                              {t.done && <Check size={13} strokeWidth={3} />}
                            </div>
                            <span
                              className={cn(
                                "text-xs sm:text-sm font-medium transition-all",
                                t.done ? "line-through text-[var(--mut)]" : "text-[var(--text)] font-semibold"
                              )}
                            >
                              {t.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <span className="rounded px-1.5 py-0.5 text-[11px] font-mono font-bold bg-[var(--panel2)] text-[var(--mut)]">
                              {t.mins}m
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {progressPercent === 100 ? (
                      <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[var(--ok)]/10 text-[var(--ok)] text-xs font-bold animate-pulse">
                        <Sparkles size={15} />
                        <span>All goals crushed! Instant offline satisfaction.</span>
                      </div>
                    ) : (
                      <p className="text-center text-xs text-[var(--mut)] font-medium">
                        👆 Click the unfinished task above to test the instant checkmark!
                      </p>
                    )}
                  </div>
                )}

                {/* TAB 2: Pomodoro Timer Sandbox */}
                {simTab === "timer" && (
                  <div className="space-y-4 text-center">
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel2)]/70 p-6">
                      <div className="text-xs font-bold uppercase tracking-wider text-[var(--mut)]">
                        Deep Work Sprint (Session 1 of 4)
                      </div>
                      <div className="mt-3 font-mono text-5xl font-black tracking-tight text-[var(--text)]">
                        {formatTimer(timerSeconds)}
                      </div>

                      <div className="mt-4 flex items-center justify-center gap-3">
                        <button
                          onClick={() => setTimerRunning(!timerRunning)}
                          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:scale-[1.03] cursor-pointer"
                          style={{ background: timerRunning ? "var(--warn)" : "var(--accent)" }}
                        >
                          {timerRunning ? <Pause size={14} /> : <Play size={14} />}
                          <span>{timerRunning ? "Pause Timer" : "Start Focus Timer"}</span>
                        </button>
                        <button
                          onClick={() => {
                            setTimerRunning(false);
                            setTimerSeconds(1500);
                          }}
                          className="p-2.5 rounded-xl border border-[var(--line)] bg-[var(--panel)] text-[var(--mut)] hover:text-[var(--text)] cursor-pointer"
                          title="Reset"
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Ambient Soundscapes Preview */}
                    <div className="flex items-center justify-center gap-2">
                      <Volume2 size={14} className="text-[var(--mut)]" />
                      <span className="text-xs font-bold text-[var(--mut)]">Offline Audio:</span>
                      {["Rainstorm", "Forest Camp", "Synthesized Chime"].map((sound, sIdx) => (
                        <span
                          key={sIdx}
                          className="rounded-full border border-[var(--line)] bg-[var(--panel2)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text)]"
                        >
                          {sound}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: Second Brain Notes Sandbox */}
                {simTab === "notes" && (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel2)]/70 p-4 text-left">
                      <div className="flex items-center justify-between border-b border-[var(--line)] pb-2 mb-2.5">
                        <span className="text-xs font-bold text-[var(--text)]">
                          📓 Architecture Manifesto.md
                        </span>
                        <span className="text-[11px] font-mono text-[var(--mut)]">AES-256 Encrypted</span>
                      </div>
                      <div className="space-y-2 text-xs sm:text-sm font-medium leading-relaxed text-[var(--text)]">
                        <p>
                          Sync state across nodes using{" "}
                          <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[var(--accent)] font-bold">
                            @P2P-Sync
                          </span>{" "}
                          under project{" "}
                          <span className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-blue-500 font-bold">
                            #Core-Engine
                          </span>
                          .
                        </p>
                        <p>
                          Related concepts captured in{" "}
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-emerald-500 font-bold">
                            [[Local First Sovereignty]]
                          </span>
                          .
                        </p>
                      </div>
                    </div>
                    <p className="text-center text-xs text-[var(--mut)] font-medium">
                      Type <code className="font-mono text-[var(--accent)]">@</code> for Tasks,{" "}
                      <code className="font-mono text-blue-500">#</code> for Projects, and{" "}
                      <code className="font-mono text-emerald-500">[[</code> for Notes anywhere.
                    </p>
                  </div>
                )}

                {/* TAB 4: 5 Layout Engines Sandbox */}
                {simTab === "layouts" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { name: "Glassmorphic", desc: "Translucent frosted dock" },
                        { name: "Planify Clean", desc: "Minimalist sidebar" },
                        { name: "Control Center", desc: "Dense modular cockpit" },
                        { name: "Desk Station", desc: "Expansive widescreen" },
                        { name: "Zen Focus", desc: "Distraction-free single view" },
                      ].map((lay) => (
                        <button
                          key={lay.name}
                          onClick={() => setActiveLayoutTeaser(lay.name)}
                          className={cn(
                            "flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                            activeLayoutTeaser === lay.name
                              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                              : "border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--mut)]"
                          )}
                        >
                          <span className="text-xs font-bold text-[var(--text)]">{lay.name}</span>
                          <span className="text-[11px] text-[var(--mut)]">{lay.desc}</span>
                        </button>
                      ))}
                    </div>
                    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 text-center">
                      <span className="text-xs font-semibold text-[var(--text)]">
                        Selected: <strong className="text-[var(--accent)]">{activeLayoutTeaser}</strong>. Switch anytime via Settings or hotkey!
                      </span>
                    </div>
                  </div>
                )}

                {/* Bottom Interactive CTA */}
                <div className="pt-4 border-t border-[var(--line)] flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--mut)]">
                    Ready to use your own workspace?
                  </span>
                  <button
                    onClick={onEnter}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    <span>Launch LifeLog</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

              </div>
            </div>
          </div>

        </section>

        {/* SECTION 2: Why LifeLog vs Big Tech Cloud (Psychological Contrast & Loss Aversion) */}
        <section id="comparison" className="space-y-8 pt-6">
          <div className="text-center space-y-2">
            <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
              Digital Sovereignty
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight">
              LifeLog vs. Big Tech Cloud SaaS
            </h2>
            <p className="mx-auto max-w-2xl text-sm sm:text-base text-[var(--mut)] leading-relaxed">
              Why settle for cloud tools that hold your personal thoughts hostage, charge monthly fees, and track your habits?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* The Old Way: Cloud SaaS */}
            <div className="rounded-3xl border border-red-500/20 bg-[var(--panel)]/70 p-6 sm:p-8 backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold uppercase tracking-wider text-red-500">
                  Typical Cloud Apps (Notion, Todoist, Evernote)
                </span>
                <span className="text-xl">⚠️</span>
              </div>
              <ul className="space-y-3 text-sm text-[var(--mut)]">
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0">✕</span>
                  <span><strong>Monthly recurring bills:</strong> $8 to $20/month per user that never stops.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0">✕</span>
                  <span><strong>Data surveillance:</strong> Your private notes and habits are analyzed to train AI models.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0">✕</span>
                  <span><strong>Server outages lock you out:</strong> If the company goes down or offline, your day stops.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0">✕</span>
                  <span><strong>Vendor lock-in:</strong> Difficult to export pure SQLite data or take your archives with you.</span>
                </li>
              </ul>
            </div>

            {/* The Sovereign Way: LifeLog */}
            <div className="rounded-3xl border border-[var(--ok)]/40 bg-[var(--panel)]/90 p-6 sm:p-8 shadow-lg backdrop-blur-md space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--ok)]/10 rounded-bl-full pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold uppercase tracking-wider text-[var(--ok)]">
                  LifeLog Sovereign System
                </span>
                <span className="text-xl">🛡️</span>
              </div>
              <ul className="space-y-3 text-sm text-[var(--text)]">
                <li className="flex items-start gap-2.5">
                  <span className="text-[var(--ok)] font-bold shrink-0">✓</span>
                  <span><strong>100% Free Forever:</strong> Zero subscriptions, zero hidden tiers, zero paywalls.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[var(--ok)] font-bold shrink-0">✓</span>
                  <span><strong>Hardware Encryption:</strong> Device-bound AES-256-GCM cipher with zero telemetry.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[var(--ok)] font-bold shrink-0">✓</span>
                  <span><strong>True Offline Independence:</strong> Runs natively on SQLite WAL with instant sub-5ms boots.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[var(--ok)] font-bold shrink-0">✓</span>
                  <span><strong>Peer-to-Peer Sync:</strong> Direct encrypted local Wi-Fi sync with zero cloud database.</span>
                </li>
              </ul>
            </div>

          </div>
        </section>

        {/* SECTION 3: 7 Core Feature Pillars (Full-Width Responsive 3-Column Grid) */}
        <section id="pillars" className="space-y-8 pt-6">
          <div className="text-center space-y-2">
            <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
              Integrated Capabilities
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight">
              7 Unified Pillars. Zero Friction.
            </h2>
            <p className="mx-auto max-w-2xl text-sm sm:text-base text-[var(--mut)] leading-relaxed">
              Every tool works together seamlessly in a single cohesive workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pillars.map((p, i) => {
              const Icon = p.icon;
              return (
                <div
                  key={i}
                  className="flex flex-col justify-between rounded-3xl border border-[var(--line)] bg-[var(--panel)]/80 p-6 sm:p-7 shadow-xs backdrop-blur-md transition-all hover:scale-[1.01] hover:border-[var(--accent)] hover:shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-xs"
                        style={{
                          background: `color-mix(in srgb, ${p.color} 15%, transparent)`,
                          color: p.color,
                        }}
                      >
                        <Icon size={24} />
                      </div>
                      <span className="rounded-full border border-[var(--line)] bg-[var(--panel2)] px-3 py-1 text-xs font-bold tracking-wider text-[var(--mut)]">
                        {p.tag}
                      </span>
                    </div>

                    <h3 className="mt-5 font-display text-lg sm:text-xl font-bold text-[var(--text)]">
                      {p.title}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--mut)] leading-relaxed">
                      {p.desc}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[var(--line)]">
                    <ul className="space-y-2">
                      {p.bullets.map((b, bi) => (
                        <li key={bi} className="flex items-start gap-2 text-xs sm:text-sm font-medium text-[var(--text)]">
                          <CheckCircle2 size={15} style={{ color: p.color }} className="shrink-0 mt-0.5" />
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

        {/* SECTION 4: Ecosystem & Downloads Hub */}
        <section id="downloads" className="space-y-8 pt-6">
          <div className="text-center space-y-2">
            <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
              Cross-Platform Ecosystem
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight">
              Download LifeLog for Your Devices
            </h2>
            <p className="mx-auto max-w-2xl text-sm sm:text-base text-[var(--mut)] leading-relaxed">
              Standalone native binaries for Windows, macOS, Linux, and Android. Sync them effortlessly over local P2P.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {platforms.map((pl, idx) => {
              const Icon = pl.icon;
              return (
                <a
                  key={idx}
                  href={pl.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col justify-between p-6 rounded-3xl border border-[var(--line)] bg-[var(--panel)]/80 backdrop-blur-md transition-all hover:scale-[1.02] hover:border-[var(--accent)] hover:shadow-xl group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="h-12 w-12 rounded-2xl flex items-center justify-center border border-[var(--line)] bg-[var(--panel2)] text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white transition-colors">
                        <Icon size={24} />
                      </div>
                      <span className="rounded-full border border-[var(--line)] bg-[var(--panel2)] px-2.5 py-0.5 text-xs font-mono font-bold text-[var(--mut)]">
                        {pl.badge}
                      </span>
                    </div>

                    <div>
                      <div className="font-display text-lg font-bold text-[var(--text)]">{pl.os}</div>
                      <div className="text-xs sm:text-sm font-semibold text-[var(--mut)] mt-1">{pl.type}</div>
                      <div className="text-xs text-[var(--mut)]/80 mt-2">{pl.note}</div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[var(--line)] flex items-center justify-between text-xs sm:text-sm font-bold text-[var(--accent)]">
                    <span>Download {pl.ext}</span>
                    <Download size={16} className="group-hover:translate-y-0.5 transition-transform" />
                  </div>
                </a>
              );
            })}
          </div>

          <div className="text-center text-xs sm:text-sm text-[var(--mut)] font-semibold">
            All releases include verified SHA-256 checksums. Review releases on the{" "}
            <a
              href="https://github.com/Krrish1411/Lifelog-Releases"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] underline font-bold"
            >
              Public Releases Repository
            </a>.
          </div>
        </section>

        {/* SECTION 5: Creator Philosophy & Manifesto */}
        <section id="philosophy" className="pt-6">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)]/90 p-8 sm:p-12 shadow-md backdrop-blur-xl space-y-6">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg"
                style={{ background: "var(--accent)" }}
              >
                KP
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--text)]">
                  Why I Built LifeLog
                </h3>
                <p className="text-sm font-semibold text-[var(--mut)]">
                  By Krish Patel · Founder & Solo Architect
                </p>
              </div>
            </div>

            <div className="space-y-4 text-sm sm:text-base leading-relaxed text-[var(--mut)] font-normal">
              <p>
                Modern productivity software has lost its core purpose. Simple daily planners, calendars, and notes have been turned into bloated surveillance engines designed to harvest your telemetry, lock your thoughts behind monthly recurring subscription paywalls, and force your life into closed corporate silos.
              </p>
              <p>
                LifeLog was born out of an uncompromising conviction: <strong className="text-[var(--text)] font-semibold">your daily schedule, your honest thoughts, your habits, and your creative output belong to you alone.</strong>
              </p>
              <p>
                There are no cloud databases. There are no tracking pixels or advertising algorithms. LifeLog writes directly to local SQLite WAL files on your machine. When you synchronize multiple devices, they communicate directly via encrypted peer-to-peer WebRTC sockets over your own local network.
              </p>
              <p className="pt-2 text-sm sm:text-base italic text-[var(--text)] font-semibold border-l-4 border-[var(--accent)] pl-4">
                "LifeLog is designed to run for decades without requiring a single remote server to stay online. Thank you for choosing sovereign personal computing."
              </p>
            </div>

            {/* Creator Actions & Contact */}
            <div className="pt-6 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Buy Me a Coffee (Clean Sans UI Font) */}
                <a
                  href="https://buymeacoffee.com/Krrish1411"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-xs transition-all hover:scale-[1.03] active:scale-[0.97] border border-black/80"
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
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel2)] px-4 py-2 text-xs sm:text-sm font-bold text-[var(--text)] transition-colors hover:bg-[var(--line)]"
                >
                  <Mail size={15} />
                  <span>getlifelog@proton.me</span>
                </a>
              </div>

              <button
                onClick={onEnter}
                className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-[var(--on-accent)] shadow-md shadow-[var(--accent)]/20 transition-all hover:scale-[1.02] cursor-pointer"
                style={{ background: "var(--accent)" }}
              >
                <span>Launch LifeLog Now</span>
                <ArrowRight size={15} />
              </button>
            </div>

          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--line)] bg-[var(--panel)]/60 py-8 text-center text-xs sm:text-sm font-semibold text-[var(--mut)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[var(--text)]">LifeLog v{APP_VERSION}</span>
            <span>·</span>
            <span>Created by <strong className="text-[var(--accent)] font-bold">Krish Patel</strong></span>
          </div>
          <div>
            100% Offline · Zero Telemetry · Open Architecture
          </div>
        </div>
      </footer>
    </div>
  );
}
