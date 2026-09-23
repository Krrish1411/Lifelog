import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock3, Inbox, Layers, Plus, Sparkles } from "lucide-react";
import { LIFE_LOG_PROJECT_ID, type Task, type TaskTimeBlock, type Session } from "../types";
import { useApp } from "../store";
import {
  WEEKDAYS_SHORT,
  addDaysIso,
  fmtDateLong,
  fmtDayShort,
  fmtDur,
  isoDate,
  listDates,
  parseIso,
  todayIso,
  trackedByDay,
  weekStartIso,
} from "../utils/core";
import { Btn, Seg, cn } from "../components/ui";
import { EditSessionModal } from "../components/EditSessionModal";
import { QuickBlockSchedulerModal } from "../components/QuickBlockSchedulerModal";

type CalView = "schedule" | "day" | "3day" | "week" | "month";
const H0 = 0; // grid starts 00:00 for full 24h coverage
const H1 = 24; // grid ends 24:00
const HOUR_H = 44;
const GRID_H = (H1 - H0) * HOUR_H;

function timeToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}
function minToTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface CalendarItem {
  id: string; // unique item id
  taskId: string;
  blockId?: string;
  sessionId?: string;
  title: string;
  label?: string;
  emoji?: string | null;
  projectId: string;
  date: string;
  time: string;
  durationMin: number;
  snoozed?: boolean;
  done?: boolean;
  isHabit?: boolean;
  isFocusSession?: boolean;
  pauses?: { at: number; resumeAt: number | null }[];
}

export interface PositionedCalendarItem extends CalendarItem {
  colIndex: number;
  numCols: number;
}

/**
 * Google Calendar-style overlapping column splitting algorithm.
 * Partitions overlapping time blocks into parallel columns (| Task 1 | Task 2 |).
 */
export function layoutOverlappingBlocks(items: CalendarItem[]): PositionedCalendarItem[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => {
    const startA = timeToMin(a.time ?? "09:00");
    const startB = timeToMin(b.time ?? "09:00");
    if (startA !== startB) return startA - startB;
    return (b.durationMin || 60) - (a.durationMin || 60);
  });

  const clusters: CalendarItem[][] = [];
  let currentCluster: CalendarItem[] = [];
  let clusterEnd = -1;

  for (const item of sorted) {
    const itemStart = timeToMin(item.time ?? "09:00");
    const itemEnd = itemStart + (item.durationMin || 60);

    if (currentCluster.length === 0) {
      currentCluster.push(item);
      clusterEnd = itemEnd;
    } else if (itemStart < clusterEnd) {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, itemEnd);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterEnd = itemEnd;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const result: PositionedCalendarItem[] = [];

  for (const cluster of clusters) {
    const colEndTimes: number[] = [];
    const clusterPositions: { item: CalendarItem; colIndex: number }[] = [];

    for (const item of cluster) {
      const itemStart = timeToMin(item.time ?? "09:00");
      const itemEnd = itemStart + (item.durationMin || 60);

      let placedCol = -1;
      for (let c = 0; c < colEndTimes.length; c++) {
        if (colEndTimes[c] <= itemStart) {
          placedCol = c;
          colEndTimes[c] = itemEnd;
          break;
        }
      }

      if (placedCol === -1) {
        placedCol = colEndTimes.length;
        colEndTimes.push(itemEnd);
      }

      clusterPositions.push({ item, colIndex: placedCol });
    }

    const numCols = Math.max(1, colEndTimes.length);
    for (const pos of clusterPositions) {
      result.push({
        ...pos.item,
        colIndex: pos.colIndex,
        numCols,
      });
    }
  }

  return result;
}

export interface UnscheduledItem {
  taskId: string;
  blockId?: string;
  title: string;
  label?: string;
  durationMin: number;
  emoji?: string | null;
  projectId: string;
  date?: string | null;
}

