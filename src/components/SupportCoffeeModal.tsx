import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Coffee, Heart, X, Sparkles, Clock, CheckCircle2 } from "lucide-react";
import { fmtDur } from "../utils/core";
import { triggerHaptic } from "../utils/native";

interface SupportCoffeeModalProps {
  open: boolean;
  onClose: () => void;
  completedTasksCount: number;
  totalFocusMinutes: number;
  onSnoozeWeek: () => void;
  onPermanentOptOut: () => void;
}

export function SupportCoffeeModal({
  open,
  onClose,
  completedTasksCount,
  totalFocusMinutes,
  onSnoozeWeek,
  onPermanentOptOut,
}: SupportCoffeeModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const handleBuyCoffee = () => {
    triggerHaptic("medium");
    window.open("https://buymeacoffee.com/Krrish1411", "_blank", "noopener,noreferrer");
    onSnoozeWeek();
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain animate-in fade-in duration-150 select-none"
      style={{
        background: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-[480px] rounded-3xl border flex flex-col overflow-hidden shadow-2xl transition-all my-auto"
        style={{
          background: "var(--panel)",
          borderColor: "color-mix(in srgb, #f59e0b 35%, var(--line))",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--line)",
          color: "var(--text)",
        }}
      >
        {/* Ambient Top Glow */}
        <div
          className="pointer-events-none absolute -top-16 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full blur-3xl opacity-30"
          style={{ background: "#f59e0b" }}
        />

        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-4 shrink-0"
          style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-2xl border text-amber-500 shadow-sm shrink-0"
              style={{ borderColor: "rgba(245, 158, 11, 0.4)", background: "rgba(245, 158, 11, 0.14)" }}
            >
              <Coffee size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-display text-sm sm:text-[15px] font-extrabold tracking-tight truncate">
                  Milestone Reached!
                </h3>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase tracking-wider text-amber-500 shrink-0">
                  Supporter
                </span>
              </div>
              <p className="text-[11px] text-[var(--mut)] truncate">
                Honoring your daily focus & independent software
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg border p-1 text-[var(--mut)] hover:text-[var(--text)] transition hover:border-[var(--accent)] cursor-pointer shrink-0 ml-2"
            style={{ borderColor: "var(--line)", background: "var(--panel)" }}
            aria-label="Close supporter prompt"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-4">
          {/* Milestone Stat Chips */}
          <div
            className="rounded-2xl border p-3 flex items-center justify-around gap-2 text-center"
            style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
          >
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 text-[10.5px] font-bold text-[var(--mut)]">
                <CheckCircle2 size={12} className="text-emerald-500" /> Completed
              </div>
              <div className="font-mono text-[16px] font-extrabold text-[var(--text)] mt-0.5">
                {completedTasksCount} Tasks
              </div>
            </div>

            <div className="h-8 w-px bg-[var(--line)]" />

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 text-[10.5px] font-bold text-[var(--mut)]">
                <Clock size={12} className="text-[var(--accent)]" /> Deep Focus
              </div>
              <div className="font-mono text-[16px] font-extrabold text-[var(--text)] mt-0.5">
                {fmtDur(totalFocusMinutes)}
              </div>
            </div>
          </div>

          {/* Warm Message */}
          <div className="space-y-2 text-xs leading-relaxed text-[var(--mut)]">
            <p>
              You've built genuine momentum. <b className="text-[var(--text)]">LifeLog</b> is 100% free, private, and local-first with zero tracking cookies and zero subscription paywalls.
            </p>
            <p>
              If LifeLog brings honest calm and clarity to your daily workflow, consider buying a coffee to support its independent development and ongoing maintenance.
            </p>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={handleBuyCoffee}
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 px-4 font-bold text-black shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            style={{
              background: "#FFDD00",
              border: "1px solid rgba(0, 0, 0, 0.15)",
              fontSize: "14px",
            }}
          >
            <Coffee size={17} className="text-black shrink-0" />
            <span>Buy Me a Coffee ($5)</span>
          </button>
        </div>

        {/* Footer Actions */}
        <div
          className="flex items-center justify-between border-t px-5 py-3 text-xs shrink-0"
          style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
        >
          <button
            type="button"
            onClick={onPermanentOptOut}
            className="text-[11px] font-semibold text-[var(--mut)] hover:text-[var(--text)] transition cursor-pointer"
            title="Permanently disable this prompt"
          >
            Don't show again
          </button>

          <button
            type="button"
            onClick={onSnoozeWeek}
            className="rounded-xl border px-3 py-1.5 text-xs font-semibold transition hover:border-[var(--accent)] cursor-pointer"
            style={{ borderColor: "var(--line)", background: "var(--panel)", color: "var(--text)" }}
          >
            Remind me in a week
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
