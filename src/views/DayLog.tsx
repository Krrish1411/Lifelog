import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, FileText, Flame, Pause, Timer } from "lucide-react";
import { useApp } from "../store";
import { decryptText, getDeviceKey } from "../utils/crypto";
import {
  WEEKDAYS_SHORT, addDaysIso, fmtClock, fmtDayShort, fmtDur, fmtNoteName, isoDate,
  listDates, parseIso, sessionMinutes, todayIso, weekStartIso,
} from "../utils/core";
import { requestDailyNote } from "../utils/nav";
import { Btn, EmptyState, cn } from "../components/ui";

export function DayLogView() {
  const { state, setView } = useApp();
  const today = todayIso();
  const [sel, setSel] = useState(today);
  const [weekStart, setWeekStart] = useState(weekStartIso(today));
  const [notePreview, setNotePreview] = useState<string | null>(null);

  const week = useMemo(() => listDates(weekStart, addDaysIso(weekStart, 6)), [weekStart]);
  const tracked = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of state.sessions) {
      if (!s.taskId || s.mode === "break") continue;
      const day = isoDate(new Date(s.startedAt));
      m.set(day, (m.get(day) ?? 0) + sessionMinutes(s));
    }
    return m;
  }, [state.sessions]);

  const daySessions = useMemo(
    () => state.sessions.filter((s) => isoDate(new Date(s.startedAt)) === sel).sort((a, b) => a.startedAt - b.startedAt),
    [state.sessions, sel],
  );
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
      if (!s.taskId || s.mode === "break") continue;
      const t = state.tasks.find((x) => x.id === s.taskId);
      if (!t) continue;
      m.set(t.projectId, (m.get(t.projectId) ?? 0) + sessionMinutes(s));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [daySessions, state.tasks]);

  const log = state.dayLogs[sel];
  const totalMin = tracked.get(sel) ?? 0;
  const focusSessions = daySessions.filter((s) => s.taskId && s.mode !== "break");

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

  const d = parseIso(sel);
  const isToday = sel === today;
  const maxProj = byProject.length ? byProject[0][1] : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-tight">Day Log</h1>
          <p className="text-[13px] font-semibold" style={{ color: "var(--mut)" }}>
            The complete record of {fmtDayShort(sel)}{isToday ? " — today" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="soft" onClick={() => { const ws = addDaysIso(weekStart, -7); setWeekStart(ws); setSel(addDaysIso(sel, -7)); }} aria-label="Previous week"><ChevronLeft size={14} /></Btn>
          <Btn variant="outline" onClick={() => { setWeekStart(weekStartIso(today)); setSel(today); }}>Today</Btn>
          <Btn variant="soft" onClick={() => { const ws = addDaysIso(weekStart, 7); setWeekStart(ws); setSel(addDaysIso(sel, 7)); }} aria-label="Next week"><ChevronRight size={14} /></Btn>
        </div>
      </div>

      {/* week strip */}
      <div className="card engine-panel grid grid-cols-7 gap-1.5 p-2">
        {week.map((iso, i) => {
          const active = iso === sel;
          const hasWork = (tracked.get(iso) ?? 0) > 0;
          const dayDoneCount = state.tasks.filter((t) => (t.done && t.doneAt && isoDate(new Date(t.doneAt)) === iso) || t.completions.some((c) => isoDate(new Date(c.at)) === iso)).length;
          return (
            <button
              key={iso}
              onClick={() => pickDay(iso)}
              className="flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 transition-all hover:-translate-y-0.5"
              style={active
                ? { borderColor: "var(--accent)", background: "var(--accent-soft)", cursor: "pointer" }
                : { borderColor: "var(--line)", cursor: "pointer" }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: active ? "var(--accent)" : "var(--mut)" }}>{WEEKDAYS_SHORT[i]}</span>
              <span
                className={cn("tnum flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-bold")}
                style={iso === today
                  ? { background: "var(--accent)", color: "var(--on-accent)" }
                  : active ? { color: "var(--accent)" } : { color: "var(--text)" }}
              >
                {parseIso(iso).getDate()}
              </span>
              <span className="flex h-[10px] items-center gap-1">
                {hasWork && <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--ok)" }} title={`${fmtDur(tracked.get(iso) ?? 0)} tracked`} />}
                {dayDoneCount > 0 && <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--accent)" }} title={`${dayDoneCount} done`} />}
              </span>
            </button>
          );
        })}
      </div>

      {/* stat row */}
      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: <Timer size={16} />, k: "Minutes focused", v: fmtDur(totalMin), hot: totalMin > 0 },
          { icon: <Flame size={16} />, k: "Sessions", v: String(focusSessions.length), hot: focusSessions.length > 0 },
          { icon: <Check size={16} />, k: "Tasks completed", v: String(dayDone.length), hot: dayDone.length > 0 },
          { icon: <CalendarDays size={16} />, k: "Check-in", v: log?.energy != null ? `${log.moodEmoji ?? ""} ${log.energy}/5`.trim() : "—", hot: !!log?.updatedAt },
        ].map((x) => (
          <div key={x.k} className="card card-hover flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: x.hot ? "var(--accent)" : "var(--mut)" }}>{x.icon}</span>
            <div>
              <div className="font-mono text-[20px] font-bold leading-none tnum" style={{ color: x.hot ? "var(--text)" : "var(--mut)" }}>{x.v}</div>
              <div className="mt-1 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>{x.k}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        {/* focus by project — hour shapes */}
        <div className="card engine-panel p-4">
          <div className="font-display text-[15px] font-bold tracking-tight">Focus by project</div>
          <div className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--mut)" }}>Block length = share of the day’s focused time</div>
          {byProject.length === 0 ? (
            <EmptyState icon={Timer} title="No focus recorded" body="Start a session from the Focus tab and it will appear here, shaped by project." />
          ) : (
            <>
              {/* proportional block bar */}
              <div className="mt-3 flex h-[34px] w-full overflow-hidden rounded-xl border" style={{ borderColor: "var(--line)" }}>
                {byProject.map(([pid, min]) => {
                  const p = state.projects.find((x) => x.id === pid);
                  return (
                    <div
                      key={pid}
                      className="flex items-center justify-center overflow-hidden text-[10.5px] font-bold transition-all hover:brightness-110"
                      style={{ width: `${(min / totalMin) * 100}%`, background: `color-mix(in srgb, ${p?.color ?? "#888"} 75%, var(--panel2))`, color: "var(--text)", minWidth: min >= 10 ? 34 : 10 }}
                      title={`${p?.name ?? "?"} · ${fmtDur(min)}`}
                    >
                      {p?.emoji}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {byProject.map(([pid, min]) => {
                  const p = state.projects.find((x) => x.id === pid);
                  return (
                    <div key={pid} className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[15px]" style={{ background: `color-mix(in srgb, ${p?.color} 20%, transparent)` }}>{p?.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between text-[12.5px] font-bold">
                          <span className="truncate">{p?.name ?? "Deleted project"}</span>
                          <span className="tnum font-mono" style={{ color: "var(--accent)" }}>{fmtDur(min)}</span>
                        </div>
                        <div className="mt-1 h-[6px] overflow-hidden rounded-full" style={{ background: "var(--bg)" }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(3, (min / maxProj) * 100)}%`, background: p?.color }} />
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

        {/* session timeline */}
        <div className="card engine-panel p-4">
          <div className="font-display text-[15px] font-bold tracking-tight">Session timeline</div>
          <div className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--mut)" }}>Every start, pause and completion — timestamped</div>
          {daySessions.length === 0 ? (
            <EmptyState icon={Flame} title="No sessions" body="This day has no focus sessions on record." />
          ) : (
            <div className="mt-3 flex max-h-[330px] flex-col gap-1.5 overflow-y-auto pr-1">
              {daySessions.map((s) => {
                const t = state.tasks.find((x) => x.id === s.taskId);
                const p = t ? state.projects.find((x) => x.id === t.projectId) : null;
                const min = sessionMinutes(s);
                return (
                  <div key={s.id} className="flex items-center gap-2.5 rounded-xl border px-2.5 py-2" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                    <span className="h-[26px] w-[4px] shrink-0 rounded-full" style={{ background: s.mode === "break" ? "var(--mut)" : p?.color ?? "var(--accent)" }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-bold">{s.mode === "break" ? "☕ Break" : `${t?.emoji ?? "▸"} ${t?.title ?? "Untitled task"}`}</div>
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

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        {/* tasks completed */}
        <div className="card engine-panel p-4">
          <div className="font-display text-[15px] font-bold tracking-tight">Tasks completed</div>
          {dayDone.length === 0 ? (
            <div className="mt-3 text-[12.5px]" style={{ color: "var(--mut)" }}>Nothing was completed on this day.</div>
          ) : (
            <div className="mt-2.5 flex flex-col gap-1.5">
              {dayDone.map((t) => {
                const at = t.done && t.doneAt && isoDate(new Date(t.doneAt)) === sel ? t.doneAt : t.completions.find((c) => isoDate(new Date(c.at)) === sel)?.at;
                const p = state.projects.find((x) => x.id === t.projectId);
                return (
                  <div key={t.id} className="flex items-center gap-2.5 rounded-xl border px-2.5 py-2" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                    <Check size={14} style={{ color: "var(--ok)" }} />
                    <span className="h-[8px] w-[8px] rounded-full" style={{ background: p?.color }} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold">{t.emoji ? `${t.emoji} ` : ""}{t.title}</span>
                    {t.completions.length > 0 && !t.done && <span className="chip !py-0 text-[9.5px]">↻ recurring</span>}
                    <span className="tnum shrink-0 font-mono text-[11px]" style={{ color: "var(--mut)" }}>{at ? fmtClock(at) : ""}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* daily note */}
        <div className="card engine-panel p-4">
          <div className="flex items-center justify-between">
            <div className="font-display text-[15px] font-bold tracking-tight">Daily note · {fmtNoteName(sel)}</div>
            <Btn size="sm" variant="soft" onClick={() => { requestDailyNote(sel); setView("notes"); }}>
              <FileText size={12} /> Open note
            </Btn>
          </div>
          {notePreview === null ? (
            <div className="mt-3 text-[12.5px]" style={{ color: "var(--mut)" }}>Decrypting note…</div>
          ) : notePreview === "" ? (
            <div className="mt-3 text-[12.5px]" style={{ color: "var(--mut)" }}>No note written for this day yet — open it and capture what happened.</div>
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
      </div>
    </div>
  );
}
