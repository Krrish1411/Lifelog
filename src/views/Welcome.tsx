import { useState } from "react";
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
  Radio,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";
import { Btn, cn } from "../components/ui";
import { APP_VERSION } from "../types";

interface WelcomeProps {
  onEnter: () => void;
  canDismiss?: boolean;
}

export function WelcomeView({ onEnter, canDismiss = true }: WelcomeProps) {
  const [activePillar, setActivePillar] = useState<number>(0);

  const pillars = [
    {
      icon: ListTodo,
      title: "Tasks & Habits Engine",
      color: "var(--accent)",
      tag: "Execution",
      desc: "Structured execution with nested subtask checklists, dynamic @/#/[ mentions, time estimates, and flexible recurrence (daily, weekly, monthly nth-weekday).",
      bullets: ["Nested subtasks & checklists", "Dynamic link dropdowns (@/#/[)", "Drag & drop to calendar", "Custom project tags & priorities"],
    },
    {
      icon: Timer,
      title: "Deep Focus Studio",
      color: "#f59e0b",
      tag: "Deep Work",
      desc: "Distraction-free Pomodoro, Flow timers, and custom countdowns. Paired with offline soundscapes and strict pause-duration auditing.",
      bullets: ["Pomodoro, Flow & Countdowns", "Synthesized bell & chime audio", "Pause-duration audit log", "Task-linked focus sessions"],
    },
    {
      icon: FileText,
      title: "Sovereign Second Brain",
      color: "#3b82f6",
      tag: "Knowledge",
      desc: "Local Markdown notes with live preview, interactive checkboxes, file attachments, and instant dynamic cross-linking to tasks and projects.",
      bullets: ["Full Markdown formatting", "Dynamic Wiki-links & Mentions", "Local file & media attachments", "Client-side AES-256 encryption"],
    },
    {
      icon: Calendar,
      title: "Visual Time Blocking",
      color: "#10b981",
      tag: "Scheduling",
      desc: "Interactive 24-hour Day, 3-Day, and Week calendar grid. Drag tasks onto the timeline to block focus time, and drag back to unblock instantly.",
      bullets: ["Drag & drop schedule planner", "Habit projection into calendar", "Interactive 15-minute snapping", "Multi-day agenda layouts"],
    },
    {
      icon: Flame,
      title: "Habit Streaks & Heatmaps",
      color: "#ef4444",
      tag: "Consistency",
      desc: "Build lasting routines with GitHub-style 12-week density heatmaps, current vs. best streak tracking, and customizable weekly targets.",
      bullets: ["12-week visual heatmaps", "Current & all-time best streaks", "Habits projected to Today tasks", "Custom target days per week"],
    },
    {
      icon: BarChart3,
      title: "Calibrated Analytics & PDF",
      color: "#8b5cf6",
      tag: "Calibration",
      desc: "Learn how you actually work. Track estimate vs. actual completion ratios, hourly energy curves, and export concise, lag-free executive PDF reports.",
      bullets: ["Estimate-vs-actual calibration", "Selective task bundling for PDF", "Hourly focus heatmaps", "Energy & mood retrospectives"],
    },
    {
      icon: Radio,
      title: "Cryptographic P2P Sync",
      color: "#06b6d4",
      tag: "Zero-Cloud",
      desc: "Direct encrypted device-to-device synchronization over your local Wi-Fi. Zero relay databases, zero third-party cloud accounts, 100% private.",
      bullets: ["Direct WebRTC / DTLS sockets", "Zero cloud server storage", "Differential conflict resolution", "Native SQLite WAL persistence"],
    },
  ];

  const platforms = [
    {
      os: "Windows",
      icon: Monitor,
      type: "64-bit Installer & Portable",
      ext: ".exe",
      href: "https://github.com/Krrish1411/Lifelog-Releases/releases/latest",
      badge: "Production Ready",
    },
    {
      os: "macOS",
      icon: Monitor,
      type: "Apple Silicon & Intel DMG",
      ext: ".dmg",
      href: "https://github.com/Krrish1411/Lifelog-Releases/releases/latest",
      badge: "Universal",
    },
    {
      os: "Linux",
      icon: Cpu,
      type: "Universal AppImage & Deb",
      ext: ".AppImage",
      href: "https://github.com/Krrish1411/Lifelog-Releases/releases/latest",
      badge: "Self-Contained",
    },
    {
      os: "Android",
      icon: Smartphone,
      type: "Native Arm64 APK",
      ext: ".apk",
      href: "https://github.com/Krrish1411/Lifelog-Releases/releases/latest",
      badge: "Offline APK",
    },
  ];

  return (
    <div
      className="fixed inset-0 h-screen w-full overflow-y-auto bg-[var(--bg)] text-[var(--text)] select-text z-50 overscroll-y-auto cursor-default"
      style={{
        paddingBottom: "max(calc(var(--safe-bottom, 12px) + 24px), 48px)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-30 select-none">
        <div
          className="absolute -top-[20%] left-1/2 h-[650px] w-[900px] -translate-x-1/2 rounded-full blur-[140px]"
          style={{ background: "radial-gradient(circle, var(--accent-soft), transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-10%] right-[-5%] h-[500px] w-[600px] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 20%, transparent), transparent 70%)" }}
        />
      </div>

      {/* Top Header Navigation Bar */}
      <header
        className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--panel)]/90 backdrop-blur-md select-none transition-colors"
        style={{ paddingTop: "var(--safe-top, 0px)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2.5">
            <svg width={32} height={32} viewBox="0 0 32 32" aria-hidden className="shrink-0">
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
            <div className="flex items-center gap-1.5">
              <span className="font-display text-[17px] font-black tracking-tight">LifeLog</span>
              <span className="rounded-full border border-[var(--line)] bg-[var(--panel2)] px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--accent)]">
                v{APP_VERSION} Sovereign
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <a
              href="#pillars"
              className="hidden md:inline-block text-[13px] font-bold text-[var(--mut)] hover:text-[var(--text)] transition-colors"
            >
              Capabilities
            </a>
            <a
              href="#downloads"
              className="hidden md:inline-block text-[13px] font-bold text-[var(--mut)] hover:text-[var(--text)] transition-colors"
            >
              Downloads
            </a>
            <a
              href="#philosophy"
              className="hidden md:inline-block text-[13px] font-bold text-[var(--mut)] hover:text-[var(--text)] transition-colors"
            >
              Philosophy
            </a>

            {/* Buy Me a Coffee Top Bar Button */}
            <a
              href="https://buymeacoffee.com/Krrish1411"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[18px] font-normal shadow-xs transition-all hover:scale-[1.03] active:scale-[0.97] border border-black/80"
              style={{
                background: "#FFDD00",
                color: "#000000",
                fontFamily: "'Cookie', cursive",
                lineHeight: 1.1,
              }}
              title="Support independent development on Buy Me a Coffee"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 8h-1V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v10c0 2.2 1.8 4 4 4h10c2.2 0 4-1.8 4-4v-2h1c1.7 0 3-1.3 3-3s-1.3-3-3-3zm-3 8c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V6h14v10zm3-4h-1v-2h1c.6 0 1 .4 1 1s-.4 1-1 1z" fill="#000000"/>
                <path d="M6 9h2v4H6zm4 0h2v4h-2zm4 0h2v4h-2z" fill="#ffffff"/>
              </svg>
              <span>Buy me a coffee</span>
            </a>

            <Btn
              variant="primary"
              size="sm"
              onClick={onEnter}
              className="shadow-md shadow-[var(--accent)]/20 text-[12.5px] font-bold !py-1.5"
            >
              <span>{canDismiss ? "Launch Workspace" : "Get Started"}</span>
              <ArrowRight size={13} />
            </Btn>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative mx-auto max-w-5xl px-4 sm:px-6 pt-10 sm:pt-16 pb-14 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 py-1.5 shadow-xs">
          <ShieldCheck size={14} style={{ color: "var(--ok)" }} />
          <span className="text-[12px] font-bold text-[var(--mut)]">
            Zero Telemetry · Native SQLite WAL · AES-256-GCM · Pure P2P Sync
          </span>
        </div>

        <h1 className="mt-6 font-display text-[38px] sm:text-[54px] font-black tracking-tight leading-[1.12]">
          The Sovereign Personal Operating System.
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-[16px] sm:text-[18px] font-medium leading-relaxed text-[var(--mut)]">
          Plan daily priorities, enter distraction-free focus flow, cultivate lasting habits, and capture encrypted second-brain notes. 100% offline, with zero vendor cloud lock-in.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <button
            onClick={onEnter}
            className="flex items-center gap-2 rounded-xl px-7 py-3 text-[14.5px] font-bold text-[var(--on-accent)] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[var(--accent)]/25"
            style={{ background: "var(--accent)" }}
          >
            <span>Launch LifeLog Workspace</span>
            <ArrowRight size={16} />
          </button>
          <a
            href="#downloads"
            className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-3 text-[14px] font-bold text-[var(--text)] transition-all hover:bg-[var(--panel2)]"
          >
            <Download size={15} style={{ color: "var(--accent)" }} />
            <span>Download Desktop & Mobile App</span>
          </a>
        </div>

        {/* 4 Sovereign Guarantees */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
          {[
            { label: "100% Offline-First", desc: "Native SQLite WAL engine with instant sub-5ms boots.", icon: HardDrive },
            { label: "Cryptographic Vault", desc: "Device-bound AES-256-GCM with PBKDF2 salt.", icon: Lock },
            { label: "5 Visual Layouts", desc: "Glass, Planify, Control, Desk, and Zen engines.", icon: Layers },
            { label: "Zero Subscriptions", desc: "Free, open, private. Forever yours to keep.", icon: Heart },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-xs"
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  <Icon size={16} />
                </div>
                <div className="mt-2.5 text-[13px] font-bold leading-snug">{item.label}</div>
                <div className="mt-1 text-[11px] font-semibold text-[var(--mut)] leading-normal">{item.desc}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 7 Core Feature Pillars */}
      <section id="pillars" className="border-t border-[var(--line)] bg-[var(--panel2)]/40 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>
              Engineered for Sovereignty
            </span>
            <h2 className="mt-2 font-display text-[30px] sm:text-[38px] font-black tracking-tight">
              7 Integrated Pillars. Zero Friction.
            </h2>
            <p className="mx-auto mt-2.5 max-w-2xl text-[14.5px] font-medium text-[var(--mut)]">
              Designed as a unified operating system where tasks, calendar schedules, focus sessions, habits, and notes seamlessly connect.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {pillars.map((p, i) => {
              const Icon = p.icon;
              return (
                <div
                  key={i}
                  className="flex flex-col justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5.5 shadow-xs transition-all hover:border-[var(--accent)] hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{ background: `color-mix(in srgb, ${p.color} 15%, transparent)`, color: p.color }}
                      >
                        <Icon size={20} />
                      </div>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: "var(--bg)", color: "var(--mut)", border: "1px solid var(--line)" }}
                      >
                        {p.tag}
                      </span>
                    </div>
                    <h3 className="mt-4 font-display text-[17px] font-bold">{p.title}</h3>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--mut)]">{p.desc}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--line)]/60">
                    <ul className="space-y-1">
                      {p.bullets.map((b, bi) => (
                        <li key={bi} className="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--text)]">
                          <CheckCircle2 size={12} style={{ color: p.color }} className="shrink-0" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Downloads Hub */}
      <section id="downloads" className="border-t border-[var(--line)] py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>
              Cross-Platform Ecosystem
            </span>
            <h2 className="mt-2 font-display text-[30px] sm:text-[38px] font-black tracking-tight">
              Get LifeLog for Your Platform
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-[14px] font-medium text-[var(--mut)]">
              Pre-built, signed binary releases for Windows, macOS, Linux, and Android. Sync seamlessly across devices using direct local P2P.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {platforms.map((pl, idx) => {
              const Icon = pl.icon;
              return (
                <a
                  key={idx}
                  href={pl.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col justify-between p-5 rounded-2xl border border-[var(--line)] bg-[var(--panel)] transition-all hover:scale-[1.02] hover:border-[var(--accent)] hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-[var(--line)] bg-[var(--panel2)] text-[var(--accent)]">
                        <Icon size={20} />
                      </div>
                      <span className="chip !py-0.5 text-[10px] font-mono">{pl.badge}</span>
                    </div>
                    <div className="mt-4 font-display text-[16px] font-bold">{pl.os}</div>
                    <div className="text-[11.5px] font-semibold text-[var(--mut)] mt-0.5">{pl.type}</div>
                  </div>
                  <div className="mt-5 flex items-center justify-between pt-3 border-t border-[var(--line)] text-xs font-bold text-[var(--accent)]">
                    <span>Download {pl.ext}</span>
                    <Download size={13} />
                  </div>
                </a>
              );
            })}
          </div>

          <div className="mt-6 text-center text-[12px] font-semibold text-[var(--mut)]">
            Looking for source code, checksums, or previous releases? Visit the{" "}
            <a
              href="https://github.com/Krrish1411/Lifelog-Releases"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] underline font-bold"
            >
              Public Releases Repository
            </a>.
          </div>
        </div>
      </section>

      {/* Philosophy & Creator Section */}
      <section id="philosophy" className="border-t border-[var(--line)] bg-[var(--panel2)]/30 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-7 sm:p-10 shadow-sm">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-md"
                style={{ background: "var(--accent)" }}
              >
                KP
              </div>
              <div>
                <h3 className="text-[17px] font-extrabold tracking-tight">Why I Built LifeLog</h3>
                <p className="text-[12px] font-semibold text-[var(--mut)]">By Krish Patel · Founder & Solo Architect</p>
              </div>
            </div>

            <div className="mt-5 space-y-3.5 text-[13.5px] leading-relaxed text-[var(--mut)] font-medium">
              <p>
                Modern productivity software has lost its way. Simple task managers and calendars have morphed into bloated cloud services designed to harvest your telemetry, lock your personal memories behind monthly recurring subscriptions, and trap your schedule inside closed proprietary ecosystems.
              </p>
              <p>
                LifeLog was born out of an uncompromising conviction: <strong className="text-[var(--text)]">your daily schedule, your thoughts, your personal habits, and your honest retrospectives belong to you alone.</strong>
              </p>
              <p>
                There are no cloud databases. There are no tracking pixels or telemetry engines. LifeLog writes directly to local SQLite WAL files and IndexedDB on your machine. When you synchronize multiple devices, they communicate directly via peer-to-peer encrypted WebRTC sockets over your own network.
              </p>
              <p className="pt-1 text-[13px] italic text-[var(--text)] font-semibold">
                "LifeLog is designed to run for decades without requiring a single server to stay online. Thank you for embracing sovereign personal computing."
              </p>
            </div>

            <div className="mt-7 pt-5 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <a
                  href="https://buymeacoffee.com/Krrish1411"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[18px] font-normal shadow-xs transition-all hover:scale-[1.03] active:scale-[0.97] border border-black/80"
                  style={{
                    background: "#FFDD00",
                    color: "#000000",
                    fontFamily: "'Cookie', cursive",
                    lineHeight: 1.1,
                  }}
                >
                  <Coffee size={15} className="text-black" />
                  <span>Buy me a coffee</span>
                </a>
                <a
                  href="mailto:getlifelog@proton.me"
                  className="btn btn-ghost !text-xs !py-2 gap-1.5"
                >
                  <Mail size={13} />
                  <span>getlifelog@proton.me</span>
                </a>
              </div>

              <Btn variant="primary" onClick={onEnter} className="font-bold gap-1.5">
                <span>Enter Workspace</span>
                <ArrowRight size={13} />
              </Btn>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--line)] py-8 text-center text-[12px] font-semibold text-[var(--mut)]">
        <p>
          LifeLog v{APP_VERSION} · Crafted with precision by{" "}
          <span className="text-[var(--accent)] font-extrabold tracking-tight">Krish Patel</span> · Sovereign Offline Sanctuary
        </p>
      </footer>
    </div>
  );
}
