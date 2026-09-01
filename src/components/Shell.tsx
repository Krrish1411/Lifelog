import { useEffect, useMemo, useState } from "react";
import { BarChart3, Calendar, Check, FileClock, FileText, Flame, LayoutDashboard, ListTodo,
  Pause, PenLine, Play, Plus, Quote, Settings, SlidersHorizontal, Square, Timer,
} from "lucide-react";
import type { TokenKey, ViewId } from "../types";
import { FONT_PAIRS, QUOTES, SHORTCUT_ACTIONS } from "../types";
import { useApp } from "./../store";
import {
  ensureContrast, fmtDateLong, fmtDur, fmtHMS, greetingFor, mix, normalizeHex,
  readableOn, sessionSeconds, streakStats, todayIso, trackedByDay,
} from "../utils/core";
import { CUSTOM_FONT_FAMILY } from "../utils/fonts";
import { Btn, Modal, TextInput, Toggle, cn } from "./ui";
import { TaskDialog } from "./TaskDialog";
import { Dashboard } from "../views/Dashboard";
import { TasksView } from "../views/Tasks";
import { FocusView } from "../views/Focus";
import { CalendarView } from "../views/Calendar";
import { HabitsView } from "../views/Habits";
import { NotesView } from "../views/Notes";
import { DayLogView } from "../views/DayLog";
import { ReportsView } from "../views/Reports";
import { ReviewView } from "../views/Review";
import { SettingsView } from "../views/Settings";

const NAV: { id: ViewId; label: string; icon: typeof Timer }[] = [
  { id: "dashboard", label: "Today", icon: LayoutDashboard },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "focus", label: "Focus", icon: Timer },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "habits", label: "Habits", icon: Flame },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "daylog", label: "Day Log", icon: FileClock },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "review", label: "Review", icon: PenLine },
  { id: "settings", label: "Settings", icon: Settings },
];

function Clock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = (n: number) => String(n).padStart(2, "0");
  if (compact) {
    return (
      <div className="text-center font-mono text-[12px] font-semibold tnum" style={{ color: "var(--mut)" }}>
        <div style={{ color: "var(--text)" }}>{p(now.getHours())}:{p(now.getMinutes())}</div>
        <div className="text-[10px]">{p(now.getSeconds())}</div>
      </div>
    );
  }
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="font-mono text-[17px] font-semibold tnum" style={{ color: "var(--text)" }}>
        {p(now.getHours())}:{p(now.getMinutes())}
        <span style={{ color: "var(--mut)" }}>:{p(now.getSeconds())}</span>
      </span>
      <span className="text-[12px] font-semibold" style={{ color: "var(--mut)" }}>{fmtDateLong(now)}</span>
    </div>
  );
}

function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={small ? 26 : 30} height={small ? 26 : 30} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--panel2)" stroke="var(--line)" />
        <circle cx="16" cy="16" r="9" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray="42 15" transform="rotate(-90 16 16)" />
        <circle cx="16" cy="16" r="3" fill="var(--accent)" />
      </svg>
      {!small && (
        <div className="leading-none">
          <div className="font-display text-[16px] font-bold tracking-tight">LifeLog</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--mut)" }}>
            your day, remembered
          </div>
        </div>
      )}
    </div>
  );
}

const TOKEN_DEFAULTS: Record<TokenKey, { dark: string; light: string }> = {
  text: { dark: "#e8efe9", light: "#182019" },
  mut: { dark: "#8fa396", light: "#5c6a60" },
  panel: { dark: "#16211c", light: "#ffffff" },
  panel2: { dark: "#1d2b24", light: "#f7faf7" },
  line: { dark: "#26382f", light: "#d7ded8" },
  ok: { dark: "#6fbf8e", light: "#3e8f60" },
  warn: { dark: "#e0b457", light: "#a67c1f" },
  danger: { dark: "#d66853", light: "#b23c28" },
};

