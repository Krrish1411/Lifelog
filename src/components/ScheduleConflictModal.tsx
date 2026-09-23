import React, { useState } from "react";
import { type Task, type Session, type Project } from "../types";
import { Modal, Btn } from "./ui";
import { Calendar, ArrowRight, Clock, Inbox, SplitSquareVertical, Check } from "lucide-react";
import { fmtDur } from "../utils/core";

export interface ConflictData {
  session: Session;
  workedTask: Task;
  conflictingTask: Task;
  conflictingBlockId?: string;
  startHM: string;
  endHM: string;
  durationMin: number;
}

interface ScheduleConflictModalProps {
  conflict: ConflictData;
  projects: Project[];
  onResolve: (action: {
    type: "push_forward" | "move_to_tray" | "custom_time" | "keep_both" | "dismiss";
    customTime?: string;
  }) => void;
  onClose: () => void;
}

export function ScheduleConflictModal({
  conflict,
  projects,
  onResolve,
  onClose,
}: ScheduleConflictModalProps) {
  const { workedTask, conflictingTask, startHM, endHM, durationMin } = conflict;
  const workedProject = projects.find((p) => p.id === workedTask.projectId);
  const confProject = projects.find((p) => p.id === conflictingTask.projectId);

  // Compute pushed time
  const [confH, confM] = (conflictingTask.dueTime || "09:00").split(":").map(Number);
  const pushedTotalM = (confH * 60 + confM) + durationMin;
  const pushedH = Math.floor(pushedTotalM / 60) % 24;
  const pushedMin = pushedTotalM % 60;
  const pushedTimeStr = `${String(pushedH).padStart(2, "0")}:${String(pushedMin).padStart(2, "0")}`;

  const [customTime, setCustomTime] = useState(pushedTimeStr);
  const [showCustomInput, setShowCustomInput] = useState(false);

  return (
    <Modal open title="Schedule Alignment" onClose={onClose} width={520}>
      <div
        className="flex flex-col gap-4 text-xs"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !showCustomInput) {
            e.preventDefault();
            onResolve({ type: "push_forward" });
          }
        }}
      >
        {/* Context description */}
        <div className="p-3 rounded-2xl border" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}>
          <div className="text-[12.5px] font-bold text-[var(--text)] mb-1">
            Focus session completed: {startHM} – {endHM} ({fmtDur(durationMin)})
          </div>
          <p className="text-[11.5px] text-[var(--mut)] leading-relaxed">
            You worked on <strong className="text-[var(--text)]">{workedTask.title}</strong>, which overlapped with the scheduled time block for <strong className="text-[var(--accent)]">{conflictingTask.title}</strong>.
          </p>
        </div>

        {/* Task comparison strip */}
        <div className="grid grid-cols-2 gap-2 text-left">
          <div className="p-2.5 rounded-xl border border-[var(--ok)]/40 bg-[var(--ok)]/5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ok)] flex items-center gap-1">
              <Check size={11} /> Actually Focused
            </span>
            <div className="font-bold text-[12px] truncate mt-1 text-[var(--text)]">
              {workedTask.emoji ? `${workedTask.emoji} ` : ""}{workedTask.title}
            </div>
            {workedProject && (
              <span className="text-[10px] text-[var(--mut)]">#{workedProject.name}</span>
            )}
            <div className="text-[10.5px] font-mono font-semibold text-[var(--ok)] mt-1">
              {startHM} – {endHM} ({fmtDur(durationMin)})
            </div>
          </div>

          <div className="p-2.5 rounded-xl border border-[var(--warn)]/40 bg-[var(--warn)]/5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--warn)] flex items-center gap-1">
              <Clock size={11} /> Was Scheduled
            </span>
            <div className="font-bold text-[12px] truncate mt-1 text-[var(--text)]">
              {conflictingTask.emoji ? `${conflictingTask.emoji} ` : ""}{conflictingTask.title}
            </div>
            {confProject && (
              <span className="text-[10px] text-[var(--mut)]">#{confProject.name}</span>
            )}
            <div className="text-[10.5px] font-mono font-semibold text-[var(--warn)] mt-1">
              Planned at {conflictingTask.dueTime || startHM}
            </div>
          </div>
        </div>

        {/* Action Options */}
        <div className="flex flex-col gap-2">
          <label className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--mut)]">
            How would you like to update your calendar?
          </label>

          {/* Option 1: Push forward by duration */}
          <button
            type="button"
            onClick={() => onResolve({ type: "push_forward" })}
            className="flex items-center justify-between p-3 rounded-xl border border-[var(--line)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-all cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0">
                <ArrowRight size={15} />
              </div>
              <div>
                <div className="font-bold text-[12px] text-[var(--text)]">
                  Block {workedTask.title} & Push {conflictingTask.title} forward
                </div>
                <div className="text-[11px] text-[var(--mut)]">
                  Moves {conflictingTask.title} to {pushedTimeStr} (+{fmtDur(durationMin)})
                </div>
              </div>
            </div>
            <span className="chip !text-[10px] font-bold text-accent shrink-0">Recommended</span>
          </button>

          {/* Option 2: Move conflicting task to unscheduled tray */}
          <button
            type="button"
            onClick={() => onResolve({ type: "move_to_tray" })}
            className="flex items-center justify-between p-3 rounded-xl border border-[var(--line)] hover:border-[var(--accent)] hover:bg-[var(--panel2)] transition-all cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-[var(--panel2)] text-[var(--mut)] flex items-center justify-center shrink-0">
                <Inbox size={15} />
              </div>
              <div>
                <div className="font-bold text-[12px] text-[var(--text)]">
                  Move {conflictingTask.title} to Unscheduled Tray
                </div>
                <div className="text-[11px] text-[var(--mut)]">
                  Keep time free to reschedule manually later
                </div>
              </div>
            </div>
          </button>

          {/* Option 3: Keep both side-by-side */}
          <button
            type="button"
            onClick={() => onResolve({ type: "keep_both" })}
            className="flex items-center justify-between p-3 rounded-xl border border-[var(--line)] hover:border-[var(--accent)] hover:bg-[var(--panel2)] transition-all cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-[var(--panel2)] text-[var(--mut)] flex items-center justify-center shrink-0">
                <SplitSquareVertical size={15} />
              </div>
              <div>
                <div className="font-bold text-[12px] text-[var(--text)]">
                  Keep Both in Calendar (Split Columns)
                </div>
                <div className="text-[11px] text-[var(--mut)]">
                  Displays both tasks side-by-side as | {workedTask.title} | {conflictingTask.title} |
                </div>
              </div>
            </div>
          </button>

          {/* Option 4: Pick custom time */}
          {showCustomInput ? (
            <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[11.5px]">Reschedule to:</span>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onResolve({ type: "custom_time", customTime })}
                  className="rounded-lg border px-2 py-1 font-mono text-xs bg-[var(--bg)] border-[var(--line)] text-[var(--text)] outline-none"
                />
              </div>
              <Btn
                size="sm"
                variant="primary"
                onClick={() => onResolve({ type: "custom_time", customTime })}
              >
                Apply
              </Btn>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCustomInput(true)}
              className="text-[11px] text-[var(--accent)] hover:underline self-start cursor-pointer font-semibold py-1"
            >
              + Pick specific reschedule time...
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-[var(--line)]">
          <Btn variant="outline" size="sm" onClick={() => onResolve({ type: "dismiss" })}>
            Don't Change Schedule
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
