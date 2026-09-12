import { useState } from "react";
import {
  Sparkles,
  Layers,
  Clock,
  Lock,
  Radio,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
} from "lucide-react";
import { useApp } from "../store";

interface Slide {
  badge: string;
  title: string;
  tagline: string;
  icon: typeof Sparkles;
  accentColor: string;
  highlights: { title: string; desc: string }[];
  tip?: string;
}

const TOUR_SLIDES: Slide[] = [
  {
    badge: "Sovereign OS",
    title: "Welcome to LifeLog",
    tagline: "Your offline-first, mathematically private personal operating system.",
    icon: Sparkles,
    accentColor: "#dc2626",
    highlights: [
      {
        title: "100% Local-First & Sovereign",
        desc: "All state resides in IndexedDB on your device. Zero external tracking servers, zero forced cloud accounts.",
      },
      {
        title: "True 24-Hour Life Tracking",
        desc: "Integrates deep work pomodoros, life routines, habit consistency, and overnight sleep into a unified daily log.",
      },
      {
        title: "Crafted with Precision",
        desc: "Designed and engineered by Krish Patel to serve as a benchmark 10/10 productivity powerhouse.",
      },
    ],
    tip: "Press '?' anytime to see global hotkeys, or Cmd/Ctrl+K for the omni-search command palette.",
  },
  {
    badge: "Adaptive Ergonomics",
    title: "5 Dynamic Visual Engines",
    tagline: "Tailor your workspace canvas to your exact psychological state.",
    icon: Layers,
    accentColor: "#3b82f6",
    highlights: [
      {
        title: "Liquid Glass (Modern OS)",
        desc: "Adaptive translucent frosted acrylic with depth layering and dynamic ambient refraction.",
      },
      {
        title: "Desk Suite (Pro Station)",
        desc: "Dedicated persistent desktop side navigation inspired by classic workstation environments.",
      },
      {
        title: "Planify & Control",
        desc: "Todoist-inspired clean split columns or a compact command bar with persistent bottom telemetry.",
      },
      {
        title: "Zen Canvas",
        desc: "Minimalist, distraction-free environment for pure flow state with zero visual clutter.",
      },
    ],
    tip: "Toggle layout engines instantly in Settings or cycle themes in the top navigation bar.",
  },
  {
    badge: "Circadian Rhythm",
    title: "24-Hour Balance & Sleep Attribution",
    tagline: "Accurately maps your whole day across midnight boundaries.",
    icon: Clock,
    accentColor: "#8b5cf6",
    highlights: [
      {
        title: "Cross-Midnight Sleep Partitioning",
        desc: "Sleep logged from 23:00 to 07:00 automatically credits 1h to yesterday and 7h to today without splitting tasks.",
      },
      {
        title: "Balanced Daily Budget",
        desc: "24-hour visual progress bar tracks Sleep (indigo), Focus (crimson), Routines (emerald), and Unallocated time.",
      },
      {
        title: "Automated Daily Standup",
        desc: "One click compiles your entire day into formatted Markdown ready to paste into Slack, GitHub, or your team chat.",
      },
    ],
    tip: "Habits scheduled for today appear as reminder blocks on your timeline and task streams.",
  },
  {
    badge: "Hardware Cryptography",
    title: "Encrypted Notes & Wiki Backlinks",
    tagline: "PBKDF2 + AES-256-GCM hardware encryption with bi-directional knowledge graphs.",
    icon: Lock,
    accentColor: "#10b981",
    highlights: [
      {
        title: "Zero-Knowledge Encryption",
        desc: "Notes are encrypted before touching disk. Only your hardware device passkey can decrypt the plaintext.",
      },
      {
        title: "Bi-Directional Wiki Backlinks",
        desc: "Type [[Note Title]] to cross-reference notes, #Project to link tasks, and @Task to create direct references.",
      },
      {
        title: "KaTeX Math & Markdown",
        desc: "Full LaTeX mathematical equations ($...$ and $$...$$), tables, code syntax highlighting, and media attachments.",
      },
    ],
    tip: "Referenced tasks automatically show interactive note badges in your task planner.",
  },
  {
    badge: "Peer-to-Peer Fabric",
    title: "P2P WebRTC Sync & Focus Streaks",
    tagline: "Direct device-to-device replication without cloud intermediaries.",
    icon: Radio,
    accentColor: "#f59e0b",
    highlights: [
      {
        title: "Decentralized WebRTC DataChannels",
        desc: "Pair phone and laptop via one-time QR codes or short tokens. Syncs encrypted envelopes directly.",
      },
      {
        title: "Primary Authority & 3-Way Diff",
        desc: "Designate your primary device at first sync to prevent conflicts, or inspect diffs with 3-way visual resolution.",
      },
      {
        title: "Focus Day Streak Engine",
        desc: "Top bar streak counts genuine deep focus days — protecting your flow and compounding your daily momentum.",
      },
    ],
    tip: "Support continuous development using the 'Buy Me a Coffee' button in the top navigation bar!",
  },
];

