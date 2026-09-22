import React, { useEffect, useMemo, useState } from "react";
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

type CalView = "schedule" | "day" | "3day" | "week" | "month";
const H0 = 5; // grid starts 05:00
const H1 = 24; // grid ends 24:00
const HOUR_H = 44;
const GRID_H = (H1 - H0) * HOUR_H;

function timeToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}
function minToTime(min: number): string {
  const h = Math.floor(min / 60);
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
  const { state, set, openTaskDialog, toast } = app;
  const [view, setView] = useState<CalView>("schedule");
  const [anchor, setAnchor] = useState(todayIso());
  const [selectedDay, setSelectedDay] = useState(todayIso());
  const [hover, setHover] = useState<{ iso: string; min: number; durationMin: number } | null>(null);
  const [dragDuration, setDragDuration] = useState<number>(60);
  const [resizing, setResizing] = useState<{
    taskId: string;
    blockId?: string;
    isHabit?: boolean;
    startY: number;
    initialDur: number;
    currentDur: number;
  } | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);

  const today = todayIso();
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());

  useEffect(() => {
    const t = setInterval(
      () => setNowMin(new Date().getHours() * 60 + new Date().getMinutes()),
      30000
    );
    return () => clearInterval(t);
  }, []);

  // Google Calendar interactive bottom-edge duration resizing handler
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, b: CalendarItem) => {
    e.stopPropagation();
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setResizing({
      taskId: b.taskId,
      blockId: b.blockId,
      isHabit: !!b.isHabit,
      startY: clientY,
      initialDur: b.durationMin || 60,
      currentDur: b.durationMin || 60,
    });
  };

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - resizing.startY;
      const deltaMin = Math.round(((deltaY / HOUR_H) * 60) / 15) * 15;
      const newDur = Math.max(15, resizing.initialDur + deltaMin);
      setResizing((r) => (r ? { ...r, currentDur: newDur } : null));
    };

    const handleMouseUp = () => {
      if (resizing.currentDur !== resizing.initialDur) {
        const finalDur = resizing.currentDur;
        set((s) => ({
          ...s,
          tasks: s.tasks.map((t) => {
            if (t.id !== resizing.taskId) return t;
            if (resizing.blockId && t.timeBlocks) {
              return {
                ...t,
                timeBlocks: t.timeBlocks.map((b) =>
                  b.id === resizing.blockId ? { ...b, durationMin: finalDur } : b
                ),
              };
            }
            return { ...t, durationMin: finalDur };
          }),
        }));
        toast(`Updated duration to ${fmtDur(finalDur)}`, "ok");
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

  const tracked = useMemo(() => trackedByDay(state.sessions), [state.sessions]);

  // Flatten both standard tasks, multi-blocks, habits, and focus sessions into CalendarItems
  const blocksByDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();

    for (const t of state.tasks) {
      if (state.settings.showLifeLogProject === false && t.projectId === LIFE_LOG_PROJECT_ID) continue;
      if (t.timeBlocks && t.timeBlocks.length > 0) {
        // Multi-block task
        for (const b of t.timeBlocks) {
          if (!b.date || !b.time) continue;
          const isDone = !!b.done || !!t.done;
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
          const arr = m.get(b.date) ?? [];
          arr.push(item);
          m.set(b.date, arr);
        }
      } else {
        // Single block task
        if (!t.due || !t.dueTime) continue;
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
        const arr = m.get(t.due) ?? [];
        arr.push(item);
        m.set(t.due, arr);
      }
    }

    // Project daily habits onto Calendar as reminder blocks (Feature 1.3)
    const sortedHabits = [...state.habits].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    sortedHabits.forEach((h, hIdx) => {
      const habitDays = new Set([...h.completions, todayIso()]);
      const defaultMin = 7 * 60 + 30 + (hIdx * 25);
      const habitTime = h.time || minToTime(defaultMin);
      for (const d of habitDays) {
        const isDone = h.completions.includes(d);
        const item: CalendarItem = {
          id: `h-${h.id}-${d}`,
          taskId: h.id,
          title: h.name,
          label: "Daily Habit",
          emoji: h.emoji,
          projectId: "habits-stream",
          date: d,
          time: habitTime,
          durationMin: 20,
          done: isDone,
          isHabit: true,
        };
        const arr = m.get(d) ?? [];
        arr.push(item);
        m.set(d, arr);
      }
    });

    // Project Executed Focus Sessions & Pauses onto Calendar Timeline
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

      const arr = m.get(sDate) ?? [];
      // If there is an existing scheduled item for the SAME task overlapping this session,
      // replace it so the task is not duplicated on the calendar!
      const sEndMin = sStartMin + sDurationMin;
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
        arr.push(item);
      }
      m.set(sDate, arr);
    }

    for (const arr of m.values()) {
      arr.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
    }
    return m;
  }, [state.tasks, state.habits, state.sessions, state.settings.showLifeLogProject]);

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

  const navigate = (dir: -1 | 1) => {
    if (view === "month") {
      const d = parseIso(anchor);
      setAnchor(isoDate(new Date(d.getFullYear(), d.getMonth() + dir, Math.min(d.getDate(), 28))));
    } else if (view === "schedule") {
      setAnchor(addDaysIso(anchor, dir * 7));
    } else if (view === "3day") {
      setAnchor(addDaysIso(anchor, dir * 3));
    } else {
      setAnchor(addDaysIso(anchor, dir * (view === "week" ? 7 : 1)));
    }
  };

  const label = useMemo(() => {
    if (view === "month") {
      const d = parseIso(anchor);
      return `${
        [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ][d.getMonth()]
      } ${d.getFullYear()}`;
    }
    if (view === "schedule") {
      return `${fmtDayShort(anchor)} — ${fmtDayShort(addDaysIso(anchor, 13))}`;
    }
    if (days.length === 1) return fmtDayShort(days[0]);
    return `${fmtDayShort(days[0])} — ${fmtDayShort(days[days.length - 1])}`;
  }, [view, anchor, days]);

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
      const newTime = min !== null ? minToTime(min) : "08:00";
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
      toast(`Rescheduled habit “${habit?.name ?? "habit"}” to ${newTime}`, "ok");
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
                    time: min !== null ? minToTime(min) : b.time || "09:00",
                    durationMin: b.durationMin || effectiveDur,
                  }
                : b
            ),
          };
        }

        return {
          ...t,
          due: iso,
          dueTime: min !== null ? minToTime(min) : t.due === iso ? t.dueTime : "09:00",
          durationMin: effectiveDur,
        };
      }),
    }));

    const task = state.tasks.find((x) => x.id === taskId);
    toast(
      `Scheduled “${task?.title ?? "task"}” · ${fmtDayShort(iso)}${
        min !== null ? ` at ${minToTime(min)}` : ""
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
          busyNow={busyNow?.title ?? null}
        />
        <Tray unscheduled={unscheduled} onDragItem={setDragDuration} />
        <div className="flex flex-col gap-3 w-full min-w-0">
          {scheduleDays.map((iso) => {
            const blocks = blocksByDay.get(iso) ?? [];
            const isToday = iso === today;
            const minTracked = tracked.get(iso) ?? 0;
            const d = parseIso(iso);
            const dayNum = d.getDate();

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
                        {blocks.length} {blocks.length === 1 ? "block" : "blocks"}{" "}
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

                {blocks.length === 0 ? (
                  <div className="py-2 text-center text-[11.5px] italic" style={{ color: "var(--mut)" }}>
                    No events scheduled
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 w-full min-w-0">
                    {blocks.map((b) => {
                      const p = state.projects.find((x) => x.id === b.projectId);
                      const task = state.tasks.find((x) => x.id === b.taskId);
                      return (
                        <div
                          key={b.id}
                          onClick={() => openTaskDialog({ taskId: b.taskId })}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg bg-[var(--panel2)] hover:bg-[var(--panel)] cursor-pointer transition-colors w-full min-w-0 border-l-4",
                            b.done && "opacity-60 bg-[var(--panel)]"
                          )}
                          style={{ borderLeftColor: b.done ? "var(--ok)" : (p?.color ?? "var(--accent)") }}
                        >
                          <div className="flex flex-col shrink-0 min-w-[50px]">
                            <span className="text-[11.5px] font-bold tnum">{b.time}</span>
                            <span className="text-[10px]" style={{ color: "var(--mut)" }}>
                              {b.durationMin}m
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 truncate">
                              {b.done && <Check size={12} className="text-emerald-500 font-bold shrink-0" />}
                              {b.emoji && <span className="text-[12px]">{b.emoji}</span>}
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
                    {blocks.slice(0, 3).map((b, i) => {
                      const p = state.projects.find((x) => x.id === b.projectId);
                      return (
                        <span
                          key={b.id || i}
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: p?.color ?? "var(--accent)" }}
                        />
                      );
                    })}
                    {blocks.length > 3 && (
                      <span className="text-[8px] font-bold leading-none text-mut">
                        +{blocks.length - 3}
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
                {selectedDayBlocks.length}{" "}
                {selectedDayBlocks.length === 1 ? "block" : "blocks"}
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

          {selectedDayBlocks.length === 0 ? (
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
              {selectedDayBlocks.map((b) => {
                const p = state.projects.find((x) => x.id === b.projectId);
                const task = state.tasks.find((x) => x.id === b.taskId);
                return (
                  <div
                    key={b.id}
                    onClick={() => openTaskDialog({ taskId: b.taskId })}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--panel2)] hover:bg-[var(--panel)] cursor-pointer transition-colors w-full min-w-0 border-l-4"
                    style={{ borderLeftColor: p?.color ?? "var(--accent)" }}
                  >
                    <div className="flex flex-col shrink-0 min-w-[50px]">
                      <span className="text-[12px] font-bold tnum">{b.time}</span>
                      <span className="text-[10px]" style={{ color: "var(--mut)" }}>
                        {b.durationMin}m
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        {b.emoji && <span className="text-[12px]">{b.emoji}</span>}
                        <span className="text-[12.5px] font-semibold truncate">{b.title}</span>
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
        onToday={() => setAnchor(todayIso())}
        busyNow={busyNow?.title ?? null}
      />
      <Tray unscheduled={unscheduled} onDragItem={setDragDuration} />
      <div className={cn("card w-full max-w-full scrollbar-none", view === "day" ? "overflow-x-hidden" : "overflow-x-auto")}>
        <div className={cn("flex w-full", view === "day" ? "min-w-0" : view === "3day" ? "min-w-[480px]" : "min-w-[640px]")}>
          {/* gutter */}
          <div
            className="relative w-[50px] shrink-0 border-r"
            style={{ borderColor: "var(--line)", height: GRID_H + 34 }}
          >
            <div className="h-[34px]" />
            {Array.from({ length: H1 - H0 }, (_, i) => (
              <div
                key={i}
                className="absolute right-1.5 text-[10px] font-bold tnum"
                style={{ top: 34 + i * HOUR_H - 6, color: "var(--mut)" }}
              >
                {String(H0 + i).padStart(2, "0")}:00
              </div>
            ))}
            {/* Live time gutter indicator */}
            {nowMin >= H0 * 60 && nowMin <= H1 * 60 && (
              <div
                className="absolute right-1 z-30 px-1 py-0.5 rounded text-[9px] font-bold text-white bg-red-500 shadow-sm font-mono leading-none"
                style={{ top: 34 + ((nowMin - H0 * 60) / 60) * HOUR_H - 7 }}
              >
                {minToTime(nowMin)}
              </div>
            )}
          </div>

          {days.map((iso) => {
            const rawBlocks = blocksByDay.get(iso) ?? [];
            const blocks = layoutOverlappingBlocks(rawBlocks);
            const busyMin = rawBlocks.reduce((a, b) => a + b.durationMin, 0);
            const isToday = iso === today;
            const wk = (parseIso(iso).getDay() + 6) % 7;
            return (
              <div
                key={iso}
                className={cn(
                  "relative flex-1 border-r last:border-r-0",
                  view === "day" ? "min-w-0 w-full" : "min-w-[150px]"
                )}
                style={{ borderColor: "var(--line)" }}
              >
                {/* day header */}
                <div
                  className="sticky top-0 z-10 flex h-[34px] items-center justify-between border-b px-2"
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

                {/* grid */}
                <div
                  className="relative"
                  style={{ height: GRID_H }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const raw = ((e.clientY - rect.top) / HOUR_H) * 60 + H0 * 60;
                    const dur = dragDuration || 60;
                    const snapped = Math.max(
                      H0 * 60,
                      Math.min(H1 * 60 - dur, Math.floor(raw / 15) * 15)
                    );
                    if (!hover || hover.iso !== iso || hover.min !== snapped || hover.durationMin !== dur)
                      setHover({ iso, min: snapped, durationMin: dur });
                  }}
                  onDrop={dropOn(iso, hover?.iso === iso ? hover.min : H0 * 60)}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const rawMin = H0 * 60 + (y / HOUR_H) * 60;
                    const snapped = Math.max(
                      H0 * 60,
                      Math.min(H1 * 60 - 30, Math.floor(rawMin / 30) * 30)
                    );
                    openTaskDialog({ presetDate: iso, presetTime: minToTime(snapped) });
                  }}
                >
                  {Array.from({ length: (H1 - H0) * 2 }, (_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t"
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

                  {/* Duration-aware drag-and-drop hover preview */}
                  {hover?.iso === iso && (
                    <div
                      className="pointer-events-none absolute left-1 right-1 z-20 flex flex-col items-center justify-center rounded-lg border-2 border-dashed text-[11px] font-bold shadow-md transition-all"
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

                  {/* Scheduled and Focus blocks with Google Calendar overlapping split */}
                  {blocks.map((b) => {
                    const start = timeToMin(b.time ?? "09:00");
                    const top = ((start - H0 * 60) / 60) * HOUR_H;
                    const currentDuration =
                      resizing && resizing.taskId === b.taskId && resizing.blockId === b.blockId
                        ? resizing.currentDur
                        : b.durationMin;
                    const h = Math.max(26, (currentDuration / 60) * HOUR_H);
                    const p = state.projects.find((x) => x.id === b.projectId);
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
                        onClick={(e) => {
                          e.stopPropagation();
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
                                  : `Completed habit “${habit.name}! 🎉`,
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
                          "absolute z-[5] overflow-hidden rounded-lg border-l-[3px] px-2 py-1 transition-transform hover:scale-[1.015]",
                          b.done && "opacity-75"
                        )}
                        style={{
                          top,
                          height: h,
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          background: b.isFocusSession
                            ? "color-mix(in srgb, var(--ok) 16%, var(--panel2))"
                            : b.done
                            ? "color-mix(in srgb, var(--ok) 14%, var(--panel2))"
                            : `color-mix(in srgb, ${p?.color ?? "#888"} ${
                                b.snoozed ? 10 : 22
                              }%, var(--panel2))`,
                          borderLeftColor: b.isFocusSession
                            ? "var(--ok)"
                            : b.done
                            ? "var(--ok)"
                            : p?.color,
                          cursor: b.done ? "pointer" : "grab",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                        }}
                        title={`${b.title}${b.label ? ` · ${b.label}` : ""} (${currentDuration}m)${
                          b.done ? " [COMPLETED]" : ""
                        } · ${b.time}–${minToTime(start + currentDuration)}`}
                      >
                        <div className="flex items-center gap-1 leading-tight">
                          {b.done ? (
                            <Check size={11} className="text-emerald-500 font-bold shrink-0" />
                          ) : b.isFocusSession ? (
                            <span className="text-[10px] shrink-0">⚡</span>
                          ) : b.blockId ? (
                            <Layers size={10} className="text-accent shrink-0" />
                          ) : null}
                          <span
                            className={cn(
                              "truncate text-[11px] font-bold",
                              b.done && "line-through opacity-70"
                            )}
                          >
                            {b.emoji ? `${b.emoji} ` : ""}
                            {b.title}
                          </span>
                        </div>
                        {b.label && (
                          <div
                            className={cn(
                              "text-[9.5px] font-medium text-accent truncate",
                              b.done && "opacity-60"
                            )}
                          >
                            {b.label}
                            {b.pauses && b.pauses.length > 0 && (
                              <span className="ml-1 text-[9px] text-[var(--warn)]">
                                ({b.pauses.length} {b.pauses.length === 1 ? "pause" : "pauses"})
                              </span>
                            )}
                          </div>
                        )}
                        {h >= 36 && (
                          <div
                            className="tnum text-[9.5px] font-bold mt-0.5"
                            style={{ color: "var(--mut)" }}
                          >
                            {b.time}–{minToTime(start + currentDuration)} · {currentDuration}m
                          </div>
                        )}

                        {/* Google Calendar bottom resize handle */}
                        {!b.done && !b.isFocusSession && (
                          <div
                            onMouseDown={(e) => handleResizeStart(e, b)}
                            onTouchStart={(e) => handleResizeStart(e, b)}
                            className="absolute bottom-0 left-0 right-0 h-2.5 cursor-ns-resize flex items-center justify-center hover:bg-white/20 transition-colors group z-20"
                            title="Drag to resize duration (15m increments)"
                          >
                            <div className="w-5 h-0.5 rounded-full bg-white/40 group-hover:bg-white/90" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* worked time footer */}
                <div
                  className="flex h-[26px] items-center justify-between border-t px-2 text-[10px] font-bold"
                  style={{ borderColor: "var(--line)", color: "var(--mut)" }}
                >
                  <span>worked</span>
                  <span
                    className="tnum"
                    style={{ color: (tracked.get(iso) ?? 0) > 0 ? "var(--ok)" : "var(--mut)" }}
                  >
                    {fmtDur(tracked.get(iso) ?? 0)}
                  </span>
                </div>
              </div>
            );
          })}
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
  busyNow,
}: {
  view: CalView;
  setView: (v: CalView) => void;
  label: string;
  navigate: (d: -1 | 1) => void;
  onToday: () => void;
  busyNow: string | null;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 w-full">
      <div>
        <h1 className="font-display text-[22px] sm:text-[24px] font-bold tracking-tight">Calendar</h1>
        <p
          className="flex items-center gap-2 text-[12.5px] font-semibold"
          style={{ color: "var(--mut)" }}
        >
          <Clock3 size={13} className="shrink-0" />
          <span className="truncate">{label}</span>
          <span
            className="chip !py-0 text-[10px] max-w-[170px] truncate"
            style={{ color: busyNow ? "var(--danger)" : "var(--ok)" }}
          >
            now: {busyNow ? `busy · ${busyNow}` : "free"}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
        <Btn variant="soft" size="sm" onClick={() => navigate(-1)} aria-label="Previous">
          <ChevronLeft size={14} />
        </Btn>
        <Btn variant="outline" size="sm" onClick={onToday}>
          Today
        </Btn>
        <Btn variant="soft" size="sm" onClick={() => navigate(1)} aria-label="Next">
          <ChevronRight size={14} />
        </Btn>
        <div className="ml-auto sm:ml-0">
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
