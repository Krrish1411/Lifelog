import { useState } from "react";
import {
  Sparkles,
  Layers,
  Clock,
  Timer,
  Lock,
  Radio,
  Heart,
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
    badge: "Start Calm",
    title: "Welcome to LifeLog! Take a Breath",
    tagline: "LifeLog has lots of powerful tools, but please don't feel overwhelmed. You don't have to use everything right away.",
    icon: Sparkles,
    accentColor: "#6366f1",
    highlights: [
      {
        title: "Start With Just One Task",
        desc: "You don't need a complicated setup. Just write down what matters today, check it off when done, and let your mind rest.",
      },
      {
        title: "Use Only What You Need",
        desc: "Ignore the timer, calendar, or habit heatmaps until you genuinely want them. LifeLog adapts to your style, not the other way around.",
      },
      {
        title: "Everything Stays on Your Machine",
        desc: "No signups, no cloud accounts, and zero tracking. Your personal life and thoughts belong to you alone.",
      },
    ],
    tip: "Look at your Today list first. We added a few friendly tutorial tasks to help you get your footing!",
  },
  {
    badge: "Simple Routine",
    title: "How Your Day Flows in LifeLog",
    tagline: "A gentle 3-step rhythm from morning intentions to evening unwinding.",
    icon: Clock,
    accentColor: "#10b981",
    highlights: [
      {
        title: "1. Morning Plan (Cockpit & Tasks)",
        desc: "Quickly note 2–3 priorities for the day. Group them into projects if you like, or keep them loose.",
      },
      {
        title: "2. Mid-day Focus (Deep Work Stage)",
        desc: "Pick a priority and tap the timer icon. The distraction-free focus screen keeps you immersed and tracks real progress.",
      },
      {
        title: "3. Evening Reflection (Daily Log)",
        desc: "Take 30 seconds to rate your energy and log a quick note. LifeLog automatically preserves your honest timeline.",
      },
    ],
    tip: "Press 'Ctrl + K' (or Cmd+K) anywhere to quickly search, switch views, or run actions.",
  },
  {
    badge: "Deep Work",
    title: "Focus Studio: Your Quiet Zone",
    tagline: "Eliminate distractions and get into the zone with built-in soundscapes and timers.",
    icon: Timer,
    accentColor: "#f59e0b",
    highlights: [
      {
        title: "Pomodoro, Countdown, or Flow",
        desc: "Choose the classic 25-minute cadence, set a custom countdown, or use the open-ended flow stopwatch.",
      },
      {
        title: "Built-In Ambient Soundscapes",
        desc: "Switch on gentle rain, ocean waves, white, pink, or brown noise directly inside the app to block background noise.",
      },
      {
        title: "Honest Pause Tracking",
        desc: "If you take a coffee break or step away, pauses are logged transparently so your focus history reflects reality.",
      },
    ],
    tip: "Tap Spacebar to pause or resume your active focus timer without touching the mouse.",
  },
  {
    badge: "Second Brain & Schedule",
    title: "Notes, Calendar & Quick Mentions",
    tagline: "Connect what you think with what you do — with zero friction.",
    icon: Layers,
    accentColor: "#3b82f6",
    highlights: [
      {
        title: "Dynamic Mentions (@, #, [)",
        desc: "Type '@' in any note to link a task, '#' to link a project, or '[' to wiki-link another note. Instant dropdowns do the searching for you.",
      },
      {
        title: "Drag-and-Drop Visual Calendar",
        desc: "Drag unscheduled tasks directly into time slots on the day grid. Drag them back to the top bar anytime if your day changes.",
      },
      {
        title: "Rich Markdown Knowledge Base",
        desc: "Write notes, attach files or images, and organize folders. Everything is protected with device-bound encryption.",
      },
    ],
    tip: "Check the 'Guides & Principles' folder in Notes for in-depth tutorials and markdown examples.",
  },
  {
    badge: "Sovereign & Free",
    title: "Yours Forever, No Subscriptions",
    tagline: "Independent software engineered for longevity, privacy, and calm.",
    icon: Heart,
    accentColor: "#ec4899",
    highlights: [
      {
        title: "Runs 100% Offline",
        desc: "Powered by a native SQLite / IndexedDB engine. Works flawlessly in airplane mode, off-grid cabins, and subway commutes.",
      },
      {
        title: "Direct Peer-to-Peer Device Sync",
        desc: "Sync laptop and phone directly over your local Wi-Fi without any third-party cloud server or monthly subscription.",
      },
      {
        title: "Crafted by Krish Patel",
        desc: "Built as an independent, transparent personal operating system. If you love it, support ongoing development on Buy Me a Coffee!",
      },
    ],
    tip: "You can revisit this tour or the full Welcome Guide anytime from Settings > General.",
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
