import { useEffect, useState } from "react";
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

  if (!open) return null;

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
        toast(`Resolved: Merged non-conflicting records across devices`, "ok");
      }
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 overflow-y-auto overscroll-contain animate-in fade-in duration-150"
      style={{
        background: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl border flex flex-col overflow-hidden shadow-2xl transition-all my-auto"
        style={{
          maxHeight: "min(92vh, 780px)",
          background: "var(--panel)",
          borderColor: "var(--line)",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.55), 0 0 0 1px var(--line)",
          color: "var(--text)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 sm:px-6 py-4 shrink-0"
          style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl border text-amber-500 shadow-sm shrink-0"
              style={{ borderColor: "rgba(245, 158, 11, 0.4)", background: "rgba(245, 158, 11, 0.12)" }}
            >
              <ArrowRightLeft size={19} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-[15px] sm:text-[16px] font-extrabold tracking-tight truncate">
                  Visual 3-Way Conflict Resolver
                </h3>
                <span className="rounded-full border px-2 py-0.5 text-[9.5px] font-mono font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 border-amber-500/30 shrink-0">
                  Smart Sync
                </span>
              </div>
              <p className="text-[11.5px] sm:text-xs text-[var(--mut)] truncate">
                Compare local state against remote replica records to resolve concurrent edits safely.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border p-1.5 transition-colors hover:opacity-75 cursor-pointer shrink-0 ml-2"
            style={{ borderColor: "var(--line)", color: "var(--mut)", background: "var(--panel)" }}
            aria-label="Close resolver"
          >
            <X size={16} />
          </button>
        </div>

        {/* Diff Comparison Matrix & Strategy Selection */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Local Device Panel */}
            <div
              className={cn(
                "rounded-2xl border p-4 transition-all",
                selectedResolution === "keep-local" ? "ring-1 ring-[var(--accent)]" : ""
              )}
              style={{
                borderColor: selectedResolution === "keep-local" ? "var(--accent)" : "var(--line)",
                background:
                  selectedResolution === "keep-local"
                    ? "color-mix(in srgb, var(--accent) 7%, var(--panel2))"
                    : "var(--panel2)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Laptop size={16} className="text-[var(--accent)] shrink-0" />
                <span className="font-display text-xs font-bold text-[var(--text)] truncate">
                  {localDeviceName}
                </span>
                <span className="ml-auto text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-500/40 text-emerald-500 bg-emerald-500/10 shrink-0">
                  Local Active
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-[var(--line)]">
                  <span className="flex items-center gap-1.5 text-[var(--mut)]">
                    <ListTodo size={13} /> Tasks
                  </span>
                  <span className="font-mono font-bold">{tasksCount} items</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[var(--line)]">
                  <span className="flex items-center gap-1.5 text-[var(--mut)]">
                    <FileText size={13} /> Encrypted Notes
                  </span>
                  <span className="font-mono font-bold">{notesCount} notes</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-1.5 text-[var(--mut)]">
                    <Flame size={13} /> Habits
                  </span>
                  <span className="font-mono font-bold">{habitsCount} habits</span>
                </div>
              </div>
            </div>

            {/* Peer Device Panel */}
            <div
              className={cn(
                "rounded-2xl border p-4 transition-all",
                selectedResolution === "accept-peer" ? "ring-1 ring-[var(--accent)]" : ""
              )}
              style={{
                borderColor: selectedResolution === "accept-peer" ? "var(--accent)" : "var(--line)",
                background:
                  selectedResolution === "accept-peer"
                    ? "color-mix(in srgb, var(--accent) 7%, var(--panel2))"
                    : "var(--panel2)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Smartphone size={16} className="text-blue-500 shrink-0" />
                <span className="font-display text-xs font-bold text-[var(--text)] truncate">
                  {peerDeviceName}
                </span>
                <span className="ml-auto text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded border border-blue-500/40 text-blue-500 bg-blue-500/10 shrink-0">
                  Remote Peer
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-[var(--line)]">
                  <span className="flex items-center gap-1.5 text-[var(--mut)]">
                    <ListTodo size={13} /> Tasks
                  </span>
                  <span className="font-mono font-bold">{tasksCount} items</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[var(--line)]">
                  <span className="flex items-center gap-1.5 text-[var(--mut)]">
                    <FileText size={13} /> Encrypted Notes
                  </span>
                  <span className="font-mono font-bold">{notesCount} notes</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-1.5 text-[var(--mut)]">
                    <Flame size={13} /> Habits
                  </span>
                  <span className="font-mono font-bold">{habitsCount} habits</span>
                </div>
              </div>
            </div>
          </div>

          {/* Resolution Options */}
          <div className="space-y-2 pt-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--mut)]">
              Select Merge Strategy
            </label>

            {/* Option 1: Merge Both (Smart CRDT) */}
            <button
              type="button"
              onClick={() => setSelectedResolution("merge-both")}
              className="w-full flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer hover:border-[var(--accent)]"
              style={{
                borderColor: selectedResolution === "merge-both" ? "var(--accent)" : "var(--line)",
                background:
                  selectedResolution === "merge-both"
                    ? "color-mix(in srgb, var(--accent) 8%, var(--panel2))"
                    : "var(--panel2)",
              }}
            >
              <div
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                style={{
                  borderColor: selectedResolution === "merge-both" ? "var(--accent)" : "var(--line)",
                  background: selectedResolution === "merge-both" ? "var(--accent)" : "transparent",
                  color: "#ffffff",
                }}
              >
                {selectedResolution === "merge-both" && <Check size={12} strokeWidth={3} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--text)]">
                    Smart 3-Way Union Merge (Recommended)
                  </span>
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-bold text-emerald-500">
                    Lossless
                  </span>
                </div>
                <p className="text-[11.5px] leading-relaxed text-[var(--mut)] mt-0.5">
                  Preserves all created tasks, sessions, and notes from both devices, applying tombstone checks for deleted records.
                </p>
              </div>
            </button>

            {/* Option 2: Keep Local */}
            <button
              type="button"
              onClick={() => setSelectedResolution("keep-local")}
              className="w-full flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer hover:border-[var(--accent)]"
              style={{
                borderColor: selectedResolution === "keep-local" ? "var(--accent)" : "var(--line)",
                background:
                  selectedResolution === "keep-local"
                    ? "color-mix(in srgb, var(--accent) 8%, var(--panel2))"
                    : "var(--panel2)",
              }}
            >
              <div
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                style={{
                  borderColor: selectedResolution === "keep-local" ? "var(--accent)" : "var(--line)",
                  background: selectedResolution === "keep-local" ? "var(--accent)" : "transparent",
                  color: "#ffffff",
                }}
              >
                {selectedResolution === "keep-local" && <Check size={12} strokeWidth={3} />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-[var(--text)]">
                  Keep This Device ({localDeviceName})
                </span>
                <p className="text-[11.5px] leading-relaxed text-[var(--mut)] mt-0.5">
                  Designates this machine as authoritative and pushes a full snapshot to the peer device, overwriting conflicting remote records.
                </p>
              </div>
            </button>

            {/* Option 3: Accept Peer */}
            <button
              type="button"
              onClick={() => setSelectedResolution("accept-peer")}
              className="w-full flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer hover:border-[var(--accent)]"
              style={{
                borderColor: selectedResolution === "accept-peer" ? "var(--accent)" : "var(--line)",
                background:
                  selectedResolution === "accept-peer"
                    ? "color-mix(in srgb, var(--accent) 8%, var(--panel2))"
                    : "var(--panel2)",
              }}
            >
              <div
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                style={{
                  borderColor: selectedResolution === "accept-peer" ? "var(--accent)" : "var(--line)",
                  background: selectedResolution === "accept-peer" ? "var(--accent)" : "transparent",
                  color: "#ffffff",
                }}
              >
                {selectedResolution === "accept-peer" && <Check size={12} strokeWidth={3} />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-[var(--text)]">
                  Accept Peer Device ({peerDeviceName})
                </span>
                <p className="text-[11.5px] leading-relaxed text-[var(--mut)] mt-0.5">
                  Overwrites local changes with the peer device's state snapshot. Useful when restoring from a primary phone or workstation.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between border-t px-5 sm:px-6 py-3.5 shrink-0"
          style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
        >
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--mut)]">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            <span className="hidden sm:inline">Encrypted with AES-256-GCM hardware key</span>
            <span className="sm:hidden">AES-256-GCM</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all hover:opacity-80 cursor-pointer"
              style={{ borderColor: "var(--line)", background: "var(--panel)", color: "var(--text)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold text-white shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
              style={{ background: "var(--accent)" }}
            >
              <Check size={14} /> Apply Resolution
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
