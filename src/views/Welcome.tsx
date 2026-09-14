import { useState, useEffect, useRef } from "react";
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
  Apple,
  Share2,
  Fingerprint,
  Copy,
  ShieldAlert,
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
    // Fallback if mounted outside store context
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

  const containerRef = useRef<HTMLDivElement>(null);

  // Smooth scroll helper that takes sticky header offset into account
  const scrollToSection = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el && containerRef.current) {
      const headerHeight = 76;
      const elRect = el.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      const targetScrollTop =
        containerRef.current.scrollTop + (elRect.top - containerRect.top) - headerHeight;
      containerRef.current.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: "smooth",
      });
    } else if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Interactive Simulator State (Dopamine & User Engagement)
  const [simTab, setSimTab] = useState<"tasks" | "timer" | "notes">("tasks");
  const [demoTasks, setDemoTasks] = useState([
    { id: 1, title: "Review daily priority queue & sync calendar", done: true, tag: "Planning", mins: 15 },
    { id: 2, title: "25-min distraction-free focus block on architecture", done: true, tag: "Deep Work", mins: 25 },
    { id: 3, title: "Click me to test LifeLog's instant dopamine hit ✨", done: false, tag: "Quick Win", mins: 5 },
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

  // PWA Install Prompt & APK Security Proof Handlers
  const [copiedSha, setCopiedSha] = useState(false);
  const [pwaPrompt, setPwaPrompt] = useState<any>(() =>
    typeof window !== "undefined" ? (window as any).__pwaInstallPrompt || null : null
  );

  useEffect(() => {
    const handlePwaPrompt = () => {
      setPwaPrompt((window as any).__pwaInstallPrompt || null);
    };
    window.addEventListener("pwa-prompt-available", handlePwaPrompt);
    return () => window.removeEventListener("pwa-prompt-available", handlePwaPrompt);
  }, []);

  const handleInstallPwa = () => {
    if (pwaPrompt) {
      pwaPrompt.prompt();
      pwaPrompt.userChoice.then(() => {
        (window as any).__pwaInstallPrompt = null;
        setPwaPrompt(null);
      });
    } else {
      onEnter();
    }
  };

  const handleCopySha = () => {
    const cmd = "sha256sum LifeLog-1.0.0.apk";
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(cmd)
        .then(() => {
          setCopiedSha(true);
          setTimeout(() => setCopiedSha(false), 2500);
        })
        .catch(() => {});
    }
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
        "Synthesized acoustic bell chimes & audio cues",
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
      action: "download",
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
      action: "download",
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
      action: "download",
    },
    {
      os: "Android",
      icon: Smartphone,
      type: "Native Arm64 APK Release",
      ext: ".apk",
      size: "6.8 MB",
      href: "https://github.com/Krrish1411/Lifelog-Releases/releases/latest",
      badge: "0/70 Clean Scan",
      note: "Offline SQLite with local P2P sync across your devices",
      action: "download",
    },
    {
      os: "iOS / iPadOS",
      icon: Apple,
      type: "Progressive Web App (PWA)",
      ext: "PWA",
      size: "Instant",
      href: "#ios-guide",
      badge: "Safari PWA",
      note: "Safari > Share > Add to Home Screen for native feel",
      action: "ios-guide",
    },
    {
      os: "Web Browser",
      icon: Globe,
      type: "100% Sandboxed Instant App",
      ext: "PWA",
      size: "Zero MB",
      href: "#",
      badge: "Instant Boot",
      note: "Runs locally in browser with zero device file access",
      action: "launch-web",
    },
  ];

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 h-screen w-full overflow-y-auto scroll-smooth bg-[var(--bg)] text-[var(--text)] select-text z-50 overscroll-y-auto cursor-default transition-colors duration-200"
      style={{
        paddingBottom: "max(calc(var(--safe-bottom, 12px) + 32px), 64px)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* Ambient Liquid Mesh Background Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden select-none z-0">
        <div
          className="absolute -top-[15%] -left-[10%] h-[550px] w-[650px] rounded-full blur-[130px] opacity-25 dark:opacity-20 animate-pulse"
          style={{
            background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
            animationDuration: "9s",
          }}
        />
        <div
          className="absolute -top-[10%] -right-[10%] h-[600px] w-[700px] rounded-full blur-[140px] opacity-20 dark:opacity-15"
          style={{
            background: "radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, rgba(59, 130, 246, 0.2) 50%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-[-15%] left-[20%] h-[500px] w-[700px] rounded-full blur-[150px] opacity-20 dark:opacity-15"
          style={{
            background: "radial-gradient(circle, rgba(245, 158, 11, 0.3) 0%, rgba(139, 92, 246, 0.18) 50%, transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--text) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Top Header Navigation Bar (Refined & Balanced Full Width) */}
      <header
        className="sticky top-0 z-50 w-full border-b border-[var(--line)] bg-[var(--panel)]/95 backdrop-blur-xl select-none transition-colors shadow-xs"
        style={{ paddingTop: "var(--safe-top, 0px)" }}
      >
        <div className="w-full flex items-center justify-between px-4 sm:px-8 md:px-12 py-3">
          {/* Brand Logo & Version Badge */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <svg width={34} height={34} viewBox="0 0 32 32" aria-hidden className="shrink-0">
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
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--ok)] ring-2 ring-[var(--panel)] animate-pulse" />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-display text-xl sm:text-2xl font-black tracking-tight text-[var(--text)]">
                LifeLog
              </span>
              <span className="rounded-full border border-[var(--line)] bg-[var(--panel2)] px-2.5 py-0.5 text-xs font-mono font-bold tracking-wide text-[var(--accent)]">
                v{APP_VERSION} Sovereign
              </span>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6">
            <a
              href="#interactive-demo"
              onClick={(e) => scrollToSection(e, "interactive-demo")}
              className="text-sm font-bold text-[var(--text)]/75 hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              Live Sandbox
            </a>
            <a
              href="#pillars"
              onClick={(e) => scrollToSection(e, "pillars")}
              className="text-sm font-bold text-[var(--text)]/75 hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              Capabilities
            </a>
            <a
              href="#comparison"
              onClick={(e) => scrollToSection(e, "comparison")}
              className="text-sm font-bold text-[var(--text)]/75 hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              Why LifeLog
            </a>
            <a
              href="#downloads"
              onClick={(e) => scrollToSection(e, "downloads")}
              className="text-sm font-bold text-[var(--text)]/75 hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              Downloads
            </a>
            <a
              href="#philosophy"
              onClick={(e) => scrollToSection(e, "philosophy")}
              className="text-sm font-bold text-[var(--text)]/75 hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              Philosophy
            </a>
          </nav>

          {/* Right Action Items: Dark Mode Toggle + Buy Me a Coffee + Launch */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Dark / Light Mode Toggle Button */}
            <button
              onClick={handleToggleTheme}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--panel2)] px-3 py-1.5 text-xs font-bold text-[var(--text)] transition-all hover:scale-[1.03] active:scale-[0.97] shadow-xs cursor-pointer"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme mode"
            >
              {isDark ? (
                <>
                  <Sun size={15} className="text-amber-400 shrink-0" />
                  <span className="hidden sm:inline uppercase tracking-wider font-extrabold text-[11px]">Light</span>
                </>
              ) : (
                <>
                  <Moon size={15} className="text-indigo-600 shrink-0" />
                  <span className="hidden sm:inline uppercase tracking-wider font-extrabold text-[11px]">Dark</span>
                </>
              )}
            </button>

            {/* Official Buy Me a Coffee Button (Sans UI Font) */}
            <a
              href="https://buymeacoffee.com/Krrish1411"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold shadow-xs transition-all hover:scale-[1.03] active:scale-[0.97] border border-black/80 shrink-0 cursor-pointer"
              style={{
                background: "#FFDD00",
                color: "#000000",
              }}
              title="Support independent development on Buy Me a Coffee"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 8h-1V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v10c0 2.2 1.8 4 4 4h10c2.2 0 4-1.8 4-4v-2h1c1.7 0 3-1.3 3-3s-1.3-3-3-3zm-3 8c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V6h14v10zm3-4h-1v-2h1c.6 0 1 .4 1 1s-.4 1-1 1z" fill="#000000"/>
                <path d="M6 9h2v4H6zm4 0h2v4h-2zm4 0h2v4h-2z" fill="#ffffff"/>
              </svg>
              <span className="font-bold tracking-tight">Buy me a coffee</span>
            </a>

            {/* Primary Launch Action */}
            <button
              onClick={onEnter}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 sm:px-4 py-1.5 text-xs sm:text-sm font-bold text-[var(--on-accent)] shadow-md shadow-[var(--accent)]/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              style={{ background: "var(--accent)" }}
            >
              <span>{canDismiss ? "Launch Workspace" : "Enter LifeLog"}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container (Well-Proportioned max-w-7xl) */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-16 sm:space-y-24">
        
        {/* HERO SECTION: Perfectly Balanced Above-the-Fold Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center pt-2">
          
          {/* Left Column: Authoritative Message & Psychological Hooks */}
          <div className="lg:col-span-7 space-y-5 text-left">
            
            {/* Trust Pill */}
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3.5 py-1.5 shadow-xs">
              <span className="flex h-2 w-2 rounded-full bg-[var(--ok)] animate-pulse" />
              <ShieldCheck size={15} className="text-[var(--ok)] shrink-0" />
              <span className="text-xs sm:text-sm font-bold tracking-wide text-[var(--text)]">
                Zero Telemetry · 100% Offline SQLite WAL · AES-256-GCM · Direct P2P Sync
              </span>
            </div>

            {/* Main Headline (Clean, Powerful, Perfectly Sized) */}
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[46px] font-black tracking-tight leading-[1.12] text-[var(--text)]">
              The Sovereign Personal Operating System.
            </h1>

            {/* Sub-headline */}
            <p className="text-base sm:text-lg text-[var(--text)]/80 font-normal leading-relaxed max-w-xl">
              Take back absolute control over your schedule, deep work, habits, and private second-brain notes. Powered entirely by local SQLite WAL with instant sub-5ms boot speeds. <strong className="text-[var(--text)] font-bold">Zero monthly subscriptions, zero third-party cloud lock-in, and zero AI telemetry scraping.</strong>
            </p>

            {/* Psychological Reassurance Banner (Overwhelm Mitigation) */}
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm transition-all duration-300 hover:border-[var(--accent)] group">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] shrink-0 group-hover:scale-105 transition-transform">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-[var(--text)]">
                    Massive Power, Zero Overwhelm
                  </h4>
                  <p className="mt-1 text-xs sm:text-sm text-[var(--text)]/75 leading-relaxed font-normal">
                    LifeLog includes full-scale modular capabilities, but you don&#39;t have to master everything on day one. Start with just 1 priority task today. Toggle features and views only when you feel ready.
                  </p>
                </div>
              </div>
            </div>

            {/* Call to Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={onEnter}
                className="flex items-center gap-2 rounded-xl px-6 sm:px-7 py-3 text-sm sm:text-base font-bold text-[var(--on-accent)] shadow-lg shadow-[var(--accent)]/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                style={{ background: "var(--accent)" }}
              >
                <span>Launch LifeLog Instantly</span>
                <ArrowRight size={17} />
              </button>

              <a
                href="#downloads"
                onClick={(e) => scrollToSection(e, "downloads")}
                className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 sm:px-6 py-3 text-sm sm:text-base font-bold text-[var(--text)] shadow-xs transition-all hover:bg-[var(--panel2)] hover:scale-[1.01] cursor-pointer"
              >
                <Download size={17} className="text-[var(--accent)]" />
                <span>Get Desktop & Mobile Apps</span>
              </a>
            </div>

            {/* 3 Core Value Pillars Strip */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[var(--line)]">
              <div className="space-y-0.5">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--mut)]">Engine Speed</div>
                <div className="text-sm sm:text-base font-extrabold text-[var(--text)]">Sub-5ms Boot</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--mut)]">Cryptography</div>
                <div className="text-sm sm:text-base font-extrabold text-[var(--text)]">Hardware AES-256</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--mut)]">Sovereign Cost</div>
                <div className="text-sm sm:text-base font-extrabold text-[var(--ok)]">$0 · No Paywalls</div>
              </div>
            </div>

          </div>

          {/* Right Column: Interactive Live Sandbox Teaser */}
          <div id="interactive-demo" className="lg:col-span-5 scroll-mt-24">
            <div className="relative rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:border-[var(--accent)] group">
              
              {/* Simulator Top Header */}
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-3.5">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500/90" />
                  <div className="h-3 w-3 rounded-full bg-amber-500/90" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500/90" />
                  <span className="ml-2 text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                    Interactive Live Sandbox
                  </span>
                </div>
                <span className="rounded-full bg-[var(--ok)]/15 border border-[var(--ok)]/30 px-2.5 py-0.5 text-[11px] font-extrabold text-[var(--ok)] uppercase tracking-wider animate-pulse">
                  Live Preview
                </span>
              </div>

              {/* Interactive Tabs */}
              <div className="mt-4 flex rounded-xl border border-[var(--line)] bg-[var(--panel2)] p-1">
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
                        "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer",
                        isActive
                          ? "bg-[var(--panel)] text-[var(--text)] shadow-xs border border-[var(--line)]"
                          : "text-[var(--text)]/70 hover:text-[var(--text)]"
                      )}
                    >
                      <Icon size={14} className={isActive ? "text-[var(--accent)]" : ""} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Sandbox Interactive Body */}
              <div className="mt-4 min-h-[280px] flex flex-col justify-between">
                
                {/* TAB 1: Tasks Sandbox */}
                {simTab === "tasks" && (
                  <div className="space-y-3">
                    {/* Momentum Meter */}
                    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel2)] p-3">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-[var(--text)]">Today&#39;s Momentum</span>
                        <span className="font-mono text-xs sm:text-sm text-[var(--accent)]">
                          {completedCount}/{demoTasks.length} Completed ({progressPercent}%)
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-[var(--line)] overflow-hidden">
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
                              ? "border-[var(--ok)]/40 bg-[var(--ok)]/10 text-[var(--text)]"
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
                                "text-xs sm:text-sm font-semibold transition-all",
                                t.done ? "line-through opacity-70" : "text-[var(--text)]"
                              )}
                            >
                              {t.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <span className="rounded px-1.5 py-0.5 text-[11px] font-mono font-bold bg-[var(--panel2)] text-[var(--text)]">
                              {t.mins}m
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {progressPercent === 100 ? (
                      <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[var(--ok)]/15 text-[var(--ok)] text-xs font-bold animate-pulse border border-[var(--ok)]/30">
                        <Sparkles size={15} />
                        <span>All goals completed! Pure offline dopamine satisfaction.</span>
                      </div>
                    ) : (
                      <p className="text-center text-xs text-[var(--text)]/70 font-semibold">
                        👆 Click the unfinished task above to feel the instant checkmark reward!
                      </p>
                    )}
                  </div>
                )}

                {/* TAB 2: Pomodoro Timer Sandbox */}
                {simTab === "timer" && (
                  <div className="space-y-4 text-center">
                    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel2)] p-5">
                      <div className="text-xs font-bold uppercase tracking-wider text-[var(--text)]/70">
                        Deep Work Focus Block (Session 1 of 4)
                      </div>
                      <div className="mt-2 font-mono text-4xl sm:text-5xl font-black tracking-tight text-[var(--text)]">
                        {formatTimer(timerSeconds)}
                      </div>

                      <div className="mt-4 flex items-center justify-center gap-3">
                        <button
                          onClick={() => setTimerRunning(!timerRunning)}
                          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:scale-[1.03] cursor-pointer"
                          style={{ background: timerRunning ? "var(--warn)" : "var(--accent)" }}
                        >
                          {timerRunning ? <Pause size={14} /> : <Play size={14} />}
                          <span>{timerRunning ? "Pause Focus" : "Start Focus Timer"}</span>
                        </button>
                        <button
                          onClick={() => {
                            setTimerRunning(false);
                            setTimerSeconds(1500);
                          }}
                          className="p-2.5 rounded-xl border border-[var(--line)] bg-[var(--panel)] text-[var(--text)] hover:border-[var(--accent)] cursor-pointer"
                          title="Reset"
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
                      <Volume2 size={14} className="text-[var(--text)] shrink-0" />
                      <span className="text-xs font-bold text-[var(--text)]">Synthetic Audio Cues:</span>
                      {["Start Chime", "Break Bell", "Pause Auditing"].map((sound, sIdx) => (
                        <span
                          key={sIdx}
                          className="rounded-full border border-[var(--line)] bg-[var(--panel2)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--text)]"
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
                    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel2)] p-4 text-left">
                      <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5 mb-2.5">
                        <span className="text-xs font-bold text-[var(--text)]">
                          📓 Architecture Manifesto.md
                        </span>
                        <span className="text-[11px] font-mono font-bold text-[var(--accent)]">AES-256 Encrypted</span>
                      </div>
                      <div className="space-y-2 text-xs sm:text-sm font-medium leading-relaxed text-[var(--text)]">
                        <p>
                          Sync state across nodes using{" "}
                          <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[var(--accent)] font-bold">
                            @P2P-Sync
                          </span>{" "}
                          under project{" "}
                          <span className="rounded bg-blue-500/15 px-1.5 py-0.5 font-mono text-blue-500 font-bold">
                            #Core-Engine
                          </span>
                          .
                        </p>
                        <p>
                          Related principles captured in{" "}
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-emerald-500 font-bold">
                            [[Local First Sovereignty]]
                          </span>
                          .
                        </p>
                      </div>
                    </div>
                    <p className="text-center text-xs text-[var(--text)]/70 font-semibold">
                      Type <code className="font-mono text-[var(--accent)] font-bold">@</code> for Tasks,{" "}
                      <code className="font-mono text-blue-500 font-bold">#</code> for Projects, and{" "}
                      <code className="font-mono text-emerald-500 font-bold">[[</code> for Notes anywhere.
                    </p>
                  </div>
                )}

                {/* Bottom Interactive CTA */}
                <div className="pt-3.5 border-t border-[var(--line)] flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text)]/70">
                    Ready to build your personal sanctuary?
                  </span>
                  <button
                    onClick={onEnter}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    <span>Launch Workspace</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

              </div>
            </div>
          </div>

        </section>

        {/* SECTION 2: Why LifeLog vs Big Tech Cloud (Loss Aversion & Privacy Urgency) */}
        <section id="comparison" className="space-y-6 pt-4 scroll-mt-24">
          <div className="text-center space-y-2">
            <span className="rounded-full bg-[var(--accent-soft)] px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-[var(--accent)]">
              Digital Sovereignty
            </span>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[var(--text)]">
              LifeLog vs. Big Tech Cloud SaaS
            </h2>
            <p className="mx-auto max-w-2xl text-sm sm:text-base text-[var(--text)]/75 leading-relaxed font-normal">
              Why settle for cloud services that hold your private thoughts hostage, charge perpetual subscriptions, and feed your data to AI algorithms?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* The Old Way: Cloud SaaS */}
            <div className="rounded-2xl border border-red-500/25 bg-[var(--panel)] p-6 sm:p-7 shadow-sm space-y-4 transition-all duration-300 hover:shadow-lg hover:border-red-500/50">
              <div className="flex items-center justify-between">
                <span className="text-sm sm:text-base font-bold uppercase tracking-wider text-red-500">
                  Big Tech Cloud SaaS (Notion, Todoist, Evernote)
                </span>
                <span className="text-xl">⚠️</span>
              </div>
              <ul className="space-y-3 text-sm text-[var(--text)]/80">
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0">✕</span>
                  <span><strong>Perpetual recurring fees:</strong> $8 to $25/month per user that drains your wallet forever.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0">✕</span>
                  <span><strong>AI surveillance:</strong> Your private notes and journal reflections are scraped to train LLMs.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0">✕</span>
                  <span><strong>Cloud outages lock you out:</strong> If AWS or the vendor&#39;s servers go down, your day halts.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0">✕</span>
                  <span><strong>Data hostage:</strong> Locked behind closed proprietary databases that cannot be freely exported.</span>
                </li>
              </ul>
            </div>

            {/* The Sovereign Way: LifeLog */}
            <div className="rounded-2xl border border-[var(--ok)]/50 bg-[var(--panel)] p-6 sm:p-7 shadow-md space-y-4 transition-all duration-300 hover:shadow-xl hover:border-[var(--ok)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-[var(--ok)]/10 rounded-bl-full pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-sm sm:text-base font-bold uppercase tracking-wider text-[var(--ok)]">
                  LifeLog Sovereign System
                </span>
                <span className="text-xl">🛡️</span>
              </div>
              <ul className="space-y-3 text-sm text-[var(--text)]">
                <li className="flex items-start gap-2.5">
                  <span className="text-[var(--ok)] font-bold shrink-0">✓</span>
                  <span><strong>100% Free Forever:</strong> Zero subscriptions, zero paywalls, zero locked features.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[var(--ok)] font-bold shrink-0">✓</span>
                  <span><strong>Hardware Encryption:</strong> Device-bound AES-256-GCM cipher with zero remote telemetry.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[var(--ok)] font-bold shrink-0">✓</span>
                  <span><strong>True Offline Independence:</strong> Executes directly against local SQLite WAL in sub-5 milliseconds.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[var(--ok)] font-bold shrink-0">✓</span>
                  <span><strong>Direct P2P Sync:</strong> Encrypted device-to-device synchronization over local Wi-Fi with zero servers.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* SECTION 3: 7 Core Feature Pillars */}
        <section id="pillars" className="space-y-6 pt-4 scroll-mt-24">
          <div className="text-center space-y-2">
            <span className="rounded-full bg-[var(--accent-soft)] px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-[var(--accent)]">
              Integrated Capabilities
            </span>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[var(--text)]">
              7 Unified Pillars. Zero Friction.
            </h2>
            <p className="mx-auto max-w-2xl text-sm sm:text-base text-[var(--text)]/75 leading-relaxed font-normal">
              Every tool works together seamlessly in a single cohesive, privacy-first workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {pillars.map((p, i) => {
              const Icon = p.icon;
              return (
                <div
                  key={i}
                  className="flex flex-col justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-md group"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-xl shadow-xs transition-transform group-hover:scale-105"
                        style={{
                          background: `color-mix(in srgb, ${p.color} 15%, transparent)`,
                          color: p.color,
                        }}
                      >
                        <Icon size={22} />
                      </div>
                      <span className="rounded-full border border-[var(--line)] bg-[var(--panel2)] px-2.5 py-0.5 text-xs font-bold tracking-wider text-[var(--text)]">
                        {p.tag}
                      </span>
                    </div>

                    <h3 className="mt-4 font-display text-lg font-bold text-[var(--text)]">
                      {p.title}
                    </h3>
                    <p className="mt-1.5 text-xs sm:text-sm text-[var(--text)]/75 leading-relaxed font-normal">
                      {p.desc}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-[var(--line)]">
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

        {/* SECTION 4: Cross-Platform Ecosystem & Downloads Hub */}
        <section id="downloads" className="space-y-6 pt-4 scroll-mt-24">
          <div className="text-center space-y-2">
            <span className="rounded-full bg-[var(--accent-soft)] px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-[var(--accent)]">
              Cross-Platform Ecosystem
            </span>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[var(--text)]">
              Download LifeLog for Your Devices
            </h2>
            <p className="mx-auto max-w-2xl text-sm sm:text-base text-[var(--text)]/75 leading-relaxed font-normal">
              Pre-built native binaries with verified SHA-256 checksums, direct arm64 Android APKs, and zero-install PWA support for iOS and Web.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {platforms.map((pl, idx) => {
              const Icon = pl.icon;
              const isIos = pl.action === "ios-guide";
              const isWeb = pl.action === "launch-web";

              const handleClick = (e: React.MouseEvent) => {
                if (isIos) {
                  scrollToSection(e, "ios-guide");
                } else if (isWeb) {
                  e.preventDefault();
                  onEnter();
                }
              };

              return (
                <a
                  key={idx}
                  href={pl.href}
                  onClick={handleClick}
                  target={isIos || isWeb ? undefined : "_blank"}
                  rel={isIos || isWeb ? undefined : "noopener noreferrer"}
                  className="flex flex-col justify-between p-5 rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-md group cursor-pointer"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="h-11 w-11 rounded-xl flex items-center justify-center border border-[var(--line)] bg-[var(--panel2)] text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white transition-all">
                        <Icon size={22} />
                      </div>
                      <span className="rounded-full border border-[var(--line)] bg-[var(--panel2)] px-2 py-0.5 text-[11px] font-mono font-bold text-[var(--text)]">
                        {pl.badge}
                      </span>
                    </div>

                    <div>
                      <div className="font-display text-base sm:text-lg font-bold text-[var(--text)]">{pl.os}</div>
                      <div className="text-xs sm:text-sm font-semibold text-[var(--text)]/80 mt-0.5">{pl.type}</div>
                      <div className="text-xs text-[var(--text)]/65 mt-1.5 font-medium">{pl.note}</div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-[var(--line)] flex items-center justify-between text-xs sm:text-sm font-bold text-[var(--accent)]">
                    <span>{isIos ? "View Safari Guide" : isWeb ? "Launch Web App" : `Download ${pl.ext}`}</span>
                    {isIos || isWeb ? (
                      <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                    ) : (
                      <Download size={15} className="group-hover:translate-y-0.5 transition-transform" />
                    )}
                  </div>
                </a>
              );
            })}
          </div>

          {/* DEDICATED SECTION A: iOS / iPadOS Safari PWA Guide */}
          <div id="ios-guide" className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8 shadow-sm space-y-6 scroll-mt-24">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-[var(--panel2)] border border-[var(--line)] text-[var(--text)] shrink-0">
                  <Apple size={26} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-xl sm:text-2xl font-black tracking-tight text-[var(--text)]">
                      iOS & iPadOS Installation Guide
                    </h3>
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-500">
                      Zero App Store Fees
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-[var(--text)]/75 mt-0.5">
                    Apple restricts independent APK sideloading, but LifeLog runs as a first-class native Progressive Web App on iPhone and iPad with zero App Store restrictions or fees.
                  </p>
                </div>
              </div>
              <button
                onClick={onEnter}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:opacity-90 transition-all shrink-0 cursor-pointer shadow-sm"
              >
                <span>Launch Web App</span>
                <ArrowRight size={15} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel2)]/60 p-5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-full bg-[var(--accent)] text-white font-mono text-xs font-black flex items-center justify-center">1</span>
                  <span className="text-xs font-mono font-bold text-[var(--text)]/60">Step One</span>
                </div>
                <div className="font-display text-base font-bold text-[var(--text)]">Open in Safari</div>
                <p className="text-xs text-[var(--text)]/75 leading-relaxed">
                  Launch the official LifeLog URL (<code className="font-mono text-[var(--accent)]">https://krrish1411.github.io/Lifelog-Releases/</code>) inside Apple Safari on your iPhone or iPad.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel2)]/60 p-5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-full bg-[var(--accent)] text-white font-mono text-xs font-black flex items-center justify-center">2</span>
                  <span className="text-xs font-mono font-bold text-[var(--text)]/60">Step Two</span>
                </div>
                <div className="font-display text-base font-bold text-[var(--text)]">Tap the Share Icon</div>
                <p className="text-xs text-[var(--text)]/75 leading-relaxed">
                  Tap the <strong>Share</strong> button at the bottom of Safari (the square icon with an upward arrow <span className="font-bold text-[var(--accent)]">⎋ / 📤</span>).
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel2)]/60 p-5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-full bg-[var(--accent)] text-white font-mono text-xs font-black flex items-center justify-center">3</span>
                  <span className="text-xs font-mono font-bold text-[var(--text)]/60">Step Three</span>
                </div>
                <div className="font-display text-base font-bold text-[var(--text)]">Tap "Add to Home Screen"</div>
                <p className="text-xs text-[var(--text)]/75 leading-relaxed">
                  Scroll down the share sheet, tap <strong>"Add to Home Screen"</strong> (➕), and tap <strong>"Add"</strong> in the top-right corner.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-[var(--text)]">
              <div className="flex items-start sm:items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  <strong>Native Standalone Experience:</strong> Launches with zero Safari address bars, fluid 120Hz scrolling, and local encrypted SQLite database persistence right on your iOS device.
                </span>
              </div>
            </div>
          </div>

          {/* DEDICATED SECTION B: Android APK Security, Malware Proof & PWA Fallback */}
          <div id="apk-security" className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8 shadow-sm space-y-6 scroll-mt-24">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
              <div className="flex items-start gap-3.5">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 shrink-0">
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-xl sm:text-2xl font-black tracking-tight text-[var(--text)]">
                      Android APK Safety & Anti-Malware Proof
                    </h3>
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-0.5 text-xs font-mono font-bold text-emerald-500">
                      0/70 Clean Scan • 100% Malware-Free
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-[var(--text)]/75 mt-1 max-w-3xl leading-relaxed">
                    When downloading APKs directly from GitHub releases, Android displays a default generic security warning (<em>"File might be harmful"</em>) because the file was compiled outside Google Play. We believe in radical transparency: don't just take our word for it — here is undeniable mathematical, cryptographic, and zero-telemetry proof:
                  </p>
                </div>
              </div>
            </div>

            {/* 4 Pillars of Proof */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Proof 1: VirusTotal 0/70 Clean Scan */}
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel2)]/60 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                    <CheckCircle2 size={15} />
                    Multi-Engine Antivirus Audit
                  </span>
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-mono font-bold text-emerald-500">
                    0/70 Clean
                  </span>
                </div>
                <div className="font-display text-base font-bold text-[var(--text)]">
                  VirusTotal 70+ Security Vendor Verification
                </div>
                <p className="text-xs text-[var(--text)]/75 leading-relaxed">
                  Every released APK is audited against 70+ industry-leading security engines including <strong>Kaspersky, Bitdefender, Microsoft Defender, Google, Avast, and ESET</strong>. Zero malware, zero adware, zero tracking backdoors.
                </p>
                <a
                  href="https://www.virustotal.com/gui/home/upload"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] hover:underline pt-1"
                >
                  <span>Verify APK on VirusTotal</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              {/* Proof 2: Cryptographic SHA-256 Checksum */}
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel2)]/60 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
                    <Fingerprint size={15} />
                    Cryptographic Integrity
                  </span>
                  <span className="rounded bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-mono font-bold text-[var(--accent)]">
                    SHA-256
                  </span>
                </div>
                <div className="font-display text-base font-bold text-[var(--text)]">
                  Immutable Hash Verification
                </div>
                <p className="text-xs text-[var(--text)]/75 leading-relaxed">
                  Verify that the APK you downloaded is bit-for-bit identical to the compiled source and has not been intercepted, tampered with, or modified:
                </p>
                <div className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-[11px] text-[var(--text)]/90">
                  <code>sha256sum LifeLog-1.0.0.apk</code>
                  <button
                    onClick={handleCopySha}
                    className="ml-2 p-1 text-[var(--accent)] hover:opacity-80 cursor-pointer"
                    title="Copy Verification Command"
                  >
                    {copiedSha ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Proof 3: Zero Invasive Permissions */}
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel2)]/60 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1.5">
                    <Lock size={15} />
                    Zero Invasive Permissions
                  </span>
                  <span className="rounded bg-blue-500/15 px-2 py-0.5 text-[11px] font-mono font-bold text-blue-500">
                    Strict Sandbox
                  </span>
                </div>
                <div className="font-display text-base font-bold text-[var(--text)]">
                  Transparent Android Manifest Audit
                </div>
                <div className="space-y-1.5 text-xs text-[var(--text)]/75">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 font-bold">✕</span>
                    <span><strong>No Camera</strong> or Video access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 font-bold">✕</span>
                    <span><strong>No Microphone</strong> or Audio recording</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 font-bold">✕</span>
                    <span><strong>No GPS / Location</strong> tracking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 font-bold">✕</span>
                    <span><strong>No Contacts, Phone, or SMS</strong> inspection</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-500 font-semibold pt-1 border-t border-[var(--line)]">
                    <CheckCircle2 size={13} />
                    <span>Only Local Alarms & Peer-to-Peer Wi-Fi Sync</span>
                  </div>
                </div>
              </div>

              {/* Proof 4: Zero Outbound Telemetry (Network Inspected) */}
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel2)]/60 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                    <Radio size={15} />
                    Zero Telemetry
                  </span>
                  <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-500">
                    Network Verified
                  </span>
                </div>
                <div className="font-display text-base font-bold text-[var(--text)]">
                  Zero Spyware & Zero Tracking Network Proof
                </div>
                <p className="text-xs text-[var(--text)]/75 leading-relaxed">
                  Malware exists to steal or exfiltrate private data. LifeLog contains zero tracking SDKs, zero advertising networks, and zero analytics pixels. You can verify this independently by monitoring device traffic with Wireshark, Proxyman, or Little Snitch: <strong>zero outbound packets on startup</strong>.
                </p>
                <a
                  href="https://github.com/Krrish1411/Lifelog-Releases#-zero-cloud-sovereignty-guarantee"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] hover:underline pt-1"
                >
                  <span>Review Sovereignty Guarantee</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* THE PWA FALLBACK (Direct User Request) */}
            <div className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2">
                  <Globe size={18} className="text-[var(--accent)] shrink-0" />
                  <span className="font-display text-sm sm:text-base font-black text-[var(--text)]">
                    Hesitant about installing APKs? Use the 1-Tap Sandboxed PWA Option!
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[var(--text)]/80 leading-relaxed">
                  If you prefer not to sideload an APK or enable "Install unknown apps", you don't have to! You can run LifeLog directly inside your mobile browser (Chrome, Brave, Firefox) or install it as a PWA in 1 tap. It runs inside the browser's hardware-isolated OS sandbox with zero device file access, yet gives you the exact same offline SQLite database, instant sub-5ms boot, and full-screen experience.
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
                <button
                  onClick={handleInstallPwa}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-xs sm:text-sm font-bold text-white hover:opacity-90 transition-all cursor-pointer shadow-sm"
                >
                  <span>{pwaPrompt ? "Install PWA App" : "Open Sovereign Web App"}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>

          <div className="text-center text-xs sm:text-sm text-[var(--text)]/75 font-semibold">
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

        {/* SECTION 5: The Sovereign Covenant & Future Pro Roadmap */}
        <section className="pt-4">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-500 shrink-0">
                <Crown size={24} />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--text)]">
                  The Sovereign Covenant & Independent Funding
                </h3>
                <p className="text-xs sm:text-sm font-medium text-[var(--text)]/70">
                  How LifeLog stays 100% independent without venture capital or selling your personal data
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="rounded-xl border border-[var(--ok)]/40 bg-[var(--panel2)]/60 p-5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--ok)]">
                  <CheckCircle2 size={17} />
                  <span>The Core Workspace is Forever Free</span>
                </div>
                <p className="text-xs sm:text-sm text-[var(--text)]/80 leading-relaxed">
                  Your daily life system — unlimited tasks, nested subtasks, focus timers, second brain notes, habit streaks, visual time blocking, SQLite database storage, and direct local P2P sync — will <strong className="text-[var(--text)]">never be locked behind a subscription or paywall</strong>.
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/40 bg-[var(--panel2)]/60 p-5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-500">
                  <Zap size={17} />
                  <span>Future Optional Pro Power Extensions</span>
                </div>
                <p className="text-xs sm:text-sm text-[var(--text)]/80 leading-relaxed">
                  To sustainably fund continuous updates and research, future specialized power add-ons (such as optional encrypted cloud relay fallback for restrictive firewalls, artisan theme packs, and executive team automation) will be available as optional Pro upgrades. <strong className="text-[var(--text)]">The core remains sovereign and yours for life.</strong>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6: Creator Philosophy & Manifesto */}
        <section id="philosophy" className="pt-4 scroll-mt-24">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-10 shadow-sm space-y-6 transition-all duration-300 hover:border-[var(--accent)]">
            <div className="flex items-center gap-4">
              <div
                className="w-13 h-13 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md"
                style={{ background: "var(--accent)" }}
              >
                KP
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--text)]">
                  Why I Built LifeLog
                </h3>
                <p className="text-xs sm:text-sm font-semibold text-[var(--mut)]">
                  By Krish Patel · Founder & Solo Architect
                </p>
              </div>
            </div>

            <div className="space-y-4 text-sm sm:text-base leading-relaxed text-[var(--text)]/80 font-normal">
              <p>
                Modern productivity software has lost its core purpose. Simple daily planners, calendars, and notes have been turned into bloated surveillance engines designed to harvest your telemetry, lock your thoughts behind monthly recurring subscription paywalls, and force your life into closed corporate silos.
              </p>
              <p>
                LifeLog was born out of an uncompromising conviction: <strong className="text-[var(--text)] font-bold">your daily schedule, your honest thoughts, your habits, and your creative output belong to you alone.</strong>
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
                {/* Buy Me a Coffee */}
                <a
                  href="https://buymeacoffee.com/Krrish1411"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold shadow-xs transition-all hover:scale-[1.03] active:scale-[0.97] border border-black/80 cursor-pointer"
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
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--panel2)] px-4 py-2 text-xs sm:text-sm font-bold text-[var(--text)] transition-colors hover:bg-[var(--line)] cursor-pointer"
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
      <footer className="relative z-10 border-t border-[var(--line)] bg-[var(--panel)] py-8 text-center text-xs sm:text-sm font-semibold text-[var(--text)]/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[var(--text)]">LifeLog v{APP_VERSION}</span>
            <span>·</span>
            <span>Created by <strong className="text-[var(--accent)] font-bold">Krish Patel</strong></span>
          </div>
          <div>
            100% Offline Sovereign Sanctuary · Zero Telemetry · Open Architecture
          </div>
        </div>
      </footer>
    </div>
  );
}
