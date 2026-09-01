import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, Inbox } from "lucide-react";
import type { Task } from "../types";
import { useApp } from "../store";
import {
  WEEKDAYS_SHORT,
  addDaysIso,
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

type CalView = "day" | "3day" | "week" | "month";
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

export function CalendarView() {
  const app = useApp();
  const { state, set, openTaskDialog, toast } = app;
  const [view, setView] = useState<CalView>("week");
  const [anchor, setAnchor] = useState(todayIso());
  const [hover, setHover] = useState<{ iso: string; min: number } | null>(null);
  const today = todayIso();
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());
  useEffect(() => {
    const t = setInterval(() => setNowMin(new Date().getHours() * 60 + new Date().getMinutes()), 30000);
    return () => clearInterval(t);
  }, []);

  const tracked = useMemo(() => trackedByDay(state.sessions), [state.sessions]);

  const blocksByDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of state.tasks) {
      if (!t.due || !t.dueTime || t.done) continue;
      const arr = m.get(t.due) ?? [];
      arr.push(t);
      m.set(t.due, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.dueTime ?? "").localeCompare(b.dueTime ?? ""));
    return m;
  }, [state.tasks]);

  const days: string[] = useMemo(() => {
    if (view === "day") return [anchor];
    if (view === "3day") return listDates(anchor, addDaysIso(anchor, 2));
    if (view === "week") return listDates(weekStartIso(anchor), addDaysIso(weekStartIso(anchor), 6));
    return [];
  }, [view, anchor]);

  const monthCells = useMemo(() => {
    if (view !== "month") return [];
    const d = parseIso(anchor);
    const first = isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
    const start = weekStartIso(first);
    return listDates(start, addDaysIso(start, 41));
  }, [view, anchor]);

  const navigate = (dir: -1 | 1) => {
    if (view === "month") {
      const d = parseIso(anchor);
      setAnchor(isoDate(new Date(d.getFullYear(), d.getMonth() + dir, Math.min(d.getDate(), 28))));
    } else if (view === "3day") setAnchor(addDaysIso(anchor, dir * 3));
    else setAnchor(addDaysIso(anchor, dir * (view === "week" ? 7 : 1)));
  };

  const label = useMemo(() => {
    if (view === "month") {
      const d = parseIso(anchor);
      return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][d.getMonth()]} ${d.getFullYear()}`;
    }
    if (days.length === 1) return fmtDayShort(days[0]);
    return `${fmtDayShort(days[0])} — ${fmtDayShort(days[days.length - 1])}`;
  }, [view, anchor, days]);

  const unscheduled = useMemo(
    () => state.tasks.filter((t) => !t.done && (!t.due || !t.dueTime) && (!t.snoozedUntil || t.snoozedUntil <= Date.now())),
    [state.tasks],
  );

  const dropOn = (iso: string, min: number | null) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("lifelog/task");
    if (!id) return;
    set((s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              due: iso,
              dueTime: min !== null ? minToTime(min) : t.due === iso ? t.dueTime : null,
              durationMin: t.durationMin || 60,
            }
          : t,
      ),
    }));
    const t = state.tasks.find((x) => x.id === id);
    toast(`Blocked “${t?.title ?? "task"}” · ${fmtDayShort(iso)}${min !== null ? ` ${minToTime(min)}` : ""}`, "ok");
    setHover(null);
  };

  const busyNow = (() => {
    const list = blocksByDay.get(today) ?? [];
    return list.find((t) => nowMin >= timeToMin(t.dueTime ?? "") && nowMin < timeToMin(t.dueTime ?? "") + t.durationMin);
  })();

  /* ---------------- month view ---------------- */
  if (view === "month") {
    return (
      <div className="flex flex-col gap-3">
        <Header view={view} setView={setView} label={label} navigate={navigate} onToday={() => setAnchor(todayIso())} busyNow={busyNow?.title ?? null} />
        <Tray unscheduled={unscheduled} />
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--line)" }}>
            {WEEKDAYS_SHORT.map((d) => (
              <div key={d} className="px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((iso, i) => {
              const inMonth = parseIso(iso).getMonth() === parseIso(anchor).getMonth();
              const blocks = blocksByDay.get(iso) ?? [];
              const min = tracked.get(iso) ?? 0;
              const isToday = iso === today;
              return (
                <div
                  key={iso}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("drop-hot"); }}
                  onDragLeave={(e) => e.currentTarget.classList.remove("drop-hot")}
                  onDrop={(e) => { e.currentTarget.classList.remove("drop-hot"); dropOn(iso, null)(e); }}
                  onClick={() => openTaskDialog({ presetDate: iso })}
                  className={cn("min-h-[104px] cursor-pointer border-b border-r p-1.5 transition-colors hover:bg-[var(--panel2)]")}
                  style={{ borderColor: "var(--line)", opacity: inMonth ? 1 : 0.45, background: isToday ? "var(--accent-soft)" : undefined }}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("tnum rounded-md px-1.5 py-px text-[12px] font-bold")} style={isToday ? { background: "var(--accent)", color: "var(--on-accent)" } : { color: "var(--mut)" }}>
                      {parseIso(iso).getDate()}
                    </span>
                    {min > 0 && (
                      <span className="chip !border-0 !py-0 font-mono text-[9.5px]" style={{ background: "color-mix(in srgb, var(--ok) 18%, transparent)", color: "var(--ok)" }}>
                        {fmtDur(min)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-col gap-1">
                    {blocks.slice(0, 3).map((b) => {
                      const p = state.projects.find((x) => x.id === b.projectId);
                      return (
                        <div
                          key={b.id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("lifelog/task", b.id)}
                          onClick={(e) => { e.stopPropagation(); openTaskDialog({ taskId: b.id }); }}
                          className="truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-bold"
                          style={{ background: `color-mix(in srgb, ${p?.color ?? "#888"} 26%, transparent)`, color: "var(--text)", cursor: "grab" }}
                          title={`${b.title} · ${b.dueTime}`}
                        >
                          <span className="tnum" style={{ color: p?.color }}>{b.dueTime}</span> {b.title}
                        </div>
                      );
                    })}
                    {blocks.length > 3 && (
                      <span className="text-[10px] font-bold" style={{ color: "var(--mut)" }}>+{blocks.length - 3} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- day / 3day / week ---------------- */
  return (
    <div className="flex flex-col gap-3">
      <Header view={view} setView={setView} label={label} navigate={navigate} onToday={() => setAnchor(todayIso())} busyNow={busyNow?.title ?? null} />
      <Tray unscheduled={unscheduled} />
      <div className="card overflow-x-auto">
        <div className="flex min-w-[640px]">
          {/* gutter */}
          <div className="relative w-[52px] shrink-0 border-r" style={{ borderColor: "var(--line)", height: GRID_H + 34 }}>
            <div className="h-[34px]" />
            {Array.from({ length: H1 - H0 }, (_, i) => (
              <div key={i} className="absolute right-1.5 text-[10px] font-bold tnum" style={{ top: 34 + i * HOUR_H - 6, color: "var(--mut)" }}>
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
              <div key={iso} className="relative min-w-[150px] flex-1 border-r" style={{ borderColor: "var(--line)" }}>
                {/* day header */}
                <div className="sticky top-0 z-10 flex h-[34px] items-center justify-between border-b px-2" style={{ borderColor: "var(--line)", background: isToday ? "var(--accent-soft)" : "var(--panel)" }}>
                  <span className="text-[11.5px] font-bold">
                    <span style={{ color: "var(--mut)" }}>{WEEKDAYS_SHORT[wk]}</span>{" "}
                    <span className={cn("tnum rounded px-1")} style={isToday ? { background: "var(--accent)", color: "var(--on-accent)" } : {}}>{parseIso(iso).getDate()}</span>
                  </span>
                  <span className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: busyMin > 0 ? "var(--accent)" : "var(--mut)" }}>
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
                    const snapped = Math.max(H0 * 60, Math.min(H1 * 60 - 30, Math.floor(raw / 30) * 30));
                    if (!hover || hover.iso !== iso || hover.min !== snapped) setHover({ iso, min: snapped });
                  }}
                  onDragLeave={() => setHover(null)}
                  onDrop={dropOn(iso, hover?.iso === iso ? hover.min : H0 * 60)}
                  onClick={() => openTaskDialog({ presetDate: iso })}
                >
                  {Array.from({ length: (H1 - H0) * 2 }, (_, i) => (
                    <div key={i} className="absolute left-0 right-0 border-t" style={{ top: i * (HOUR_H / 2), borderColor: i % 2 === 0 ? "var(--line)" : "color-mix(in srgb, var(--line) 45%, transparent)" }} />
                  ))}
                  {hover?.iso === iso && (
                    <div
                      className="pointer-events-none absolute left-1 right-1 z-10 flex items-center justify-center rounded-lg border-2 border-dashed text-[11px] font-bold"
                      style={{ top: ((hover.min - H0 * 60) / 60) * HOUR_H, height: HOUR_H, borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--accent)" }}
                    >
                      {minToTime(hover.min)} – {minToTime(hover.min + 60)}
                    </div>
                  )}
                  {/* blocks */}
                  {blocks.map((b) => {
                    const start = timeToMin(b.dueTime ?? "09:00");
                    const top = ((start - H0 * 60) / 60) * HOUR_H;
                    const h = Math.max(24, (b.durationMin / 60) * HOUR_H);
                    const p = state.projects.find((x) => x.id === b.projectId);
                    const snoozed = b.snoozedUntil && b.snoozedUntil > Date.now();
                    return (
                      <div
                        key={b.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("lifelog/task", b.id); e.stopPropagation(); }}
                        onClick={(e) => { e.stopPropagation(); openTaskDialog({ taskId: b.id }); }}
                        className="absolute left-1 right-1 z-[5] overflow-hidden rounded-lg border-l-[3px] px-2 py-1 transition-transform hover:scale-[1.015]"
                        style={{
                          top, height: h,
                          background: `color-mix(in srgb, ${p?.color ?? "#888"} ${snoozed ? 10 : 22}%, var(--panel2))`,
                          borderLeftColor: p?.color,
                          cursor: "grab",
                          opacity: snoozed ? 0.6 : 1,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                        }}
                        title={`${b.title} · ${b.dueTime}–${minToTime(start + b.durationMin)}${snoozed ? " · snoozed" : ""}`}
                      >
                        <div className="truncate text-[11px] font-bold leading-tight">{b.emoji ? `${b.emoji} ` : ""}{b.title}</div>
                        {h >= 38 && (
                          <div className="tnum text-[9.5px] font-bold" style={{ color: "var(--mut)" }}>
                            {b.dueTime}–{minToTime(start + b.durationMin)} · {b.durationMin}m{snoozed ? " · ⏸ snoozed" : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* now indicator */}
                  {isToday && nowMin >= H0 * 60 && nowMin <= H1 * 60 && (
                    <div className="pointer-events-none absolute left-0 right-0 z-20" style={{ top: ((nowMin - H0 * 60) / 60) * HOUR_H }}>
                      <div className="h-[2px]" style={{ background: "var(--danger)" }} />
                      <div className="absolute -left-[4px] -top-[4px] h-[10px] w-[10px] rounded-full" style={{ background: "var(--danger)", animation: "nowpulse 2s infinite" }} />
                    </div>
                  )}
                </div>
                {/* worked time footer */}
                <div className="flex h-[26px] items-center justify-between border-t px-2 text-[10px] font-bold" style={{ borderColor: "var(--line)", color: "var(--mut)" }}>
                  <span>worked</span>
                  <span className="tnum" style={{ color: (tracked.get(iso) ?? 0) > 0 ? "var(--ok)" : "var(--mut)" }}>{fmtDur(tracked.get(iso) ?? 0)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="text-[11.5px] font-semibold" style={{ color: "var(--mut)" }}>
        Drag tasks from the tray onto a slot to time-block · drag blocks to move them · click a block to edit · click empty space for a new task
      </div>
    </div>
  );
}

/* ---------------- header & tray ---------------- */
function Header({ view, setView, label, navigate, onToday, busyNow }: {
  view: CalView; setView: (v: CalView) => void; label: string;
  navigate: (d: -1 | 1) => void; onToday: () => void; busyNow: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-[24px] font-bold tracking-tight">Calendar</h1>
        <p className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--mut)" }}>
          <Clock3 size={13} /> {label}
          <span className="chip !py-0 text-[10.5px]" style={{ color: busyNow ? "var(--danger)" : "var(--ok)" }}>
            now: {busyNow ? `busy · ${busyNow}` : "free"}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Btn variant="soft" onClick={() => navigate(-1)} aria-label="Previous"><ChevronLeft size={14} /></Btn>
        <Btn variant="outline" onClick={onToday}>Today</Btn>
        <Btn variant="soft" onClick={() => navigate(1)} aria-label="Next"><ChevronRight size={14} /></Btn>
        <Seg
          options={[
            { value: "day", label: "Day" },
            { value: "3day", label: "3 Day" },
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

function Tray({ unscheduled }: { unscheduled: Task[] }) {
  const { state, openTaskDialog } = useApp();
  return (
    <div className="card flex items-center gap-2 overflow-x-auto p-2.5">
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>
        <Inbox size={13} /> Drag to schedule
      </span>
      {unscheduled.length === 0 && (
        <span className="text-[12px] font-semibold" style={{ color: "var(--mut)" }}>Everything is scheduled — tidy calendar.</span>
      )}
      {unscheduled.map((t) => {
        const p = state.projects.find((x) => x.id === t.projectId);
        return (
          <div
            key={t.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("lifelog/task", t.id)}
            onClick={() => openTaskDialog({ taskId: t.id })}
            className="chip shrink-0 !py-1 transition-transform hover:scale-[1.04]"
            style={{ borderColor: `color-mix(in srgb, ${p?.color} 55%, var(--line))`, cursor: "grab" }}
            title={`${t.title} — drag onto the calendar`}
          >
            <span className="h-[8px] w-[8px] rounded-full" style={{ background: p?.color }} />
            {t.emoji ? `${t.emoji} ` : ""}{t.title}
            {t.due && !t.dueTime && <span style={{ color: "var(--mut)" }}>· {t.due}</span>}
          </div>
        );
      })}
    </div>
  );
}
