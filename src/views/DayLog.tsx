import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Flame,
  Pause,
  Timer,
  Moon,
  Clock,
  Zap,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { useApp } from "../store";
import { decryptText, getDeviceKey } from "../utils/crypto";
import {
  WEEKDAYS_SHORT,
  addDaysIso,
  fmtClock,
  fmtDayShort,
  fmtDur,
  fmtNoteName,
  isoDate,
  listDates,
  parseIso,
  sessionMinutes,
  streakStats,
  todayIso,
  weekStartIso,
  fmtTimeRange,
  fmtTimeStr,
  getTaskMinutesForDay,
  isSleepTask,
} from "../utils/core";
import { requestDailyNote } from "../utils/nav";
import { Btn, EmptyState, Modal, cn } from "../components/ui";
import { LIFE_LOG_CATEGORIES, LIFE_LOG_PROJECT_ID, type LifeLogCategory } from "../types";

export function DayLogView() {
  const { state, setView, toast } = useApp();
  const today = todayIso();
  const [sel, setSel] = useState(today);
  const [weekStart, setWeekStart] = useState(weekStartIso(today));
  const [notePreview, setNotePreview] = useState<string | null>(null);
  const [standupModalOpen, setStandupModalOpen] = useState(false);
  const [copiedStandup, setCopiedStandup] = useState(false);

  const week = useMemo(() => listDates(weekStart, addDaysIso(weekStart, 6)), [weekStart]);

  // Tracked minutes map: date -> total focus minutes
  const tracked = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of state.sessions) {
      if (s.mode === "break" || !s.taskId) continue;
      const key = isoDate(new Date(s.startedAt));
      map.set(key, (map.get(key) ?? 0) + sessionMinutes(s));
    }
    return map;
  }, [state.sessions]);

  const daySessions = useMemo(() => {
    return state.sessions.filter((s) => isoDate(new Date(s.startedAt)) === sel);
  }, [state.sessions, sel]);

  const dayDone = useMemo(
    () =>
      state.tasks.filter((t) => {
        if (t.done && t.doneAt && isoDate(new Date(t.doneAt)) === sel) return true;
        return t.completions.some((c) => isoDate(new Date(c.at)) === sel);
      }),
    [state.tasks, sel],
  );

  const byProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of daySessions) {
      if (s.mode === "break") continue;
      const t = s.taskId ? state.tasks.find((x) => x.id === s.taskId) : null;
      const pid = t?.projectId ?? "__unassigned";
      m.set(pid, (m.get(pid) ?? 0) + sessionMinutes(s));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [daySessions, state.tasks]);

  const allCategories: LifeLogCategory[] = useMemo(() => {
    return [...LIFE_LOG_CATEGORIES, ...(state.settings.customLifeLogCategories ?? [])];
  }, [state.settings.customLifeLogCategories]);

  // Tasks from LifeLog stream for the selected day (including cross-midnight sleep!):
  const dayLifeLogTasks = useMemo(() => {
    return state.tasks.filter((t) => {
      if (t.projectId !== LIFE_LOG_PROJECT_ID) return false;
      const minOnDay = getTaskMinutesForDay(t, sel);
      if (minOnDay > 0) return true;
      return (
        t.due === sel ||
        (!t.due && isoDate(new Date(t.createdAt)) === sel) ||
        (t.done && t.doneAt && isoDate(new Date(t.doneAt)) === sel)
      );
    });
  }, [state.tasks, sel]);

  const sleepTasks = useMemo(() => {
    return dayLifeLogTasks.filter((t) => isSleepTask(t));
  }, [dayLifeLogTasks]);

  const routineTasks = useMemo(() => {
    return dayLifeLogTasks.filter((t) => !isSleepTask(t));
  }, [dayLifeLogTasks]);

  // Cross-midnight sleep split: evening portion goes to start day, morning portion goes to wake-up day
  const sleepMin = useMemo(() => {
    return state.tasks
      .filter((t) => isSleepTask(t))
      .reduce((acc, t) => acc + getTaskMinutesForDay(t, sel), 0);
  }, [state.tasks, sel]);

  const routineMin = useMemo(() => {
    return state.tasks
      .filter((t) => t.projectId === LIFE_LOG_PROJECT_ID && !isSleepTask(t))
      .reduce((acc, t) => acc + getTaskMinutesForDay(t, sel), 0);
  }, [state.tasks, sel]);

  const log = state.dayLogs[sel];
  const totalMin = tracked.get(sel) ?? 0;
  const focusSessions = daySessions.filter((s) => s.taskId && s.mode !== "break");

  const dayTotalLoggedMin = sleepMin + routineMin + totalMin;
  const dayPct = Math.min(100, Math.round((dayTotalLoggedMin / 1440) * 100));
  const unloggedMin = Math.max(0, 1440 - dayTotalLoggedMin);

  /* decrypt daily note preview */
  useEffect(() => {
    let alive = true;
    setNotePreview(null);
    const note = state.notes.find((n) => n.daily && n.day === sel);
    if (!note) return;
    getDeviceKey().then((k) => decryptText(k, note.blob)).then((text) => {
      if (alive) setNotePreview(text.trim() || "");
    });
    return () => { alive = false; };
  }, [sel, state.notes]);

  const pickDay = (iso: string) => {
    setSel(iso);
    const ws = weekStartIso(iso);
    if (ws !== weekStart) setWeekStart(ws);
  };

  const isToday = sel === today;
  const maxProj = byProject.length ? byProject[0][1] : 1;
  const timeFmt = state.settings.timeFormat || "12h";

  const generateStandupMarkdown = () => {
    const dateHeader = fmtDayShort(sel);
    const sleepSummary =
      sleepMin > 0
        ? `${fmtDur(sleepMin)} (${sleepTasks.map((t) => t.title).join(", ") || "Logged sleep"})`
        : "None logged";
    const focusSummary =
      totalMin > 0
        ? `${fmtDur(totalMin)} across ${focusSessions.length} session${focusSessions.length !== 1 ? "s" : ""}`
        : "No sessions tracked";

    const projectsList = byProject
      .map(([pid, min]) => {
        const p = state.projects.find((x) => x.id === pid);
        return `  - **${p ? p.name : "Unassigned"}**: ${fmtDur(min)}`;
      })
      .join("\n");

    const completedTasksList =
      dayDone.length > 0
        ? dayDone
            .map((t) => {
              const p = state.projects.find((x) => x.id === t.projectId);
              return `- [x] **${t.title}** ${p ? `(#${p.name})` : ""}`;
            })
            .join("\n")
        : "- None logged yet";

    const habitsDone = state.habits.filter((h) => h.completions.includes(sel));
    const habitsList =
      habitsDone.length > 0
        ? habitsDone
            .map((h) => `- ✅ ${h.emoji} **${h.name}** (Streak: ${streakStats(h.completions).current}d)`)
            .join("\n")
        : "- None completed";

    const routinesList =
      routineTasks.length > 0
        ? routineTasks
            .map((r) => `- 🧘 **${r.title}** (${fmtDur(r.durationMin || 0)})`)
            .join("\n")
        : "- None";

    return `### 📅 Daily Standup & Summary — ${dateHeader} (${sel})

#### 😴 Sleep & Rest
${sleepSummary}

#### 🎯 Deep Focus & Pomodoro
- **Total Tracked**: ${focusSummary}
${projectsList ? `**By Project**:\n${projectsList}\n` : ""}
#### ✅ Tasks Completed (${dayDone.length})
${completedTasksList}

#### 🧘 Life Routines & Habits
**Routines**:
${routinesList}

**Habits**:
${habitsList}

---
*Generated by LifeLog OS · Crafted by Krish Patel*`;
  };

  const copyStandup = () => {
    const md = generateStandupMarkdown();
    navigator.clipboard.writeText(md);
    setCopiedStandup(true);
    toast("Daily standup copied to clipboard in Markdown!", "ok");
    setTimeout(() => setCopiedStandup(false), 2500);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[24px] font-bold tracking-tight">Day Log & Focus Stream</h1>
            <span className="chip !py-0.5 text-[10px] font-mono font-bold bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/30">
              {fmtDur(dayTotalLoggedMin)} tracked
            </span>
          </div>
          <p className="text-[13px] font-semibold" style={{ color: "var(--mut)" }}>
            The complete record of {fmtDayShort(sel)}{isToday ? " — today" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn
            variant="soft"
            onClick={() => setStandupModalOpen(true)}
            className="gap-1.5 text-xs font-bold border border-amber-500/30 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
            title="Generate automated daily standup in Markdown"
          >
            <Sparkles size={13} />
            <span className="hidden sm:inline">Daily Standup</span>
          </Btn>
          <Btn variant="soft" onClick={() => { const ws = addDaysIso(weekStart, -7); setWeekStart(ws); setSel(addDaysIso(sel, -7)); }} aria-label="Previous week"><ChevronLeft size={14} /></Btn>
          <Btn variant="outline" onClick={() => { setWeekStart(weekStartIso(today)); setSel(today); }}>Today</Btn>
          <Btn variant="soft" onClick={() => { const ws = addDaysIso(weekStart, 7); setWeekStart(ws); setSel(addDaysIso(sel, 7)); }} aria-label="Next week"><ChevronRight size={14} /></Btn>
        </div>
      </div>

      {/* Week strip */}
      <div className="card engine-panel grid grid-cols-7 gap-1.5 p-2 w-full min-w-0 overflow-hidden">
        {week.map((iso, i) => {
          const active = iso === sel;
          const hasWork = (tracked.get(iso) ?? 0) > 0;
          const hasLife = state.tasks.some((t) => t.projectId === LIFE_LOG_PROJECT_ID && (t.due === iso || (t.done && t.doneAt && isoDate(new Date(t.doneAt)) === iso)));
          const dayDoneCount = state.tasks.filter((t) => (t.done && t.doneAt && isoDate(new Date(t.doneAt)) === iso) || t.completions.some((c) => isoDate(new Date(c.at)) === iso)).length;
          return (
            <button
              key={iso}
              onClick={() => pickDay(iso)}
              className="flex flex-col items-center gap-1 rounded-xl border px-1 sm:px-2 py-2.5 transition-all hover:-translate-y-0.5 min-w-0 cursor-pointer"
              style={active
                ? { borderColor: "var(--accent)", background: "var(--accent-soft)" }
                : { borderColor: "var(--line)" }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: active ? "var(--accent)" : "var(--mut)" }}>{WEEKDAYS_SHORT[i]}</span>
              <span
                className={cn("tnum flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-bold shrink-0")}
                style={iso === today
                  ? { background: "var(--accent)", color: "var(--on-accent)" }
                  : active ? { color: "var(--accent)" } : { color: "var(--text)" }}
              >
                {parseIso(iso).getDate()}
              </span>
              <span className="flex h-[10px] items-center gap-1">
                {hasWork && <span className="h-[6px] w-[6px] rounded-full shrink-0 bg-sky-500" title={`${fmtDur(tracked.get(iso) ?? 0)} focused`} />}
                {hasLife && <span className="h-[6px] w-[6px] rounded-full shrink-0 bg-indigo-500" title="LifeLog tracked" />}
                {dayDoneCount > 0 && <span className="h-[6px] w-[6px] rounded-full shrink-0" style={{ background: "var(--accent)" }} title={`${dayDoneCount} done`} />}
              </span>
            </button>
          );
        })}
      </div>

      {/* 24-Hour Whole Day Balance & Focus Log Bar */}
      <div className="card engine-panel p-4 w-full min-w-0 overflow-hidden flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌊</span>
            <div>
              <span className="font-display text-[15px] font-bold tracking-tight">24h Day Balance & Focus Record</span>
              <div className="text-[11px] font-semibold text-[var(--mut)]">
                {fmtDur(dayTotalLoggedMin)} of 24h accounted for ({dayPct}%)
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono font-bold">
            <span className="text-indigo-400 flex items-center gap-1">😴 {fmtDur(sleepMin)} Sleep</span>
            <span className="text-sky-400 flex items-center gap-1">⚡ {fmtDur(totalMin)} Deep Focus</span>
            <span className="text-emerald-400 flex items-center gap-1">🧘 {fmtDur(routineMin)} Routines</span>
            <span className="text-[var(--mut)] flex items-center gap-1">⏳ {fmtDur(unloggedMin)} Free</span>
          </div>
        </div>

        {/* 24h colored strip */}
        <div className="h-3.5 w-full rounded-full overflow-hidden flex bg-[var(--panel2)] border border-[var(--line)]">
          {sleepMin > 0 && (
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${Math.min(100, (sleepMin / 1440) * 100)}%` }}
              title={`Sleep: ${fmtDur(sleepMin)}`}
            />
          )}
          {totalMin > 0 && (
            <div
              className="h-full bg-sky-500 transition-all duration-300"
              style={{ width: `${Math.min(100, (totalMin / 1440) * 100)}%` }}
              title={`Deep Focus: ${fmtDur(totalMin)}`}
            />
          )}
          {routineMin > 0 && (
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.min(100, (routineMin / 1440) * 100)}%` }}
              title={`Life & Routines: ${fmtDur(routineMin)}`}
            />
          )}
        </div>
      </div>

      {/* Stat Row */}
      <div className="stagger grid grid-cols-2 gap-2.5 lg:grid-cols-4 w-full min-w-0">
        {[
          { icon: <Zap size={16} />, k: "Deep Focus", v: fmtDur(totalMin), sub: `${focusSessions.length} session${focusSessions.length !== 1 ? "s" : ""}`, hot: totalMin > 0 },
          { icon: <Moon size={16} />, k: "Sleep Tracked", v: fmtDur(sleepMin), sub: sleepTasks[0]?.dueTime ? fmtTimeRange(sleepTasks[0].dueTime, sleepMin, timeFmt) : `${sleepTasks.length} log${sleepTasks.length !== 1 ? "s" : ""}`, hot: sleepMin > 0 },
          { icon: <Sparkles size={16} />, k: "Life & Routines", v: fmtDur(routineMin), sub: `${routineTasks.length} activit${routineTasks.length !== 1 ? "ies" : "y"}`, hot: routineMin > 0 },
          { icon: <CheckCircle2 size={16} />, k: "Tasks Done", v: String(dayDone.length), sub: `${dayLifeLogTasks.filter((t) => t.done).length} routines`, hot: dayDone.length > 0 },
        ].map((x) => (
          <div key={x.k} className="card card-hover flex items-center gap-3 p-3.5 min-w-0 overflow-hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: "var(--accent-soft)", color: x.hot ? "var(--accent)" : "var(--mut)" }}>{x.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[18px] font-bold leading-none tnum truncate" style={{ color: x.hot ? "var(--text)" : "var(--mut)" }}>{x.v}</div>
              <div className="mt-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--mut)]">
                <span>{x.k}</span>
                <span className="font-mono lowercase opacity-80">{x.sub}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Section 1: Focus Timeline */}
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr] w-full min-w-0">
        {/* Focus by Project */}
        <div className="card engine-panel p-4 w-full min-w-0 overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-[15px] font-bold tracking-tight">Focus by Project</div>
              <div className="mt-0.5 text-[11.5px] font-semibold" style={{ color: "var(--mut)" }}>Share of the day’s focused deep work time</div>
            </div>
            {totalMin > 0 && (
              <span className="font-mono text-xs font-bold text-[var(--accent)]">
                {fmtDur(totalMin)}
              </span>
            )}
          </div>
          {byProject.length === 0 ? (
            <EmptyState icon={Zap} title="No focus recorded" body="Start a session from the Focus tab or task card and it will appear here, grouped by project." />
          ) : (
            <>
              {/* Proportional Block Bar */}
              <div className="mt-3 flex h-[34px] w-full overflow-hidden rounded-xl border" style={{ borderColor: "var(--line)" }}>
                {byProject.map(([pid, min]) => {
                  const p = state.projects.find((x) => x.id === pid);
                  const pName = pid === "__unassigned" ? "Archived / Unassigned" : (p?.name ?? "Archived");
                  const pColor = pid === "__unassigned" ? "var(--mut)" : (p?.color ?? "#888");
                  const pEmoji = pid === "__unassigned" ? "📁" : (p?.emoji ?? "▸");
                  return (
                    <div
                      key={pid}
                      className="flex items-center justify-center overflow-hidden text-[10.5px] font-bold transition-all hover:brightness-110"
                      style={{ width: `${(min / Math.max(1, totalMin)) * 100}%`, background: `color-mix(in srgb, ${pColor} 75%, var(--panel2))`, color: "var(--text)", minWidth: min >= 10 ? 34 : 10 }}
                      title={`${pName} · ${fmtDur(min)}`}
                    >
                      {pEmoji}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {byProject.map(([pid, min]) => {
                  const p = state.projects.find((x) => x.id === pid);
                  const pName = pid === "__unassigned" ? "Archived / Unassigned" : (p?.name ?? "Deleted project");
                  const pColor = pid === "__unassigned" ? "var(--mut)" : (p?.color ?? "#888");
                  const pEmoji = pid === "__unassigned" ? "📁" : (p?.emoji ?? "▸");
                  return (
                    <div key={pid} className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[15px]" style={{ background: `color-mix(in srgb, ${pColor} 20%, transparent)` }}>{pEmoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between text-[12.5px] font-bold">
                          <span className="truncate">{pName}</span>
                          <span className="tnum font-mono" style={{ color: "var(--accent)" }}>{fmtDur(min)}</span>
                        </div>
                        <div className="mt-1 h-[6px] overflow-hidden rounded-full" style={{ background: "var(--bg)" }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(3, (min / maxProj) * 100)}%`, background: pColor }} />
                        </div>
                      </div>
                      <span className="tnum text-[10.5px] font-bold" style={{ color: "var(--mut)" }}>{Math.round((min / Math.max(1, totalMin)) * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Timestamped Session Timeline (Focus Log) */}
        <div className="card engine-panel p-4 w-full min-w-0 overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-[15px] font-bold tracking-tight">Focus Session Timeline</div>
              <div className="mt-0.5 text-[11.5px] font-semibold" style={{ color: "var(--mut)" }}>Every focus sprint, pause and completion — timestamped</div>
            </div>
            <Btn size="sm" variant="soft" onClick={() => setView("focus")}>
              <Zap size={12} /> Focus
            </Btn>
          </div>
          {daySessions.length === 0 ? (
            <EmptyState icon={Flame} title="No sessions" body="This day has no focus sessions on record." />
          ) : (
            <div className="mt-3 flex max-h-[330px] flex-col gap-1.5 overflow-y-auto pr-1 w-full min-w-0">
              {daySessions.map((s) => {
                const t = state.tasks.find((x) => x.id === s.taskId);
                const p = t ? state.projects.find((x) => x.id === t.projectId) : null;
                const min = sessionMinutes(s);
                return (
                  <div key={s.id} className="flex items-center gap-2.5 rounded-xl border px-2.5 py-2 min-w-0 w-full" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                    <span className="h-[26px] w-[4px] shrink-0 rounded-full" style={{ background: s.mode === "break" ? "var(--mut)" : p?.color ?? "var(--accent)" }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-bold flex items-center gap-1.5">
                        {s.mode === "break" ? (
                          <span>☕ Break</span>
                        ) : (
                          <>
                            <span>{t?.emoji ?? "💻"}</span>
                            <span className="truncate">{t?.title ?? "Untitled task"}</span>
                            {p && (
                              <span className="chip !py-0 !text-[9.5px] font-semibold" style={{ color: p.color, borderColor: `${p.color}40` }}>
                                #{p.name}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold tnum" style={{ color: "var(--mut)" }}>
                        <span>{fmtClock(s.startedAt)} → {s.endedAt ? fmtClock(s.endedAt) : "…"}</span>
                        <span className="chip !border-0 !py-0 text-[9.5px]" style={{ background: "var(--panel2)" }}>{s.mode}</span>
                        {s.pauses.length > 0 && <span className="inline-flex items-center gap-0.5"><Pause size={9} /> {s.pauses.length} pause{s.pauses.length > 1 ? "s" : ""}</span>}
                      </div>
                    </div>
                    <span className="tnum shrink-0 font-mono text-[13px] font-bold" style={{ color: "var(--accent)" }}>{fmtDur(min)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Tasks Completed & LifeLog Stream */}
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr] w-full min-w-0">
        {/* Tasks Completed (Normal Projects + LifeLog) */}
        <div className="card engine-panel p-4 w-full min-w-0 overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="font-display text-[15px] font-bold tracking-tight">Tasks & Activities Completed</div>
            <span className="chip !py-0.5 text-xs font-mono font-bold text-[var(--ok)] border-[var(--ok)]/30">
              {dayDone.length} finished
            </span>
          </div>
          {dayDone.length === 0 ? (
            <div className="mt-3 text-[12.5px]" style={{ color: "var(--mut)" }}>Nothing was completed on this day.</div>
          ) : (
            <div className="mt-2.5 flex max-h-[300px] flex-col gap-1.5 overflow-y-auto pr-1 w-full min-w-0">
              {dayDone.map((t) => {
                const at = t.done && t.doneAt && isoDate(new Date(t.doneAt)) === sel ? t.doneAt : t.completions.find((c) => isoDate(new Date(c.at)) === sel)?.at;
                const p = state.projects.find((x) => x.id === t.projectId);
                const isLife = t.projectId === LIFE_LOG_PROJECT_ID;
                const cat = isLife ? allCategories.find((c) => t.tags.includes(c.tag)) : null;

                return (
                  <div key={t.id} className="flex items-center gap-2.5 rounded-xl border px-2.5 py-2 min-w-0 w-full" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                    <Check size={14} className="shrink-0" style={{ color: "var(--ok)" }} />
                    {isLife ? (
                      <span className="text-xs shrink-0">{cat?.emoji || "🌊"}</span>
                    ) : (
                      <span className="h-[8px] w-[8px] rounded-full shrink-0" style={{ background: p?.color || "var(--accent)" }} />
                    )}
                    <div className="min-w-0 flex-1 truncate text-[12.5px] font-bold flex items-center gap-1.5">
                      <span className="truncate">{t.emoji ? `${t.emoji} ` : ""}{t.title}</span>
                      {p && !isLife && (
                        <span className="chip !py-0 text-[9.5px] font-semibold shrink-0" style={{ color: p.color }}>
                          #{p.name}
                        </span>
                      )}
                      {cat && (
                        <span className="chip !py-0 text-[9.5px] font-semibold shrink-0 text-[var(--accent)]">
                          {cat.label}
                        </span>
                      )}
                    </div>
                    {t.completions.length > 0 && !t.done && <span className="chip !py-0 text-[9.5px] shrink-0">↻ recurring</span>}
                    <span className="tnum shrink-0 font-mono text-[11px]" style={{ color: "var(--mut)" }}>{at ? fmtClock(at) : ""}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* LifeLog Routine & Sleep Stream Card */}
        <div className="card engine-panel p-4 w-full min-w-0 overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="font-display text-[15px] font-bold tracking-tight">Life Stream & Routines</div>
            <Btn size="sm" variant="soft" onClick={() => setView("tasks")}>
              <Sparkles size={12} /> LifeLog
            </Btn>
          </div>
          {dayLifeLogTasks.length === 0 ? (
            <div className="mt-3 text-[12.5px]" style={{ color: "var(--mut)" }}>
              No sleep or routines logged for this date. Quick log routines from the Tasks/LifeLog tab.
            </div>
          ) : (
            <div className="mt-2.5 flex max-h-[300px] flex-col gap-1.5 overflow-y-auto pr-1 w-full min-w-0">
              {dayLifeLogTasks.map((t) => {
                const cat = allCategories.find((c) => t.tags.includes(c.tag));
                const dur = t.durationMin || t.estimateMin || 0;
                return (
                  <div key={t.id} className="flex items-center gap-2.5 rounded-xl border px-2.5 py-2 min-w-0 w-full" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                    <span className="text-base shrink-0">{cat?.emoji || t.emoji || "🌊"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-bold flex items-center gap-1.5">
                        <span className="truncate">{t.title}</span>
                        {cat && (
                          <span className="chip !py-0 text-[9.5px] font-semibold text-[var(--accent)]">
                            {cat.label}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold tnum" style={{ color: "var(--mut)" }}>
                        {t.dueTime ? (
                          <span className="text-sky-400 font-mono">
                            {fmtTimeRange(t.dueTime, dur, timeFmt)}
                          </span>
                        ) : (
                          <span>{t.done ? "Completed" : "Logged"}</span>
                        )}
                      </div>
                    </div>
                    <span className="tnum shrink-0 font-mono text-[12px] font-bold" style={{ color: "var(--accent)" }}>
                      {fmtDur(dur)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Daily Note & Standup Log */}
      <div className="card engine-panel p-4 w-full min-w-0 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="font-display text-[15px] font-bold tracking-tight">Daily Note & Review · {fmtNoteName(sel)}</div>
          <Btn size="sm" variant="soft" onClick={() => { requestDailyNote(sel); setView("notes"); }}>
            <FileText size={12} /> Open Note
          </Btn>
        </div>
        {notePreview === null ? (
          <div className="mt-3 text-[12.5px]" style={{ color: "var(--mut)" }}>Decrypting note…</div>
        ) : notePreview === "" ? (
          <div className="mt-3 text-[12.5px]" style={{ color: "var(--mut)" }}>No note written for this day yet — open it and capture thoughts, review or what happened.</div>
        ) : (
          <div className="note-page mt-2.5 max-h-[190px] overflow-y-auto whitespace-pre-wrap rounded-xl border p-3 text-[13px]" style={{ borderColor: "var(--line)", background: "var(--bg)", color: "var(--text)" }}>
            {notePreview.slice(0, 700)}{notePreview.length > 700 ? "…" : ""}
          </div>
        )}
        {log?.mood && (
          <div className="mt-2.5 text-[12px] font-semibold" style={{ color: "var(--mut)" }}>
            Check-in: {log.moodEmoji ?? ""} energy {log.energy}/5 — “{log.mood}”
          </div>
        )}
      </div>

      {/* 1.2 Automated Daily Standup Modal */}
      <Modal
        open={standupModalOpen}
        onClose={() => setStandupModalOpen(false)}
        title={`Daily Standup & Summary · ${fmtDayShort(sel)}`}
        width={580}
      >
        <div className="space-y-4 select-none">
          <p className="text-xs text-[var(--mut)]">
            Automatically compiled from your tracked sleep, deep focus pomodoros, completed tasks, and habits for {fmtDayShort(sel)} ({sel}).
          </p>

          <pre
            className="p-4 rounded-2xl border text-xs font-mono whitespace-pre-wrap max-h-[340px] overflow-y-auto leading-relaxed select-text"
            style={{ borderColor: "var(--line)", background: "var(--panel2)", color: "var(--text)" }}
          >
            {generateStandupMarkdown()}
          </pre>

          <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
            <span className="text-[11px] text-[var(--mut)]">
              {dayDone.length} tasks · {focusSessions.length} sessions · {fmtDur(dayTotalLoggedMin)} tracked
            </span>
            <div className="flex items-center gap-2">
              <Btn variant="outline" size="sm" onClick={() => setStandupModalOpen(false)}>
                Close
              </Btn>
              <Btn variant="primary" size="sm" onClick={copyStandup} className="gap-1.5 font-bold">
                {copiedStandup ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedStandup ? "Copied!" : "Copy Markdown"}</span>
              </Btn>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
