import { type Session, type Task, type TaskTimeBlock } from "../types";
import { todayIso, uid, isoDate } from "./core";
import { type ConflictData } from "../components/ScheduleConflictModal";

function timeToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minToTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Checks if a completed focus session conflicts with an existing scheduled task in the calendar.
 */
export function detectScheduleConflict(
  session: Session,
  tasks: Task[]
): ConflictData | null {
  if (session.mode === "break" || !session.taskId || !session.startedAt) return null;

  const workedTask = tasks.find((t) => t.id === session.taskId);
  if (!workedTask) return null;

  const sDate = isoDate(new Date(session.startedAt));
  const startD = new Date(session.startedAt);
  const endD = session.endedAt ? new Date(session.endedAt) : new Date(session.startedAt + 25 * 60000);

  const startHM = minToTime(startD.getHours() * 60 + startD.getMinutes());
  const endHM = minToTime(endD.getHours() * 60 + endD.getMinutes());
  const startMin = timeToMin(startHM);
  const endMin = timeToMin(endHM);
  const durationMin = Math.max(1, Math.round(((session.endedAt || endD.getTime()) - session.startedAt) / 60000));

  // Check all other tasks for overlap on sDate
  for (const t of tasks) {
    if (t.id === workedTask.id) continue;

    // Check timeBlocks
    if (t.timeBlocks && t.timeBlocks.length > 0) {
      for (const b of t.timeBlocks) {
        if (b.date !== sDate || !b.time) continue;
        const bStart = timeToMin(b.time);
        const bEnd = bStart + (b.durationMin || 60);
        // Overlap condition
        if (startMin < bEnd && endMin > bStart) {
          return {
            session,
            workedTask,
            conflictingTask: t,
            conflictingBlockId: b.id,
            startHM,
            endHM,
            durationMin,
          };
        }
      }
    } else if (t.due === sDate && t.dueTime) {
      const bStart = timeToMin(t.dueTime);
      const bEnd = bStart + (t.durationMin || 60);
      if (startMin < bEnd && endMin > bStart) {
        return {
          session,
          workedTask,
          conflictingTask: t,
          startHM,
          endHM,
          durationMin,
        };
      }
    }
  }

  return null;
}

/**
 * Automatically creates/updates a calendar time block for an unscheduled task that was worked in a focus session.
 */
export function autoBlockUnscheduledSession(
  session: Session,
  tasks: Task[]
): Task[] {
  if (session.mode === "break" || !session.taskId || !session.startedAt) return tasks;

  const workedTask = tasks.find((t) => t.id === session.taskId);
  if (!workedTask) return tasks;

  const sDate = isoDate(new Date(session.startedAt));
  const startD = new Date(session.startedAt);
  const endD = session.endedAt ? new Date(session.endedAt) : new Date(session.startedAt + 25 * 60000);
  const startHM = minToTime(startD.getHours() * 60 + startD.getMinutes());
  const durationMin = Math.max(15, Math.round(((session.endedAt || endD.getTime()) - session.startedAt) / 60000));

  const newBlock: TaskTimeBlock = {
    id: uid(),
    date: sDate,
    time: startHM,
    durationMin,
    label: `${session.mode === "pomodoro" ? "Pomodoro" : session.mode === "countdown" ? "Countdown" : "Flow"} (${durationMin}m)`,
    done: true,
  };

  return tasks.map((t) => {
    if (t.id !== workedTask.id) return t;

    // Check if task already has a matching single block on this date
    if (t.due === sDate) {
      return {
        ...t,
        due: sDate,
        dueTime: startHM,
        durationMin: Math.max(t.durationMin || 0, durationMin),
      };
    }

    // Check if task has timeBlocks
    if (t.timeBlocks && t.timeBlocks.length > 0) {
      const sStart = timeToMin(startHM);
      const sEnd = sStart + durationMin;
      // Match block on same date (preferably overlapping)
      let matchIdx = t.timeBlocks.findIndex((b) => {
        if (b.date !== sDate || !b.time) return false;
        const bStart = timeToMin(b.time);
        const bEnd = bStart + (b.durationMin || 60);
        return sStart < bEnd && sEnd > bStart;
      });

      if (matchIdx < 0) {
        matchIdx = t.timeBlocks.findIndex((b) => b.date === sDate);
      }

      if (matchIdx >= 0) {
        return {
          ...t,
          timeBlocks: t.timeBlocks.map((b, idx) =>
            idx === matchIdx ? { ...b, time: startHM, durationMin, done: true } : b
          ),
        };
      }
      return {
        ...t,
        timeBlocks: [...t.timeBlocks, newBlock],
      };
    }

    if (!t.due || !t.dueTime) {
      return {
        ...t,
        due: sDate,
        dueTime: startHM,
        durationMin,
      };
    }

    // Has single block on a completely different date: convert to multi-block
    return {
      ...t,
      timeBlocks: [
        {
          id: uid(),
          date: t.due,
          time: t.dueTime,
          durationMin: t.durationMin || 60,
          label: "Block 1",
          done: !!t.done,
        },
        newBlock,
      ],
    };
  });
}

/**
 * Resolves a schedule conflict by updating the tasks according to user action.
 */
export function resolveScheduleConflict(
  conflict: ConflictData,
  tasks: Task[],
  action: {
    type: "push_forward" | "move_to_tray" | "custom_time" | "keep_both" | "dismiss";
    customTime?: string;
  }
): Task[] {
  if (action.type === "dismiss") {
    return tasks;
  }

  // 1. Auto-block the session for the worked task
  const updated = autoBlockUnscheduledSession(conflict.session, tasks);

  if (action.type === "keep_both") {
    // Both remain scheduled in their respective slots (side-by-side)
    return updated;
  }

  // 2. Adjust the conflicting task based on the chosen action
  const { conflictingTask, conflictingBlockId, durationMin } = conflict;

  return updated.map((t) => {
    if (t.id !== conflictingTask.id) return t;

    if (action.type === "move_to_tray") {
      if (conflictingBlockId && t.timeBlocks) {
        const remaining = t.timeBlocks.filter((b) => b.id !== conflictingBlockId);
        return {
          ...t,
          timeBlocks: remaining.length > 0 ? remaining : undefined,
          dueTime: remaining.length === 0 ? null : t.dueTime,
        };
      }
      return {
        ...t,
        dueTime: null,
      };
    }

    let targetTime = action.customTime;
    if (action.type === "push_forward") {
      const origTime = conflictingBlockId
        ? t.timeBlocks?.find((b) => b.id === conflictingBlockId)?.time || t.dueTime || "09:00"
        : t.dueTime || "09:00";
      const [h, m] = origTime.split(":").map(Number);
      const newTotal = (h * 60 + m) + durationMin;
      targetTime = minToTime(newTotal);
    }

    if (!targetTime) return t;

    if (conflictingBlockId && t.timeBlocks) {
      return {
        ...t,
        timeBlocks: t.timeBlocks.map((b) =>
          b.id === conflictingBlockId ? { ...b, time: targetTime } : b
        ),
      };
    }

    return {
      ...t,
      dueTime: targetTime,
    };
  });
}
