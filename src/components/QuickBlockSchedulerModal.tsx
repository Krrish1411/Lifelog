import React, { useState } from "react";
import { type Task, type Project } from "../types";
import { Modal, Btn } from "./ui";
import { Clock, Zap, Check, ArrowRight } from "lucide-react";
import { fmtDateLong, fmtDayShort, fmtDur, parseIso } from "../utils/core";

interface QuickBlockSchedulerModalProps {
  open: boolean;
  date: string;
  time: string;
  durationMin: number;
  onClose: () => void;
  onAssignTask: (task: Task) => void;
  onCreateAndSchedule: (title: string, projectId: string) => void;
  onStartFocusNow: (title: string, projectId: string) => void;
  tasks: Task[];
  projects: Project[];
}

function timeToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function minToTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function QuickBlockSchedulerModal({
  open,
  date,
  time,
  durationMin,
  onClose,
  onAssignTask,
  onCreateAndSchedule,
  onStartFocusNow,
  tasks,
  projects,
}: QuickBlockSchedulerModalProps) {
  const [title, setTitle] = useState("");
  const activeProjects = projects.filter((p) => p.id !== "lifelog");
  const [projectId, setProjectId] = useState<string>(() => activeProjects[0]?.id || "work");

  const startMin = timeToMin(time || "09:00");
  const endMin = startMin + durationMin;
  const endTimeStr = minToTime(endMin);

  // Filter unscheduled tasks from backlog
  const backlogTasks = tasks
    .filter((t) => !t.done && (!t.due || !t.dueTime))
    .slice(0, 8);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) return;
    onCreateAndSchedule(title.trim(), projectId);
    onClose();
  };

  const handleStartFocus = () => {
    const taskTitle = title.trim() || "Deep Focus Block";
    onStartFocusNow(taskTitle, projectId);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Schedule Time Block" width={520}>
      <div
        className="flex flex-col gap-4 text-xs"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      >
        {/* Time slot summary badge */}
        <div
          className="flex items-center justify-between p-3 rounded-2xl border"
          style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/15 flex items-center justify-center text-[var(--accent)] shrink-0">
              <Clock size={16} />
            </div>
            <div>
              <div className="text-[13px] font-bold text-[var(--text)]">
                {time} – {endTimeStr}
              </div>
              <div className="text-[11px] font-medium text-[var(--mut)]">
                {fmtDayShort(date)}, {fmtDateLong(parseIso(date))}
              </div>
            </div>
          </div>
          <span className="chip !py-1 !px-2.5 font-bold text-[11px] text-[var(--accent)] border border-[var(--accent)]/30">
            {fmtDur(durationMin)} block
          </span>
        </div>

        {/* Section 1: Create New Task & Schedule */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--mut)]">
            Create New Task
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What are you working on? (Press Enter to block)"
              className="flex-1 rounded-xl border p-2.5 text-xs font-semibold bg-[var(--panel2)] border-[var(--line)] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
            />
            {activeProjects.length > 0 && (
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-[120px] shrink-0 rounded-xl border p-2 text-xs font-semibold bg-[var(--panel2)] border-[var(--line)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              >
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end pt-1">
            <Btn
              type="button"
              variant="outline"
              size="sm"
              onClick={handleStartFocus}
              className="gap-1 font-bold text-[var(--accent)]"
            >
              <Zap size={13} className="text-amber-500 fill-amber-500" />
              <span>Start Focus Now</span>
            </Btn>
            <Btn
              type="submit"
              variant="primary"
              size="sm"
              disabled={!title.trim()}
              className="gap-1 font-bold"
            >
              <Check size={13} />
              <span>Block Time</span>
            </Btn>
          </div>
        </form>

        {/* Section 2: Quick Assign Backlog Tasks */}
        {backlogTasks.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: "var(--line)" }}>
            <div className="flex items-center justify-between text-[11px] font-bold text-[var(--mut)] uppercase tracking-wider">
              <span>Or Pick From Backlog ({backlogTasks.length})</span>
            </div>

            <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-0.5">
              {backlogTasks.map((t) => {
                const proj = projects.find((p) => p.id === t.projectId);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onAssignTask(t);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] hover:bg-[var(--accent-soft)] hover:border-[var(--accent)]/40 transition-all text-left group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[12px] shrink-0">{t.emoji || "📝"}</span>
                      <span className="font-semibold text-[12px] text-[var(--text)] truncate">
                        {t.title}
                      </span>
                      {proj && (
                        <span className="text-[10px] text-[var(--mut)] shrink-0">
                          #{proj.name}
                        </span>
                      )}
                    </div>
                    <span className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] transition-opacity shrink-0">
                      <span>Schedule</span>
                      <ArrowRight size={12} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