export function CalendarView() {
  const app = useApp();
  const { state, set, openTaskDialog, toast, requestFocus } = app;
  const [view, setView] = useState<CalView>("schedule");
  const [anchor, setAnchor] = useState(todayIso());
  const [selectedDay, setSelectedDay] = useState(todayIso());
  const [hover, setHover] = useState<{ iso: string; min: number; durationMin: number } | null>(null);
  const [dragDuration, setDragDuration] = useState<number>(60);
  const [resizing, setResizing] = useState<{
    targetItemId: string;
    taskId: string;
    blockId?: string;
    isHabit?: boolean;
    edge: "top" | "bottom";
    startY: number;
    initialStartMin: number;
    initialDur: number;
    currentStartMin: number;
    currentDur: number;
  } | null>(null);

  const mouseResizeActiveRef = useRef(false);
  const mouseResizeClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const justInteractedRef = useRef(false);

  // Drag-to-create time block state
  const [dragCreate, setDragCreate] = useState<{
    iso: string;
    startMin: number;
    currentMin: number;
  } | null>(null);

  const potentialCreateRef = useRef<{
    iso: string;
    slotMin: number;
    startY: number;
    startX: number;
  } | null>(null);

  const [quickBlockModal, setQuickBlockModal] = useState<{
    open: boolean;
    date: string;
    time: string;
    durationMin: number;
  } | null>(null);

  const timelineScrollerRef = useRef<HTMLDivElement>(null);

  const today = todayIso();
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());

  useEffect(() => {
    const t = setInterval(
      () => setNowMin(new Date().getHours() * 60 + new Date().getMinutes()),
      30000
    );
    return () => clearInterval(t);
  }, []);

  // Auto-scroll timeline to current morning/active hour on mount
  useEffect(() => {
    if (timelineScrollerRef.current) {
      const targetHour = Math.max(0, Math.min(20, Math.floor(nowMin / 60) - 1));
      timelineScrollerRef.current.scrollTop = targetHour * HOUR_H;
    }
  }, [view]);

  // Dual-edge duration resizing handler
  const handleResizeStart = (
    e: React.MouseEvent | React.TouchEvent,
    b: CalendarItem,
    edge: "top" | "bottom"
  ) => {
    e.stopPropagation();
    e.preventDefault();
    mouseResizeActiveRef.current = true;
    if (mouseResizeClearTimerRef.current) clearTimeout(mouseResizeClearTimerRef.current);

    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const startMin = timeToMin(b.time || "09:00");
    const dur = b.durationMin || 60;

    setResizing({
      targetItemId: b.id,
      taskId: b.taskId,
      blockId: b.blockId,
      isHabit: !!b.isHabit,
      edge,
      startY: clientY,
      initialStartMin: startMin,
      initialDur: dur,
      currentStartMin: startMin,
      currentDur: dur,
    });
  };

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - resizing.startY;
      const deltaMin = Math.round(((deltaY / HOUR_H) * 60) / 15) * 15;

      if (resizing.edge === "bottom") {
        const newDur = Math.max(15, resizing.initialDur + deltaMin);
        setResizing((r) => (r ? { ...r, currentDur: newDur } : null));
      } else {
        const initialEndMin = resizing.initialStartMin + resizing.initialDur;
        const newStartMin = Math.max(0, Math.min(initialEndMin - 15, resizing.initialStartMin + deltaMin));
        const newDur = initialEndMin - newStartMin;
        setResizing((r) => (r ? { ...r, currentStartMin: newStartMin, currentDur: newDur } : null));
      }
    };

    const handleMouseUp = () => {
      justInteractedRef.current = true;
      mouseResizeClearTimerRef.current = setTimeout(() => {
        mouseResizeActiveRef.current = false;
        justInteractedRef.current = false;
      }, 100);

      const hasChanged =
        resizing.currentDur !== resizing.initialDur ||
        resizing.currentStartMin !== resizing.initialStartMin;

      if (hasChanged) {
        const finalDur = resizing.currentDur;
        const finalTime = minToTime(resizing.currentStartMin);

        set((s) => ({
          ...s,
          tasks: s.tasks.map((t) => {
            if (t.id !== resizing.taskId) return t;
            if (resizing.blockId && t.timeBlocks) {
              return {
                ...t,
                timeBlocks: t.timeBlocks.map((b) =>
                  b.id === resizing.blockId
                    ? { ...b, time: finalTime, durationMin: finalDur }
                    : b
                ),
              };
            }
            return {
              ...t,
              dueTime: finalTime,
              durationMin: finalDur,
            };
          }),
        }));
        toast(`Updated duration to ${fmtDur(finalDur)} (${finalTime})`, "ok");
      }
      setResizing(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleMouseMove);
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [resizing, set, toast]);

  // Window listeners for drag-to-create time blocking & cleaning hover preview
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!potentialCreateRef.current) return;
      const { iso, slotMin, startY, startX } = potentialCreateRef.current;
      const dy = e.clientY - startY;
      const dx = e.clientX - startX;
      const dist = Math.hypot(dx, dy);

      if (dist >= 6 && !dragCreate) {
        setDragCreate({
          iso,
          startMin: slotMin,
          currentMin: slotMin + 15,
        });
      } else if (dragCreate) {
        const deltaMin = Math.round(((dy / HOUR_H) * 60) / 15) * 15;
        const curMin = Math.max(0, Math.min(1440, slotMin + deltaMin));
        setDragCreate((prev) => (prev ? { ...prev, currentMin: curMin } : null));
      }
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      if (!potentialCreateRef.current) return;
      const pot = potentialCreateRef.current;
      potentialCreateRef.current = null;

      if (dragCreate) {
        const start = Math.min(dragCreate.startMin, dragCreate.currentMin);
        const end = Math.max(dragCreate.startMin, dragCreate.currentMin);
        const dur = Math.max(15, end - start);
        setQuickBlockModal({
          open: true,
          date: dragCreate.iso,
          time: minToTime(start),
          durationMin: dur,
        });
        setDragCreate(null);
        justInteractedRef.current = true;
        setTimeout(() => {
          justInteractedRef.current = false;
        }, 100);
      } else {
        const dy = Math.abs(e.clientY - pot.startY);
        const dx = Math.abs(e.clientX - pot.startX);
        if (dy < 6 && dx < 6) {
          setQuickBlockModal({
            open: true,
            date: pot.iso,
            time: minToTime(pot.slotMin),
            durationMin: 60,
          });
        }
      }
    };

    const handleWindowDragEnd = () => {
      setHover(null);
      setDragDuration(60);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    window.addEventListener("dragend", handleWindowDragEnd);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      window.removeEventListener("dragend", handleWindowDragEnd);
    };
  }, [dragCreate]);

  // Quick Block Scheduler handlers
  const handleAssignBacklogTask = (task: Task) => {
    if (!quickBlockModal) return;
    const { date, time, durationMin } = quickBlockModal;

    set((s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              due: date,
              dueTime: time,
              durationMin,
            }
          : t
      ),
    }));
    toast(`Scheduled “${task.title}” · ${fmtDayShort(date)} at ${time}`, "ok");
  };

  const handleCreateAndScheduleNewTask = (title: string, projectId: string) => {
    if (!quickBlockModal) return;
    const { date, time, durationMin } = quickBlockModal;
    const newId = `t-${Date.now()}`;

    const newTask: Task = {
      id: newId,
      title,
      projectId,
      notes: "",
      emoji: null,
      priority: "medium",
      tags: [],
      estimateMin: durationMin,
      due: date,
      dueTime: time,
      durationMin,
      snoozedUntil: null,
      done: false,
      doneAt: null,
      createdAt: Date.now(),
      subtasks: [],
      recurrence: null,
      completions: [],
      privateNote: null,
    };

    set((s) => ({
      ...s,
      tasks: [newTask, ...s.tasks],
    }));
    toast(`Created and scheduled “${title}” at ${time}`, "ok");
  };

  const handleStartFocusFromBlock = (title: string, projectId: string) => {
    if (!quickBlockModal) return;
    const { durationMin } = quickBlockModal;
    const newId = `t-${Date.now()}`;
    const newTask: Task = {
      id: newId,
      title,
      projectId,
      notes: "",
      emoji: null,
      priority: "high",
      tags: [],
      estimateMin: durationMin,
      due: todayIso(),
      dueTime: minToTime(new Date().getHours() * 60 + new Date().getMinutes()),
      durationMin,
      snoozedUntil: null,
      done: false,
      doneAt: null,
      createdAt: Date.now(),
      subtasks: [],
      recurrence: null,
      completions: [],
      privateNote: null,
    };

    set((s) => ({
      ...s,
      tasks: [newTask, ...s.tasks],
    }));
    requestFocus(newId);
    toast(`Started focus session for “${title}”! ⚡`, "ok");
  };

  // Compute view date arrays first so blocksByDay can populate all visible days
  const days: string[] = useMemo(() => {
    if (view === "day") return [anchor];
    if (view === "3day") return listDates(anchor, addDaysIso(anchor, 2));
    if (view === "week")
      return listDates(weekStartIso(anchor), addDaysIso(weekStartIso(anchor), 6));
    return [];
  }, [view, anchor]);

  const monthCells = useMemo(() => {
    if (view !== "month") return [];
    const d = parseIso(anchor);
    const first = isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
    const start = weekStartIso(first);
    return listDates(start, addDaysIso(start, 41));
  }, [view, anchor]);

  const scheduleDays = useMemo(() => {
    if (view !== "schedule") return [];
    return listDates(anchor, addDaysIso(anchor, 13));
  }, [view, anchor]);

  const allVisibleDates = useMemo(() => {
    const set = new Set<string>([todayIso(), anchor]);
    for (const d of days) set.add(d);
    for (const d of scheduleDays) set.add(d);
    for (const d of monthCells) set.add(d);
    return Array.from(set);
  }, [days, scheduleDays, monthCells, anchor]);

  const tracked = useMemo(() => trackedByDay(state.sessions), [state.sessions]);

  // Flatten tasks, multi-blocks, habits, and focus sessions into timed items vs all-day items
  const { blocksByDay, allDayByDay } = useMemo(() => {
    const timedMap = new Map<string, CalendarItem[]>();
    const allDayMap = new Map<string, CalendarItem[]>();

    // Split blocks running past midnight (00:00) so they don't overflow the grid
    const addBlockWithOvernightSplit = (item: CalendarItem) => {
      const startMin = timeToMin(item.time ?? "09:00");
      const dur = item.durationMin || 60;
      const endMin = startMin + dur;

      if (endMin <= 1440) {
        const arr = timedMap.get(item.date) ?? [];
        arr.push(item);
        timedMap.set(item.date, arr);
      } else {
        // Clamps at 24:00 today
        const dur1 = Math.max(15, 1440 - startMin);
        const part1: CalendarItem = {
          ...item,
          durationMin: dur1,
        };
        const arr1 = timedMap.get(item.date) ?? [];
        arr1.push(part1);
        timedMap.set(item.date, arr1);

        // Starts at 00:00 on the following day with remaining duration
        const nextDate = addDaysIso(item.date, 1);
        const dur2 = endMin - 1440;
        if (dur2 > 0) {
          const part2: CalendarItem = {
            ...item,
            id: `${item.id}-cont`,
            date: nextDate,
            time: "00:00",
            durationMin: dur2,
            label: item.label ? `${item.label} (cont.)` : "(cont.)",
          };
          const arr2 = timedMap.get(nextDate) ?? [];
          arr2.push(part2);
          timedMap.set(nextDate, arr2);
        }
      }
    };

    // 1. Process tasks
    for (const t of state.tasks) {
      if (state.settings.showLifeLogProject === false && t.projectId === LIFE_LOG_PROJECT_ID) continue;
      if (t.timeBlocks && t.timeBlocks.length > 0) {
        // Multi-block task
        for (const b of t.timeBlocks) {
          if (!b.date) continue;
          const isDone = !!b.done || !!t.done;
          if (b.time) {
            const item: CalendarItem = {
              id: `b-${b.id}`,
              taskId: t.id,
              blockId: b.id,
              title: t.title,
              label: b.label || "Block",
              emoji: t.emoji,
              projectId: t.projectId,
              date: b.date,
              time: b.time,
              durationMin: b.durationMin || 60,
              snoozed: !!t.snoozedUntil && t.snoozedUntil > Date.now(),
              done: isDone,
            };
            addBlockWithOvernightSplit(item);
          } else {
            // All-day multi-block
            const item: CalendarItem = {
              id: `b-${b.id}`,
              taskId: t.id,
              blockId: b.id,
              title: t.title,
              label: b.label || "All Day",
              emoji: t.emoji,
              projectId: t.projectId,
              date: b.date,
              time: "",
              durationMin: 0,
              done: isDone,
            };
            const arr = allDayMap.get(b.date) ?? [];
            arr.push(item);
            allDayMap.set(b.date, arr);
          }
        }
      } else {
        // Single block task
        if (!t.due) continue;
        if (t.dueTime) {
          const item: CalendarItem = {
            id: `t-${t.id}`,
            taskId: t.id,
            title: t.title,
            emoji: t.emoji,
            projectId: t.projectId,
            date: t.due,
            time: t.dueTime,
            durationMin: t.durationMin || 60,
            snoozed: !!t.snoozedUntil && t.snoozedUntil > Date.now(),
            done: !!t.done,
          };
          addBlockWithOvernightSplit(item);
        } else {
          // All-day task
          const item: CalendarItem = {
            id: `t-${t.id}`,
            taskId: t.id,
            title: t.title,
            emoji: t.emoji,
            projectId: t.projectId,
            date: t.due,
            time: "",
            durationMin: 0,
            done: !!t.done,
          };
          const arr = allDayMap.get(t.due) ?? [];
          arr.push(item);
          allDayMap.set(t.due, arr);
        }
      }
    }

    // 2. Habits: reliably populate for ALL visible dates in active calendar view
    const sortedHabits = [...state.habits].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    sortedHabits.forEach((h) => {
      for (const d of allVisibleDates) {
        const isDone = h.completions.includes(d);
        const item: CalendarItem = {
          id: `h-${h.id}-${d}`,
          taskId: h.id,
          title: h.name,
          label: "Habit",
          emoji: h.emoji,
          projectId: "habits-stream",
          date: d,
          time: "",
          durationMin: 0,
          done: isDone,
          isHabit: true,
        };
        const arr = allDayMap.get(d) ?? [];
        arr.push(item);
        allDayMap.set(d, arr);
      }
    });

    // 3. Executed Focus Sessions & Pauses onto Timeline
    for (const sess of state.sessions) {
      if (sess.mode === "break" || !sess.startedAt) continue;
      const sDate = isoDate(new Date(sess.startedAt));
      const startD = new Date(sess.startedAt);
      const endD = sess.endedAt ? new Date(sess.endedAt) : new Date(sess.startedAt + 25 * 60000);
      const sStartMin = startD.getHours() * 60 + startD.getMinutes();
      const sDurationMin = Math.max(15, Math.round(((sess.endedAt || endD.getTime()) - sess.startedAt) / 60000));
      const t = state.tasks.find((x) => x.id === sess.taskId);

      const item: CalendarItem = {
        id: `sess-${sess.id}`,
        taskId: sess.taskId || "focus",
        sessionId: sess.id,
        title: t?.title || "Focus Session",
        label: sess.mode === "pomodoro" ? "Pomodoro" : sess.mode === "countdown" ? "Countdown" : "Flow",
        emoji: t?.emoji || "⚡",
        projectId: t?.projectId || "quick-focus",
        date: sDate,
        time: minToTime(sStartMin),
        durationMin: sDurationMin,
        done: sess.status !== "running",
        isFocusSession: true,
        pauses: sess.pauses,
      };

      const arr = timedMap.get(sDate) ?? [];
      const sEndMin = sStartMin + sDurationMin;
      // Deduplicate with pre-scheduled task on that day
      const matchIdx = arr.findIndex(
        (existing) =>
          !existing.isFocusSession &&
          existing.taskId === sess.taskId &&
          timeToMin(existing.time ?? "09:00") < sEndMin &&
          timeToMin(existing.time ?? "09:00") + (existing.durationMin || 60) > sStartMin
      );

      if (matchIdx >= 0) {
        arr[matchIdx] = item;
      } else {
        addBlockWithOvernightSplit(item);
      }
    }

    for (const arr of timedMap.values()) {
      arr.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
    }
    return { blocksByDay: timedMap, allDayByDay: allDayMap };
  }, [state.tasks, state.habits, state.sessions, state.settings.showLifeLogProject, allVisibleDates]);

  const navigate = (dir: -1 | 1) => {
    if (view === "month") {
      const d = parseIso(anchor);
      const newAnchor = isoDate(new Date(d.getFullYear(), d.getMonth() + dir, 1));
      setAnchor(newAnchor);
      setSelectedDay(newAnchor);
    } else if (view === "schedule") {
      setAnchor(addDaysIso(anchor, dir * 7));
    } else if (view === "3day") {
      setAnchor(addDaysIso(anchor, dir * 3));
    } else if (view === "week") {
      setAnchor(addDaysIso(anchor, dir * 7));
    } else {
      setAnchor(addDaysIso(anchor, dir));
    }
  };

  const isTodayActive = useMemo(() => {
    if (view === "day") return anchor === today;
    if (view === "3day") return days.includes(today);
    if (view === "week") return days.includes(today);
    if (view === "month") {
      const [ay, am] = anchor.split("-").map(Number);
      const [ty, tm] = today.split("-").map(Number);
      return ay === ty && am === tm;
    }
    if (view === "schedule") return scheduleDays.includes(today);
    return false;
  }, [view, anchor, today, days, scheduleDays]);

  const label = useMemo(() => {
    const parse = (s: string) => {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d);
    };
    const weekdaysShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const daysFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthsShort = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    if (view === "month") {
      const d = parse(anchor);
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    }
    if (view === "day") {
      const d = parse(anchor);
      return `${daysFull[d.getDay()]}, ${d.getDate()} ${monthsShort[d.getMonth()]} ${d.getFullYear()}`;
    }
    if (view === "3day") {
      const start = parse(anchor);
      const end = parse(addDaysIso(anchor, 2));
      if (start.getFullYear() !== end.getFullYear()) {
        return `${weekdaysShort[start.getDay()]} ${start.getDate()} ${monthsShort[start.getMonth()]} ${start.getFullYear()} — ${weekdaysShort[end.getDay()]} ${end.getDate()} ${monthsShort[end.getMonth()]} ${end.getFullYear()}`;
      }
      return `${weekdaysShort[start.getDay()]} ${start.getDate()} ${monthsShort[start.getMonth()]} — ${weekdaysShort[end.getDay()]} ${end.getDate()} ${monthsShort[end.getMonth()]} ${start.getFullYear()}`;
    }
    if (view === "week") {
      const startIso = weekStartIso(anchor);
      const start = parse(startIso);
      const end = parse(addDaysIso(startIso, 6));
      if (start.getFullYear() !== end.getFullYear()) {
        return `${weekdaysShort[start.getDay()]} ${start.getDate()} ${monthsShort[start.getMonth()]} ${start.getFullYear()} — ${weekdaysShort[end.getDay()]} ${end.getDate()} ${monthsShort[end.getMonth()]} ${end.getFullYear()}`;
      }
      return `${weekdaysShort[start.getDay()]} ${start.getDate()} ${monthsShort[start.getMonth()]} — ${weekdaysShort[end.getDay()]} ${end.getDate()} ${monthsShort[end.getMonth()]} ${start.getFullYear()}`;
    }
    if (view === "schedule") {
      const start = parse(anchor);
      const end = parse(addDaysIso(anchor, 13));
      if (start.getFullYear() !== end.getFullYear()) {
        return `${start.getDate()} ${monthsShort[start.getMonth()]} ${start.getFullYear()} — ${end.getDate()} ${monthsShort[end.getMonth()]} ${end.getFullYear()}`;
      }
      return `${start.getDate()} ${monthsShort[start.getMonth()]} — ${end.getDate()} ${monthsShort[end.getMonth()]} ${start.getFullYear()}`;
    }
    return anchor;
  }, [view, anchor]);

  // Unscheduled items for the Tray
  const unscheduled = useMemo<UnscheduledItem[]>(() => {
    const list: UnscheduledItem[] = [];

    for (const t of state.tasks) {
      if (state.settings.showLifeLogProject === false && t.projectId === LIFE_LOG_PROJECT_ID) continue;
      if (t.done || (t.snoozedUntil && t.snoozedUntil > Date.now())) continue;

      if (t.timeBlocks && t.timeBlocks.length > 0) {
        for (const b of t.timeBlocks) {
          if ((!b.date || !b.time) && !b.done) {
            list.push({
              taskId: t.id,
              blockId: b.id,
              title: t.title,
              label: b.label || "Block",
              durationMin: b.durationMin || 60,
              emoji: t.emoji,
              projectId: t.projectId,
              date: b.date,
            });
          }
        }
      } else {
        if (!t.due || !t.dueTime) {
          list.push({
            taskId: t.id,
            title: t.title,
            durationMin: t.durationMin || 60,
            emoji: t.emoji,
            projectId: t.projectId,
            date: t.due,
          });
        }
      }
    }
    return list;
  }, [state.tasks, state.settings.showLifeLogProject]);

  // Drag and drop handler
  const dropOn = (iso: string, min: number | null) => (e: React.DragEvent) => {
    e.preventDefault();
    justInteractedRef.current = true;
    setTimeout(() => {
      justInteractedRef.current = false;
    }, 250);

    const rawData = e.dataTransfer.getData("lifelog/drag");
    const taskIdFallback = e.dataTransfer.getData("lifelog/task");

    let taskId = taskIdFallback;
    let blockId: string | undefined = undefined;
    let isHabit = false;

    let durationMinFallback: number | undefined = undefined;

    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        taskId = parsed.taskId;
        blockId = parsed.blockId;
        isHabit = Boolean(parsed.isHabit);
        durationMinFallback = parsed.durationMin;
      } catch {
        // ignore
      }
    }

    if (!taskId) return;

    // Check if it's a habit
    const habit = state.habits.find((h) => h.id === taskId);
    if (isHabit || habit) {
      const newTime = min !== null ? minToTime(min) : undefined;
      set((s) => ({
        ...s,
        habits: s.habits.map((h) => {
          if (h.id !== taskId) return h;
          return {
            ...h,
            time: newTime,
          };
        }),
      }));
      toast(
        newTime
          ? `Rescheduled habit “${habit?.name ?? "habit"}” to ${newTime}`
          : `Moved habit “${habit?.name ?? "habit"}” to All-Day`,
        "ok"
      );
      setHover(null);
      setDragDuration(60);
      return;
    }

    set((s) => ({
      ...s,
      tasks: s.tasks.map((t) => {
        if (t.id !== taskId) return t;

        const effectiveDur = t.durationMin || durationMinFallback || dragDuration || 60;

        if (blockId && t.timeBlocks) {
          return {
            ...t,
            timeBlocks: t.timeBlocks.map((b) =>
              b.id === blockId
                ? {
                    ...b,
                    date: iso,
                    time: min !== null ? minToTime(min) : null,
                    durationMin: b.durationMin || effectiveDur,
                  }
                : b
            ),
          };
        }

        return {
          ...t,
          due: iso,
          dueTime: min !== null ? minToTime(min) : null,
          durationMin: effectiveDur,
        };
      }),
    }));

    const task = state.tasks.find((x) => x.id === taskId);
    toast(
      `Scheduled “${task?.title ?? "task"}” · ${fmtDayShort(iso)}${
        min !== null ? ` at ${minToTime(min)}` : " (All Day)"
      }`,
      "ok"
    );
    setHover(null);
    setDragDuration(60);
  };

  const busyNow = (() => {
    const list = blocksByDay.get(today) ?? [];
    return list.find(
      (b) =>
        nowMin >= timeToMin(b.time ?? "") && nowMin < timeToMin(b.time ?? "") + b.durationMin
    );
  })();

  /* ---------------- schedule view (Google Calendar chronological feed) ---------------- */
  if (view === "schedule") {
    return (
      <div className="flex flex-col gap-3 w-full max-w-full overflow-x-hidden">
        <Header
          view={view}
          setView={setView}
          label={label}
          navigate={navigate}
          onToday={() => {
            setAnchor(todayIso());
            setSelectedDay(todayIso());
          }}
          isTodayActive={isTodayActive}
          busyNow={busyNow?.title ?? null}
        />
        <Tray unscheduled={unscheduled} onDragItem={setDragDuration} />
        <div className="flex flex-col gap-3 w-full min-w-0">
          {scheduleDays.map((iso) => {
            const blocks = blocksByDay.get(iso) ?? [];
            const allDayItems = allDayByDay.get(iso) ?? [];
            const isToday = iso === today;
            const minTracked = tracked.get(iso) ?? 0;
            const d = parseIso(iso);
            const dayNum = d.getDate();
            const totalCount = blocks.length + allDayItems.length;

            return (
              <div
                key={iso}
                className={cn(
                  "card p-3 w-full min-w-0 flex flex-col gap-2 transition-all",
                  isToday
                    ? "!border-[var(--accent)] border-[1.5px] border-l-[5px] !border-l-[var(--accent)] shadow-md shadow-[var(--accent)]/15"
                    : ""
                )}
              >
                <div
                  className="flex items-center justify-between pb-1.5 border-b"
                  style={{ borderColor: "var(--line)" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold",
                        isToday
                          ? "bg-[var(--accent)] text-[var(--on-accent)]"
                          : "bg-[var(--panel2)] text-[var(--text)]"
                      )}
                    >
                      {dayNum}
                    </span>
                    <div>
                      <div className="text-[12px] font-bold flex items-center gap-1.5">
                        <span>{fmtDayShort(iso)}</span>
                        {isToday && (
                          <span className="chip !text-[9.5px] !py-0 !px-1.5 text-accent font-bold">
                            Today
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px]" style={{ color: "var(--mut)" }}>
                        {totalCount} {totalCount === 1 ? "item" : "items"}{" "}
                        {minTracked > 0 && `· ${fmtDur(minTracked)} tracked`}
                      </div>
                    </div>
                  </div>
                  <Btn
                    size="sm"
                    variant="soft"
                    onClick={() => openTaskDialog({ presetDate: iso })}
                    className="!p-1.5 h-7"
                    title="Add to this day"
                  >
                    <Plus size={13} />
                  </Btn>
                </div>

                {totalCount === 0 ? (
                  <div className="py-2 text-center text-[11.5px] italic" style={{ color: "var(--mut)" }}>
                    No events scheduled
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 w-full min-w-0">
                    {/* All-day items */}
                    {allDayItems.map((item) => {
                      const p = state.projects.find((x) => x.id === item.projectId);
                      const projColor = p?.color ?? (item.isHabit ? "var(--ok)" : "var(--accent)");
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (justInteractedRef.current) return;
                            if (item.isHabit) {
                              const habit = state.habits.find((h) => h.id === item.taskId);
                              if (habit) {
                                const has = habit.completions.includes(item.date);
                                set((s) => ({
                                  ...s,
                                  habits: s.habits.map((h) =>
                                    h.id === habit.id
                                      ? {
                                          ...h,
                                          completions: has
                                            ? h.completions.filter((d) => d !== item.date)
                                            : [...h.completions, item.date],
                                        }
                                      : h
                                  ),
                                }));
                                toast(
                                  has
                                    ? `Unchecked habit “${habit.name}”`
                                    : `Completed habit “${habit.name}”! 🎉`,
                                  "ok"
                                );
                              }
                              return;
                            }
                            openTaskDialog({ taskId: item.taskId });
                          }}
                          className={cn(
                            "relative flex items-center gap-2.5 p-2 rounded-lg bg-[var(--panel2)] hover:bg-[var(--panel)] cursor-pointer transition-colors w-full min-w-0 border",
                            item.done && "opacity-60 bg-[var(--panel)]"
                          )}
                          style={{
                            borderColor: `color-mix(in srgb, ${projColor} 30%, transparent)`,
                          }}
                        >
                          {/* 3.5px accent bar */}
                          <div
                            className="absolute left-1.5 top-1.5 bottom-1.5 w-[3.5px] rounded-full pointer-events-none"
                            style={{ backgroundColor: projColor }}
                          />
                          <div className="flex flex-col shrink-0 min-w-[50px] pl-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-mut">
                              All Day
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 truncate">
                              {item.done ? (
                                <Check size={12} className="text-emerald-500 font-bold shrink-0" />
                              ) : item.isHabit ? (
                                <span className="text-[11px] shrink-0">🔁</span>
                              ) : item.emoji ? (
                                <span className="text-[12px] shrink-0">{item.emoji}</span>
                              ) : null}
                              <span className={cn("text-[12.5px] font-semibold truncate", item.done && "line-through opacity-75")}>
                                {item.title}
                              </span>
                              {item.label && (
                                <span className="chip !text-[9.5px] !py-0 !px-1 shrink-0">
                                  {item.label}
                                </span>
                              )}
                            </div>
                            {p && (
                              <div
                                className="text-[10.5px] flex items-center gap-1 mt-0.5"
                                style={{ color: p.color }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ background: p.color }}
                                />
                                <span className="truncate">{p.name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Timed blocks */}
                    {blocks.map((b) => {
                      const p = state.projects.find((x) => x.id === b.projectId);
                      const task = state.tasks.find((x) => x.id === b.taskId);
                      const projColor = b.isFocusSession
                        ? "var(--ok)"
                        : b.done
                        ? "var(--ok)"
                        : (p?.color ?? "var(--accent)");
                      return (
                        <div
                          key={b.id}
                          onClick={() => {
                            if (justInteractedRef.current) return;
                            if (b.isFocusSession && b.sessionId) {
                              const sess = state.sessions.find((s) => s.id === b.sessionId);
                              if (sess) setEditingSession(sess);
                              return;
                            }
                            openTaskDialog({ taskId: b.taskId });
                          }}
                          className={cn(
                            "relative flex items-center gap-2.5 p-2 rounded-lg bg-[var(--panel2)] hover:bg-[var(--panel)] cursor-pointer transition-colors w-full min-w-0 border",
                            b.done && "opacity-60 bg-[var(--panel)]"
                          )}
                          style={{
                            borderColor: `color-mix(in srgb, ${projColor} 30%, transparent)`,
                          }}
                        >
                          {/* 3.5px accent bar */}
                          <div
                            className="absolute left-1.5 top-1.5 bottom-1.5 w-[3.5px] rounded-full pointer-events-none"
                            style={{ backgroundColor: projColor }}
                          />
                          <div className="flex flex-col shrink-0 min-w-[50px] pl-2">
                            <span className="text-[11.5px] font-bold tnum">{b.time}</span>
                            <span className="text-[10px]" style={{ color: "var(--mut)" }}>
                              {b.durationMin}m
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 truncate">
                              {b.done ? (
                                <Check size={12} className="text-emerald-500 font-bold shrink-0" />
                              ) : b.isFocusSession ? (
                                <span className="text-[10px] shrink-0">⚡</span>
                              ) : b.emoji ? (
                                <span className="text-[12px]">{b.emoji}</span>
                              ) : null}
                              <span className={cn("text-[12.5px] font-semibold truncate", b.done && "line-through opacity-75")}>
                                {b.title}
                              </span>
                              {b.label && (
                                <span className="chip !text-[9.5px] !py-0 !px-1 shrink-0">
                                  {b.label}
                                </span>
                              )}
                            </div>
                            {p && (
                              <div
                                className="text-[10.5px] flex items-center gap-1 mt-0.5"
                                style={{ color: p.color }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ background: p.color }}
                                />
                                <span className="truncate">{p.name}</span>
                              </div>
                            )}
                          </div>
                          {task && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                set((s) => ({
                                  ...s,
                                  tasks: s.tasks.map((t) =>
                                    t.id === task.id ? { ...t, done: !t.done } : t
                                  ),
                                }));
                              }}
                              className="p-1 rounded hover:bg-[var(--panel)] shrink-0 text-mut hover:text-accent"
                              title={task.done ? "Mark incomplete" : "Mark done"}
                            >
                              <Check
                                size={14}
                                className={task.done ? "text-accent" : "opacity-40"}
                              />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---------------- month view (Google Calendar mobile style: dots + agenda) ---------------- */
  if (view === "month") {
    const selectedDayBlocks = blocksByDay.get(selectedDay) ?? [];
    const selectedDayAllDay = allDayByDay.get(selectedDay) ?? [];
    const totalSelected = selectedDayBlocks.length + selectedDayAllDay.length;
    const selectedDayTracked = tracked.get(selectedDay) ?? 0;

    return (
      <div className="flex flex-col gap-3 w-full max-w-full overflow-x-hidden">
        <Header
          view={view}
          setView={setView}
          label={label}
          navigate={navigate}
          onToday={() => {
            setAnchor(todayIso());
            setSelectedDay(todayIso());
          }}
          isTodayActive={isTodayActive}
          busyNow={busyNow?.title ?? null}
        />
        <Tray unscheduled={unscheduled} onDragItem={setDragDuration} />

        {/* Compact 7-day Google Calendar dot grid */}
        <div className="card overflow-hidden w-full min-w-0 p-2">
          <div
            className="grid grid-cols-7 border-b pb-1 mb-1"
            style={{ borderColor: "var(--line)" }}
          >
            {WEEKDAYS_SHORT.map((d) => (
              <div
                key={d}
                className="text-center py-1 text-[11px] font-bold uppercase tracking-wider"
                style={{ color: "var(--mut)" }}
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {monthCells.map((iso) => {
              const inMonth = parseIso(iso).getMonth() === parseIso(anchor).getMonth();
              const blocks = blocksByDay.get(iso) ?? [];
              const allDay = allDayByDay.get(iso) ?? [];
              const combined = [...allDay, ...blocks];
              const isToday = iso === today;
              const isSelected = iso === selectedDay;
              const cellDate = parseIso(iso).getDate();

              return (
                <div
                  key={iso}
                  onClick={() => setSelectedDay(iso)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add("drop-hot");
                  }}
                  onDragLeave={(e) => e.currentTarget.classList.remove("drop-hot")}
                  onDrop={(e) => {
                    e.currentTarget.classList.remove("drop-hot");
                    dropOn(iso, null)(e);
                  }}
                  className={cn(
                    "flex flex-col items-center justify-start py-1.5 px-0.5 rounded-lg cursor-pointer transition-colors min-h-[50px] relative",
                    isSelected
                      ? "bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]"
                      : "hover:bg-[var(--panel2)]"
                  )}
                  style={{
                    opacity: inMonth ? 1 : 0.35,
                  }}
                >
                  <span
                    className={cn(
                      "w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-bold tnum",
                      isToday
                        ? "bg-[var(--accent)] text-[var(--on-accent)] shadow-sm"
                        : isSelected
                        ? "font-extrabold text-accent"
                        : "text-[var(--text)]"
                    )}
                  >
                    {cellDate}
                  </span>

                  {/* Dot indicators for tasks/blocks */}
                  <div className="flex items-center justify-center gap-0.5 mt-1 max-w-full flex-wrap px-0.5">
                    {combined.slice(0, 3).map((b, i) => {
                      const p = state.projects.find((x) => x.id === b.projectId);
                      const dotColor = p?.color ?? (b.isHabit ? "var(--ok)" : "var(--accent)");
                      return (
                        <span
                          key={b.id || i}
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: dotColor }}
                        />
                      );
                    })}
                    {combined.length > 3 && (
                      <span className="text-[8px] font-bold leading-none text-mut">
                        +{combined.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda panel below Month grid */}
        <div className="card p-3 flex flex-col gap-2.5 w-full min-w-0">
          <div
            className="flex items-center justify-between pb-2 border-b"
            style={{ borderColor: "var(--line)" }}
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[13.5px] font-bold">
                  {fmtDateLong(parseIso(selectedDay))}
                </h3>
                {selectedDay === today && (
                  <span className="chip !text-[10px] !py-0 !px-1.5 text-accent font-bold">
                    Today
                  </span>
                )}
              </div>
              <p className="text-[11px] font-medium mt-0.5" style={{ color: "var(--mut)" }}>
                {totalSelected}{" "}
                {totalSelected === 1 ? "item" : "items"}
                {selectedDayTracked > 0 && ` · ${fmtDur(selectedDayTracked)} tracked`}
              </p>
            </div>
            <Btn
              size="sm"
              variant="primary"
              onClick={() => openTaskDialog({ presetDate: selectedDay })}
              className="gap-1 text-[12px]"
            >
              <Plus size={13} /> Add Block
            </Btn>
          </div>

          {totalSelected === 0 ? (
            <div className="py-6 text-center flex flex-col items-center justify-center gap-2">
              <Clock3 size={24} className="opacity-30 text-mut" />
              <p className="text-[12.5px] font-semibold text-mut">
                No blocks scheduled for this day
              </p>
              <Btn
                size="sm"
                variant="soft"
                onClick={() => openTaskDialog({ presetDate: selectedDay })}
                className="gap-1 text-[11.5px]"
              >
                <Plus size={12} /> Schedule task
              </Btn>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 w-full min-w-0">
              {/* All-day items for selected day */}
              {selectedDayAllDay.map((item) => {
                const p = state.projects.find((x) => x.id === item.projectId);
                const projColor = p?.color ?? (item.isHabit ? "var(--ok)" : "var(--accent)");
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (justInteractedRef.current) return;
                      if (item.isHabit) {
                        const habit = state.habits.find((h) => h.id === item.taskId);
                        if (habit) {
                          const has = habit.completions.includes(item.date);
                          set((s) => ({
                            ...s,
                            habits: s.habits.map((h) =>
                              h.id === habit.id
                                ? {
                                    ...h,
                                    completions: has
                                      ? h.completions.filter((d) => d !== item.date)
                                      : [...h.completions, item.date],
                                  }
                                : h
                            ),
                          }));
                          toast(
                            has
                              ? `Unchecked habit “${habit.name}”`
                              : `Completed habit “${habit.name}”! 🎉`,
                            "ok"
                          );
                        }
                        return;
                      }
                      openTaskDialog({ taskId: item.taskId });
                    }}
                    className={cn(
                      "relative flex items-center gap-2.5 p-2 rounded-lg bg-[var(--panel2)] hover:bg-[var(--panel)] cursor-pointer transition-colors w-full min-w-0 border",
                      item.done && "opacity-60 bg-[var(--panel)]"
                    )}
                    style={{
                      borderColor: `color-mix(in srgb, ${projColor} 30%, transparent)`,
                    }}
                  >
                    {/* 3.5px accent bar */}
                    <div
                      className="absolute left-1.5 top-1.5 bottom-1.5 w-[3.5px] rounded-full pointer-events-none"
                      style={{ backgroundColor: projColor }}
                    />
                    <div className="flex flex-col shrink-0 min-w-[50px] pl-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-mut">
                        All Day
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        {item.done ? (
                          <Check size={12} className="text-emerald-500 font-bold shrink-0" />
                        ) : item.isHabit ? (
                          <span className="text-[11px] shrink-0">🔁</span>
                        ) : item.emoji ? (
                          <span className="text-[12px]">{item.emoji}</span>
                        ) : null}
                        <span className={cn("text-[12.5px] font-semibold truncate", item.done && "line-through opacity-75")}>
                          {item.title}
                        </span>
                        {item.label && (
                          <span className="chip !text-[9.5px] !py-0 !px-1 shrink-0">
                            {item.label}
                          </span>
                        )}
                      </div>
                      {p && (
                        <div
                          className="text-[10.5px] flex items-center gap-1 mt-0.5"
                          style={{ color: p.color }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: p.color }}
                          />
                          <span className="truncate">{p.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Timed blocks for selected day */}
              {selectedDayBlocks.map((b) => {
                const p = state.projects.find((x) => x.id === b.projectId);
                const task = state.tasks.find((x) => x.id === b.taskId);
                const projColor = b.isFocusSession
                  ? "var(--ok)"
                  : b.done
                  ? "var(--ok)"
                  : (p?.color ?? "var(--accent)");
                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      if (justInteractedRef.current) return;
                      if (b.isFocusSession && b.sessionId) {
                        const sess = state.sessions.find((s) => s.id === b.sessionId);
                        if (sess) setEditingSession(sess);
                        return;
                      }
                      openTaskDialog({ taskId: b.taskId });
                    }}
                    className={cn(
                      "relative flex items-center gap-2.5 p-2 rounded-lg bg-[var(--panel2)] hover:bg-[var(--panel)] cursor-pointer transition-colors w-full min-w-0 border",
                      b.done && "opacity-60 bg-[var(--panel)]"
                    )}
                    style={{
                      borderColor: `color-mix(in srgb, ${projColor} 30%, transparent)`,
                    }}
                  >
                    {/* 3.5px accent bar */}
                    <div
                      className="absolute left-1.5 top-1.5 bottom-1.5 w-[3.5px] rounded-full pointer-events-none"
                      style={{ backgroundColor: projColor }}
                    />
                    <div className="flex flex-col shrink-0 min-w-[50px] pl-2">
                      <span className="text-[12px] font-bold tnum">{b.time}</span>
                      <span className="text-[10px]" style={{ color: "var(--mut)" }}>
                        {b.durationMin}m
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        {b.done ? (
                          <Check size={12} className="text-emerald-500 font-bold shrink-0" />
                        ) : b.isFocusSession ? (
                          <span className="text-[10px] shrink-0">⚡</span>
                        ) : b.emoji ? (
                          <span className="text-[12px]">{b.emoji}</span>
                        ) : null}
                        <span className={cn("text-[12.5px] font-semibold truncate", b.done && "line-through opacity-75")}>
                          {b.title}
                        </span>
                        {b.label && (
                          <span className="chip !text-[9.5px] !py-0 !px-1 shrink-0">
                            {b.label}
                          </span>
                        )}
                      </div>
                      {p && (
                        <div
                          className="text-[10.5px] flex items-center gap-1 mt-0.5"
                          style={{ color: p.color }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: p.color }}
                          />
                          <span className="truncate">{p.name}</span>
                        </div>
                      )}
                    </div>
                    {task ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          set((s) => ({
                            ...s,
                            tasks: s.tasks.map((t) =>
                              t.id === task.id ? { ...t, done: !t.done } : t
                            ),
                          }));
                        }}
                        className="p-1 rounded hover:bg-[var(--panel)] shrink-0 text-mut hover:text-accent"
                        title={task.done ? "Mark incomplete" : "Mark done"}
                      >
                        <Check
                          size={14}
                          className={task.done ? "text-accent" : "opacity-40"}
                        />
                      </button>
                    ) : b.isHabit ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const habit = state.habits.find((h) => h.id === b.taskId);
                          if (habit) {
                            const has = habit.completions.includes(b.date);
                            set((s) => ({
                              ...s,
                              habits: s.habits.map((h) =>
                                h.id === habit.id
                                  ? {
                                      ...h,
                                      completions: has
                                        ? h.completions.filter((d) => d !== b.date)
                                        : [...h.completions, b.date],
                                    }
                                  : h
                              ),
                            }));
                            toast(has ? `Unchecked habit “${habit.name}”` : `Completed habit “${habit.name}”! 🎉`, "ok");
                          }
                        }}
                        className="p-1 rounded hover:bg-[var(--panel)] shrink-0 text-mut hover:text-accent"
                        title={b.done ? "Mark incomplete" : "Mark done"}
                      >
                        <Check
                          size={14}
                          className={b.done ? "text-accent" : "opacity-40"}
                        />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------------- day / 3day / week ---------------- */
  return (
    <div className="flex flex-col gap-3 w-full max-w-full overflow-x-hidden">
      <Header
        view={view}
        setView={setView}
        label={label}
        navigate={navigate}
        onToday={() => {
          setAnchor(todayIso());
          setSelectedDay(todayIso());
        }}
        isTodayActive={isTodayActive}
        busyNow={busyNow?.title ?? null}
      />
      <Tray unscheduled={unscheduled} onDragItem={setDragDuration} />
      <div
        ref={timelineScrollerRef}
        className={cn(
          "card w-full max-w-full max-h-[calc(100vh-220px)] sm:max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-none",
          view === "day" ? "overflow-x-hidden" : "overflow-x-auto"
        )}
      >
        <div className={cn("flex flex-col w-full", view === "day" ? "min-w-0" : view === "3day" ? "min-w-[480px]" : "min-w-[640px]")}>
          {/* 1. Day headers row */}
          <div className="sticky top-0 z-30 flex border-b bg-[var(--panel)] shadow-sm" style={{ borderColor: "var(--line)" }}>
            <div className="w-[50px] shrink-0 border-r h-[34px] bg-[var(--panel)]" style={{ borderColor: "var(--line)" }} />
            {days.map((iso) => {
              const rawBlocks = blocksByDay.get(iso) ?? [];
              const busyMin = rawBlocks.reduce((a, b) => a + b.durationMin, 0);
              const isToday = iso === today;
              const wk = (parseIso(iso).getDay() + 6) % 7;
              return (
                <div
                  key={iso}
                  className={cn(
                    "flex-1 border-r last:border-r-0 flex h-[34px] items-center justify-between px-2",
                    view === "day" ? "min-w-0" : "min-w-[150px]"
                  )}
                  style={{
                    borderColor: "var(--line)",
                    background: isToday ? "var(--accent-soft)" : "var(--panel)",
                  }}
                >
                  <span className="text-[11.5px] font-bold">
                    <span style={{ color: "var(--mut)" }}>{WEEKDAYS_SHORT[wk]}</span>{" "}
                    <span
                      className={cn("tnum rounded px-1")}
                      style={
                        isToday
                          ? { background: "var(--accent)", color: "var(--on-accent)" }
                          : {}
                      }
                    >
                      {parseIso(iso).getDate()}
                    </span>
                  </span>
                  <span
                    className="text-[9.5px] font-bold uppercase tracking-wide"
                    style={{ color: busyMin > 0 ? "var(--accent)" : "var(--mut)" }}
                  >
                    {busyMin > 0 ? `busy ${fmtDur(busyMin)}` : "free"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 2. All-Day Row */}
          <div className="sticky top-[34px] z-20 flex border-b bg-[var(--panel2)]/95 backdrop-blur-sm" style={{ borderColor: "var(--line)" }}>
            <div
              className="w-[50px] shrink-0 border-r flex items-center justify-center text-[9px] font-bold uppercase tracking-wider select-none"
              style={{ borderColor: "var(--line)", color: "var(--mut)" }}
            >
              all-day
            </div>
            {days.map((iso) => {
              const allDayItems = allDayByDay.get(iso) ?? [];
              return (
                <div
                  key={iso}
                  className={cn(
                    "flex-1 border-r last:border-r-0 p-1 flex flex-col gap-1 min-h-[34px] justify-center transition-colors",
                    view === "day" ? "min-w-0" : "min-w-[150px]"
                  )}
                  style={{ borderColor: "var(--line)" }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add("bg-[var(--accent-soft)]");
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove("bg-[var(--accent-soft)]");
                  }}
                  onDrop={(e) => {
                    e.currentTarget.classList.remove("bg-[var(--accent-soft)]");
                    dropOn(iso, null)(e);
                  }}
                  onClick={() => {
                    if (justInteractedRef.current) return;
                    openTaskDialog({ presetDate: iso });
                  }}
                  title="Click to add all-day task · drop tasks here"
                >
                  {allDayItems.length === 0 && (
                    <div className="h-full w-full flex items-center justify-center opacity-0 hover:opacity-100 text-[10px] font-semibold text-mut pointer-events-none select-none">
                      + All-day
                    </div>
                  )}
                  {allDayItems.map((item) => {
                    const p = state.projects.find((x) => x.id === item.projectId);
                    const projColor = p?.color ?? (item.isHabit ? "var(--ok)" : "var(--accent)");
                    return (
                      <div
                        key={item.id}
                        draggable={!item.done}
                        onDragStart={(e) => {
                          if (item.done) return;
                          setDragDuration(60);
                          e.dataTransfer.setData(
                            "lifelog/drag",
                            JSON.stringify({
                              taskId: item.taskId,
                              blockId: item.blockId,
                              isHabit: !!item.isHabit,
                              durationMin: 60,
                            })
                          );
                          e.dataTransfer.setData("lifelog/task", item.taskId);
                          e.stopPropagation();
                        }}
                        onDragEnd={() => {
                          setHover(null);
                          setDragDuration(60);
                          justInteractedRef.current = true;
                          setTimeout(() => {
                            justInteractedRef.current = false;
                          }, 250);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (justInteractedRef.current) return;
                          if (item.isHabit) {
                            const habit = state.habits.find((h) => h.id === item.taskId);
                            if (habit) {
                              const has = habit.completions.includes(item.date);
                              set((s) => ({
                                ...s,
                                habits: s.habits.map((h) =>
                                  h.id === habit.id
                                    ? {
                                        ...h,
                                        completions: has
                                          ? h.completions.filter((d) => d !== item.date)
                                          : [...h.completions, item.date],
                                      }
                                    : h
                                ),
                              }));
                              toast(
                                has
                                  ? `Unchecked habit “${habit.name}”`
                                  : `Completed habit “${habit.name}”! 🎉`,
                                "ok"
                              );
                            }
                            return;
                          }
                          openTaskDialog({ taskId: item.taskId });
                        }}
                        className={cn(
                          "group relative flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all select-none cursor-pointer truncate",
                          item.done ? "opacity-60 bg-[var(--panel)]" : "hover:scale-[1.01]"
                        )}
                        style={{
                          backgroundColor: item.done
                            ? "var(--panel2)"
                            : `color-mix(in srgb, ${projColor} 16%, var(--panel2))`,
                          borderColor: `color-mix(in srgb, ${projColor} 38%, transparent)`,
                          color: "var(--text)",
                        }}
                        title={`${item.title}${item.isHabit ? " (Habit)" : " (All Day)"}${item.done ? " [DONE]" : ""}`}
                      >
                        <div
                          className="w-[3px] self-stretch rounded-full shrink-0 -my-0.5 -ml-1"
                          style={{ backgroundColor: projColor }}
                        />
                        {item.done ? (
                          <Check size={11} className="text-emerald-500 font-bold shrink-0" />
                        ) : item.isHabit ? (
                          <span className="text-[10px] shrink-0">🔁</span>
                        ) : item.emoji ? (
                          <span className="text-[11px] shrink-0">{item.emoji}</span>
                        ) : null}
                        <span className={cn("truncate flex-1 min-w-0", item.done && "line-through opacity-70")}>
                          {item.title}
                        </span>
                        {item.label && (
                          <span className="chip !text-[8.5px] !py-0 !px-1 shrink-0 opacity-80">
                            {item.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* 3. Hourly Grid */}
          <div className="flex w-full">
            {/* gutter */}
            <div
              className="relative w-[50px] shrink-0 border-r"
              style={{ borderColor: "var(--line)", height: GRID_H }}
            >
              {Array.from({ length: H1 - H0 }, (_, i) => (
                <div
                  key={i}
                  className="absolute right-1.5 text-[10px] font-bold tnum"
                  style={{ top: i * HOUR_H - 6, color: "var(--mut)" }}
                >
                  {String(H0 + i).padStart(2, "0")}:00
                </div>
              ))}
              {/* Live time gutter indicator */}
              {nowMin >= H0 * 60 && nowMin <= H1 * 60 && (
                <div
                  className="absolute right-1 z-30 px-1 py-0.5 rounded text-[9px] font-bold text-white bg-red-500 shadow-sm font-mono leading-none"
                  style={{ top: ((nowMin - H0 * 60) / 60) * HOUR_H - 7 }}
                >
                  {minToTime(nowMin)}
                </div>
              )}
            </div>

            {/* Day columns */}
            {days.map((iso) => {
              const rawBlocks = blocksByDay.get(iso) ?? [];
              const blocks = layoutOverlappingBlocks(rawBlocks);
              const isToday = iso === today;
              return (
                <div
                  key={iso}
                  className={cn(
                    "relative flex-1 border-r last:border-r-0",
                    view === "day" ? "min-w-0 w-full" : "min-w-[150px]"
                  )}
                  style={{ borderColor: "var(--line)" }}
                >
                  {/* grid */}
                  <div
                    className="relative"
                    style={{ height: GRID_H }}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const y = e.clientY - rect.top;
                      const rawMin = H0 * 60 + (y / HOUR_H) * 60;
                      const snapped = Math.max(
                        H0 * 60,
                        Math.min(H1 * 60 - 15, Math.floor(rawMin / 15) * 15)
                      );
                      potentialCreateRef.current = {
                        iso,
                        slotMin: snapped,
                        startY: e.clientY,
                        startX: e.clientX,
                      };
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const raw = ((e.clientY - rect.top) / HOUR_H) * 60 + H0 * 60;
                      const dur = dragDuration || 60;
                      const snapped = Math.max(
                        H0 * 60,
                        Math.min(H1 * 60 - dur, Math.floor(raw / 15) * 15)
                      );
                      if (!hover || hover.iso !== iso || hover.min !== snapped || hover.durationMin !== dur) {
                        setHover({ iso, min: snapped, durationMin: dur });
                      }
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setHover((curr) => (curr?.iso === iso ? null : curr));
                      }
                    }}
                    onDrop={dropOn(iso, hover?.iso === iso ? hover.min : H0 * 60)}
                  >
                    {Array.from({ length: (H1 - H0) * 2 }, (_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-t pointer-events-none"
                        style={{
                          top: i * (HOUR_H / 2),
                          borderColor:
                            i % 2 === 0
                              ? "var(--line)"
                              : "color-mix(in srgb, var(--line) 45%, transparent)",
                        }}
                      />
                    ))}

                    {/* Live current time red indicator line */}
                    {isToday && nowMin >= H0 * 60 && nowMin <= H1 * 60 && (
                      <div
                        className="pointer-events-none absolute left-0 right-0 z-30 flex items-center"
                        style={{
                          top: ((nowMin - H0 * 60) / 60) * HOUR_H,
                        }}
                      >
                        <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-md -ml-1.5 ring-2 ring-red-400/40 shrink-0" />
                        <div className="h-[2px] flex-1 bg-red-500 shadow-sm" />
                      </div>
                    )}

                    {/* Drag-and-drop hover preview (only when not resizing and not drag-creating) */}
                    {hover?.iso === iso && !resizing && !dragCreate && (
                      <div
                        className="pointer-events-none absolute left-1 right-1 z-20 flex flex-col items-center justify-center rounded-xl border-2 border-dashed text-[11px] font-bold shadow-md transition-all"
                        style={{
                          top: ((hover.min - H0 * 60) / 60) * HOUR_H,
                          height: Math.max(26, ((hover.durationMin || 60) / 60) * HOUR_H),
                          borderColor: "var(--accent)",
                          background: "var(--accent-soft)",
                          color: "var(--accent)",
                        }}
                      >
                        <span>{minToTime(hover.min)} – {minToTime(hover.min + (hover.durationMin || 60))}</span>
                        <span className="text-[9.5px] font-normal opacity-85">
                          {fmtDur(hover.durationMin || 60)}
                        </span>
                      </div>
                    )}

                    {/* Direct Drag-to-Create live translucent block preview */}
                    {dragCreate && dragCreate.iso === iso && (() => {
                      const createStart = Math.min(dragCreate.startMin, dragCreate.currentMin);
                      const createEnd = Math.max(dragCreate.startMin, dragCreate.currentMin);
                      const createDur = Math.max(15, createEnd - createStart);
                      const createTop = ((createStart - H0 * 60) / 60) * HOUR_H;
                      const createH = Math.max(26, (createDur / 60) * HOUR_H);

                      return (
                        <div
                          className="pointer-events-none absolute left-1 right-1 z-30 flex flex-col justify-between rounded-xl border-2 border-[var(--accent)] bg-[var(--accent-soft)] p-2 text-[11px] font-bold shadow-xl transition-none"
                          style={{
                            top: createTop,
                            height: createH,
                            color: "var(--accent)",
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">⚡</span>
                            <span className="font-bold truncate">New Time Block</span>
                          </div>
                          <div className="text-[10px] font-semibold tnum opacity-90 mt-auto">
                            {minToTime(createStart)} – {minToTime(createStart + createDur)} · {fmtDur(createDur)}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Scheduled and Focus blocks */}
                    {blocks.map((b) => {
                      const start = timeToMin(b.time ?? "09:00");
                      const isResizingThis = resizing && resizing.targetItemId === b.id;
                      const displayStartMin = isResizingThis ? resizing.currentStartMin : start;
                      const displayDuration = isResizingThis ? resizing.currentDur : b.durationMin;
                      const top = ((displayStartMin - H0 * 60) / 60) * HOUR_H;
                      const h = Math.max(26, (displayDuration / 60) * HOUR_H);
                      const p = state.projects.find((x) => x.id === b.projectId);
                      const projColor = b.isFocusSession
                        ? "var(--ok)"
                        : b.done
                        ? "var(--ok)"
                        : (p?.color ?? "var(--accent)");
                      const leftPct = (b.colIndex / b.numCols) * 100;
                      const widthPct = 100 / b.numCols;

                      return (
                        <div
                          key={b.id}
                          draggable={!b.done && !b.isFocusSession}
                          onDragStart={(e) => {
                            if (b.done || b.isFocusSession) return;
                            setDragDuration(b.durationMin || 60);
                            e.dataTransfer.setData(
                              "lifelog/drag",
                              JSON.stringify({
                                taskId: b.taskId,
                                blockId: b.blockId,
                                isHabit: !!b.isHabit,
                                durationMin: b.durationMin || 60,
                              })
                            );
                            e.dataTransfer.setData("lifelog/task", b.taskId);
                            e.stopPropagation();
                          }}
                          onDragEnd={() => {
                            setHover(null);
                            setDragDuration(60);
                            justInteractedRef.current = true;
                            setTimeout(() => {
                              justInteractedRef.current = false;
                            }, 250);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (mouseResizeActiveRef.current || justInteractedRef.current) return;
                            if (b.isHabit) {
                              const habit = state.habits.find((h) => h.id === b.taskId);
                              if (habit) {
                                const has = habit.completions.includes(b.date);
                                set((s) => ({
                                  ...s,
                                  habits: s.habits.map((h) =>
                                    h.id === habit.id
                                      ? {
                                          ...h,
                                          completions: has
                                            ? h.completions.filter((d) => d !== b.date)
                                            : [...h.completions, b.date],
                                        }
                                      : h
                                  ),
                                }));
                                toast(
                                  has
                                    ? `Unchecked habit “${habit.name}”`
                                    : `Completed habit “${habit.name}”! 🎉`,
                                  "ok"
                                );
                              }
                              return;
                            }
                            if (!b.isFocusSession) {
                              openTaskDialog({ taskId: b.taskId });
                            } else if (b.sessionId) {
                              const sess = state.sessions.find((s) => s.id === b.sessionId);
                              if (sess) setEditingSession(sess);
                            }
                          }}
                          className={cn(
                            "group absolute z-[5] overflow-hidden rounded-md border text-[11px] transition-all select-none",
                            b.done && "opacity-75"
                          )}
                          style={{
                            top,
                            height: h,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                            backgroundColor: b.isFocusSession
                              ? "color-mix(in srgb, var(--ok) 14%, var(--panel2))"
                              : b.done
                              ? "color-mix(in srgb, var(--ok) 10%, var(--panel2))"
                              : `color-mix(in srgb, ${projColor} ${
                                  b.snoozed ? 10 : 18
                                }%, var(--panel2))`,
                            borderColor: b.isFocusSession
                              ? "color-mix(in srgb, var(--ok) 35%, transparent)"
                              : b.done
                              ? "color-mix(in srgb, var(--ok) 30%, transparent)"
                              : `color-mix(in srgb, ${projColor} 32%, transparent)`,
                            cursor: b.done ? "pointer" : "grab",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                          }}
                          title={`${b.title}${b.label ? ` · ${b.label}` : ""} (${displayDuration}m)${
                            b.done ? " [COMPLETED]" : ""
                          } · ${minToTime(displayStartMin)}–${minToTime(displayStartMin + displayDuration)}`}
                        >
                          {/* Top resize handle for adjusting start time */}
                          {!b.done && !b.isFocusSession && (
                            <div
                              onMouseDown={(e) => handleResizeStart(e, b, "top")}
                              onTouchStart={(e) => handleResizeStart(e, b, "top")}
                              className="absolute top-0 left-0 right-0 h-2.5 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-black/10 dark:hover:bg-white/10"
                              title="Drag top edge to adjust start time (15m increments)"
                            >
                              <div className="w-5 h-0.5 rounded-full bg-white/60 dark:bg-white/40 shadow-sm" />
                            </div>
                          )}

                          {/* 3.5px vertical accent pill bar */}
                          <div
                            className="absolute left-1 top-1 bottom-1 w-[3.5px] rounded-full pointer-events-none"
                            style={{
                              backgroundColor: projColor,
                            }}
                          />

                          {/* Content area padded to clear the 3px pill bar */}
                          <div className="flex flex-col h-full pl-3 pr-1 py-0.5 overflow-hidden leading-tight">
                            <div className="flex items-center gap-1 min-w-0">
                              {b.done ? (
                                <Check size={11} className="text-emerald-500 font-bold shrink-0" />
                              ) : b.isFocusSession ? (
                                <span className="text-[10px] shrink-0">⚡</span>
                              ) : b.blockId ? (
                                <Layers size={10} className="text-accent shrink-0" />
                              ) : null}
                              <span
                                className={cn(
                                  "truncate font-bold text-[11px] text-[var(--text)]",
                                  b.done && "line-through opacity-70"
                                )}
                              >
                                {b.emoji ? `${b.emoji} ` : ""}
                                {b.title}
                              </span>
                            </div>

                            {b.label && (
                              <div className="text-[9.5px] font-medium text-accent truncate opacity-90">
                                {b.label}
                                {b.pauses && b.pauses.length > 0 && (
                                  <span className="ml-1 text-[9px] text-[var(--warn)]">
                                    ({b.pauses.length} {b.pauses.length === 1 ? "pause" : "pauses"})
                                  </span>
                                )}
                              </div>
                            )}

                            {h >= 34 && (
                              <div
                                className="tnum text-[9.5px] font-semibold mt-auto truncate"
                                style={{ color: "var(--mut)" }}
                              >
                                {minToTime(displayStartMin)}–{minToTime(displayStartMin + displayDuration)} · {fmtDur(displayDuration)}
                              </div>
                            )}
                          </div>

                          {/* Bottom resize handle for adjusting duration */}
                          {!b.done && !b.isFocusSession && (
                            <div
                              onMouseDown={(e) => handleResizeStart(e, b, "bottom")}
                              onTouchStart={(e) => handleResizeStart(e, b, "bottom")}
                              className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-black/10 dark:hover:bg-white/10"
                              title="Drag bottom edge to adjust duration (15m increments)"
                            >
                              <div className="w-5 h-1 rounded-full bg-white/60 dark:bg-white/40 shadow-sm" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 4. Worked time footer */}
          <div className="flex border-t" style={{ borderColor: "var(--line)" }}>
            <div
              className="w-[50px] shrink-0 border-r h-[26px] flex items-center justify-end pr-1 text-[9px] font-bold uppercase text-mut"
              style={{ borderColor: "var(--line)" }}
            >
              worked
            </div>
            {days.map((iso) => (
              <div
                key={iso}
                className={cn(
                  "flex-1 border-r last:border-r-0 flex h-[26px] items-center justify-between px-2 text-[10px] font-bold",
                  view === "day" ? "min-w-0" : "min-w-[150px]"
                )}
                style={{ borderColor: "var(--line)", color: "var(--mut)" }}
              >
                <span>total</span>
                <span
                  className="tnum"
                  style={{ color: (tracked.get(iso) ?? 0) > 0 ? "var(--ok)" : "var(--mut)" }}
                >
                  {fmtDur(tracked.get(iso) ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="text-[11.5px] font-semibold" style={{ color: "var(--mut)" }}>
        Drag tasks or calendar blocks from the tray onto any time slot · drag blocks across days ·
        click empty slot to add
      </div>

      {editingSession && (
        <EditSessionModal
          session={editingSession}
          tasks={state.tasks}
          projects={state.projects}
          onSave={(updated) => {
            set((st) => ({
              ...st,
              sessions: st.sessions.map((x) => (x.id === updated.id ? updated : x)),
            }));
            toast("Focus session updated", "ok");
          }}
          onDelete={(sessionId) => {
            set((st) => ({
              ...st,
              sessions: st.sessions.filter((x) => x.id !== sessionId),
            }));
            toast("Focus session deleted", "ok");
          }}
          onClose={() => setEditingSession(null)}
        />
      )}

      {quickBlockModal && (
        <QuickBlockSchedulerModal
          open={quickBlockModal.open}
          date={quickBlockModal.date}
          time={quickBlockModal.time}
          durationMin={quickBlockModal.durationMin}
          onClose={() => setQuickBlockModal(null)}
          onAssignTask={handleAssignBacklogTask}
          onCreateAndSchedule={handleCreateAndScheduleNewTask}
          onStartFocusNow={handleStartFocusFromBlock}
          tasks={state.tasks}
          projects={state.projects}
        />
      )}
    </div>
  );
}

/* ---------------- header & tray ---------------- */
function Header({
  view,
  setView,
  label,
  navigate,
  onToday,
  isTodayActive,
  busyNow,
}: {
  view: CalView;
  setView: (v: CalView) => void;
  label: string;
  navigate: (d: -1 | 1) => void;
  onToday: () => void;
  isTodayActive: boolean;
  busyNow: string | null;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Dedicated standalone Today button */}
        <button
          type="button"
          onClick={onToday}
          className={cn(
            "px-3 py-1.5 rounded-xl text-[12.5px] font-bold border transition-all active:scale-95 shadow-sm",
            isTodayActive
              ? "bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)] shadow-sm"
              : "bg-[var(--panel2)] hover:bg-[var(--panel)] text-[var(--text)] border-[var(--line)]"
          )}
          title="Jump to Today"
        >
          Today
        </button>

        {/* Navigation cluster with date range/title between arrows */}
        <div className="flex items-center gap-1.5 bg-[var(--panel2)] px-2 py-1 rounded-xl border border-[var(--line)] shadow-sm">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1 rounded-lg hover:bg-[var(--panel)] text-mut hover:text-[var(--text)] transition-colors active:scale-95"
            title="Previous"
            aria-label="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-[13.5px] sm:text-[14.5px] font-bold tracking-tight text-[var(--text)] px-1 sm:px-2 select-none min-w-0 truncate text-center">
            {label}
          </h2>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="p-1 rounded-lg hover:bg-[var(--panel)] text-mut hover:text-[var(--text)] transition-colors active:scale-95"
            title="Next"
            aria-label="Next"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Live Free / Busy status pill */}
        <div className="flex items-center gap-2 text-[11px] font-medium" style={{ color: "var(--mut)" }}>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold tracking-wide",
              busyNow
                ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                busyNow ? "bg-red-500 animate-pulse" : "bg-emerald-500"
              )}
            />
            {busyNow ? `Busy · ${busyNow}` : "Free now"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto sm:ml-0">
        <Seg
          options={[
            { value: "schedule", label: "Schedule" },
            { value: "day", label: "Day" },
            { value: "3day", label: "3D" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>
    </div>
  );
}

function Tray({
  unscheduled,
  onDragItem,
}: {
  unscheduled: UnscheduledItem[];
  onDragItem?: (dur: number) => void;
}) {
  const { state, set, toast, openTaskDialog } = useApp();
  const [isHot, setIsHot] = useState(false);

  const handleDropOnTray = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHot(false);
    const rawData = e.dataTransfer.getData("lifelog/drag");
    const taskIdFallback = e.dataTransfer.getData("lifelog/task");

    let taskId = taskIdFallback;
    let blockId: string | undefined = undefined;
    let isHabit = false;

    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        taskId = parsed.taskId;
        blockId = parsed.blockId;
        isHabit = Boolean(parsed.isHabit);
      } catch {}
    }

    if (!taskId) return;

    if (isHabit || state.habits.some((h) => h.id === taskId)) {
      const habit = state.habits.find((h) => h.id === taskId);
      set((s) => ({
        ...s,
        habits: s.habits.map((h) => (h.id === taskId ? { ...h, time: undefined } : h)),
      }));
      toast(`Reset habit “${habit?.name ?? "habit"}” calendar time block`, "ok");
      return;
    }

    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;

    set((s) => ({
      ...s,
      tasks: s.tasks.map((t) => {
        if (t.id !== taskId) return t;

        // If it was a multi-block task:
        if (blockId && t.timeBlocks) {
          return {
            ...t,
            timeBlocks: t.timeBlocks.map((b) =>
              b.id === blockId
                ? {
                    ...b,
                    time: null,
                    date: null,
                  }
                : b
            ),
          };
        }

        // Single block task: clear dueTime so it leaves the calendar time-grid and returns to unscheduled!
        return {
          ...t,
          dueTime: null,
        };
      }),
    }));

    toast(`Unscheduled “${task.title}” · returned to tray`, "ok");
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsHot(true);
      }}
      onDragLeave={() => setIsHot(false)}
      onDrop={handleDropOnTray}
      className={cn(
        "card flex items-center gap-2 overflow-x-auto p-2.5 w-full max-w-full scrollbar-none transition-all",
        isHot && "ring-2 ring-[var(--accent)] bg-[var(--accent-soft)]"
      )}
    >
      <span
        className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors"
        style={{ color: isHot ? "var(--accent)" : "var(--mut)" }}
      >
        <Inbox size={13} /> {isHot ? "Release to unblock time & return task" : `Drag to schedule (${unscheduled.length})`}
      </span>
      {unscheduled.length === 0 && !isHot && (
        <span className="text-[12px] font-semibold" style={{ color: "var(--mut)" }}>
          Everything is scheduled — drag blocks here to unblock time.
        </span>
      )}
      {unscheduled.map((item, idx) => {
        const p = state.projects.find((x) => x.id === item.projectId);
        return (
          <div
            key={item.blockId ? `${item.taskId}-${item.blockId}` : `${item.taskId}-${idx}`}
            draggable
            onDragStart={(e) => {
              const dur = item.durationMin || 60;
              onDragItem?.(dur);
              e.dataTransfer.setData(
                "lifelog/drag",
                JSON.stringify({ taskId: item.taskId, blockId: item.blockId, durationMin: dur })
              );
              e.dataTransfer.setData("lifelog/task", item.taskId);
            }}
            onClick={() => openTaskDialog({ taskId: item.taskId })}
            className="chip shrink-0 !py-1 transition-transform hover:scale-[1.04]"
            style={{
              borderColor: `color-mix(in srgb, ${p?.color ?? "var(--accent)"} 55%, var(--line))`,
              cursor: "grab",
            }}
            title={`${item.title}${item.label ? ` · ${item.label}` : ""} (${item.durationMin}m) — drag onto calendar`}
          >
            <span className="h-[8px] w-[8px] rounded-full" style={{ background: p?.color }} />
            {item.emoji ? `${item.emoji} ` : ""}
            {item.title}
            {item.label && <span className="text-accent">[{item.label}]</span>}
            <span style={{ color: "var(--mut)" }}>· {item.durationMin}m</span>
          </div>
        );
      })}
    </div>
  );
}
