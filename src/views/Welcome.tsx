import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Flame,
  Globe,
  HardDrive,
  HeartHandshake,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  Lock,
  Play,
  Shield,
  ShieldCheck,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";
import { Btn, cn } from "../components/ui";

interface WelcomeProps {
  onEnter: () => void;
  canDismiss?: boolean;
}

export function WelcomeView({ onEnter, canDismiss = true }: WelcomeProps) {
  const [activeTab, setActiveTab] = useState<number>(0);

  const features = [
    {
      icon: LayoutDashboard,
      title: "Cockpit Dashboard",
      color: "var(--accent)",
      tag: "Command Center",
      desc: "Instant day overview with live time-tracking, today's urgent tasks, energy check-ins, and motivational cues tailored to the hour.",
    },
    {
      icon: ListTodo,
      title: "Tasks & Projects",
      color: "#4fa3a5",
      tag: "Execution",
      desc: "Hierarchical projects, subtask checklists, recurrence engine (daily, weekly, nth-weekday monthly), and time estimates.",
    },
    {
      icon: Timer,
      title: "Focus & Pomodoro",
      color: "#e0b457",
      tag: "Deep Work",
      desc: "Distraction-free Pomodoro, custom countdowns, and flow timers with pause-duration auditing and gentle synthetic bell chimes.",
    },
    {
      icon: Calendar,
      title: "Visual Time Blocking",
      color: "#6fbf8e",
      tag: "Scheduling",
      desc: "Interactive Day, 3-Day, and Week calendar grid. Drag and drop time-blocks directly into your schedule with 24-hour precision.",
    },
    {
      icon: Flame,
      title: "Habit Streaks & Heatmaps",
      color: "#d66853",
      tag: "Consistency",
      desc: "Track routines with 12-week GitHub-style density heatmaps, current vs. best streak counters, and weekly target completions.",
    },
    {
      icon: FileText,
      title: "Encrypted Second Brain",
      color: "#7f9cd6",
      tag: "Knowledge",
      desc: "Full Markdown notes with real-time word counts, interactive checklists, bidirectional tag filtering, and AES-256 client-side encryption.",
    },
    {
      icon: BarChart3,
      title: "Retrospective Analytics",
      color: "#c079b8",
      tag: "Calibration",
      desc: "Estimate-vs-actual task accuracy calibration, hourly focus heatmaps, project time allocations, and day-by-day logs.",
    },
  ];

  const steps = [
    {
      step: "01",
      title: "Plan Your Day in Seconds",
      body: "Start in the Cockpit or Tasks view. Group items into color-coded projects, set rough time estimates, and schedule key commitments into your calendar.",
      icon: ListTodo,
    },
    {
      step: "02",
      title: "Enter the Deep Work Stage",
      body: "Pick a task and tap 'Start Pomodoro' or 'Flow'. The distraction-free focus stage takes over your screen, keeping track of pauses and logging exact timestamps.",
      icon: Timer,
    },
    {
      step: "03",
      title: "Reflect, Calibrate & Repeat",
      body: "At evening wrap-up, record your day rating and check-in note. LifeLog's Reports show your honest estimate-vs-actual calibration ratio and focus patterns.",
      icon: BarChart3,
    },
  ];

  return (
    <div
      className="relative min-h-screen w-full overflow-y-auto bg-[var(--bg)] text-[var(--text)] select-text"
      style={{
        paddingBottom: "max(calc(var(--safe-bottom, 12px) + 24px), 36px)",
      }}
    >
      {/* Background ambient gradient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-40">
        <div
          className="absolute -top-[20%] left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, var(--accent-soft), transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full blur-[100px]"
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 15%, transparent), transparent 70%)" }}
        />
      </div>

      {/* Top Navigation Bar with notch and status bar safe insets */}
      <header
        className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--panel)]/95 backdrop-blur-md select-none transition-colors"
        style={{
          paddingTop: "var(--safe-top, 44px)",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2.5">
            <svg width={30} height={30} viewBox="0 0 32 32" aria-hidden className="shrink-0">
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
              <span className="font-display text-[16px] sm:text-[17px] font-extrabold tracking-tight">LifeLog</span>
              <span className="rounded-full border border-[var(--line)] bg-[var(--panel2)] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[var(--mut)]">
                Local-First
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="#features"
              className="hidden text-[13px] font-bold text-[var(--mut)] transition-colors hover:text-[var(--text)] sm:inline-block"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="hidden text-[13px] font-bold text-[var(--mut)] transition-colors hover:text-[var(--text)] sm:inline-block"
            >
              How It Works
            </a>
            <Btn
              variant="primary"
              size="sm"
              onClick={onEnter}
              className="shadow-lg shadow-[var(--accent)]/20 text-[12px] sm:text-[13px] !py-1.5 sm:!py-2"
            >
              <span>{canDismiss ? "Enter LifeLog" : "Get Started"}</span>
              <ArrowRight size={13} />
            </Btn>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative mx-auto max-w-5xl px-4 sm:px-6 pt-8 sm:pt-14 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3.5 py-1.5 shadow-sm">
          <ShieldCheck size={14} style={{ color: "var(--ok)" }} />
          <span className="text-[12px] font-bold text-[var(--mut)]">
            100% Local · Zero Trackers · AES-256 Encrypted
          </span>
        </div>

        <h1 className="mt-6 font-display text-[40px] font-black tracking-tight sm:text-[56px] sm:leading-[1.12]">
          Your Day, Honestly Remembered.
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-[16px] font-medium leading-relaxed text-[var(--mut)] sm:text-[18px]">
          A sovereign, calm productivity system. Plan daily priorities, immerse in focused work blocks, build enduring habits, and capture encrypted notes — with zero cloud lock-in.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onEnter}
            className="flex items-center gap-2.5 rounded-xl px-7 py-3.5 text-[15px] font-bold text-[var(--on-accent)] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-[var(--accent)]/25"
            style={{ background: "var(--accent)" }}
          >
            <span>Open LifeLog Workspace</span>
            <ArrowRight size={16} />
          </button>
          <a
            href="#features"
            className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-6 py-3.5 text-[15px] font-bold text-[var(--text)] transition-all hover:bg-[var(--panel2)]"
          >
            <span>Explore All Capabilities</span>
          </a>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 text-left">
          {[
            { label: "Zero Cloud Required", desc: "IndexedDB local persistence", icon: HardDrive },
            { label: "Hardware-Key Encryption", desc: "PBKDF2 + AES-256-GCM blobs", icon: Lock },
            { label: "5 Visual Layout Engines", desc: "Glass, Planify, Control, Desk, Zen", icon: Sparkles },
            { label: "Sub-Millisecond Response", desc: "No spinner, instant navigation", icon: Zap },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  <Icon size={18} />
                </div>
                <div className="mt-3 text-[13.5px] font-bold leading-snug">{item.label}</div>
                <div className="mt-1 text-[11.5px] font-semibold text-[var(--mut)]">{item.desc}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feature Showcase Section */}
      <section id="features" className="border-t border-[var(--line)] bg-[var(--panel2)]/50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <span className="text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>
              Engineered for Sovereignty
            </span>
            <h2 className="mt-2 font-display text-[32px] font-extrabold tracking-tight sm:text-[40px]">
              Everything you need. Nothing you don't.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] font-medium text-[var(--mut)]">
              Designed as a unified suite where every session, task, calendar event, and habit flows naturally into your permanent historical record.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="group relative flex flex-col justify-between rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-2xl transition-transform group-hover:scale-110"
                        style={{ background: `color-mix(in srgb, ${f.color} 14%, transparent)`, color: f.color }}
                      >
                        <Icon size={22} />
                      </div>
                      <span
                        className="rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider"
                        style={{ background: "var(--bg)", color: "var(--mut)", border: "1px solid var(--line)" }}
                      >
                        {f.tag}
                      </span>
                    </div>
                    <h3 className="mt-5 font-display text-[18px] font-bold">{f.title}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-[var(--mut)]">{f.desc}</p>
                  </div>

                  <div className="mt-6 flex items-center gap-1 text-[12px] font-bold" style={{ color: f.color }}>
                    <span>Included offline</span>
                    <CheckCircle2 size={13} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works (3 Steps) */}
      <section id="how-it-works" className="border-t border-[var(--line)] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <span className="text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>
              The LifeLog Cycle
            </span>
            <h2 className="mt-2 font-display text-[32px] font-extrabold tracking-tight sm:text-[38px]">
              How to structure an honest day
            </h2>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              return (
                <div
                  key={idx}
                  className="relative flex flex-col rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-7 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[30px] font-black tracking-tighter" style={{ color: "var(--accent)" }}>
                      {s.step}
                    </span>
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: "var(--panel2)", color: "var(--mut)", border: "1px solid var(--line)" }}
                    >
                      <Icon size={18} />
                    </div>
                  </div>
                  <h3 className="mt-5 font-display text-[18px] font-bold">{s.title}</h3>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--mut)]">{s.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Privacy Guarantee Box */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div
          className="rounded-3xl border p-8 text-center sm:p-10"
          style={{
            borderColor: "color-mix(in srgb, var(--accent) 35%, var(--line))",
            background: "color-mix(in srgb, var(--panel) 90%, var(--accent-soft))",
          }}
        >
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <KeyRound size={26} />
          </div>
          <h2 className="mt-4 font-display text-[26px] font-bold">Cryptographically Isolated to Your Device</h2>
          <p className="mx-auto mt-2.5 max-w-xl text-[14px] leading-relaxed text-[var(--mut)]">
            LifeLog transmits zero telemetric packets. All tasks, notes, habits, and sessions are saved locally in your browser's IndexedDB. Encrypted backups protect private notes with PBKDF2 salt and AES-256-GCM encryption.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onEnter}
              className="flex items-center gap-2 rounded-xl px-8 py-3.5 text-[15px] font-bold text-[var(--on-accent)] transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[var(--accent)]/30"
              style={{ background: "var(--accent)" }}
            >
              <span>Get Started Now</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--line)] py-8 text-center text-[12px] font-semibold text-[var(--mut)]">
        <p>LifeLog · Crafted by <span className="text-[var(--accent)] font-bold">Krish Patel</span> · 100% Local-First Sanctuary</p>
      </footer>
    </div>
  );
}
