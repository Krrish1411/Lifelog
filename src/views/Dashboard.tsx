import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ExternalLink, FileText, Flame, Leaf, Pencil, Play, Plus, RotateCcw, Timer } from "lucide-react";
import type { Task } from "../types";
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
import { Btn, EmptyState, cn } from "../components/ui";

const ENERGY_LABELS = ["Depleted", "Low", "Steady", "Strong", "Charged"];
const MOOD_EMOJIS = ["😫", "😕", "😐", "🙂", "😄", "🤩"];

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
  const [zen, setZen] = useState(false);
  const [quick, setQuick] = useState("");
  const [flashTab, setFlashTab] = useState<"1w" | "1m" | "1y">("1w");
  const [editingCheckin, setEditingCheckin] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [energy, setEnergy] = useState(3);
  const [moodEmoji, setMoodEmoji] = useState<string | null>(null);
  const [mood, setMood] = useState("");

  const log = state.dayLogs[today];
  useEffect(() => {
    const l = state.dayLogs[today];
    setEnergy(l?.energy ?? 3);
    setMoodEmoji(l?.moodEmoji ?? null);
    setMood(l?.mood ?? "");
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

  const saveCheckin = () => {
    set((s) => ({
      ...s,
      dayLogs: { ...s.dayLogs, [today]: { energy, moodEmoji, mood: mood.trim(), updatedAt: Date.now() } },
    }));
    setEditingCheckin(false);
    toast(log?.updatedAt ? "Check-in updated" : "Check-in saved — see you tonight", "ok");
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
    const saved = !!log?.updatedAt && !editingCheckin;
    return (
      <div className="card card-hover p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-[15px] font-bold tracking-tight">
              {new Date().getHours() < 14 ? "Morning check-in" : "Evening check-in"}
            </div>
            <div className="text-[11.5px] font-semibold" style={{ color: "var(--mut)" }}>
              {log?.updatedAt
                ? <>Logged {fmtClock(log.updatedAt)} {log.moodEmoji ? `· felt ${log.moodEmoji}` : ""} — editable any time</>
                : "How is the tank looking?"}
            </div>
          </div>
          {saved ? (
            <Btn size="sm" variant="ghost" onClick={() => setEditingCheckin(true)}>
              <Pencil size={12} /> Edit
            </Btn>
          ) : (
            <Btn size="sm" variant="primary" onClick={saveCheckin}>
              <Check size={13} /> {log?.updatedAt ? "Update" : "Save"}
            </Btn>
          )}
        </div>

        <div className="mt-3.5">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="lbl mb-0">Energy</span>
            <span className="font-mono text-[16px] font-bold tnum" style={{ color: "var(--accent)" }}>
              {energy}/5 · {ENERGY_LABELS[energy - 1]}
            </span>
          </div>
          <input
            type="range" min={1} max={5} step={1} value={energy} disabled={saved}
            onChange={(e) => { setEnergy(parseInt(e.target.value, 10)); setEditingCheckin(true); }}
            className={cn("energy", saved && "opacity-70")}
          />
          <div className="mt-1 flex justify-between text-[9.5px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>
            {ENERGY_LABELS.map((l) => <span key={l}>{l}</span>)}
          </div>
        </div>

        <div className="mt-3.5">
          <span className="lbl">Mood</span>
          <div className="flex items-center gap-1.5">
            {MOOD_EMOJIS.map((e) => {
              const active = moodEmoji === e;
              return (
                <button
                  key={e}
                  disabled={saved}
                  onClick={() => { setMoodEmoji(active ? null : e); setEditingCheckin(true); }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border text-[20px] transition-all hover:scale-110 disabled:cursor-default disabled:hover:scale-100"
                  style={
                    active
                      ? { background: "var(--accent-soft)", borderColor: "var(--accent)", transform: "scale(1.12)", boxShadow: "0 4px 14px -6px var(--accent)" }
                      : { borderColor: "var(--line)", background: "var(--bg)", opacity: saved ? 0.55 : 1, cursor: "pointer" }
                  }
                  aria-label={`Mood ${e}`}
                >
                  {e}
                </button>
              );
            })}
            <span className="ml-1 text-[11.5px] font-semibold" style={{ color: "var(--mut)" }}>
              {moodEmoji ? "tap again to clear" : "pick one"}
            </span>
          </div>
        </div>

        {!compact && (
          <div className="mt-3">
            <span className="lbl">Feeling note</span>
            <textarea
              className="inp min-h-[52px] resize-y" value={mood} disabled={saved}
              onChange={(e) => { setMood(e.target.value); setEditingCheckin(true); }}
              placeholder="One honest sentence about today…"
            />
          </div>
        )}
      </div>
    );
  };

  /* ================= plan card ================= */
  const planCard = (compact = false) => (
    <div className={cn("card p-4", !compact && "card-hover")}>
      <div className="flex items-center justify-between">
        <div className="font-display text-[15px] font-bold tracking-tight">Open tasks</div>
        <div className="text-[11.5px] font-bold tnum" style={{ color: "var(--mut)" }}>
          {doneToday.length} done · {dueTasks.length} open
        </div>
      </div>
      <div className="mt-2 h-[6px] overflow-hidden rounded-full" style={{ background: "var(--bg)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${doneToday.length + dueTasks.length > 0 ? Math.round((doneToday.length / (doneToday.length + dueTasks.length)) * 100) : 0}%`,
            background: "linear-gradient(90deg, var(--ok), var(--accent))",
          }}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="inp" value={quick} onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && quickAdd()}
          placeholder="Quick-add to today… (Enter)"
        />
        <Btn variant="primary" onClick={quickAdd} aria-label="Quick add"><Plus size={14} /></Btn>
      </div>
      <div className="mt-3 flex flex-col gap-1">
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
              className="group flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-all hover:translate-x-[2px]"
              style={{ borderColor: "var(--line)", background: "var(--bg)" }}
            >
              <button
                onClick={() => toggleDone(t.id)}
                className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-md border transition-all hover:scale-110"
                style={{ borderColor: proj?.color ?? "var(--accent)", cursor: "pointer" }}
                aria-label="Complete"
              >
                <Check size={11} style={{ opacity: 0, transition: "opacity .1s" }} className="group-hover:opacity-60" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate text-[13px] font-bold">
                  {t.emoji && <span>{t.emoji}</span>}
                  <span className="truncate">{t.title}</span>
                  {t.recurrence && <RotateCcw size={11} style={{ color: "var(--mut)" }} />}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>
                  <span className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: proj?.color }} />
                  <span>{proj?.name}</span>
                  {t.dueTime && <span className="chip !py-0 text-[10px]">▦ {t.dueTime} · {t.durationMin}m</span>}
                  {overdue && <span style={{ color: "var(--danger)" }}>overdue · {fmtDayShort(t.due ?? today)}</span>}
                  {t.estimateMin > 0 && <span>est {fmtDur(t.estimateMin)}</span>}
                  {taskTracked(t.id) > 0 && <span style={{ color: "var(--accent)" }}>▸ {fmtDur(taskTracked(t.id))} logged</span>}
                </div>
              </div>
              {!compact && (
                <Btn size="sm" variant="soft" onClick={() => requestFocus(t.id)} title="Open in Focus (you pick the mode)">
                  <Play size={11} /> Focus
                </Btn>
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
            <div key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-[12px]" style={{ color: "var(--mut)" }}>
              <Check size={12} style={{ color: "var(--ok)" }} />
              <span className="line-through">{t.title}</span>
              <span className="ml-auto tnum">{t.doneAt ? fmtClock(t.doneAt) : ""}</span>
            </div>
          ))}
      </div>
    </div>
  );

  /* ================= schedule card ================= */
  const scheduleCard = (compact = false) => (
    <div className={cn("card p-4", !compact && "card-hover")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="font-display text-[15px] font-bold tracking-tight">Schedule</div>
          <span className="chip !py-0 text-[10px]" style={{ color: busyNow ? "var(--danger)" : "var(--ok)" }}>
            <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: busyNow ? "var(--danger)" : "var(--ok)", animation: busyNow ? "nowpulse 1.6s infinite" : "none" }} />
            {busyNow ? "in a block" : "free now"}
          </span>
        </div>
        <div className="text-[11.5px] font-bold tnum" style={{ color: "var(--mut)" }}>
          {schedule.length} block{schedule.length === 1 ? "" : "s"} · {fmtDur(schedule.reduce((a, t) => a + t.durationMin, 0))} planned
        </div>
      </div>
      {schedule.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed px-3 py-4 text-center" style={{ borderColor: "var(--line)" }}>
          <div className="text-[12.5px] font-semibold" style={{ color: "var(--mut)" }}>No time blocks today.</div>
          <Btn size="sm" variant="soft" className="mt-2" onClick={() => setView("calendar")}>
            <CalendarDays size={12} /> Open calendar to drag tasks on
          </Btn>
        </div>
      ) : (
        <div className="mt-3 flex flex-col">
          {schedule.map((t) => {
            const proj = state.projects.find((p) => p.id === t.projectId);
            const start = hmToMin(t.dueTime ?? "09:00");
            const end = start + t.durationMin;
            const isNow = nowMin >= start && nowMin < end;
            const past = end <= nowMin;
            return (
              <div key={t.id} className="group relative flex items-stretch gap-3">
                {/* rail */}
                <div className="flex w-[52px] shrink-0 flex-col items-end pt-2.5">
                  <span className="font-mono text-[11px] font-bold tnum" style={{ color: isNow ? "var(--accent)" : "var(--mut)" }}>{t.dueTime}</span>
                  <span className="text-[9px] font-semibold tnum" style={{ color: "var(--mut)" }}>{minToHm(end)}</span>
                </div>
                <div className="relative flex flex-col items-center">
                  <span
                    className="z-[1] mt-2.5 h-[9px] w-[9px] shrink-0 rounded-full border-2"
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
                  className="mb-1.5 min-w-0 flex-1 cursor-pointer rounded-xl border px-3 py-2 transition-all hover:translate-x-[2px]"
                  style={{
                    borderColor: isNow ? `color-mix(in srgb, ${proj?.color ?? "var(--accent)"} 55%, var(--line))` : "var(--line)",
                    background: isNow ? `color-mix(in srgb, ${proj?.color ?? "var(--accent)"} 10%, var(--bg))` : "var(--bg)",
                    opacity: past ? 0.55 : 1,
                  }}
                  onClick={() => openTaskDialog({ taskId: t.id })}
                  title="Click to edit this block"
                >
                  <div className="flex items-center gap-1.5">
                    {isNow && <span className="chip !py-0 text-[9px]" style={{ background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" }}>NOW</span>}
                    {past && <Check size={11} style={{ color: "var(--mut)" }} />}
                    <span className="truncate text-[13px] font-bold">{t.emoji ? `${t.emoji} ` : ""}{t.title}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>
                    <span className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: proj?.color }} />
                    {proj?.name} · {t.durationMin}m
                    {taskTracked(t.id) > 0 && <span style={{ color: "var(--accent)" }}>▸ {fmtDur(taskTracked(t.id))} logged</span>}
                  </div>
                </div>
                {!compact && (
                  <div className="flex items-center pr-0.5">
                    <Btn size="sm" variant="ghost" onClick={() => requestFocus(t.id)} title="Focus on this task">
                      <Play size={12} />
                    </Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ================= zen overlay ================= */
  if (zen) {
    return (
      <div className="fadein fixed inset-0 z-[60] overflow-y-auto" style={{ background: "color-mix(in srgb, var(--bg) 92%, black)" }}>
        <div className="pointer-events-none fixed inset-0" style={{ background: "radial-gradient(ellipse 70% 50% at 50% 0%, var(--accent-soft), transparent 70%)" }} />
        <div className="relative mx-auto flex max-w-[560px] flex-col gap-4 px-5 py-14">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-[24px] font-bold tracking-tight">Zen mode</div>
              <div className="text-[12.5px] font-semibold" style={{ color: "var(--mut)" }}>{fmtDateLong(new Date())}</div>
            </div>
            <Btn variant="outline" onClick={() => setZen(false)}><Leaf size={13} /> Exit zen</Btn>
          </div>
          <div className="rise grid grid-cols-3 gap-2 text-center">
            {[
              { k: "Focused", v: fmtDur(todayMin) },
              { k: "Sessions", v: String(sessionsToday.length) },
              { k: "Done", v: String(doneToday.length) },
            ].map((x) => (
              <div key={x.k} className="rounded-2xl border px-3 py-4" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
                <div className="font-mono text-[22px] font-bold tnum" style={{ color: "var(--accent)" }}>{x.v}</div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>{x.k}</div>
              </div>
            ))}
          </div>
          {scheduleCard(true)}
          {checkinCard(true)}
          {planCard(true)}
        </div>
      </div>
    );
  }

  /* ================= the cockpit ================= */
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold leading-tight tracking-tight">
            {greetingFor(new Date().getHours())}
            {state.settings.profileName.trim() ? `, ${state.settings.profileName.trim()}` : ""}
          </h1>
          <div className="text-[11.5px] font-bold uppercase tracking-[0.13em]" style={{ color: "var(--accent)" }}>
            {fmtDateLong(new Date())}
          </div>
          <p className="mt-0.5 text-[13px] font-semibold" style={{ color: "var(--mut)" }}>
            {fmtDur(weekMin)} tracked this week · {dueTasks.length} open · {schedule.length} time block{schedule.length === 1 ? "" : "s"} today
          </p>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" onClick={() => setZen(true)}><Leaf size={13} /> Zen mode</Btn>
          <Btn variant="soft" onClick={() => openTaskDialog({ presetDate: today })}><Plus size={13} /> Task</Btn>
        </div>
      </div>

      {/* ------- weighted stat strip ------- */}
      <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.55fr_1fr_1fr_1fr]">
        <div
          className="card card-hover relative overflow-hidden p-4"
          style={{ borderColor: "color-mix(in srgb, var(--accent) 40%, var(--line))", boxShadow: "0 8px 30px -18px var(--accent)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--mut)" }}>Focused today</span>
            {anyRunning ? (
              <span className="chip !py-0 text-[9.5px]" style={{ color: "var(--danger)", borderColor: "color-mix(in srgb, var(--danger) 50%, var(--line))" }}>
                <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: "var(--danger)", animation: "nowpulse 1.4s infinite" }} /> recording
              </span>
            ) : (
              <Timer size={13} style={{ color: "var(--mut)" }} />
            )}
          </div>
          <div className="mt-1 font-mono text-[30px] font-bold leading-none tnum" style={{ color: "var(--accent)" }}>
            {fmtDur(todayMin)}
          </div>
          <div className="mt-3 flex h-[38px] items-end gap-1.5" aria-hidden>
            {weekBars.map((b, i) => (
              <div key={b.iso} className="group/bar relative flex-1">
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
          <div className="mt-1 flex justify-between text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>
            <span>last 7 days</span><span>today</span>
          </div>
        </div>

        <div className="card card-hover flex flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--mut)" }}>Sessions</span>
            <Timer size={13} style={{ color: "var(--mut)" }} />
          </div>
          <div>
            <div className="font-mono text-[28px] font-bold leading-none tnum">{sessionsToday.length}</div>
            <div className="mt-1.5 text-[11px] font-semibold" style={{ color: "var(--mut)" }}>
              {sessionsToday.length === 0 ? "none yet — hit Focus" : <>last ended {lastSessionAt ? fmtClock(lastSessionAt) : "—"}</>}
            </div>
          </div>
        </div>

        <div className="card card-hover flex flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--mut)" }}>Tasks done</span>
            <Check size={13} style={{ color: "var(--ok)" }} />
          </div>
          <div>
            <div className="font-mono text-[28px] font-bold leading-none tnum">
              {doneToday.length}
              <span className="text-[15px] font-semibold" style={{ color: "var(--mut)" }}> / {doneToday.length + dueTasks.length}</span>
            </div>
            <div className="mt-2 h-[5px] overflow-hidden rounded-full" style={{ background: "var(--bg)" }}>
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

        <div className="card card-hover flex flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--mut)" }}>Day streak</span>
            <Flame size={14} style={{ color: bestHabit && bestHabit.cur > 0 ? "var(--warn)" : "var(--mut)" }} />
          </div>
          <div>
            <div className="font-mono text-[28px] font-bold leading-none tnum">
              {bestHabit ? bestHabit.cur : 0}
              <span className="text-[15px] font-semibold" style={{ color: "var(--mut)" }}>d</span>
            </div>
            <div className="mt-1.5 truncate text-[11px] font-semibold" style={{ color: "var(--mut)" }}>
              {bestHabit ? `${bestHabit.emoji} ${bestHabit.name}` : "no habits yet"}
            </div>
          </div>
        </div>
      </div>

      {/* ------- main grid ------- */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="stagger flex flex-col gap-4">
          {checkinCard()}
          {scheduleCard()}
          {planCard()}
        </div>

        <div className="stagger flex flex-col gap-4">
          {/* inline daily note */}
          <div className="card card-hover flex flex-col p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[16px]">📅</span>
                <div>
                  <div className="font-display text-[15px] font-bold leading-tight tracking-tight">Daily note</div>
                  <div className="text-[10.5px] font-semibold tnum" style={{ color: "var(--mut)" }}>{fmtNoteName(today)}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
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
              className="inp mt-3 h-[150px] resize-y !leading-relaxed"
              value={noteText}
              onChange={(e) => { setNoteText(e.target.value); setNoteStatus("dirty"); }}
              placeholder="Intentions, thoughts, what happened… autosaves & encrypts as you type."
            />
          </div>

          {/* on this day */}
          <div className="card card-hover p-4">
            <div className="font-display text-[15px] font-bold tracking-tight">On this day</div>
            <div className="mt-2 flex gap-1.5">
              {([["1w", "1 week ago"], ["1m", "1 month ago"], ["1y", "1 year ago"]] as const).map(([v, l]) => (
                <button
                  key={v} onClick={() => setFlashTab(v)}
                  className="rounded-lg px-2.5 py-1 text-[11.5px] font-bold transition-all"
                  style={flashTab === v ? { background: "var(--accent)", color: "var(--on-accent)", cursor: "pointer" } : { color: "var(--mut)", background: "var(--bg)", cursor: "pointer" }}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
              <div className="flex items-center gap-2 text-[12px] font-bold" style={{ color: "var(--mut)" }}>
                <CalendarDays size={13} /> {fmtDayShort(flashDate)}
              </div>
              {flash.min > 0 || flash.doneTitles.length > 0 ? (
                <>
                  <div className="mt-1.5 font-mono text-[20px] font-bold tnum" style={{ color: "var(--accent)" }}>
                    {fmtDur(flash.min)} <span className="text-[11px] font-semibold" style={{ color: "var(--mut)" }}>tracked</span>
                  </div>
                  {flash.doneTitles.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1">
                      {flash.doneTitles.slice(0, 5).map((t, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-[12px] font-semibold">
                          <Check size={11} style={{ color: "var(--ok)" }} /> {t}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <div className="mt-2 text-[12.5px]" style={{ color: "var(--mut)" }}>
                  Nothing logged on this day — a blank page in your log.
                </div>
              )}
            </div>
          </div>

          {/* habit flames */}
          <div className="card card-hover p-4">
            <div className="flex items-center justify-between">
              <div className="font-display text-[15px] font-bold tracking-tight">Habit flames</div>
              <Btn size="sm" variant="ghost" onClick={() => setView("habits")}>Open habits</Btn>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {state.habits.length === 0 && (
                <EmptyState icon={Flame} title="No habits yet" body="Create one in the Habits tab." />
              )}
              {state.habits.slice(0, 3).map((h) => {
                const doneTodayH = h.completions.includes(today);
                return (
                  <div key={h.id} className="flex items-center gap-2.5">
                    <span className="text-[16px]">{h.emoji}</span>
                    <span className="flex-1 truncate text-[13px] font-bold">{h.name}</span>
                    <span className="chip !py-0 text-[10.5px]" style={{ color: doneTodayH ? "var(--ok)" : "var(--mut)" }}>
                      <Flame size={10} /> {doneTodayH ? "done today" : "pending"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => openTaskDialog({ presetDate: today })}
            className="card card-hover flex items-center justify-center gap-2 p-4 text-[13px] font-bold"
            style={{ color: "var(--accent)", cursor: "pointer" }}
          >
            <Plus size={15} /> Plan something for today
          </button>
        </div>
      </div>
    </div>
  );
}