interface OnboardingTourModalProps {
  open: boolean;
  onClose: () => void;
}

export function OnboardingTourModal({ open, onClose }: OnboardingTourModalProps) {
  const { set } = useApp();
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!open) return null;

  const slide = TOUR_SLIDES[currentSlide];
  const IconComponent = slide.icon;
  const isLast = currentSlide === TOUR_SLIDES.length - 1;

  const handleFinish = () => {
    set((s) => ({
      ...s,
      settings: {
        ...s.settings,
        onboardingTourSeen: true,
      },
    }));
    onClose();
  };

  const handleNext = () => {
    if (isLast) {
      handleFinish();
    } else {
      setCurrentSlide((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentSlide((prev) => Math.max(0, prev - 1));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in"
      style={{ background: "rgba(0, 0, 0, 0.65)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleFinish();
      }}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border shadow-2xl transition-all"
        style={{
          background: "var(--panel)",
          borderColor: "var(--line)",
          color: "var(--text)",
        }}
      >
        {/* Top ambient banner */}
        <div
          className="relative px-6 pt-6 pb-4 border-b flex items-start justify-between"
          style={{
            borderColor: "var(--line)",
            background: `radial-gradient(circle at top left, ${slide.accentColor}18, transparent 70%)`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm"
              style={{
                borderColor: `${slide.accentColor}40`,
                background: `${slide.accentColor}15`,
                color: slide.accentColor,
              }}
            >
              <IconComponent size={22} />
            </div>
            <div>
              <span
                className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border inline-block mb-1"
                style={{
                  borderColor: `${slide.accentColor}30`,
                  background: `${slide.accentColor}10`,
                  color: slide.accentColor,
                }}
              >
                {slide.badge} · Slide {currentSlide + 1} of {TOUR_SLIDES.length}
              </span>
              <h2 className="text-xl font-display font-extrabold tracking-tight text-[var(--text)]">
                {slide.title}
              </h2>
            </div>
          </div>

          <button
            onClick={handleFinish}
            className="p-1.5 rounded-xl border transition-colors hover:opacity-75 cursor-pointer"
            style={{ borderColor: "var(--line)", color: "var(--mut)", background: "var(--panel2)" }}
            aria-label="Close tour"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <p className="text-sm font-medium text-[var(--mut)]">
            {slide.tagline}
          </p>

          <div className="grid gap-3 pt-1">
            {slide.highlights.map((h, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl border transition-all"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--panel2)",
                }}
              >
                <div
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `${slide.accentColor}25`, color: slide.accentColor }}
                >
                  <Check size={12} strokeWidth={3} />
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--text)]">{h.title}</div>
                  <div className="text-[12px] leading-relaxed text-[var(--mut)] mt-0.5">{h.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {slide.tip && (
            <div
              className="mt-3 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs border"
              style={{
                borderColor: "var(--line)",
                background: "color-mix(in srgb, var(--accent) 8%, var(--panel2))",
                color: "var(--text)",
              }}
            >
              <Sparkles size={14} className="shrink-0 text-[var(--accent)]" />
              <span className="font-medium text-[11.5px] leading-snug">{slide.tip}</span>
            </div>
          )}
        </div>

        {/* Footer with Step Dots and Navigation */}
        <div
          className="flex items-center justify-between px-6 py-4 border-t"
          style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
        >
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {TOUR_SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentSlide ? "w-6 bg-[var(--accent)]" : "w-2 bg-[var(--line)] hover:bg-[var(--mut)]"
                }`}
                aria-label={`Jump to slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {currentSlide > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all hover:opacity-80 cursor-pointer"
                style={{ borderColor: "var(--line)", background: "var(--panel)", color: "var(--text)" }}
              >
                <ChevronLeft size={14} /> Back
              </button>
            )}

            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
              style={{ background: "var(--accent)" }}
            >
              {isLast ? (
                <>
                  Get Started <Check size={14} />
                </>
              ) : (
                <>
                  Next <ChevronRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
