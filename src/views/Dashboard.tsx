import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ExternalLink, FileText, Flame, Pencil, Play, Plus, Quote, RotateCcw, SlidersHorizontal, Sparkles, Timer } from "lucide-react";
import type { Task } from "../types";
import { QUOTES } from "../types";
import { useApp } from "../store";
import {
  addDaysIso,
  fmtClock,
  fmtDateLong,
  fmtDayShort,
  fmtDur,
  fmtNoteName,
  greetingFor,
  isoDate,
  parseIso,
  sessionMinutes,
  streakStats,
  todayIso,
  trackedByDay,
  uid,
} from "../utils/core";
import { decryptText, encryptText, getDeviceKey } from "../utils/crypto";
import { requestDailyNote } from "../utils/nav";
import { Btn, EmptyState, Modal, Toggle, cn } from "../components/ui";
import { triggerHaptic } from "../utils/native";

const ENERGY_OPTIONS = [
  { level: 1, label: "Depleted", icon: "🪫" },
  { level: 2, label: "Low", icon: "🔋" },
  { level: 3, label: "Steady", icon: "⚡" },
  { level: 4, label: "Strong", icon: "🔥" },
  { level: 5, label: "Charged", icon: "🚀" },
];

const MOOD_OPTIONS = [
  { emoji: "😫", label: "Tired" },
  { emoji: "😕", label: "Rough" },
  { emoji: "😐", label: "Meh" },
  { emoji: "🙂", label: "Good" },
  { emoji: "😄", label: "Great" },
  { emoji: "🔥", label: "Rad" },
];

function hmToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}
function minToHm(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function monthsAgo(iso: string, m: number): string {
  const d = parseIso(iso);
  const nd = new Date(d.getFullYear(), d.getMonth() - m, 1);
  const max = new Date(nd.getFullYear(), nd.getMonth() + 1, 0).getDate();
  nd.setDate(Math.min(d.getDate(), max));
  return isoDate(nd);
}

export function Dashboard() {
  const app = useApp();
  const { state, set, setView, requestFocus, openTaskDialog, toggleDone, toast } = app;
  const today = todayIso();
  const [quick, setQuick] = useState("");
  const [flashTab, setFlashTab] = useState<"1w" | "1m" | "1y">("1w");
  const [editingCheckin, setEditingCheckin] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [energy, setEnergy] = useState(3);
  const [moodEmoji, setMoodEmoji] = useState<string | null>(null);
  const [mood, setMood] = useState("");
  const feelingInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const widgets = state.settings.dashboardWidgets ?? {};
  const toggleWidget = (k: string) => {
    set((s) => ({
      ...s,
      settings: {
        ...s.settings,
        dashboardWidgets: {
          ...s.settings.dashboardWidgets,
          [k]: !(s.settings.dashboardWidgets?.[k] ?? true),
        },
      },
    }));
  };

  const log = state.dayLogs[today];
  useEffect(() => {
    const l = state.dayLogs[today];
    setEnergy(l?.energy ?? 3);
    setMoodEmoji(l?.moodEmoji ?? null);
    if (document.activeElement !== feelingInputRef.current) {
      setMood(l?.mood ?? "");
    }
  }, [today, state.dayLogs]);

  /* ---------- daily note (inline, encrypted) ---------- */
  const [noteText, setNoteText] = useState("");
  const [noteStatus, setNoteStatus] = useState<"loading" | "dirty" | "saving" | "saved">("loading");
  const noteLoadedFor = useRef<string | null>(null);

  useEffect(() => {
    // ensure today's daily note exists
    if (!state.notes.some((n) => n.daily && n.day === today)) {
      const note = {
        id: uid(), title: fmtNoteName(today), folderId: "f-daily", createdAt: Date.now(),
        updatedAt: Date.now(), blob: { plain: "" }, daily: true, day: today,
      };
      set((s) => (s.notes.some((n) => n.daily && n.day === today) ? s : { ...s, notes: [note, ...s.notes] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  useEffect(() => {
    if (noteLoadedFor.current === today) return;
    const note = state.notes.find((n) => n.daily && n.day === today);
    if (!note) return;
    noteLoadedFor.current = today;
    setNoteStatus("loading");
    getDeviceKey()
      .then((k) => decryptText(k, note.blob))
      .then((text) => {
        if (noteLoadedFor.current === today) {
          setNoteText(text);
          setNoteStatus("saved");
        }
      });
  }, [state.notes, today]);

  useEffect(() => {
    if (noteLoadedFor.current !== today || noteStatus !== "dirty") return;
    const t = setTimeout(async () => {
      setNoteStatus("saving");
      const key = await getDeviceKey();
      const blob = await encryptText(key, noteText);
      set((s) => ({
        ...s,
        notes: s.notes.map((n) => (n.daily && n.day === today ? { ...n, blob, updatedAt: Date.now() } : n)),
      }));
      setNoteStatus("saved");
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteText, noteStatus, today]);

  /* ---------- derived numbers ---------- */
  const tracked = useMemo(() => trackedByDay(state.sessions), [state.sessions]);
  const todayMin = tracked.get(today) ?? 0;
  const startOfDay = parseIso(today).getTime();
  const weekMin = useMemo(() => {
    let t = 0;
    for (let i = 0; i < 7; i++) t += tracked.get(addDaysIso(today, -i)) ?? 0;
    return t;
  }, [tracked, today]);
  const sessionsToday = useMemo(
    () => state.sessions.filter((s) => s.startedAt >= startOfDay && s.mode !== "break"),
    [state.sessions, startOfDay],
  );
  const anyRunning = state.sessions.some((s) => s.status === "running");
  const lastSessionAt = sessionsToday.reduce((a, s) => Math.max(a, s.endedAt ?? s.startedAt), 0);

  const dueTasks = useMemo(
    () =>
      state.tasks
        .filter((t) => !t.done && t.due && t.due <= today && (!t.snoozedUntil || t.snoozedUntil <= Date.now()))
        .sort((a, b) => {
          if (a.due !== b.due) return (a.due ?? "").localeCompare(b.due ?? "");
          const aw = a.dueTime ? 0 : 1;
          const bw = b.dueTime ? 0 : 1;
          if (aw !== bw) return aw - bw;
          const pw = { urgent: 0, high: 1, medium: 2, low: 3 };
          return pw[a.priority] - pw[b.priority];
        }),
    [state.tasks, today],
  );
  const doneToday = useMemo(
    () => state.tasks.filter((t) => t.done && t.doneAt && isoDate(new Date(t.doneAt)) === today),
    [state.tasks, today],
  );

  const schedule = useMemo(
    () =>
      state.tasks
        .filter((t) => !t.done && t.due === today && t.dueTime)
        .sort((a, b) => (a.dueTime ?? "").localeCompare(b.dueTime ?? "")),
    [state.tasks, today],
  );
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());
  useEffect(() => {
    const t = setInterval(() => setNowMin(new Date().getHours() * 60 + new Date().getMinutes()), 30000);
    return () => clearInterval(t);
  }, []);
  const busyNow = schedule.find((t) => nowMin >= hmToMin(t.dueTime ?? "") && nowMin < hmToMin(t.dueTime ?? "") + t.durationMin);

  const bestHabit = useMemo(() => {
    let best: { name: string; emoji: string; cur: number } | null = null;
    for (const h of state.habits) {
      const cur = streakStats(h.completions).current;
      if (!best || cur > best.cur) best = { name: h.name, emoji: h.emoji, cur };
    }
    return best;
  }, [state.habits]);

  const weekBars = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const iso = addDaysIso(today, -(6 - i));
        return { iso, min: tracked.get(iso) ?? 0 };
      }),
    [tracked, today],
  );
  const weekMax = Math.max(1, ...weekBars.map((b) => b.min));

  const taskTracked = (id: string) =>
    state.sessions.filter((s) => s.taskId === id).reduce((a, s) => a + sessionMinutes(s), 0);

  const updateCheckin = (updates: Partial<{ energy: number; moodEmoji: string | null; mood: string }>) => {
    triggerHaptic("light");
    const nextEnergy = updates.energy !== undefined ? updates.energy : energy;
    const nextMoodEmoji = updates.moodEmoji !== undefined ? updates.moodEmoji : moodEmoji;
    const nextMood = updates.mood !== undefined ? updates.mood : mood;

    if (updates.energy !== undefined) setEnergy(updates.energy);
    if (updates.moodEmoji !== undefined) setMoodEmoji(updates.moodEmoji);
    if (updates.mood !== undefined) setMood(updates.mood);

    set((s) => ({
      ...s,
      dayLogs: {
        ...s.dayLogs,
        [today]: {
          energy: nextEnergy,
          moodEmoji: nextMoodEmoji,
          mood: nextMood,
          updatedAt: Date.now(),
        },
      },
    }));
  };

  const quickAdd = () => {
    const v = quick.trim();
    if (!v) return;
    const t: Task = {
      id: uid(), projectId: state.projects[0]?.id ?? "p", title: v, notes: "", emoji: null,
      priority: "medium", tags: [], estimateMin: 0, due: today, dueTime: null, durationMin: 60,
      snoozedUntil: null, done: false, doneAt: null, createdAt: Date.now(), subtasks: [],
      recurrence: null, completions: [], privateNote: null,
    };
    set((s) => ({ ...s, tasks: [t, ...s.tasks] }));
    setQuick("");
    toast("Added to today", "ok");
  };

  const flashDate = flashTab === "1w" ? addDaysIso(today, -7) : flashTab === "1m" ? monthsAgo(today, 1) : monthsAgo(today, 12);
  const flash = useMemo(() => {
    const doneTitles: string[] = [];
    for (const t of state.tasks) {
      if (t.doneAt && isoDate(new Date(t.doneAt)) === flashDate) doneTitles.push(t.title);
      for (const c of t.completions) if (isoDate(new Date(c.at)) === flashDate) doneTitles.push(`${t.title} ↻`);
    }
    return { min: tracked.get(flashDate) ?? 0, doneTitles };
  }, [state.tasks, tracked, flashDate]);

  /* ================= check-in card ================= */
  const checkinCard = (compact = false) => {
    const isMorning = new Date().getHours() < 14;
    return (
      <div className="card card-hover p-3.5 sm:p-4 w-full min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[16px] shrink-0">{isMorning ? "🌅" : "🌙"}</span>
              <div className="font-display text-[15px] font-bold tracking-tight truncate">
                {isMorning ? "Morning check-in" : "Evening check-in"}
              </div>
            </div>
            <div className="mt-0.5 text-[11px] font-semibold truncate" style={{ color: "var(--mut)" }}>
              {log?.updatedAt ? `Logged ${fmtClock(log.updatedAt)} · tap to adjust anytime` : "How is your tank looking today?"}
            </div>
          </div>
          {log?.updatedAt && (
            <span className="chip !py-0.5 text-[10px] font-bold shrink-0" style={{ color: "var(--ok)", borderColor: "var(--ok)" }}>
              ✓ Saved
            </span>
          )}
        </div>

        {/* Tactile 1-tap Energy Levels */}
        <div className="mt-3.5 min-w-0">
          <div className="mb-1.5 flex items-baseline justify-between text-[11px]">
            <span className="font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>Energy</span>
            <span className="font-mono font-bold" style={{ color: "var(--accent)" }}>
              {energy}/5 · {ENERGY_OPTIONS.find((o) => o.level === energy)?.label}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 w-full min-w-0">
            {ENERGY_OPTIONS.map((opt) => {
              const active = energy === opt.level;
              return (
                <button
                  key={opt.level}
                  type="button"
                  onClick={() => updateCheckin({ energy: opt.level })}
                  className="flex flex-col items-center justify-center py-2 px-1 rounded-xl border transition-all cursor-pointer min-w-0 active:scale-95"
                  style={
                    active
                      ? {
                          background: "var(--accent-soft)",
                          borderColor: "var(--accent)",
                          boxShadow: "0 2px 10px -4px var(--accent)",
                          transform: "scale(1.02)",
                        }
                      : {
                          borderColor: "var(--line)",
                          background: "var(--bg)",
                        }
                  }
                  aria-label={`Energy level ${opt.level}: ${opt.label}`}
                >
                  <span className="text-[16px] leading-none">{opt.icon}</span>
                  <span className="mt-1 text-[10px] font-bold truncate w-full text-center" style={{ color: active ? "var(--accent)" : "var(--text)" }}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tactile 1-tap Mood Picker */}
        <div className="mt-3.5 min-w-0">
          <div className="mb-1.5 flex items-baseline justify-between text-[11px]">
            <span className="font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>Mood</span>
            <span className="font-semibold" style={{ color: "var(--mut)" }}>
              {moodEmoji ? "tap to clear" : "pick one"}
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1 w-full min-w-0">
            {MOOD_OPTIONS.map((opt) => {
              const active = moodEmoji === opt.emoji;
              return (
                <button
                  key={opt.emoji}
                  type="button"
                  onClick={() => updateCheckin({ moodEmoji: active ? null : opt.emoji })}
                  className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl border transition-all cursor-pointer min-w-0 active:scale-90"
                  style={
                    active
                      ? {
                          background: "var(--accent-soft)",
                          borderColor: "var(--accent)",
                          boxShadow: "0 3px 12px -5px var(--accent)",
                          transform: "scale(1.06)",
                        }
                      : {
                          borderColor: "var(--line)",
                          background: "var(--bg)",
                        }
                  }
                  aria-label={`Mood ${opt.label}`}
                >
                  <span className="text-[19px] leading-none">{opt.emoji}</span>
                  <span className="mt-1 text-[9px] font-semibold truncate w-full text-center" style={{ color: active ? "var(--accent)" : "var(--mut)" }}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {!compact && (
          <div className="mt-3 min-w-0">
            <span className="lbl mb-1">Feeling note</span>
            <textarea
              ref={feelingInputRef}
              className="inp min-h-[48px] resize-y w-full min-w-0 text-[13px]"
              value={mood}
              onChange={(e) => {
                setMood(e.target.value);
                updateCheckin({ mood: e.target.value });
              }}
              onBlur={() => {
                const trimmed = mood.trim();
                if (trimmed !== mood) {
                  setMood(trimmed);
                  updateCheckin({ mood: trimmed });
                }
              }}
              placeholder="One honest sentence about today… (auto-saves)"
            />
          </div>
        )}
      </div>
    );
  };

  /* ================= plan card ================= */
  const planCard = (compact = false) => (
    <div className={cn("card p-3.5 sm:p-4 w-full min-w-0 overflow-hidden", !compact && "card-hover")}>
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="font-display text-[15px] font-bold tracking-tight truncate">Open tasks</div>
        <div className="text-[11.5px] font-bold tnum shrink-0" style={{ color: "var(--mut)" }}>
          {doneToday.length} done · {dueTasks.length} open
        </div>
      </div>
      <div className="mt-2 h-[6px] overflow-hidden rounded-full w-full" style={{ background: "var(--bg)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${doneToday.length + dueTasks.length > 0 ? Math.round((doneToday.length / (doneToday.length + dueTasks.length)) * 100) : 0}%`,
            background: "linear-gradient(90deg, var(--ok), var(--accent))",
          }}
        />
      </div>
      <div className="mt-3 flex gap-2 w-full min-w-0">
        <input
          className="inp flex-1 min-w-0 text-[13px]" value={quick} onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && quickAdd()}
          placeholder="Quick-add to today… (Enter)"
        />
        <Btn variant="primary" onClick={quickAdd} aria-label="Quick add" className="shrink-0"><Plus size={14} /></Btn>
      </div>
      <div className="mt-3 flex flex-col gap-1 w-full min-w-0">
        {dueTasks.length === 0 && (
          <div className="rounded-xl border border-dashed px-3 py-4 text-center text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--mut)" }}>
            Nothing due. Add a task or pull one onto today from the calendar.
          </div>
        )}
        {dueTasks.map((t) => {
          const proj = state.projects.find((p) => p.id === t.projectId);
          const overdue = t.due && t.due < today;
          return (
            <div
              key={t.id}
              className="group flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-all w-full min-w-0 overflow-hidden"
              style={{ borderColor: "var(--line)", background: "var(--bg)" }}
            >
              <button
                onClick={() => toggleDone(t.id)}
                className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-md border transition-all hover:scale-110 active:scale-95"
                style={{ borderColor: proj?.color ?? "var(--accent)", cursor: "pointer" }}
                aria-label="Complete"
              >
                <Check size={11} style={{ opacity: 0, transition: "opacity .1s" }} className="group-hover:opacity-60" />
              </button>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex items-center gap-1.5 text-[13px] font-bold min-w-0 w-full">
                  {t.emoji && <span className="shrink-0">{t.emoji}</span>}
                  <span className="truncate flex-1 min-w-0">{t.title}</span>
                  {t.recurrence && <RotateCcw size={11} className="shrink-0" style={{ color: "var(--mut)" }} />}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold min-w-0" style={{ color: "var(--mut)" }}>
                  <span className="inline-block h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: proj?.color }} />
                  <span className="truncate max-w-[100px] sm:max-w-[150px]">{proj?.name}</span>
                  {t.dueTime && <span className="chip !py-0 text-[10px]">▦ {t.dueTime} · {t.durationMin}m</span>}
                  {overdue && <span style={{ color: "var(--danger)" }}>overdue · {fmtDayShort(t.due ?? today)}</span>}
                  {t.estimateMin > 0 && <span>est {fmtDur(t.estimateMin)}</span>}
                  {taskTracked(t.id) > 0 && <span style={{ color: "var(--accent)" }}>▸ {fmtDur(taskTracked(t.id))} logged</span>}
                </div>
              </div>
              {!compact && (
                <button
                  type="button"
                  onClick={() => requestFocus(t.id)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[var(--mut)] hover:text-[var(--accent)] hover:border-[var(--accent)] active:scale-95 transition-all cursor-pointer"
                  title="Open in Focus mode"
                  aria-label="Focus on task"
                >
                  <Play size={12} />
                </button>
              )}
            </div>
          );
        })}
        {doneToday.length > 0 && (
          <button onClick={() => setShowDone((v) => !v)} className="mt-1 self-start text-[11.5px] font-bold" style={{ color: "var(--mut)", cursor: "pointer" }}>
            {showDone ? "▾" : "▸"} {doneToday.length} completed today
          </button>
        )}
        {showDone &&
          doneToday.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-[12px] min-w-0 w-full overflow-hidden" style={{ color: "var(--mut)" }}>
              <Check size={12} className="shrink-0" style={{ color: "var(--ok)" }} />
              <span className="line-through truncate flex-1 min-w-0">{t.title}</span>
              <span className="ml-auto tnum shrink-0">{t.doneAt ? fmtClock(t.doneAt) : ""}</span>
            </div>
          ))}
      </div>
    </div>
  );

  /* ================= schedule card ================= */
  const scheduleCard = (compact = false) => (
    <div className={cn("card p-3.5 sm:p-4 w-full min-w-0 overflow-hidden", !compact && "card-hover")}>
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="font-display text-[15px] font-bold tracking-tight truncate">Schedule</div>
          <span className="chip !py-0 text-[10px] shrink-0" style={{ color: busyNow ? "var(--danger)" : "var(--ok)" }}>
            <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: busyNow ? "var(--danger)" : "var(--ok)", animation: busyNow ? "nowpulse 1.6s infinite" : "none" }} />
            {busyNow ? "in a block" : "free now"}
          </span>
        </div>
        <div className="text-[11.5px] font-bold tnum shrink-0" style={{ color: "var(--mut)" }}>
          {schedule.length} block{schedule.length === 1 ? "" : "s"} · {fmtDur(schedule.reduce((a, t) => a + t.durationMin, 0))}
        </div>
      </div>
      {schedule.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed px-3 py-4 text-center" style={{ borderColor: "var(--line)" }}>
          <div className="text-[12.5px] font-semibold" style={{ color: "var(--mut)" }}>No time blocks today.</div>
          <Btn size="sm" variant="soft" className="mt-2" onClick={() => setView("calendar")}>
            <CalendarDays size={12} /> Open calendar to plan
          </Btn>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-1 w-full min-w-0">
          {schedule.map((t) => {
            const proj = state.projects.find((p) => p.id === t.projectId);
            const start = hmToMin(t.dueTime ?? "09:00");
            const end = start + t.durationMin;
            const isNow = nowMin >= start && nowMin < end;
            const past = end <= nowMin;
            return (
              <div key={t.id} className="group relative flex items-stretch gap-2 w-full min-w-0 overflow-hidden">
                {/* rail */}
                <div className="flex w-[46px] shrink-0 flex-col items-end pt-2">
                  <span className="font-mono text-[11px] font-bold tnum" style={{ color: isNow ? "var(--accent)" : "var(--mut)" }}>{t.dueTime}</span>
                  <span className="text-[9px] font-semibold tnum" style={{ color: "var(--mut)" }}>{minToHm(end)}</span>
                </div>
                <div className="relative flex flex-col items-center shrink-0">
                  <span
                    className="z-[1] mt-2 h-[9px] w-[9px] shrink-0 rounded-full border-2"
                    style={{
                      borderColor: proj?.color ?? "var(--accent)",
                      background: past ? "var(--panel)" : proj?.color ?? "var(--accent)",
                      animation: isNow ? "nowpulse 1.4s infinite" : "none",
                      boxShadow: isNow ? "0 0 10px var(--accent)" : "none",
                    }}
                  />
                  <span className="w-[2px] flex-1" style={{ background: "var(--line)" }} />
                </div>
                <div
                  className="mb-1.5 min-w-0 flex-1 cursor-pointer rounded-xl border px-3 py-2 transition-all hover:translate-x-[2px] overflow-hidden"
                  style={{
                    borderColor: isNow ? `color-mix(in srgb, ${proj?.color ?? "var(--accent)"} 55%, var(--line))` : "var(--line)",
                    background: isNow ? `color-mix(in srgb, ${proj?.color ?? "var(--accent)"} 10%, var(--bg))` : "var(--bg)",
                    opacity: past ? 0.55 : 1,
                  }}
                  onClick={() => openTaskDialog({ taskId: t.id })}
                  title="Click to edit this block"
                >
                  <div className="flex items-center gap-1.5 min-w-0 w-full">
                    {isNow && <span className="chip !py-0 text-[9px] shrink-0" style={{ background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" }}>NOW</span>}
                    {past && <Check size={11} className="shrink-0" style={{ color: "var(--mut)" }} />}
                    <span className="truncate flex-1 min-w-0 text-[13px] font-bold">{t.emoji ? `${t.emoji} ` : ""}{t.title}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold min-w-0" style={{ color: "var(--mut)" }}>
                    <span className="inline-block h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: proj?.color }} />
                    <span className="truncate max-w-[100px] sm:max-w-[150px]">{proj?.name}</span> · {t.durationMin}m
                    {taskTracked(t.id) > 0 && <span className="shrink-0" style={{ color: "var(--accent)" }}>▸ {fmtDur(taskTracked(t.id))} logged</span>}
                  </div>
                </div>
                {!compact && (
                  <div className="flex items-center pr-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); requestFocus(t.id); }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border text-[var(--mut)] hover:text-[var(--accent)] hover:border-[var(--accent)] active:scale-95 transition-all cursor-pointer"
                      title="Focus on this task"
                      aria-label="Focus on task"
                    >
                      <Play size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ================= the cockpit ================= */
  return (
    <div className="flex flex-col gap-4 w-full max-w-full min-w-0 overflow-x-hidden">
      {/* Top Cockpit Header: Full width greeting on mobile, no truncation */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 min-w-0 w-full">
        <div className="min-w-0 w-full sm:flex-1">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-[11.5px] font-bold uppercase tracking-[0.13em]" style={{ color: "var(--accent)" }}>
            <Sparkles size={13} className="shrink-0" />
            <span>{fmtDateLong(new Date())}</span>
          </div>
          <h1 className="font-display text-[22px] sm:text-[26px] font-bold leading-tight tracking-tight text-[var(--text)] mt-0.5 break-words">
            {greetingFor(new Date().getHours())}
            {state.settings.profileName.trim() ? `, ${state.settings.profileName.trim()}` : ""}
          </h1>
          <p className="mt-1 text-[12px] sm:text-[13px] font-semibold text-[var(--mut)] break-words">
            {fmtDur(weekMin)} tracked this week · {dueTasks.length} open · {schedule.length} block{schedule.length === 1 ? "" : "s"} today
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <Btn variant="outline" size="sm" onClick={() => setCustomizeOpen(true)}>
            <SlidersHorizontal size={13} /> <span className="hidden sm:inline">Customize Bento</span><span className="sm:hidden">Customize</span>
          </Btn>
          <Btn variant="primary" size="sm" onClick={() => openTaskDialog({ presetDate: today })}>
            <Plus size={13} /> Task
          </Btn>
        </div>
      </div>

      {/* ------- weighted stat strip ------- */}
      {widgets.focusMetric !== false && (
        <div className="stagger grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[1.55fr_1fr_1fr_1fr] w-full min-w-0">
          <div
            className="card card-hover relative overflow-hidden p-3.5 sm:p-4 min-w-0 w-full"
            style={{ borderColor: "color-mix(in srgb, var(--accent) 40%, var(--line))", boxShadow: "0 8px 30px -18px var(--accent)" }}
          >
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] truncate" style={{ color: "var(--mut)" }}>Focused today</span>
              {anyRunning ? (
                <span className="chip !py-0 text-[9.5px] shrink-0" style={{ color: "var(--danger)", borderColor: "color-mix(in srgb, var(--danger) 50%, var(--line))" }}>
                  <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: "var(--danger)", animation: "nowpulse 1.4s infinite" }} /> recording
                </span>
              ) : (
                <Timer size={13} className="shrink-0" style={{ color: "var(--mut)" }} />
              )}
            </div>
            <div className="mt-1 font-mono text-[28px] sm:text-[30px] font-bold leading-none tnum" style={{ color: "var(--accent)" }}>
              {fmtDur(todayMin)}
            </div>
            <div className="mt-3 flex h-[38px] items-end gap-1.5 w-full min-w-0" aria-hidden>
              {weekBars.map((b, i) => (
                <div key={b.iso} className="group/bar relative flex-1 min-w-0">
                  <div
                    className="w-full rounded-t-[4px] transition-all duration-500"
                    style={{
                      height: Math.max(4, (b.min / weekMax) * 38),
                      background: i === 6 ? "var(--accent)" : `color-mix(in srgb, var(--accent) ${18 + (i / 6) * 22}%, var(--line))`,
                      animation: `rise 0.4s ${0.05 * i}s cubic-bezier(0.2,0.7,0.3,1) both`,
                    }}
                  />
                  <span
                    className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[9.5px] font-bold opacity-0 transition-opacity group-hover/bar:opacity-100"
                    style={{ background: "var(--panel2)", borderColor: "var(--line)", color: "var(--text)" }}
                  >
                    {fmtDayShort(b.iso)} · {fmtDur(b.min)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[9px] font-bold uppercase tracking-wider min-w-0" style={{ color: "var(--mut)" }}>
              <span>last 7 days</span><span>today</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:col-span-2 lg:col-span-3 lg:grid-cols-3 w-full min-w-0">
            <div className="card card-hover flex flex-col justify-between p-3 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] truncate" style={{ color: "var(--mut)" }}>Sessions</span>
                <Timer size={12} className="shrink-0" style={{ color: "var(--mut)" }} />
              </div>
              <div className="mt-1 min-w-0">
                <div className="font-mono text-[22px] sm:text-[26px] font-bold leading-none tnum">{sessionsToday.length}</div>
                <div className="mt-1 text-[10px] font-semibold truncate" style={{ color: "var(--mut)" }}>
                  {sessionsToday.length === 0 ? "none yet" : <>last {lastSessionAt ? fmtClock(lastSessionAt) : "—"}</>}
                </div>
              </div>
            </div>

            <div className="card card-hover flex flex-col justify-between p-3 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] truncate" style={{ color: "var(--mut)" }}>Done</span>
                <Check size={12} className="shrink-0" style={{ color: "var(--ok)" }} />
              </div>
              <div className="mt-1 min-w-0">
                <div className="font-mono text-[22px] sm:text-[26px] font-bold leading-none tnum">
                  {doneToday.length}
                  <span className="text-[12px] font-semibold" style={{ color: "var(--mut)" }}>/{doneToday.length + dueTasks.length}</span>
                </div>
                <div className="mt-1.5 h-[4px] overflow-hidden rounded-full w-full" style={{ background: "var(--bg)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${doneToday.length + dueTasks.length > 0 ? (doneToday.length / (doneToday.length + dueTasks.length)) * 100 : 0}%`,
                      background: "var(--ok)",
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="card card-hover flex flex-col justify-between p-3 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] truncate" style={{ color: "var(--mut)" }}>Streak</span>
                <Flame size={12} className="shrink-0" style={{ color: bestHabit && bestHabit.cur > 0 ? "var(--warn)" : "var(--mut)" }} />
              </div>
              <div className="mt-1 min-w-0">
                <div className="font-mono text-[22px] sm:text-[26px] font-bold leading-none tnum">
                  {bestHabit ? bestHabit.cur : 0}
                  <span className="text-[12px] font-semibold" style={{ color: "var(--mut)" }}>d</span>
                </div>
                <div className="mt-1 text-[10px] font-semibold truncate" style={{ color: "var(--mut)" }}>
                  {bestHabit ? `${bestHabit.emoji} ${bestHabit.name}` : "no habits"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------- main grid ------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr] w-full min-w-0">
        <div className="stagger flex flex-col gap-4 w-full min-w-0">
          {widgets.dayCheckin !== false && checkinCard()}
          {widgets.upcomingSchedule !== false && scheduleCard()}
          {widgets.quickTasks !== false && planCard()}
        </div>

        <div className="stagger flex flex-col gap-4 w-full min-w-0">
          {/* inline daily note */}
          {widgets.dailyNote !== false && (
            <div className="card card-hover flex flex-col p-3.5 sm:p-4 w-full min-w-0 overflow-hidden">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-[16px] shrink-0">📅</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[15px] font-bold leading-tight tracking-tight truncate">Daily note</div>
                    <div className="text-[10.5px] font-semibold tnum truncate" style={{ color: "var(--mut)" }}>{fmtNoteName(today)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="chip !py-0 text-[9.5px]"
                    style={{
                      color: noteStatus === "saved" ? "var(--ok)" : noteStatus === "dirty" || noteStatus === "saving" ? "var(--warn)" : "var(--mut)",
                    }}
                  >
                    {noteStatus === "loading" ? "decrypting…" : noteStatus === "dirty" ? "unsaved" : noteStatus === "saving" ? "encrypting…" : "🔒 saved"}
                  </span>
                  <Btn size="sm" variant="ghost" onClick={() => { requestDailyNote(today); setView("notes"); }} title="Open in Notes">
                    <ExternalLink size={12} />
                  </Btn>
                </div>
              </div>
              <textarea
                className="inp mt-3 h-[130px] resize-y !leading-relaxed w-full min-w-0 text-[13px]"
                value={noteText}
                onChange={(e) => { setNoteText(e.target.value); setNoteStatus("dirty"); }}
                placeholder="Intentions, thoughts, what happened… autosaves & encrypts as you type."
              />
            </div>
          )}

          {/* on this day */}
          {widgets.flashback !== false && (
            <div className="card card-hover p-3.5 sm:p-4 w-full min-w-0 overflow-hidden">
              <div className="font-display text-[15px] font-bold tracking-tight">On this day</div>
              <div className="mt-2 flex gap-1.5 overflow-x-auto scrollbar-none py-0.5 w-full min-w-0">
                {([["1w", "1 week ago"], ["1m", "1 month ago"], ["1y", "1 year ago"]] as const).map(([v, l]) => (
                  <button
                    key={v} onClick={() => setFlashTab(v)}
                    className="rounded-lg px-2.5 py-1 text-[11.5px] font-bold transition-all shrink-0 cursor-pointer"
                    style={flashTab === v ? { background: "var(--accent)", color: "var(--on-accent)" } : { color: "var(--mut)", background: "var(--bg)" }}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-xl border p-3 w-full min-w-0 overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                <div className="flex items-center gap-2 text-[12px] font-bold truncate" style={{ color: "var(--mut)" }}>
                  <CalendarDays size={13} className="shrink-0" /> {fmtDayShort(flashDate)}
                </div>
                {flash.min > 0 || flash.doneTitles.length > 0 ? (
                  <>
                    <div className="mt-1.5 font-mono text-[20px] font-bold tnum" style={{ color: "var(--accent)" }}>
                      {fmtDur(flash.min)} <span className="text-[11px] font-semibold" style={{ color: "var(--mut)" }}>tracked</span>
                    </div>
                    {flash.doneTitles.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1 w-full min-w-0">
                        {flash.doneTitles.slice(0, 5).map((t, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-[12px] font-semibold min-w-0 w-full">
                            <Check size={11} className="shrink-0" style={{ color: "var(--ok)" }} />
                            <span className="truncate flex-1 min-w-0">{t}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <div className="mt-2 text-[12px]" style={{ color: "var(--mut)" }}>
                    Nothing logged on this day.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* habit flames */}
          {widgets.habitsRadar !== false && (
            <div className="card card-hover p-3.5 sm:p-4 w-full min-w-0 overflow-hidden">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="font-display text-[15px] font-bold tracking-tight truncate">Habit flames</div>
                <Btn size="sm" variant="ghost" onClick={() => setView("habits")} className="shrink-0">Open habits</Btn>
              </div>
              <div className="mt-2 flex flex-col gap-2 w-full min-w-0">
                {state.habits.length === 0 && (
                  <EmptyState icon={Flame} title="No habits yet" body="Create one in the Habits tab." />
                )}
                {state.habits.slice(0, 3).map((h) => {
                  const doneTodayH = h.completions.includes(today);
                  return (
                    <div key={h.id} className="flex items-center gap-2 min-w-0 w-full">
                      <span className="text-[16px] shrink-0">{h.emoji}</span>
                      <span className="flex-1 truncate text-[13px] font-bold min-w-0">{h.name}</span>
                      <span className="chip !py-0 text-[10px] shrink-0" style={{ color: doneTodayH ? "var(--ok)" : "var(--mut)" }}>
                        <Flame size={10} /> {doneTodayH ? "done" : "pending"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={() => openTaskDialog({ presetDate: today })}
            className="card card-hover flex w-full min-w-0 items-center justify-center gap-2 p-3.5 text-[13px] font-bold text-center cursor-pointer"
            style={{ color: "var(--accent)" }}
          >
            <Plus size={15} /> <span>Plan something for today</span>
          </button>
        </div>
      </div>

      {/* Customize Bento Modal */}
      <Modal
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        title="Customize Dashboard Bento"
        width={480}
        footer={
          <Btn variant="primary" onClick={() => setCustomizeOpen(false)}>Done</Btn>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[var(--color-mut)]">
            Choose which modular cards and widgets appear on your dashboard.
          </p>
          {[
            { key: "focusMetric", label: "Focused Today & 7-Day Sparkline" },
            { key: "dayCheckin", label: "Energy & Mood Daily Check-in" },
            { key: "upcomingSchedule", label: "Today's Schedule & Timeline" },
            { key: "quickTasks", label: "Open Tasks & Quick-Add List" },
            { key: "dailyNote", label: "Encrypted Daily Note Pad" },
            { key: "habitsRadar", label: "Habit Flames & Streaks" },
            { key: "flashback", label: "Flashback (On This Day)" },
          ].map((w) => (
            <div
              key={w.key}
              className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--line)] bg-[var(--panel)]"
            >
              <span className="text-xs font-semibold text-[var(--color-text)]">{w.label}</span>
              <Toggle
                checked={widgets[w.key] !== false}
                onChange={() => toggleWidget(w.key)}
              />
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
