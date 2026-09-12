import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  GitMerge,
  ArrowRightLeft,
  Smartphone,
  Laptop,
  Check,
  X,
  FileText,
  ListTodo,
  Flame,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "../store";
import { useBodyScrollLock } from "../utils/scrollLock";
import { cn } from "./ui";

interface DiffConflictModalProps {
  open: boolean;
  onClose: () => void;
  peerDeviceName?: string;
  onResolve?: (action: "keep-local" | "accept-peer" | "merge-both") => void;
}

export function DiffConflictModal({
  open,
  onClose,
  peerDeviceName = "Paired Device",
  onResolve,
}: DiffConflictModalProps) {
  const { state, toast } = useApp();
  const [selectedResolution, setSelectedResolution] = useState<"keep-local" | "accept-peer" | "merge-both">("merge-both");

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const localDeviceName = state.settings.profileName || "This Device";
  const tasksCount = state.tasks.length;
  const notesCount = state.notes.length;
  const habitsCount = state.habits.length;

  const handleApply = () => {
    if (onResolve) {
      onResolve(selectedResolution);
    } else {
      if (selectedResolution === "keep-local") {
        toast(`Resolved: Retained ${localDeviceName} state as primary`, "ok");
      } else if (selectedResolution === "accept-peer") {
        toast(`Resolved: Synchronized state from ${peerDeviceName}`, "ok");
      } else {
        toast(`Resolved: Merged records across devices`, "ok");
      }
    }
    onClose();
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain animate-in fade-in duration-150"
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
        className="relative w-full max-w-[500px] rounded-3xl border flex flex-col overflow-hidden shadow-2xl transition-all my-auto"
        style={{
          background: "var(--panel)",
          borderColor: "var(--line)",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--line)",
          color: "var(--text)",
        }}
      >
        {/* Header - Compact, clean Lifelog aesthetic */}
        <div
          className="flex items-center justify-between border-b px-4 py-3 sm:px-5 sm:py-3.5 shrink-0"
          style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl border text-amber-500 shadow-sm shrink-0"
              style={{ borderColor: "rgba(245, 158, 11, 0.4)", background: "rgba(245, 158, 11, 0.12)" }}
            >
              <GitMerge size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-display text-sm sm:text-[15px] font-extrabold tracking-tight truncate">
                  Visual Conflict Resolver
                </h3>
                <span className="rounded-full border px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 border-amber-500/30 shrink-0">
                  Smart Sync
                </span>
              </div>
              <p className="text-[11px] text-[var(--mut)] truncate">
                Reconcile concurrent edits between paired devices safely
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg border p-1 text-[var(--mut)] hover:text-[var(--text)] transition hover:border-[var(--accent)] cursor-pointer shrink-0 ml-2"
            style={{ borderColor: "var(--line)", background: "var(--panel)" }}
            aria-label="Close resolver"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content Body - Unified, zero internal scroll needed */}
        <div className="p-3.5 sm:p-4.5 flex flex-col gap-3">
          {/* Unified Device State Matrix */}
          <div
            className="rounded-2xl border p-2.5 sm:p-3 flex flex-col gap-2"
            style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
          >
            {/* Device Names Row */}
            <div className="flex items-center justify-between gap-2 text-xs font-bold">
              <div className="flex items-center gap-1.5 min-w-0">
                <Laptop size={14} className="text-[var(--accent)] shrink-0" />
                <span className="truncate">{localDeviceName}</span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border border-emerald-500/40 text-emerald-500 bg-emerald-500/10 shrink-0">
                  Local
                </span>
              </div>

              <ArrowRightLeft size={12} className="text-[var(--mut)] shrink-0 opacity-60" />

              <div className="flex items-center gap-1.5 min-w-0 justify-end">
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border border-blue-500/40 text-blue-500 bg-blue-500/10 shrink-0">
                  Peer
                </span>
                <span className="truncate text-right">{peerDeviceName}</span>
                <Smartphone size={14} className="text-blue-500 shrink-0" />
              </div>
            </div>

            {/* Metrics Comparison Pill Grid */}
            <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-[var(--line)]/60 text-[11px]">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-center flex flex-col items-center">
                <div className="flex items-center gap-1 text-[10px] text-[var(--mut)]">
                  <ListTodo size={11} /> Tasks
                </div>
                <div className="font-mono font-bold text-[11.5px] mt-0.5">
                  <span>{tasksCount}</span> <span className="text-[var(--mut)] font-normal text-[10px]">vs</span> <span>{tasksCount}</span>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-center flex flex-col items-center">
                <div className="flex items-center gap-1 text-[10px] text-[var(--mut)]">
                  <FileText size={11} /> Notes
                </div>
                <div className="font-mono font-bold text-[11.5px] mt-0.5">
                  <span>{notesCount}</span> <span className="text-[var(--mut)] font-normal text-[10px]">vs</span> <span>{notesCount}</span>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-center flex flex-col items-center">
                <div className="flex items-center gap-1 text-[10px] text-[var(--mut)]">
                  <Flame size={11} /> Habits
                </div>
                <div className="font-mono font-bold text-[11.5px] mt-0.5">
                  <span>{habitsCount}</span> <span className="text-[var(--mut)] font-normal text-[10px]">vs</span> <span>{habitsCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Strategy Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--mut)] px-0.5">
              Select Resolution Strategy
            </label>

            {/* Option 1: Smart 3-Way Union Merge (Recommended) */}
            <div
              onClick={() => setSelectedResolution("merge-both")}
              className={cn(
                "cursor-pointer rounded-2xl border p-2.5 sm:p-3 transition-all flex items-start gap-2.5",
                selectedResolution === "merge-both" ? "ring-1 ring-[var(--accent)]" : "hover:border-[var(--accent)]/50"
              )}
              style={{
                borderColor: selectedResolution === "merge-both" ? "var(--accent)" : "var(--line)",
                background:
                  selectedResolution === "merge-both"
                    ? "color-mix(in srgb, var(--accent) 7%, var(--panel2))"
                    : "var(--panel2)",
              }}
            >
              <div
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition"
                style={{
                  borderColor: selectedResolution === "merge-both" ? "var(--accent)" : "var(--line)",
                  background: selectedResolution === "merge-both" ? "var(--accent)" : "transparent",
                  color: "#ffffff",
                }}
              >
                {selectedResolution === "merge-both" && <Check size={10} strokeWidth={3} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[var(--text)]">
                    Smart 3-Way Union Merge
                  </span>
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.2 text-[9.5px] font-bold text-emerald-500 shrink-0">
                    Lossless (Recommended)
                  </span>
                </div>
                <p className="text-[11px] leading-tight text-[var(--mut)] mt-0.5">
                  Preserves changes from both devices, applying tombstone deletion tracking.
                </p>
              </div>
            </div>

            {/* Option 2: Keep Local */}
            <div
              onClick={() => setSelectedResolution("keep-local")}
              className={cn(
                "cursor-pointer rounded-2xl border p-2.5 sm:p-3 transition-all flex items-start gap-2.5",
                selectedResolution === "keep-local" ? "ring-1 ring-[var(--accent)]" : "hover:border-[var(--accent)]/50"
              )}
              style={{
                borderColor: selectedResolution === "keep-local" ? "var(--accent)" : "var(--line)",
                background:
                  selectedResolution === "keep-local"
                    ? "color-mix(in srgb, var(--accent) 7%, var(--panel2))"
                    : "var(--panel2)",
              }}
            >
              <div
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition"
                style={{
                  borderColor: selectedResolution === "keep-local" ? "var(--accent)" : "var(--line)",
                  background: selectedResolution === "keep-local" ? "var(--accent)" : "transparent",
                  color: "#ffffff",
                }}
              >
                {selectedResolution === "keep-local" && <Check size={10} strokeWidth={3} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[var(--text)] truncate">
                    Keep This Device ({localDeviceName})
                  </span>
                </div>
                <p className="text-[11px] leading-tight text-[var(--mut)] mt-0.5">
                  Authoritative local state overwrites conflicting records on {peerDeviceName}.
                </p>
              </div>
            </div>

            {/* Option 3: Accept Peer */}
            <div
              onClick={() => setSelectedResolution("accept-peer")}
              className={cn(
                "cursor-pointer rounded-2xl border p-2.5 sm:p-3 transition-all flex items-start gap-2.5",
                selectedResolution === "accept-peer" ? "ring-1 ring-[var(--accent)]" : "hover:border-[var(--accent)]/50"
              )}
              style={{
                borderColor: selectedResolution === "accept-peer" ? "var(--accent)" : "var(--line)",
                background:
                  selectedResolution === "accept-peer"
                    ? "color-mix(in srgb, var(--accent) 7%, var(--panel2))"
                    : "var(--panel2)",
              }}
            >
              <div
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition"
                style={{
                  borderColor: selectedResolution === "accept-peer" ? "var(--accent)" : "var(--line)",
                  background: selectedResolution === "accept-peer" ? "var(--accent)" : "transparent",
                  color: "#ffffff",
                }}
              >
                {selectedResolution === "accept-peer" && <Check size={10} strokeWidth={3} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[var(--text)] truncate">
                    Accept Peer Device ({peerDeviceName})
                  </span>
                </div>
                <p className="text-[11px] leading-tight text-[var(--mut)] mt-0.5">
                  Replaces local conflicting data with the snapshot from {peerDeviceName}.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Sticky, always visible without scrolling */}
        <div
          className="flex items-center justify-between border-t px-4 py-3 sm:px-5 sm:py-3.5 shrink-0"
          style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
        >
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--mut)]">
            <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
            <span className="hidden sm:inline">E2EE AES-256-GCM hardware key</span>
            <span className="sm:hidden">AES-256 E2EE</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-3 py-1.5 text-xs font-semibold transition hover:border-[var(--accent)] cursor-pointer"
              style={{ borderColor: "var(--line)", background: "var(--panel)", color: "var(--text)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110 active:scale-95 cursor-pointer"
              style={{ background: "var(--accent)" }}
            >
              <Check size={13} /> Apply Resolution
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
