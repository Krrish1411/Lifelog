import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Coffee, Expand, Pause, Play, Plus, Square, Target, Trash2, Zap } from "lucide-react";
import type { Session, TimerMode } from "../types";
import { useApp } from "../store";
import { fmtClock, fmtDur, isoDate, sessionMinutes, todayIso, uid } from "../utils/core";
import { Btn, EmptyState, SearchInput, Seg, cn } from "../components/ui";

function elapsedMsOf(s: Session, now: number): number {
  let ms = now - s.startedAt;
  for (const p of s.pauses) {
    const r = p.resumeAt ?? now;
    ms -= Math.max(0, Math.min(r, now) - p.at);
  }
  return Math.max(0, ms);
}
function fmtMs(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

export function FocusView() {
  const app = useApp();
  const { state, set, toast, focusTaskId, clearFocusRequest } = app;
  const settings = state.settings;
  const [selTaskId, setSelTaskId] = useState<string | null>(null);
  const [selSubtaskId, setSelSubtaskId] = useState<string | null>(null);
  const [mode, setMode] = useState<TimerMode | null>(null);
  const [stage, setStage] = useState(false); // full-screen counter
  const [now, setNow] = useState(Date.now());
  const [query, setQuery] = useState("");
  const [cdMin, setCdMin] = useState(String(settings.countdownMin));
  const [breakOffer, setBreakOffer] = useState(false);
  const finishing = useRef(false);

  /* the single source of truth: the running session in the store.
     The mini-widget, shortcuts and this view all read/write it, so they can never disagree. */
  const live = state.sessions.find((s) => s.status === "running") ?? null;
  const paused = useMemo(() => {
    if (!live) return false;
    const lp = live.pauses[live.pauses.length - 1];
    return !!lp && lp.resumeAt === null;
  }, [live]);

  /* arriving from elsewhere: pre-select task, never auto-start */
  useEffect(() => {
    if (focusTaskId) {
      setSelTaskId(focusTaskId);
      setSelSubtaskId(null);
      setMode(null);
      setBreakOffer(false);
      clearFocusRequest();
    }
  }, [focusTaskId, clearFocusRequest]);

  /* pre-select the live session's task */
  useEffect(() => {
    if (live?.taskId) setSelTaskId(live.taskId);
    if (live?.subtaskId) setSelSubtaskId(live.subtaskId);
    if (live && live.mode !== "break") setMode(live.mode as TimerMode);
  }, [live?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* close the stage when the session ends (from here, the widget, or a shortcut) */
  useEffect(() => {
    if (!live) {
      setStage(false);
      setBreakOffer(false);
    }
  }, [live?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [live?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const elapsedMs = live ? elapsedMsOf(live, now) : 0;
  const plannedMs = live?.plannedMin ? live.plannedMin * 60000 : null;
  const remainingMs = plannedMs !== null ? Math.max(0, plannedMs - elapsedMs) : null;

  const finalize = (kind: "done" | "stopped") => {
    if (!live || finishing.current) return;
    finishing.current = true;
    const ts = Date.now();
    const mins = sessionMinutes(live, ts);
    set((s) => ({
      ...s,
      sessions: s.sessions.map((x) =>
        x.id === live.id
          ? { ...x, endedAt: ts, status: kind, pauses: x.pauses.map((p) => (p.resumeAt ? p : { ...p, resumeAt: ts })) }
          : x,
      ),
    }));
    if (kind === "done") {
      if (live.mode === "break") toast("Break over — ready when you are", "ok");
      else {
        toast(`${live.mode === "pomodoro" ? "Pomodoro" : live.mode === "flow" ? "Flow session" : "Countdown"} complete — ${fmtDur(mins)} logged`, "ok");
        if (live.mode === "pomodoro") setBreakOffer(true);
      }
    } else {
      toast(`Stopped — ${fmtDur(Math.max(1, mins))} saved to the log`, "warn");
    }
    finishing.current = false;
  };

  /* auto-complete planned sessions */
  useEffect(() => {
    if (live && plannedMs !== null && !paused && elapsedMs >= plannedMs) finalize("done");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, live?.id, paused]);

  const start = (m: TimerMode | "break") => {
    const isBreak = m === "break";
    if (!isBreak && !selTaskId) return toast("Pick a task first", "err");
    const plannedMin =
      m === "pomodoro" ? settings.pomodoroMin
        : m === "countdown" ? Math.max(1, parseInt(cdMin, 10) || settings.countdownMin)
        : m === "break" ? settings.breakMin
        : null;
    const id = uid();
    const ts = Date.now();
    set((s) => ({
      ...s,
      sessions: [...s.sessions, {
        id, taskId: isBreak ? null : selTaskId, subtaskId: isBreak ? null : selSubtaskId,
        mode: m, startedAt: ts, endedAt: null, plannedMin, pauses: [], status: "running",
      }],
    }));
    setBreakOffer(false);
    setNow(ts);
    setStage(true); // the counter takes over the screen
    toast(isBreak ? "Break started" : `${m === "pomodoro" ? "Pomodoro" : m === "countdown" ? "Countdown" : "Flow"} started — back button keeps it running`, "ok");
  };

  const pause = () => {
    if (!live || paused) return;
    set((s) => ({ ...s, sessions: s.sessions.map((x) => (x.id === live.id ? { ...x, pauses: [...x.pauses, { at: Date.now(), resumeAt: null }] } : x)) }));
    setNow(Date.now());
  };
  const resume = () => {
    if (!live || !paused) return;
    set((s) => ({
      ...s,
      sessions: s.sessions.map((x) =>
        x.id === live.id
          ? { ...x, pauses: x.pauses.map((p, i) => (i === x.pauses.length - 1 && !p.resumeAt ? { ...p, resumeAt: Date.now() } : p)) }
          : x,
      ),
    }));
    setNow(Date.now());
  };
  const extend = (min: number) => {
    if (!live || !live.plannedMin) return;
    set((s) => ({ ...s, sessions: s.sessions.map((x) => (x.id === live.id ? { ...x, plannedMin: x.plannedMin! + min } : x)) }));
    toast(`+${min} min added`, "ok");
  };

  const tasks = useMemo(
    () =>
      state.tasks
        .filter((t) => !t.done && (!query.trim() || t.title.toLowerCase().includes(query.trim().toLowerCase())))
        .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999")),
    [state.tasks, query],
  );
  const selTask = state.tasks.find((t) => t.id === selTaskId);
  const today = todayIso();
  const todaySessions = useMemo(
    () => state.sessions.filter((s) => isoDate(new Date(s.startedAt)) === today).sort((a, b) => b.startedAt - a.startedAt),
    [state.sessions, today],
  );
  const todayTotal = todaySessions.reduce((a, s) => (s.taskId ? a + sessionMinutes(s) : a), 0);

  const progress = plannedMs !== null ? Math.min(1, elapsedMs / plannedMs) : live ? (elapsedMs % 3600000) / 3600000 : 0;

  /* ================= FULL-SCREEN SESSION STAGE ================= */
  if (stage && live) {
    const task = state.tasks.find((t) => t.id === live.taskId);
    const proj = task ? state.projects.find((p) => p.id === task.projectId) : null;
    const big = remainingMs !== null ? fmtMs(remainingMs) : fmtMs(elapsedMs);
    const R = 132;
    const C = 2 * Math.PI * R;
    const doneToday = todaySessions.filter((s) => s.taskId && s.mode !== "break" && s.endedAt).length;
    return (
      <div className="fadein fixed inset-0 z-[85] flex flex-col overflow-y-auto" style={{ background: "var(--bg)" }}>
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 65% 45% at 50% 30%, var(--accent-soft), transparent 70%)" }} />
        {/* top bar */}
        <div className="relative flex items-center justify-between px-6 py-4">
          <Btn variant="outline" onClick={() => setStage(false)} title="Back to the app — the timer keeps running">
            <ArrowLeft size={14} /> Back
          </Btn>
          <span className="chip" style={{ color: "var(--accent)" }}>
            <Target size={12} /> {live.mode === "break" ? "Break" : live.mode === "pomodoro" ? "Pomodoro" : live.mode === "countdown" ? "Countdown" : "Flow"}
          </span>
          <span className="font-mono text-[13px] font-semibold tnum" style={{ color: "var(--mut)" }}>{fmtClock(Date.now())}</span>
        </div>

        <div className="relative mx-auto flex w-full max-w-[620px] flex-1 flex-col items-center justify-center gap-6 px-6 pb-10">
          {/* task card */}
          {task ? (
            <div className="pop flex w-full items-center gap-3 rounded-2xl border px-4 py-3"
              style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
              <span className="text-[24px]">{task.emoji ?? "▸"}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-bold">{task.title}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold" style={{ color: "var(--mut)" }}>
                  <span className="inline-flex items-center gap-1"><span className="h-[8px] w-[8px] rounded-full" style={{ background: proj?.color }} />{proj?.name}</span>
                  {live.subtaskId && <span>step: {task.subtasks.find((s) => s.id === live.subtaskId)?.title}</span>}
                  {task.estimateMin > 0 && <span>est {fmtDur(task.estimateMin)}</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className="chip" style={{ color: "var(--mut)" }}><Coffee size={13} /> Break — stretch, water, breathe</div>
          )}

          {/* ring + digits */}
          <div className="relative">
            <svg width={300} height={300} viewBox="0 0 300 300" className="rotate-[-90deg]">
              <circle cx="150" cy="150" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
              <circle
                cx="150" cy="150" r={R} fill="none"
                stroke={paused ? "var(--warn)" : "var(--accent)"}
                strokeWidth="10" strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - progress)}
                style={{ transition: "stroke-dashoffset 0.4s linear, stroke 0.3s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className={cn("stage-num font-mono font-bold", paused && "opacity-60")} style={{ fontSize: 58, color: "var(--text)" }}>
                {big}
              </div>
              <div className="mt-1 text-[11.5px] font-bold uppercase tracking-[0.16em]" style={{ color: paused ? "var(--warn)" : "var(--mut)" }}>
                {paused ? "Paused" : remainingMs !== null ? "remaining" : "flowing"}
              </div>
            </div>
          </div>

          {/* controls */}
          <div className="flex items-center gap-3">
            <Btn variant={paused ? "primary" : "soft"} size="lg" onClick={paused ? resume : pause} className="!px-7 !py-3">
              {paused ? <Play size={17} /> : <Pause size={17} />} {paused ? "Resume" : "Pause"}
            </Btn>
            {plannedMs !== null && (
              <Btn variant="soft" size="lg" onClick={() => extend(5)} title="Add 5 minutes"><Plus size={15} /> 5m</Btn>
            )}
            <Btn variant="danger" size="lg" onClick={() => finalize("stopped")} className="!px-6 !py-3" style={{ background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" }}>
              <Square size={15} /> Stop
            </Btn>
          </div>

          <div className="flex items-center gap-4 text-[12px] font-semibold" style={{ color: "var(--mut)" }}>
            <span className="tnum">{doneToday} session{doneToday === 1 ? "" : "s"} today</span>
            <span>·</span>
            <span className="tnum">{fmtDur(todayTotal)} tracked today</span>
            <span>·</span>
            <span>{live.pauses.length} pause{live.pauses.length === 1 ? "" : "s"}</span>
          </div>
          {breakOffer && null}
        </div>
      </div>
    );
  }

  /* ================= normal focus view ================= */
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-tight">Focus</h1>
          <p className="text-[13px] font-semibold" style={{ color: "var(--mut)" }}>
            Pomodoro, countdown or open flow — starting takes over the screen; Back keeps it running.
          </p>
        </div>
        {live && (
          <Btn variant="primary" size="lg" onClick={() => setStage(true)} className="ring-pulse">
            <Expand size={15} /> Session running — open full counter
          </Btn>
        )}
      </div>

      {breakOffer && !live && (
        <div className="pop flex items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}>
          <Coffee size={16} style={{ color: "var(--accent)" }} />
          <span className="flex-1 text-[13px] font-bold">Pomodoro done. Take a {settings.breakMin}-minute break?</span>
          <Btn variant="primary" size="sm" onClick={() => start("break")}>Start break</Btn>
          <Btn variant="ghost" size="sm" onClick={() => setBreakOffer(false)}>Skip</Btn>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr_280px]">
        {/* task picker */}
        <div className="card engine-panel flex max-h-[640px] flex-col p-3">
          <SearchInput value={query} onChange={setQuery} placeholder="Find a task…" width="100%" />
          <div className="mt-2 flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {tasks.length === 0 && <div className="px-2 py-4 text-center text-[12px]" style={{ color: "var(--mut)" }}>No open tasks match.</div>}
            {tasks.map((t) => {
              const p = state.projects.find((x) => x.id === t.projectId);
              const active = t.id === selTaskId;
              return (
                <button
                  key={t.id}
                  disabled={!!live && live.mode !== "break"}
                  onClick={() => { setSelTaskId(t.id); setSelSubtaskId(null); }}
                  className="flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all disabled:opacity-50"
                  style={active ? { borderColor: "var(--accent)", background: "var(--accent-soft)" } : { borderColor: "var(--line)", cursor: "pointer" }}
                >
                  <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: p?.color }} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold">{t.emoji ? `${t.emoji} ` : ""}{t.title}</span>
                  {t.priority === "urgent" && <Zap size={11} style={{ color: "var(--danger)" }} />}
                </button>
              );
            })}
          </div>
          {selTask && selTask.subtasks.length > 0 && (
            <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--line)" }}>
              <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>Track a step</div>
              <div className="flex flex-col gap-1">
                <button onClick={() => setSelSubtaskId(null)} className="rounded-lg px-2 py-1 text-left text-[12px] font-semibold"
                  style={!selSubtaskId ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--mut)", cursor: "pointer" }}>
                  Whole task
                </button>
                {selTask.subtasks.filter((s) => !s.done).map((s) => (
                  <button key={s.id} onClick={() => setSelSubtaskId(s.id)} className="rounded-lg px-2 py-1 text-left text-[12px] font-semibold"
                    style={selSubtaskId === s.id ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--mut)", cursor: "pointer" }}>
                    ↳ {s.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* timer */}
        <div className="card engine-panel relative flex flex-col items-center p-6">
          <Seg
            options={[
              { value: "pomodoro", label: `Pomodoro · ${settings.pomodoroMin}m` },
              { value: "countdown", label: "Countdown" },
              { value: "flow", label: "Flow" },
            ]}
            value={mode}
            onChange={(m) => { if (!live) setMode(m); }}
          />
          {mode === "countdown" && !live && (
            <div className="mt-3 flex items-center gap-2">
              <input className="inp w-[110px] text-center font-mono" type="number" min={1} max={480} value={cdMin}
                onChange={(e) => setCdMin(e.target.value)} />
              <span className="text-[12px] font-bold" style={{ color: "var(--mut)" }}>minutes</span>
            </div>
          )}
          <div className="relative mt-6">
            <svg width={240} height={240} viewBox="0 0 240 240" className="rotate-[-90deg]">
              <circle cx="120" cy="120" r="104" fill="none" stroke="var(--line)" strokeWidth="12" />
              <circle cx="120" cy="120" r="104" fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 104} strokeDashoffset={2 * Math.PI * 104 * (1 - progress)}
                style={{ transition: "stroke-dashoffset 0.4s linear" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="stage-num font-mono text-[42px] font-bold" style={{ color: live ? "var(--text)" : "var(--mut)" }}>
                {live ? (remainingMs !== null ? fmtMs(remainingMs) : fmtMs(elapsedMs)) : mode === "pomodoro" ? `${settings.pomodoroMin}:00` : mode === "countdown" ? `${cdMin || settings.countdownMin}:00` : "0:00"}
              </div>
              <div className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--mut)" }}>
                {live ? (paused ? "paused" : "running") : selTask ? "ready" : "pick a task"}
              </div>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2.5">
            {!live ? (
              <Btn variant="primary" size="lg" disabled={!selTaskId && mode !== "flow"} onClick={() => mode && start(mode)} className="!px-8">
                <Play size={16} /> Start {mode === "pomodoro" ? "pomodoro" : mode === "countdown" ? "countdown" : mode === "flow" ? "flow" : ""}
              </Btn>
            ) : (
              <>
                <Btn variant="soft" size="lg" onClick={paused ? resume : pause}>{paused ? <Play size={15} /> : <Pause size={15} />} {paused ? "Resume" : "Pause"}</Btn>
                {plannedMs !== null && <Btn variant="soft" size="lg" onClick={() => extend(5)}><Plus size={14} /> 5m</Btn>}
                <Btn variant="danger" size="lg" onClick={() => finalize("stopped")} style={{ background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" }}>
                  <Square size={14} /> Stop
                </Btn>
                <Btn variant="outline" size="lg" onClick={() => setStage(true)}><Expand size={14} /> Full screen</Btn>
              </>
            )}
          </div>
          <p className="mt-3 max-w-[420px] text-center text-[11.5px] font-semibold" style={{ color: "var(--mut)" }}>
            Nothing auto-starts. When you start, the counter takes over the screen — the Back button returns you to the app while the timer keeps running.
          </p>
        </div>

        {/* today */}
        <div className="card engine-panel flex max-h-[640px] flex-col p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[14.5px] font-bold">Today</span>
            <span className="font-mono text-[15px] font-bold tnum" style={{ color: "var(--accent)" }}>{fmtDur(todayTotal)}</span>
          </div>
          <div className="mt-2 flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
            {todaySessions.length === 0 && (
              <EmptyState icon={Target} title="No sessions yet" body="Your sessions will appear here with their exact times." />
            )}
            {todaySessions.map((s) => {
              const t = state.tasks.find((x) => x.id === s.taskId);
              return (
                <div key={s.id} className="rounded-xl border px-2.5 py-2" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                  <div className="flex items-center gap-2 text-[12px] font-bold">
                    <span className={cn("h-[7px] w-[7px] rounded-full")} style={{ background: s.status === "running" ? "var(--ok)" : s.mode === "break" ? "var(--mut)" : "var(--accent)" }} />
                    <span className="truncate">{s.mode === "break" ? "Break" : t?.title ?? "Untitled"}</span>
                    <span className="ml-auto font-mono tnum" style={{ color: "var(--mut)" }}>{fmtDur(sessionMinutes(s))}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold tnum" style={{ color: "var(--mut)" }}>
                    <span>{fmtClock(s.startedAt)} → {s.endedAt ? fmtClock(s.endedAt) : "now"}</span>
                    {s.pauses.length > 0 && <span>· {s.pauses.length} pause{s.pauses.length > 1 ? "s" : ""}</span>}
                    {s.status === "stopped" && <span>· stopped early</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>
            Every start, pause and stop is timestamped — see the Day Log.
          </div>
          <span className="hidden"><Trash2 size={1} /></span>
        </div>
      </div>
    </div>
  );
}
