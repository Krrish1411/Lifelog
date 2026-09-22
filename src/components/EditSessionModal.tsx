import React, { useState } from "react";
import { type Session, type Task, type Project, LIFE_LOG_PROJECT_ID } from "../types";
import { Modal, Btn } from "./ui";
import { Clock, Trash2, Check, Calendar, Tag } from "lucide-react";
import { fmtDur } from "../utils/core";

interface EditSessionModalProps {
  session: Session;
  tasks: Task[];
  projects: Project[];
  onSave: (updatedSession: Session) => void;
  onDelete: (sessionId: string) => void;
  onClose: () => void;
}

export function EditSessionModal({
  session,
  tasks,
  projects,
  onSave,
  onDelete,
  onClose,
}: EditSessionModalProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(session.taskId);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Time handling
  const startDate = new Date(session.startedAt);
  const endDate = session.endedAt ? new Date(session.endedAt) : new Date(session.startedAt + 25 * 60000);

  const formatHHMM = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  const [startTime, setStartTime] = useState(formatHHMM(startDate));
  const [endTime, setEndTime] = useState(formatHHMM(endDate));

  // Compute duration in minutes from start and end time
  const parseHMToMinutes = (hm: string) => {
    const [h, m] = hm.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const initialDurMin = Math.max(
    1,
    Math.round(((session.endedAt || session.startedAt) - session.startedAt) / 60000)
  );
  const [durationMin, setDurationMin] = useState(initialDurMin || 25);

  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    const startM = parseHMToMinutes(val);
    const newEndM = startM + durationMin;
    const endH = Math.floor(newEndM / 60) % 24;
    const endMin = newEndM % 60;
    setEndTime(`${String(endH).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`);
  };

  const handleEndTimeChange = (val: string) => {
    setEndTime(val);
    const startM = parseHMToMinutes(startTime);
    let endM = parseHMToMinutes(val);
    if (endM < startM) endM += 24 * 60; // Crosses midnight
    setDurationMin(Math.max(1, endM - startM));
  };

  const handleDurationChange = (min: number) => {
    const validMin = Math.max(1, min);
    setDurationMin(validMin);
    const startM = parseHMToMinutes(startTime);
    const newEndM = startM + validMin;
    const endH = Math.floor(newEndM / 60) % 24;
    const endMin = newEndM % 60;
    setEndTime(`${String(endH).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`);
  };

  const handleSave = () => {
    const baseDay = new Date(session.startedAt);
    const [startH, startM] = startTime.split(":").map(Number);
    const newStartDate = new Date(baseDay);
    newStartDate.setHours(startH || 0, startM || 0, 0, 0);

    const newStartedAt = newStartDate.getTime();
    const newEndedAt = newStartedAt + durationMin * 60000;

    onSave({
      ...session,
      taskId: selectedTaskId,
      startedAt: newStartedAt,
      endedAt: newEndedAt,
      updatedAt: Date.now(),
    });
    onClose();
  };

  const activeTasks = tasks.filter((t) => t.projectId !== LIFE_LOG_PROJECT_ID);

  return (
    <Modal open title="Edit Focus Session" onClose={onClose} width={480}>
      <div className="flex flex-col gap-4 text-xs">
        {/* Task Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--mut)] flex items-center gap-1.5">
            <Tag size={12} />
            <span>Assigned Task</span>
          </label>
          <select
            value={selectedTaskId || ""}
            onChange={(e) => setSelectedTaskId(e.target.value ? e.target.value : null)}
            className="w-full rounded-xl border p-2.5 text-xs font-semibold bg-[var(--panel2)] border-[var(--line)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="">(No Task Assigned)</option>
            {activeTasks.map((t) => {
              const p = projects.find((x) => x.id === t.projectId);
              return (
                <option key={t.id} value={t.id}>
                  {t.emoji ? `${t.emoji} ` : ""}{t.title} {p ? `(#${p.name})` : ""}
                </option>
              );
            })}
          </select>
        </div>

        {/* Timeline Editor */}
        <div className="flex flex-col gap-1.5 p-3 rounded-2xl border" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}>
          <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]/60">
            <div className="flex items-center gap-1.5 font-bold text-[12px] text-[var(--text)]">
              <Clock size={13} className="text-[var(--accent)]" />
              <span>Timeline & Duration</span>
            </div>
            <span className="font-mono font-bold text-[var(--accent)] text-[12px]">
              {fmtDur(durationMin)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-[var(--mut)]">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="w-full rounded-lg border px-2.5 py-1.5 font-mono text-xs bg-[var(--bg)] border-[var(--line)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-[var(--mut)]">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className="w-full rounded-lg border px-2.5 py-1.5 font-mono text-xs bg-[var(--bg)] border-[var(--line)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* Quick Duration Adjustment Chips */}
          <div className="flex flex-col gap-1 mt-2">
            <label className="text-[10px] font-semibold text-[var(--mut)]">Set Duration (Minutes)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="720"
                value={durationMin}
                onChange={(e) => handleDurationChange(parseInt(e.target.value, 10) || 1)}
                className="w-24 rounded-lg border px-2.5 py-1 font-mono text-xs bg-[var(--bg)] border-[var(--line)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
              <div className="flex items-center gap-1 flex-wrap">
                {[15, 25, 45, 60, 90].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleDurationChange(m)}
                    className="chip !py-0.5 !px-2 text-[10px] hover:border-[var(--accent)] cursor-pointer"
                    style={{
                      borderColor: durationMin === m ? "var(--accent)" : "var(--line)",
                      background: durationMin === m ? "var(--accent-soft)" : "transparent",
                      color: durationMin === m ? "var(--accent)" : "var(--mut)",
                    }}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--err)] font-bold">Delete session?</span>
              <Btn
                size="sm"
                variant="danger"
                onClick={() => {
                  onDelete(session.id);
                  onClose();
                }}
              >
                Yes, Delete
              </Btn>
              <Btn size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Btn>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 text-[11px] font-semibold text-[var(--err)] hover:underline cursor-pointer"
            >
              <Trash2 size={12} />
              <span>Delete Session</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <Btn variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Btn>
            <Btn variant="primary" size="sm" onClick={handleSave} className="gap-1 font-bold">
              <Check size={13} />
              <span>Save Changes</span>
            </Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}
