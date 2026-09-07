import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock3, Inbox, Layers, Plus } from "lucide-react";
import type { Task, TaskTimeBlock } from "../types";
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
  title: string;
  label?: string;
  emoji?: string | null;
  projectId: string;
  date: string;
  time: string;
  durationMin: number;
  snoozed?: boolean;
  done?: boolean;
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
  const [hover, setHover] = useState<{ iso: string; min: number } | null>(null);
  const today = todayIso();
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());

  useEffect(() => {
    const t = setInterval(
      () => setNowMin(new Date().getHours() * 60 + new Date().getMinutes()),
      30000
    );
    return () => clearInterval(t);
  }, []);

  const tracked = useMemo(() => trackedByDay(state.sessions), [state.sessions]);

  // Flatten both standard tasks and multi-blocks into CalendarItems
  const blocksByDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();

    for (const t of state.tasks) {
      if (t.done) continue;

      if (t.timeBlocks && t.timeBlocks.length > 0) {
        // Multi-block task
        for (const b of t.timeBlocks) {
          if (!b.date || !b.time || b.done) continue;
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
        };
        const arr = m.get(t.due) ?? [];
        arr.push(item);
        m.set(t.due, arr);
      }
    }

    for (const arr of m.values()) {
      arr.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
    }
    return m;
  }, [state.tasks]);

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
  }, [state.tasks]);

  // Drag and drop handler
  const dropOn = (iso: string, min: number | null) => (e: React.DragEvent) => {
    e.preventDefault();
    const rawData = e.dataTransfer.getData("lifelog/drag");
    const taskIdFallback = e.dataTransfer.getData("lifelog/task");

    let taskId = taskIdFallback;
    let blockId: string | undefined = undefined;

    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        taskId = parsed.taskId;
        blockId = parsed.blockId;
      } catch {
        // ignore
      }
    }

    if (!taskId) return;

    set((s) => ({
      ...s,
      tasks: s.tasks.map((t) => {
        if (t.id !== taskId) return t;

        if (blockId && t.timeBlocks) {
          return {
            ...t,
            timeBlocks: t.timeBlocks.map((b) =>
              b.id === blockId
                ? {
                    ...b,
                    date: iso,
                    time: min !== null ? minToTime(min) : b.time || "09:00",
                  }
                : b
            ),
          };
        }

        return {
          ...t,
          due: iso,
          dueTime: min !== null ? minToTime(min) : t.due === iso ? t.dueTime : "09:00",
          durationMin: t.durationMin || 60,
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
        <Tray unscheduled={unscheduled} />
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
                          className="flex items-center gap-2 p-2 rounded-lg bg-[var(--panel2)] hover:bg-[var(--panel)] cursor-pointer transition-colors w-full min-w-0 border-l-4"
                          style={{ borderLeftColor: p?.color ?? "var(--accent)" }}
                        >
                          <div className="flex flex-col shrink-0 min-w-[50px]">
                            <span className="text-[11.5px] font-bold tnum">{b.time}</span>
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
        <Tray unscheduled={unscheduled} />

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
      <Tray unscheduled={unscheduled} />
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
          </div>

          {days.map((iso) => {
            const blocks = blocksByDay.get(iso) ?? [];
            const busyMin = blocks.reduce((a, b) => a + b.durationMin, 0);
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
                    const snapped = Math.max(
                      H0 * 60,
                      Math.min(H1 * 60 - 30, Math.floor(raw / 30) * 30)
                    );
                    if (!hover || hover.iso !== iso || hover.min !== snapped)
                      setHover({ iso, min: snapped });
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

                  {hover?.iso === iso && (
                    <div
                      className="pointer-events-none absolute left-1 right-1 z-10 flex items-center justify-center rounded-lg border-2 border-dashed text-[11px] font-bold"
                      style={{
                        top: ((hover.min - H0 * 60) / 60) * HOUR_H,
                        height: HOUR_H,
                        borderColor: "var(--accent)",
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                      }}
                    >
                      {minToTime(hover.min)} – {minToTime(hover.min + 60)}
                    </div>
                  )}

                  {/* scheduled blocks */}
                  {blocks.map((b) => {
                    const start = timeToMin(b.time ?? "09:00");
                    const top = ((start - H0 * 60) / 60) * HOUR_H;
                    const h = Math.max(26, (b.durationMin / 60) * HOUR_H);
                    const p = state.projects.find((x) => x.id === b.projectId);
                    return (
                      <div
                        key={b.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            "lifelog/drag",
                            JSON.stringify({ taskId: b.taskId, blockId: b.blockId })
                          );
                          e.dataTransfer.setData("lifelog/task", b.taskId);
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openTaskDialog({ taskId: b.taskId });
                        }}
                        className="absolute left-1 right-1 z-[5] overflow-hidden rounded-lg border-l-[3px] px-2 py-1 transition-transform hover:scale-[1.015]"
                        style={{
                          top,
                          height: h,
                          background: `color-mix(in srgb, ${p?.color ?? "#888"} ${
                            b.snoozed ? 10 : 22
                          }%, var(--panel2))`,
                          borderLeftColor: p?.color,
                          cursor: "grab",
                          opacity: b.snoozed ? 0.6 : 1,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                        }}
                        title={`${b.title}${b.label ? ` · ${b.label}` : ""} (${b.durationMin}m) · ${b.time}–${minToTime(start + b.durationMin)}`}
                      >
                        <div className="flex items-center gap-1 leading-tight">
                          {b.blockId && <Layers size={10} className="text-accent shrink-0" />}
                          <span className="truncate text-[11px] font-bold">
                            {b.emoji ? `${b.emoji} ` : ""}
                            {b.title}
                          </span>
                        </div>
                        {b.label && (
                          <div className="text-[9.5px] font-medium text-accent truncate">
                            {b.label}
                          </div>
                        )}
                        {h >= 38 && (
                          <div className="tnum text-[9.5px] font-bold" style={{ color: "var(--mut)" }}>
                            {b.time}–{minToTime(start + b.durationMin)} · {b.durationMin}m
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* now indicator */}
                  {isToday && nowMin >= H0 * 60 && nowMin <= H1 * 60 && (
                    <div
                      className="pointer-events-none absolute left-0 right-0 z-20"
                      style={{ top: ((nowMin - H0 * 60) / 60) * HOUR_H }}
                    >
                      <div className="h-[2px]" style={{ background: "var(--danger)" }} />
                      <div
                        className="absolute -left-[4px] -top-[4px] h-[10px] w-[10px] rounded-full"
                        style={{ background: "var(--danger)", animation: "nowpulse 2s infinite" }}
                      />
                    </div>
                  )}
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

function Tray({ unscheduled }: { unscheduled: UnscheduledItem[] }) {
  const { state, openTaskDialog } = useApp();
  return (
    <div className="card flex items-center gap-2 overflow-x-auto p-2.5 w-full max-w-full scrollbar-none">
      <span
        className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider"
        style={{ color: "var(--mut)" }}
      >
        <Inbox size={13} /> Drag to schedule ({unscheduled.length})
      </span>
      {unscheduled.length === 0 && (
        <span className="text-[12px] font-semibold" style={{ color: "var(--mut)" }}>
          Everything is scheduled — tidy calendar.
        </span>
      )}
      {unscheduled.map((item, idx) => {
        const p = state.projects.find((x) => x.id === item.projectId);
        return (
          <div
            key={item.blockId ? `${item.taskId}-${item.blockId}` : `${item.taskId}-${idx}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(
                "lifelog/drag",
                JSON.stringify({ taskId: item.taskId, blockId: item.blockId })
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