/* ================================================================ */
export function Shell() {
  const app = useApp();
  const { state, set, view, setView, openTaskDialog } = app;
  const layout = state.settings.layout;
  const [greeting, setGreeting] = useState(false);
  const [zenConfig, setZenConfig] = useState(false);

  /* ---------- theme variables: every token customisable, contrast-checked ---------- */
  useEffect(() => {
    const s = state.settings;
    const dark = s.themeMode === "dark";
    const bg = normalizeHex(dark ? s.bgDark : s.bgLight) ?? (dark ? "#0f1714" : "#eef1ee");
    const derived: Record<TokenKey, string> = {
      text: dark ? "#e8efe9" : "#182019",
      mut: "",
      panel: dark ? mix(bg, "#ffffff", 0.045) : mix(bg, "#ffffff", 0.6),
      panel2: dark ? mix(bg, "#ffffff", 0.09) : mix(bg, "#ffffff", 0.92),
      line: dark ? mix(bg, "#ffffff", 0.14) : mix(bg, "#000000", 0.13),
      ok: dark ? "#6fbf8e" : "#3e8f60",
      warn: dark ? "#e0b457" : "#a67c1f",
      danger: dark ? "#d66853" : "#b23c28",
    };
    derived.mut = mix(derived.text, bg, 0.45);
    // user overrides win, then contrast guards keep text readable
    (Object.keys(derived) as TokenKey[]).forEach((k) => {
      const o = s.tokens[k];
      if (o && normalizeHex(o)) derived[k] = normalizeHex(o)!;
    });
    derived.text = ensureContrast(derived.text, bg, 7);
    derived.mut = ensureContrast(derived.mut, bg, 4.6);
    derived.ok = ensureContrast(derived.ok, bg, 3);
    derived.warn = ensureContrast(derived.warn, bg, 3);
    derived.danger = ensureContrast(derived.danger, bg, 3);
    const accent = ensureContrast(normalizeHex(s.accent) ?? "#e8a33d", bg, 4.5);
    const root = document.documentElement;
    root.style.setProperty("--bg", bg);
    (Object.keys(derived) as TokenKey[]).forEach((k) => root.style.setProperty(`--${k}`, derived[k]));
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--on-accent", readableOn(accent));
    root.style.setProperty("--ring", `color-mix(in srgb, ${accent} 32%, transparent)`);
    root.style.setProperty("--accent-soft", `color-mix(in srgb, ${accent} 14%, transparent)`);
    /* zoom + font (applies to ALL text: body, headings, user content) */
    root.style.setProperty("--uizoom", String(Math.max(1, Math.min(2, s.uiZoom / 100))));
    const fam = s.customFontName
      ? `'${CUSTOM_FONT_FAMILY}', sans-serif`
      : `'${FONT_PAIRS[s.fontPair]?.family ?? "Manrope"}', sans-serif`;
    root.style.setProperty("--font-body", fam);
    root.style.setProperty("--font-display", fam);
    document.body.style.fontFamily = fam;
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.engine = s.layout;
    root.style.background = bg;
  }, [state.settings]);

  /* ---------- launch greeting ---------- */
  useEffect(() => {
    const today = todayIso();
    if (state.settings.greeting === "every" || state.meta.lastGreetingDay !== today) setGreeting(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const closeGreeting = () => {
    setGreeting(false);
    set((s) => ({ ...s, meta: { ...s.meta, lastGreetingDay: todayIso() } }));
  };

  /* ---------- global session watchdog: finish countdowns wherever you are ---------- */
  useEffect(() => {
    const t = setInterval(() => {
      const running = state.sessions.find((s) => s.status === "running");
      if (!running || running.mode === "flow" || !running.plannedMin) return;
      if (sessionSeconds(running) >= running.plannedMin * 60) {
        set((st) => ({
          ...st,
          sessions: st.sessions.map((x) =>
            x.id === running.id
              ? { ...x, endedAt: Date.now(), status: "done", pauses: x.pauses.map((p) => (p.resumeAt ? p : { ...p, resumeAt: Date.now() })) }
              : x,
          ),
        }));
        app.toast(running.mode === "break" ? "Break over — back to it" : "Timer complete — session saved to your log", "warn");
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sessions]);

  const today = todayIso();
  const dueToday = useMemo(
    () => state.tasks.filter((t) => !t.done && t.due && t.due <= today && (!t.snoozedUntil || t.snoozedUntil <= Date.now())).length,
    [state.tasks, today],
  );
  const tracked = useMemo(() => trackedByDay(state.sessions), [state.sessions]);
  const bestStreak = useMemo(() => Math.max(0, ...state.habits.map((h) => streakStats(h.completions).current)), [state.habits]);

  const views: Record<ViewId, React.ReactNode> = {
    dashboard: layout === "zen" ? <ZenHome /> : <Dashboard />,
    tasks: <TasksView />,
    focus: <FocusView />,
    calendar: <CalendarView />,
    habits: <HabitsView />,
    notes: <NotesView />,
    daylog: <DayLogView />,
    reports: <ReportsView />,
    review: <ReviewView />,
    settings: <SettingsView />,
  };

  const navButton = (n: (typeof NAV)[number], opts: { iconOnly?: boolean; horizontal?: boolean } = {}) => {
    const active = view === n.id;
    const Icon = n.icon;
    if (opts.iconOnly) {
      return (
        <button
          key={n.id}
          onClick={() => setView(n.id)}
          title={n.label}
          className="group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all"
          style={active ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--mut)", cursor: "pointer" }}
        >
          <Icon size={17} />
          {active && <span className="absolute -left-2.5 h-5 w-[3px] rounded-full" style={{ background: "var(--accent)" }} />}
          <span className="pointer-events-none absolute left-[52px] z-50 hidden whitespace-nowrap rounded-lg border px-2 py-1 text-[11px] font-bold group-hover:block"
            style={{ background: "var(--panel2)", borderColor: "var(--line)", color: "var(--text)" }}>
            {n.label}
          </span>
        </button>
      );
    }
    return (
      <button
        key={n.id}
        onClick={() => setView(n.id)}
        className={cn(
          "flex items-center gap-2.5 font-bold transition-all",
          opts.horizontal ? "rounded-lg px-2.5 py-1.5 text-[12.5px]" : "w-full rounded-xl px-3 py-2 text-[13px]",
        )}
        style={active ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--mut)", cursor: "pointer" }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "var(--text)"; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "var(--mut)"; }}
      >
        <Icon size={16} />
        <span>{n.label}</span>
        {n.id === "tasks" && dueToday > 0 && !opts.horizontal && (
          <span className="ml-auto rounded-full px-1.5 py-px font-mono text-[10.5px] font-bold tnum" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
            {dueToday}
          </span>
        )}
      </button>
    );
  };

  /* ============================ PLANIFY ENGINE (icon rail) ============================ */
  if (layout === "planify") {
    return (
      <div className="relative min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-40 flex w-[74px] flex-col items-center gap-1.5 border-r py-5"
          style={{ background: "var(--panel)", borderColor: "var(--line)" }}>
          <Logo small />
          <div className="mt-4 flex w-full flex-col items-center gap-1 px-2">{NAV.map((n) => navButton(n, { iconOnly: true }))}</div>
          <div className="mt-auto flex flex-col items-center gap-3">
            <Clock compact />
            <button onClick={() => openTaskDialog()} className="flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-105"
              style={{ background: "var(--accent)", color: "var(--on-accent)", cursor: "pointer" }} title="New task">
              <Plus size={17} />
            </button>
          </div>
        </aside>
        <main className="zoomable ml-[74px] w-[calc(100%-74px)] px-7 py-7">
          <div className="w-full">{views[view]}</div>
        </main>
        <Overlays greeting={greeting} closeGreeting={closeGreeting} />
        <MiniTimer />
      </div>
    );
  }

  /* ============================ CONTROL ENGINE (command bar + status bar) ============================ */
  if (layout === "control") {
    return (
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 flex h-[52px] items-center gap-4 border-b px-4"
          style={{ background: "var(--panel)", borderColor: "var(--line)" }}>
          <Logo small />
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">{NAV.map((n) => navButton(n, { horizontal: true }))}</nav>
          <Clock />
          <Btn variant="primary" size="sm" onClick={() => openTaskDialog()}><Plus size={13} /> Task</Btn>
        </header>
        <main className="zoomable min-h-0 w-full flex-1 px-5 py-4 pb-[70px]">
          <div className="w-full">{views[view]}</div>
        </main>
        <StatusBar dueToday={dueToday} todayMin={tracked.get(today) ?? 0} bestStreak={bestStreak} goFocus={() => setView("focus")} />
        <Overlays greeting={greeting} closeGreeting={closeGreeting} />
        <MiniTimer />
      </div>
    );
  }

  /* ============================ DESK ENGINE (workspace sidebar + status bar) ============================ */
  if (layout === "desk") {
    return (
      <div className="relative min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-40 flex w-[228px] flex-col border-r p-4"
          style={{ background: "var(--panel)", borderColor: "var(--line)" }}>
          <Logo />
          <nav className="mt-5 flex flex-col gap-1">{NAV.map((n) => navButton(n))}</nav>
          <div className="mt-auto rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
            <Clock />
            <Btn variant="primary" className="mt-2 w-full" size="sm" onClick={() => openTaskDialog()}><Plus size={13} /> New task</Btn>
          </div>
        </aside>
        <div className="ml-[228px] flex min-h-screen w-[calc(100%-228px)] flex-col">
          <main className="zoomable min-h-0 w-full flex-1 px-6 py-6 pb-[76px]">
            <div className="w-full">{views[view]}</div>
          </main>
          <StatusBar dueToday={dueToday} todayMin={tracked.get(today) ?? 0} bestStreak={bestStreak} goFocus={() => setView("focus")} />
        </div>
        <Overlays greeting={greeting} closeGreeting={closeGreeting} />
        <MiniTimer />
      </div>
    );
  }

  /* ============================ ZEN ENGINE (full-screen command cockpit) ============================ */
  if (layout === "zen") {
    return (
      <div className="relative flex min-h-screen">
        <div className="ambient" style={{ opacity: 0.5 }}><div className="grid-lines" /></div>
        <aside className="sticky top-0 z-40 flex h-screen w-[64px] flex-col items-center gap-1.5 border-r py-4 backdrop-blur-md"
          style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)", borderColor: "var(--line)" }}>
          <Logo small />
          <div className="mt-3 flex w-full flex-col items-center gap-1 px-1.5">{NAV.map((n) => navButton(n, { iconOnly: true }))}</div>
          <div className="mt-auto flex flex-col items-center gap-2.5">
            {view === "dashboard" && (
              <button onClick={() => setZenConfig((v) => !v)} title="Customise zen panels"
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-all"
                style={{ color: zenConfig ? "var(--accent)" : "var(--mut)", cursor: "pointer" }}>
                <SlidersHorizontal size={16} />
              </button>
            )}
            <Clock compact />
          </div>
        </aside>
        <div className="relative z-10 flex min-h-screen w-[calc(100%-64px)] flex-col">
          {view === "dashboard" && zenConfig && (
            <div className="pop mx-6 mt-4 flex flex-wrap items-center gap-4 rounded-2xl border px-4 py-2.5"
              style={{ background: "var(--panel2)", borderColor: "var(--line)" }}>
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>Zen panels</span>
              {(["plan", "timer", "checkin", "insights"] as const).map((k) => (
                <Toggle key={k} checked={state.settings.zenPanels[k]}
                  onChange={(v) => set((s) => ({ ...s, settings: { ...s.settings, zenPanels: { ...s.settings.zenPanels, [k]: v } } }))}
                  label={k === "checkin" ? "check-in" : k} />
              ))}
              <button onClick={() => setZenConfig(false)} className="ml-auto text-[11.5px] font-bold" style={{ color: "var(--mut)", cursor: "pointer" }}>Done</button>
            </div>
          )}
          <main className="zoomable min-h-0 w-full flex-1 px-6 py-5">
            <div className="w-full">{views[view]}</div>
          </main>
        </div>
        <Overlays greeting={greeting} closeGreeting={closeGreeting} />
        <MiniTimer />
      </div>
    );
  }

  /* ============================ LIQUID GLASS ENGINE (default) ============================ */
  return (
    <div className="relative min-h-screen">
      <div className="liquid-field"><div className="blob b1" /><div className="blob b2" /><div className="blob b3" /></div>
      <aside className="fixed inset-y-4 left-4 z-40 flex w-[248px] flex-col rounded-3xl border p-4 backdrop-blur-2xl"
        style={{
          background: "color-mix(in srgb, var(--panel) 55%, transparent)",
          borderColor: "color-mix(in srgb, var(--text) 13%, transparent)",
          boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--text) 14%, transparent), 0 24px 60px -30px rgba(0,0,0,0.6)",
        }}>
        <Logo />
        <nav className="mt-6 flex flex-col gap-1">{NAV.map((n) => navButton(n))}</nav>
        <div className="mt-auto flex flex-col gap-3">
          <div className="rounded-2xl border px-3 py-2.5 backdrop-blur-xl" style={{ borderColor: "color-mix(in srgb, var(--text) 12%, transparent)", background: "color-mix(in srgb, var(--bg) 55%, transparent)" }}>
            <Clock />
          </div>
          <Btn variant="primary" onClick={() => openTaskDialog()}><Plus size={14} /> New task</Btn>
        </div>
      </aside>
      <main className="zoomable relative z-10 ml-[272px] w-[calc(100%-272px)] px-7 py-6">
        <div className="w-full">{views[view]}</div>
      </main>
      <Overlays greeting={greeting} closeGreeting={closeGreeting} />
      <MiniTimer />
    </div>
  );
}

/* ============================ zen home cockpit ============================ */
function ZenHome() {
  const { state, set, setView, requestFocus, toggleDone, openTaskDialog, toast } = useApp();
  const today = todayIso();
  const p = state.settings.zenPanels;
  const tracked = useMemo(() => trackedByDay(state.sessions), [state.sessions]);
  const todayMin = tracked.get(today) ?? 0;
  const dueTasks = useMemo(
    () => state.tasks.filter((t) => !t.done && t.due && t.due <= today && (!t.snoozedUntil || t.snoozedUntil <= Date.now()))
      .sort((a, b) => (a.dueTime ? 0 : 1) - (b.dueTime ? 0 : 1) || (a.due ?? "").localeCompare(b.due ?? "")),
    [state.tasks, today],
  );
  const doneToday = state.tasks.filter((t) => t.done && t.doneAt && todayIsoOf(t.doneAt) === today).length;
  const running = state.sessions.find((s) => s.status === "running");
  const log = state.dayLogs[today];
  const [energy, setEnergy] = useState(log?.energy ?? 3);
  const EMOJIS = ["😫", "😕", "😐", "🙂", "😄", "🤩"];
  const [moodEmoji, setMoodEmoji] = useState(log?.moodEmoji ?? "");
  const hour = new Date().getHours();
  const name = state.settings.profileName.trim();

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">
            {greetingFor(hour)}{name ? `, ${name}` : ""}.
          </h1>
          <p className="text-[13px] font-semibold" style={{ color: "var(--mut)" }}>
            {fmtDateLong(new Date())} · {fmtDur(todayMin)} tracked · {dueTasks.length} due · {doneToday} done
          </p>
        </div>
        <div className="flex gap-2">
          <Btn variant="soft" onClick={() => setView("daylog")}><FileClock size={13} /> Day log</Btn>
          <Btn variant="primary" onClick={() => requestFocus(null)}><Play size={13} /> Start focus</Btn>
        </div>
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-3" style={{ gridAutoRows: "minmax(120px, auto)" }}>
        {p.plan && (
          <div className="card card-hover flex flex-col p-4 lg:row-span-2">
            <div className="flex items-center justify-between">
              <span className="font-display text-[15px] font-bold">Today’s plan</span>
              <Btn size="sm" variant="ghost" onClick={() => openTaskDialog({ presetDate: today })}><Plus size={12} /> Add</Btn>
            </div>
            <div className="mt-2.5 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
              {dueTasks.length === 0 && (
                <div className="rounded-xl border border-dashed px-3 py-6 text-center text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--mut)" }}>
                  Clear runway. Pull a task onto today or enjoy the quiet.
                </div>
              )}
              {dueTasks.map((t) => {
                const proj = state.projects.find((x) => x.id === t.projectId);
                return (
                  <div key={t.id} className="group flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-all hover:translate-x-[2px]"
                    style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                    <button onClick={() => toggleDone(t.id)}
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-all hover:scale-110"
                      style={{ borderColor: proj?.color ?? "var(--accent)", cursor: "pointer" }} aria-label="Complete">
                      <Check size={11} className="opacity-0 transition-opacity group-hover:opacity-60" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold">{t.emoji ? `${t.emoji} ` : ""}{t.title}</div>
                      <div className="text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>
                        {proj?.name}{t.dueTime ? ` · ${t.dueTime}` : ""}{t.due && t.due < today ? " · overdue" : ""}
                      </div>
                    </div>
                    <Btn size="sm" variant="soft" onClick={() => requestFocus(t.id)}><Play size={11} /></Btn>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {p.timer && (
          <div className="card card-hover relative overflow-hidden p-4">
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-25" style={{ background: "var(--accent)", filter: "blur(34px)" }} />
            <span className="font-display text-[15px] font-bold">Focus</span>
            {running ? (
              <div className="mt-3">
                <div className="stage-num font-mono text-[38px] font-bold" style={{ color: "var(--accent)" }}>
                  {fmtHMS(sessionSeconds(running))}
                </div>
                <div className="mt-0.5 truncate text-[12px] font-semibold" style={{ color: "var(--mut)" }}>
                  {running.mode} · {state.tasks.find((t) => t.id === running.taskId)?.title ?? "break"}
                </div>
                <Btn variant="primary" className="mt-3" onClick={() => setView("focus")}>Open session</Btn>
              </div>
            ) : (
              <div className="mt-3">
                <div className="text-[12.5px] font-semibold" style={{ color: "var(--mut)" }}>
                  Pomodoro, countdown or open flow — the counter takes over the screen once you start.
                </div>
                <div className="mt-3 flex gap-2">
                  <Btn variant="primary" onClick={() => requestFocus(null)}><Timer size={13} /> Open Focus</Btn>
                  <Btn variant="soft" onClick={() => setView("calendar")}><Calendar size={13} /> Calendar</Btn>
                </div>
              </div>
            )}
          </div>
        )}

        {p.insights && (
          <div className="card card-hover p-4">
            <span className="font-display text-[15px] font-bold">Today at a glance</span>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { k: "Tracked", v: fmtDur(todayMin) },
                { k: "Done", v: String(doneToday) },
                { k: "Due", v: String(dueTasks.length) },
                { k: "Top streak", v: `${Math.max(0, ...state.habits.map((h) => streakStats(h.completions).current))}d` },
              ].map((x) => (
                <div key={x.k} className="rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                  <div className="font-mono text-[17px] font-bold tnum" style={{ color: "var(--accent)" }}>{x.v}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>{x.k}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {p.checkin && (
          <div className="card card-hover p-4">
            <div className="flex items-center justify-between">
              <span className="font-display text-[15px] font-bold">{hour < 14 ? "Morning check-in" : "Evening check-in"}</span>
              <Btn size="sm" variant="primary" onClick={() => {
                set((s) => ({ ...s, dayLogs: { ...s.dayLogs, [today]: { energy, moodEmoji, mood: s.dayLogs[today]?.mood ?? "", updatedAt: Date.now() } } }));
                toast("Check-in saved", "ok");
              }}><Check size={12} /> Save</Btn>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="font-mono text-[20px] font-bold tnum" style={{ color: "var(--accent)" }}>{energy}/5</span>
              <input type="range" min={1} max={5} value={energy} onChange={(e) => setEnergy(parseInt(e.target.value, 10))} className="energy flex-1" />
            </div>
            <div className="mt-2.5 flex gap-1.5">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => setMoodEmoji(moodEmoji === e ? "" : e)}
                  className="flex h-9 flex-1 items-center justify-center rounded-xl border text-[17px] transition-all hover:scale-105"
                  style={moodEmoji === e ? { borderColor: "var(--accent)", background: "var(--accent-soft)" } : { borderColor: "var(--line)", cursor: "pointer", opacity: 0.75 }}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function todayIsoOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ============================ control / desk status bar ============================ */
function StatusBar({ dueToday, todayMin, bestStreak, goFocus }: { dueToday: number; todayMin: number; bestStreak: number; goFocus: () => void }) {
  const { state } = useApp();
  const running = state.sessions.find((s) => s.status === "running");
  const [, force] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => force((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [running]);
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex h-[52px] items-center gap-4 border-t px-4 backdrop-blur-md"
      style={{ background: "color-mix(in srgb, var(--panel) 92%, transparent)", borderColor: "var(--line)" }}>
      <span className="chip !py-0.5 text-[11px]"><Flame size={11} style={{ color: "var(--accent)" }} /> {fmtDur(todayMin)} today</span>
      <span className="chip !py-0.5 text-[11px]"><ListTodo size={11} style={{ color: "var(--mut)" }} /> {dueToday} due</span>
      <span className="chip !py-0.5 text-[11px]"><Check size={11} style={{ color: "var(--ok)" }} /> streak {bestStreak}d</span>
      {running && (
        <button onClick={goFocus} className="ml-auto flex items-center gap-2 rounded-lg px-2.5 py-1 font-mono text-[12.5px] font-bold tnum transition-all hover:opacity-80"
          style={{ background: "var(--accent-soft)", color: "var(--accent)", cursor: "pointer" }}>
          <span className="h-[7px] w-[7px] rounded-full" style={{ background: "var(--ok)", animation: "nowpulse 1.6s infinite" }} />
          {running.mode} · {fmtHMS(sessionSeconds(running))}
        </button>
      )}
      <span className={cn("ml-auto text-[10.5px] font-bold uppercase tracking-wider", running && "ml-0")} style={{ color: "var(--mut)" }}>
        AES-256 · local only
      </span>
    </div>
  );
}

/* ============================ floating mini-timer ============================ */
function MiniTimer() {
  const { state, set, setView, toast } = useApp();
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const running = state.sessions.find((s) => s.status === "running");
  if (!running) return null;

  const openPause = running.pauses.length > 0 && running.pauses[running.pauses.length - 1].resumeAt === null;
  const elapsedSec = sessionSeconds(running);
  const remainingSec = running.plannedMin ? Math.max(0, running.plannedMin * 60 - elapsedSec) : null;
  const task = state.tasks.find((t) => t.id === running.taskId);
  const label = running.mode === "break" ? "Break" : task?.title ?? "Focus session";
  const pct = remainingSec !== null ? Math.min(100, (elapsedSec / (running.plannedMin! * 60)) * 100) : null;

  const togglePause = () => {
    set((s) => ({
      ...s,
      sessions: s.sessions.map((x) => {
        if (x.id !== running.id) return x;
        if (openPause) {
          return { ...x, pauses: x.pauses.map((p, i) => (i === x.pauses.length - 1 ? { ...p, resumeAt: Date.now() } : p)) };
        }
        return { ...x, pauses: [...x.pauses, { at: Date.now(), resumeAt: null }] };
      }),
    }));
    toast(openPause ? "Resumed" : "Paused — timestamps kept", "ok");
  };
  const stop = () => {
    const ts = Date.now();
    set((s) => ({
      ...s,
      sessions: s.sessions.map((x) =>
        x.id === running.id
          ? { ...x, endedAt: ts, status: "stopped", pauses: x.pauses.map((p) => (p.resumeAt ? p : { ...p, resumeAt: ts })) }
          : x,
      ),
    }));
    toast(`Stopped — ${fmtDur(Math.max(1, Math.round(elapsedSec / 60)))} saved to your log`, "ok");
  };

  const big = remainingSec !== null ? fmtHMS(remainingSec) : fmtHMS(elapsedSec);

  return (
    <div className="mini-timer fixed bottom-5 left-5 z-[80] w-[252px] rounded-2xl border p-3 shadow-2xl backdrop-blur-xl"
      style={{ background: "color-mix(in srgb, var(--panel2) 92%, transparent)", borderColor: "color-mix(in srgb, var(--accent) 45%, var(--line))" }}>
      <div className="flex items-center gap-2">
        <span className={cn("h-[9px] w-[9px] rounded-full", !openPause && "ring-pulse")} style={{ background: openPause ? "var(--warn)" : "var(--ok)" }} />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--accent)" }}>
          {openPause ? "Paused" : running.mode === "break" ? "Break" : running.mode}
        </span>
        <span className="ml-auto font-mono text-[18px] font-bold tnum" style={{ color: "var(--text)" }}>{big}</span>
      </div>
      <div className="mt-1 truncate text-[12px] font-bold" title={label}>{label}</div>
      {pct !== null && (
        <div className="mt-1.5 h-[5px] overflow-hidden rounded-full" style={{ background: "var(--bg)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--accent)" }} />
        </div>
      )}
      <div className="mt-2 flex gap-1.5">
        <Btn size="sm" variant="soft" className="flex-1" onClick={togglePause}>
          {openPause ? <Play size={12} /> : <Pause size={12} />} {openPause ? "Resume" : "Pause"}
        </Btn>
        <Btn size="sm" variant="danger" onClick={stop}><Square size={11} /> Stop</Btn>
        <Btn size="sm" variant="ghost" onClick={() => setView("focus")} title="Open full counter"><Timer size={12} /></Btn>
      </div>
    </div>
  );
}

/* ============================ greeting + confirm overlays ============================ */
function Overlays({ greeting, closeGreeting }: { greeting: boolean; closeGreeting: () => void }) {
  const { state, set, setView, openTaskDialog, toast, confirmReq, resolveConfirm } = useApp();
  const [confirmText, setConfirmText] = useState("");
  const [help, setHelp] = useState(false);
  useEffect(() => setConfirmText(""), [confirmReq]);
  const blocked = !!confirmReq?.requireText && confirmText !== confirmReq.requireText;
  const hour = new Date().getHours();
  const name = state.settings.profileName.trim();

  /* ---------- global keyboard shortcuts (customisable in Settings) ---------- */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const sc = state.settings.shortcuts ?? {};
      const k = e.key === " " ? "space" : e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const action = Object.entries(sc).find(([, key]) => key === k)?.[0];
      if (!action) return;
      e.preventDefault();
      switch (action) {
        case "newTask": openTaskDialog(); break;
        case "openFocus": setView("focus"); break;
        case "openCalendar": setView("calendar"); break;
        case "openNotes": setView("notes"); break;
        case "openDayLog": setView("daylog"); break;
        case "openReports": setView("reports"); break;
        case "help": setHelp(true); break;
        case "togglePause": {
          const live = state.sessions.find((s) => s.status === "running");
          if (!live) { toast("No timer running", "warn"); break; }
          const lp = live.pauses[live.pauses.length - 1];
          const isPaused = !!lp && lp.resumeAt === null;
          set((st) => ({
            ...st,
            sessions: st.sessions.map((x) =>
              x.id === live.id
                ? isPaused
                  ? { ...x, pauses: x.pauses.map((p, i) => (i === x.pauses.length - 1 ? { ...p, resumeAt: Date.now() } : p)) }
                  : { ...x, pauses: [...x.pauses, { at: Date.now(), resumeAt: null }] }
                : x,
            ),
          }));
          toast(isPaused ? "Timer resumed" : "Timer paused", "ok");
          break;
        }
        default: break;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settings.shortcuts, state.sessions]);
  const quote = useMemo(() => {
    const pool = [...QUOTES, ...state.settings.customQuotes.filter((q) => q.trim())];
    return pool[Math.floor(Math.random() * pool.length)] ?? QUOTES[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greeting]);

  return (
    <>
      <Modal open={greeting} onClose={closeGreeting} title="LifeLog" width={520}>
        <div className="flex flex-col items-start gap-4">
          <div>
            <div className="font-display text-[27px] font-bold leading-tight tracking-tight">
              {greetingFor(hour)}{name ? `, ${name}` : ""}.
            </div>
            <div className="mt-1 text-[13px] font-semibold" style={{ color: "var(--mut)" }}>{fmtDateLong(new Date())}</div>
          </div>
          <div className="w-full rounded-2xl border p-4" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
            <div className="flex items-start gap-3">
              <Quote size={20} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
              <p className="font-display text-[16px] font-semibold leading-relaxed" style={{ color: "var(--text)" }}>
                {quote}
              </p>
            </div>
          </div>
          <div className="flex w-full justify-end gap-2">
            <Btn variant="ghost" onClick={closeGreeting}>Skip</Btn>
            <Btn variant="primary" onClick={closeGreeting}>Let’s log the day</Btn>
          </div>
          <div className="text-[11px]" style={{ color: "var(--mut)" }}>
            Shows {state.settings.greeting === "every" ? "on every launch" : "on the first launch of each day"} · add your own lines in Settings → Greeting.
          </div>
        </div>
      </Modal>

      <Modal
        open={!!confirmReq?.open}
        onClose={() => resolveConfirm(false)}
        title={confirmReq?.title ?? ""}
        width={440}
        footer={
          <>
            <Btn variant="ghost" onClick={() => resolveConfirm(false)}>Cancel</Btn>
            <Btn
              variant={confirmReq?.danger ? "danger" : "primary"}
              disabled={blocked}
              onClick={() => resolveConfirm(true)}
              style={confirmReq?.danger ? { background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" } : undefined}
            >
              {confirmReq?.confirmLabel ?? "Confirm"}
            </Btn>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text)" }}>{confirmReq?.body}</p>
        {confirmReq?.requireText && (
          <div className="mt-3">
            <span className="lbl">Type “{confirmReq.requireText}” to confirm</span>
            <TextInput value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={confirmReq.requireText} />
          </div>
        )}
      </Modal>

      <TaskDialog />

      <Modal open={help} onClose={() => setHelp(false)} title="Keyboard shortcuts" width={420}>
        <div className="flex flex-col gap-1.5">
          {SHORTCUT_ACTIONS.map((a) => (
            <div key={a.action} className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
              <span className="text-[12.5px] font-bold">{a.label}</span>
              <kbd className="rounded-lg border px-2 py-0.5 font-mono text-[11.5px] font-bold" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}>
                {(state.settings.shortcuts[a.action] ?? "") === "space" ? "␣ space" : state.settings.shortcuts[a.action] ?? "—"}
              </kbd>
            </div>
          ))}
          <div className="mt-1 text-[11px] font-semibold" style={{ color: "var(--mut)" }}>
            Remap any key in Settings → Keyboard shortcuts. Shortcuts pause while you type in a field.
          </div>
        </div>
      </Modal>
    </>
  );
}
