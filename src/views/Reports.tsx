import { useMemo, useState } from "react";
import { Flame, Lightbulb, Settings2, Target } from "lucide-react";
import { useApp } from "../store";
import {
  MONTHS, WEEKDAYS_SHORT, addDaysIso, fmtDayShort, fmtDur, isoDate, listDates, parseIso,
  sessionMinutes, streakStats, todayIso, weekStartIso,
} from "../utils/core";
import { BarRow, Btn, EmptyState, Seg, cn } from "../components/ui";

type Preset = "week" | "last7" | "month" | "last30" | "all" | "custom";

export function ReportsView() {
  const { state, setView } = useApp();
  const today = todayIso();
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState(() => {
    const d = parseIso(todayIso());
    return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [to, setTo] = useState(() => todayIso());

  const applyPreset = (p: Preset) => {
    setPreset(p);
    const d = parseIso(today);
    if (p === "week") { setFrom(weekStartIso(today)); setTo(today); }
    else if (p === "last7") { setFrom(addDaysIso(today, -6)); setTo(today); }
    else if (p === "month") { setFrom(isoDate(new Date(d.getFullYear(), d.getMonth(), 1))); setTo(today); }
    else if (p === "last30") { setFrom(addDaysIso(today, -29)); setTo(today); }
    else if (p === "all") { setFrom("2000-01-01"); setTo(today); }
  };

  const days = useMemo(() => listDates(from, to), [from, to]);

  const sessions = useMemo(
    () => state.sessions.filter((s) => { const d = isoDate(new Date(s.startedAt)); return d >= from && d <= to; }),
    [state.sessions, from, to],
  );
  const workSessions = sessions.filter((s) => s.taskId && s.mode !== "break");
  const totalMin = workSessions.reduce((a, s) => a + sessionMinutes(s), 0);
  const w = state.settings.reportWidgets;
  const anyWidget = Object.values(w).some(Boolean);

  /* ---- time of day ---- */
  const hourBuckets = useMemo(() => {
    const b = Array(24).fill(0) as number[];
    for (const s of workSessions) b[new Date(s.startedAt).getHours()] += sessionMinutes(s);
    return b;
  }, [workSessions]);
  const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));

  /* ---- projects / tags ---- */
  const byProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of workSessions) {
      const t = state.tasks.find((x) => x.id === s.taskId);
      if (t) m.set(t.projectId, (m.get(t.projectId) ?? 0) + sessionMinutes(s));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [workSessions, state.tasks]);
  const byTag = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of workSessions) {
      const t = state.tasks.find((x) => x.id === s.taskId);
      if (!t) continue;
      for (const tag of t.tags) m.set(tag, (m.get(tag) ?? 0) + sessionMinutes(s));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [workSessions, state.tasks]);

  /* ---- completed + estimates ---- */
  const completedIn = useMemo(() => {
    const out: { title: string; at: number }[] = [];
    for (const t of state.tasks) {
      if (t.done && t.doneAt) { const d = isoDate(new Date(t.doneAt)); if (d >= from && d <= to) out.push({ title: t.title, at: t.doneAt }); }
      for (const c of t.completions) { const d = isoDate(new Date(c.at)); if (d >= from && d <= to) out.push({ title: `${t.title} ↻`, at: c.at }); }
    }
    return out;
  }, [state.tasks, from, to]);
  const estVsActual = useMemo(() => {
    let planned = 0, actual = 0;
    for (const t of state.tasks) {
      if (!t.done || !t.doneAt || t.estimateMin <= 0) continue;
      const d = isoDate(new Date(t.doneAt));
      if (d < from || d > to) continue;
      planned += t.estimateMin;
      actual += state.sessions.filter((s) => s.taskId === t.id).reduce((a, s) => a + sessionMinutes(s), 0);
    }
    return { planned, actual };
  }, [state.tasks, state.sessions, from, to]);

  /* ---- estimate calibration (task / project / tag) ---- */
  const [calibDim, setCalibDim] = useState<"task" | "project" | "tag">("task");
  const calibration = useMemo(() => {
    const inRange = new Set<string>();
    for (const s of workSessions) if (s.taskId) inRange.add(s.taskId);
    for (const t of state.tasks) {
      if (t.done && t.doneAt) { const d = isoDate(new Date(t.doneAt)); if (d >= from && d <= to) inRange.add(t.id); }
    }
    type Row = { key: string; name: string; emoji?: string; color?: string; planned: number; actual: number };
    const rows = new Map<string, Row>();
    const add = (key: string, name: string, emoji: string | undefined, color: string | undefined, planned: number, actual: number) => {
      const r = rows.get(key) ?? { key, name, emoji, color, planned: 0, actual: 0 };
      r.planned += planned;
      r.actual += actual;
      rows.set(key, r);
    };
    const trackedFor = (tid: string) => state.sessions.filter((s) => s.taskId === tid).reduce((a, s) => a + sessionMinutes(s), 0);
    for (const t of state.tasks) {
      if (!inRange.has(t.id) || t.estimateMin <= 0) continue;
      const actual = trackedFor(t.id);
      if (calibDim === "task") add(t.id, t.title, t.emoji ?? undefined, undefined, t.estimateMin, actual);
      else if (calibDim === "project") {
        const p = state.projects.find((x) => x.id === t.projectId);
        add(t.projectId, p?.name ?? "Deleted project", p?.emoji, p?.color, t.estimateMin, actual);
      } else {
        const tags = t.tags.length ? t.tags : ["untagged"];
        for (const tag of tags) add(`tag:${tag}`, tag, undefined, state.tagColors[tag] ?? "var(--accent)", t.estimateMin, actual);
      }
    }
    return [...rows.values()]
      .filter((r) => r.planned > 0)
      .map((r) => {
        const delta = r.actual - r.planned;
        const pct = Math.round((delta / Math.max(1, r.planned)) * 100);
        const status: "over" | "under" | "accurate" = Math.abs(pct) <= 10 ? "accurate" : delta > 0 ? "over" : "under";
        return { ...r, delta, pct, status };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [calibDim, state.tasks, state.projects, state.sessions, state.tagColors, workSessions, from, to]);
  const calibSummary = useMemo(() => ({
    over: calibration.filter((r) => r.status === "over").length,
    under: calibration.filter((r) => r.status === "under").length,
    accurate: calibration.filter((r) => r.status === "accurate").length,
  }), [calibration]);

  /* ---- productivity analytics: last 8 weeks ---- */
  const weeklyTrend = useMemo(() => {
    const ws0 = weekStartIso(today);
    const weeks: { ws: string; min: number; done: number; active: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const ws = addDaysIso(ws0, -7 * i);
      const we = addDaysIso(ws, 6);
      let min = 0;
      const activeDays = new Set<string>();
      for (const s of state.sessions) {
        if (!s.taskId || s.mode === "break") continue;
        const d = isoDate(new Date(s.startedAt));
        if (d >= ws && d <= we) { min += sessionMinutes(s); activeDays.add(d); }
      }
      let done = 0;
      for (const t of state.tasks) {
        if (t.done && t.doneAt) { const d = isoDate(new Date(t.doneAt)); if (d >= ws && d <= we) done++; }
        for (const c of t.completions) { const d = isoDate(new Date(c.at)); if (d >= ws && d <= we) done++; }
      }
      weeks.push({ ws, min, done, active: activeDays.size });
    }
    return weeks;
  }, [state.sessions, state.tasks, today]);

  /* ---- session quality ---- */
  const quality = useMemo(() => {
    if (workSessions.length === 0) return null;
    const mins = workSessions.map((s) => sessionMinutes(s));
    const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
    const longestIdx = mins.indexOf(Math.max(...mins));
    const longestTask = state.tasks.find((t) => t.id === workSessions[longestIdx].taskId);
    const deepMin = mins.filter((m) => m >= 25).reduce((a, b) => a + b, 0);
    const pauses = workSessions.reduce((a, s) => a + s.pauses.length, 0);
    return { avg, longest: Math.max(...mins), longestTask: longestTask?.title ?? "task", deepMin, pauses };
  }, [workSessions, state.tasks]);

  /* ---- weekdays ---- */
  const byWeekday = useMemo(() => {
    const b = Array(7).fill(0) as number[];
    for (const s of workSessions) b[(new Date(s.startedAt).getDay() + 6) % 7] += sessionMinutes(s);
    return b;
  }, [workSessions]);

  /* ---- energy ---- */
  const energies = days.map((iso) => ({ iso, log: state.dayLogs[iso] })).filter((x) => x.log);

  /* ---- insights ---- */
  const insights = useMemo(() => {
    const out: { icon: React.ReactNode; text: string }[] = [];
    if (totalMin > 0) {
      out.push({ icon: <Target size={13} />, text: `Your most productive hour is ${String(peakHour).padStart(2, "0")}:00–${String((peakHour + 1) % 24).padStart(2, "0")}:00 with ${fmtDur(hourBuckets[peakHour])} tracked in range.` });
      const best = byWeekday.indexOf(Math.max(...byWeekday));
      if (Math.max(...byWeekday) > 0) out.push({ icon: <Flame size={13} />, text: `${["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"][best]} are your strongest days (${fmtDur(byWeekday[best])} tracked).` });
      if (quality) {
        out.push({ icon: <Lightbulb size={13} />, text: `Average session is ${fmtDur(quality.avg)}; ${Math.round((quality.deepMin / Math.max(1, totalMin)) * 100)}% of your time was deep work (sessions ≥ 25 min).` });
      }
    }
    if (estVsActual.planned > 0) {
      const ratio = Math.round((estVsActual.actual / estVsActual.planned) * 100);
      out.push({
        icon: <Lightbulb size={13} />,
        text: ratio > 115
          ? `Completed tasks ran ${ratio - 100}% over their estimates — consider padding estimates or splitting tasks.`
          : ratio < 85
            ? `You beat estimates by ${100 - ratio}% — you can afford bolder estimates.`
            : `Estimates are well calibrated (${ratio}% of planned) — keep trusting them.`,
      });
    }
    /* momentum: last 7 days vs the 7 before */
    const tracked = new Map<string, number>();
    for (const s of workSessions) {
      if (s.taskId && s.mode !== "break") {
        const d = isoDate(new Date(s.startedAt));
        tracked.set(d, (tracked.get(d) ?? 0) + sessionMinutes(s));
      }
    }
    let last7 = 0, prev7 = 0;
    for (let i = 0; i < 7; i++) last7 += tracked.get(addDaysIso(to, -i)) ?? 0;
    for (let i = 7; i < 14; i++) prev7 += tracked.get(addDaysIso(to, -i)) ?? 0;
    if (prev7 > 0 && last7 > 0) {
      const delta = Math.round(((last7 - prev7) / prev7) * 100);
      out.push({
        icon: delta >= 0 ? <Flame size={13} /> : <Lightbulb size={13} />,
        text: `Momentum: last 7 days ${delta >= 0 ? "up" : "down"} ${Math.abs(delta)}% vs the 7 before (${fmtDur(last7)} vs ${fmtDur(prev7)}).`,
      });
    }
    /* longest run of consecutive working days (all history) */
    const workedDays = [...new Set(state.sessions.filter((s) => s.taskId && s.mode !== "break").map((s) => isoDate(new Date(s.startedAt))))];
    if (workedDays.length > 1) {
      const nums = workedDays.map((d) => Math.round(parseIso(d).getTime() / 86400000)).sort((a, b) => a - b);
      let run = 1, bestRun = 1;
      for (let i = 1; i < nums.length; i++) {
        if (nums[i] === nums[i - 1] + 1) { run++; bestRun = Math.max(bestRun, run); }
        else run = 1;
      }
      out.push({ icon: <Flame size={13} />, text: `Your all-time longest focus streak is ${bestRun} consecutive day${bestRun === 1 ? "" : "s"} with tracked work.` });
    }
    return out;
  }, [totalMin, hourBuckets, peakHour, byWeekday, quality, estVsActual, workSessions, state.sessions, to]);

  const maxHour = Math.max(1, ...hourBuckets);
  const widgetCard = (title: string, sub: string, body: React.ReactNode, span = false) => (
    <div className={cn("card card-hover engine-panel p-4", span && "lg:col-span-2")}>
      <div className="flex items-baseline justify-between">
        <div className="font-display text-[14.5px] font-bold tracking-tight">{title}</div>
        <div className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>{sub}</div>
      </div>
      <div className="mt-3">{body}</div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-tight">Reports</h1>
          <p className="text-[13px] font-semibold" style={{ color: "var(--mut)" }}>
            Look back at any stretch — every number is computed from your local history. Day-by-day detail lives in the Day Log.
          </p>
        </div>
        <Btn variant="outline" onClick={() => setView("settings")}><Settings2 size={13} /> Choose widgets</Btn>
      </div>

      {/* range bar */}
      <div className="card engine-panel flex flex-wrap items-center gap-2 p-3">
        {([["week", "This week"], ["last7", "Last 7 days"], ["month", "This month"], ["last30", "Last 30 days"], ["all", "All time"]] as [Preset, string][]).map(([p, l]) => (
          <button key={p} onClick={() => applyPreset(p)} className="rounded-lg px-2.5 py-1 text-[12px] font-bold transition-all"
            style={preset === p ? { background: "var(--accent)", color: "var(--on-accent)", cursor: "pointer" } : { color: "var(--mut)", background: "var(--bg)", cursor: "pointer" }}>
            {l}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-[12px] font-bold" style={{ color: "var(--mut)" }}>
          <input type="date" className="inp w-[140px]" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} />
          →
          <input type="date" className="inp w-[140px]" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} />
        </div>
      </div>

      {/* summary strip */}
      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { k: "Tracked", v: fmtDur(totalMin), sub: `${workSessions.length} sessions` },
          { k: "Completed", v: String(completedIn.length), sub: "tasks & recurrences" },
          { k: "Active days", v: `${new Set(workSessions.map((s) => isoDate(new Date(s.startedAt)))).size}/${days.length}`, sub: "days with focus" },
          { k: "Daily average", v: fmtDur(Math.round(totalMin / Math.max(1, days.length))), sub: "per calendar day" },
          { k: "Peak hour", v: hourBuckets.some((x) => x > 0) ? `${String(peakHour).padStart(2, "0")}:00` : "—", sub: "most-worked hour" },
          { k: "Avg energy", v: energies.length ? `${(Math.round((energies.reduce((a, x) => a + (x.log?.energy ?? 0), 0) / energies.length) * 10) / 10)}/5` : "—", sub: "from check-ins" },
        ].map((x) => (
          <div key={x.k} className="card card-hover engine-panel p-3.5">
            <div className="font-mono text-[21px] font-bold tnum" style={{ color: "var(--accent)" }}>{x.v}</div>
            <div className="mt-0.5 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>{x.k}</div>
            <div className="text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>{x.sub}</div>
          </div>
        ))}
      </div>

      {!anyWidget && (
        <div className="card">
          <EmptyState icon={Settings2} title="All report widgets are hidden" body="Open Settings → Report widgets and switch some on — the grid reflows automatically." />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {w.insights && widgetCard("Productivity insights", "auto-generated", (
          insights.length === 0 ? (
            <div className="text-[12.5px]" style={{ color: "var(--mut)" }}>Log some focused time and insights will appear here.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {insights.map((i, idx) => (
                <div key={idx} className="flex items-start gap-2.5 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                  <span className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }}>{i.icon}</span>
                  <span className="text-[12.5px] font-semibold leading-relaxed">{i.text}</span>
                </div>
              ))}
            </div>
          )
        ), true)}

        {w.analytics && widgetCard("Productivity analytics", "week over week", (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <DeltaChip label="Focus" value={weeklyTrend[7].min} prev={weeklyTrend[6].min} fmt={fmtDur} />
              <DeltaChip label="Completed" value={weeklyTrend[7].done} prev={weeklyTrend[6].done} fmt={(n) => `${n}`} />
              <span className="chip !py-1 text-[11px]" style={{ color: "var(--mut)" }}>
                {weeklyTrend[7].active}/7 active days this week
              </span>
            </div>
            <div className="mt-4 flex h-[130px] items-end gap-2">
              {weeklyTrend.map((wk, i) => {
                const isCur = i === weeklyTrend.length - 1;
                const max = Math.max(1, ...weeklyTrend.map((x) => x.min));
                const d = parseIso(wk.ws);
                return (
                  <div
                    key={wk.ws}
                    className="group flex h-full flex-1 cursor-default flex-col items-center gap-1.5"
                    title={`${fmtDayShort(wk.ws)} week — ${fmtDur(wk.min)} focused · ${wk.done} completed · ${wk.active} active day(s)`}
                  >
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-lg transition-all duration-500 group-hover:brightness-125"
                        style={{
                          height: `${Math.max(4, (wk.min / max) * 100)}%`,
                          background: isCur ? "var(--accent)" : "color-mix(in srgb, var(--accent) 40%, var(--panel2))",
                          boxShadow: isCur ? "0 0 0 1.5px color-mix(in srgb, var(--accent) 55%, transparent)" : undefined,
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-bold tnum" style={{ color: isCur ? "var(--accent)" : "var(--mut)" }}>
                      {MONTHS[d.getMonth()].slice(0, 3)} {d.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>
              Focused minutes per week · last 8 weeks · the highlighted bar is the current week · hover for detail
            </div>
          </div>
        ), true)}

        {w.timeOfDay && widgetCard("Time-of-day rhythm", "minutes per hour", (
          <div>
            <div className="flex h-[84px] items-end gap-[3px]">
              {hourBuckets.map((v, h) => (
                <div key={h} className="group relative flex-1 rounded-t-[4px] transition-all hover:opacity-80"
                  style={{ height: `${Math.max(3, (v / maxHour) * 100)}%`, background: v > 0 ? (h === peakHour ? "var(--accent)" : "color-mix(in srgb, var(--accent) 45%, var(--panel2))") : "var(--panel2)" }}
                  title={`${String(h).padStart(2, "0")}:00 — ${fmtDur(v)}`} />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[9.5px] font-bold" style={{ color: "var(--mut)" }}>
              <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
            </div>
          </div>
        ), true)}

        {w.projects && widgetCard("Projects", "tracked in range", (
          byProject.length === 0 ? <div className="text-[12.5px]" style={{ color: "var(--mut)" }}>No tracked time in range.</div> : (
            <div className="flex flex-col">
              {byProject.map(([pid, min]) => {
                const p = state.projects.find((x) => x.id === pid);
                return <BarRow key={pid} label={<>{p?.emoji} {p?.name ?? "Deleted project"}</>} value={min} max={byProject[0][1]} color={p?.color ?? "var(--accent)"} right={`${fmtDur(min)} · ${Math.round((min / Math.max(1, totalMin)) * 100)}%`} />;
              })}
            </div>
          )
        ))}

        {w.tags && widgetCard("Tags", "tracked via task tags", (
          byTag.length === 0 ? <div className="text-[12.5px]" style={{ color: "var(--mut)" }}>No tags on tracked tasks in range.</div> : (
            <div className="flex flex-col">
              {byTag.slice(0, 8).map(([tag, min]) => (
                <BarRow key={tag}
                  label={<><span className="h-[8px] w-[8px] rounded-full" style={{ background: state.tagColors[tag] ?? "var(--accent)" }} /> {tag}</>}
                  value={min} max={byTag[0][1]} color={state.tagColors[tag] ?? "var(--accent)"} right={fmtDur(min)} />
              ))}
            </div>
          )
        ))}

        {w.estimates && widgetCard("Estimate vs actual", "completed tasks in range", (
          estVsActual.planned === 0 ? (
            <div className="text-[12.5px]" style={{ color: "var(--mut)" }}>No completed tasks with estimates in this range.</div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                <div className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>Planned — sum of task estimates</div>
                <div className="font-mono text-[20px] font-bold tnum">{fmtDur(estVsActual.planned)}</div>
              </div>
              <div className="rounded-xl border p-3" style={{ borderColor: "color-mix(in srgb, var(--accent) 50%, var(--line))", background: "var(--accent-soft)" }}>
                <div className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>Tracked — actual time on those tasks</div>
                <div className="font-mono text-[20px] font-bold tnum" style={{ color: "var(--accent)" }}>{fmtDur(estVsActual.actual)}</div>
              </div>
              <div className="chip self-start" style={{ color: estVsActual.actual > estVsActual.planned ? "var(--warn)" : "var(--ok)" }}>
                {estVsActual.actual > estVsActual.planned
                  ? `▲ ${Math.round(((estVsActual.actual - estVsActual.planned) / estVsActual.planned) * 100)}% over estimate`
                  : `▼ ${Math.round(((estVsActual.planned - estVsActual.actual) / estVsActual.planned) * 100)}% under estimate`}
              </div>
            </div>
          )
        ))}

        {w.estimateTasks && widgetCard("Estimate calibration", "over / under by dimension", (
          calibration.length === 0 ? (
            <div className="text-[12.5px]" style={{ color: "var(--mut)" }}>No estimated tasks with tracked time in this range.</div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Seg
                  options={[{ value: "task", label: "Tasks" }, { value: "project", label: "Projects" }, { value: "tag", label: "Tags" }]}
                  value={calibDim} onChange={setCalibDim} size="sm"
                />
                <span className="chip !py-0 text-[10.5px]" style={{ color: "var(--danger)" }}>{calibSummary.over} over</span>
                <span className="chip !py-0 text-[10.5px]" style={{ color: "var(--ok)" }}>{calibSummary.under} under</span>
                <span className="chip !py-0 text-[10.5px]" style={{ color: "var(--mut)" }}>{calibSummary.accurate} on target</span>
              </div>
              <div className="flex flex-col gap-2">
                {calibration.slice(0, 8).map((r) => {
                  const max = Math.max(r.planned, r.actual, 1);
                  const col = r.status === "over" ? "var(--danger)" : r.status === "under" ? "var(--ok)" : "var(--accent)";
                  return (
                    <div key={r.key} className="rounded-xl border px-3 py-2.5 transition-all hover:-translate-y-px hover:border-[var(--accent)]"
                      style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                      <div className="flex items-center gap-2 text-[12.5px] font-bold">
                        {r.emoji && <span>{r.emoji}</span>}
                        {r.color && calibDim !== "task" && <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: r.color }} />}
                        <span className="min-w-0 flex-1 truncate">{r.name}</span>
                        <span className="chip shrink-0 !py-0 text-[10px]" style={{ color: col, borderColor: `color-mix(in srgb, ${col} 55%, transparent)` }}>
                          {r.status === "over" ? `▲ ${r.pct}% over` : r.status === "under" ? `▼ ${Math.abs(r.pct)}% under` : "● on target"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="w-[56px] shrink-0 text-[9.5px] font-bold uppercase tracking-wide" style={{ color: "var(--mut)" }}>Planned</span>
                          <div className="h-[7px] flex-1 overflow-hidden rounded-full" style={{ background: "var(--panel2)" }}>
                            <div className="h-full rounded-full" style={{ width: `${(r.planned / max) * 100}%`, background: "color-mix(in srgb, var(--mut) 65%, transparent)" }} />
                          </div>
                          <span className="tnum w-[56px] shrink-0 text-right font-mono text-[10.5px] font-bold" style={{ color: "var(--mut)" }}>{fmtDur(r.planned)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-[56px] shrink-0 text-[9.5px] font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>Actual</span>
                          <div className="h-[7px] flex-1 overflow-hidden rounded-full" style={{ background: "var(--panel2)" }}>
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(r.actual / max) * 100}%`, background: col }} />
                          </div>
                          <span className="tnum w-[56px] shrink-0 text-right font-mono text-[10.5px] font-bold">{fmtDur(r.actual)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>
                ±10% counts as on target · sorted by biggest miss · Planned = your estimates, Actual = tracked time.
              </div>
            </div>
          )
        ), true)}

        {w.streaks && widgetCard("Habit streaks", "full stats", (
          state.habits.length === 0 ? <div className="text-[12.5px]" style={{ color: "var(--mut)" }}>No habits yet.</div> : (
            <div className="flex flex-col gap-1.5">
              {state.habits.map((h) => {
                const st = streakStats(h.completions);
                return (
                  <div key={h.id} className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                    <div className="flex items-center gap-2 text-[12.5px] font-bold">
                      <span>{h.emoji}</span><span className="truncate">{h.name}</span>
                      <span className="ml-auto chip !py-0 text-[10px]" style={{ color: "var(--accent)" }}>{st.current}-day streak</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>
                      <span>longest <b style={{ color: "var(--text)" }}>{st.longest}d</b></span>
                      <span>shortest <b style={{ color: "var(--text)" }}>{st.shortest}d</b></span>
                      <span>longest skip <b style={{ color: "var(--text)" }}>{st.longestGap}d</b></span>
                      <span>total <b style={{ color: "var(--text)" }}>{st.total}</b></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ))}

        {w.energy && widgetCard("Energy & mood", "daily check-ins", (
          <div className="flex max-h-[260px] flex-col gap-1.5 overflow-y-auto pr-1">
            {energies.length === 0 && (
              <div className="text-[12.5px]" style={{ color: "var(--mut)" }}>No check-ins in range — log one from the dashboard.</div>
            )}
            {[...energies].reverse().map(({ iso, log }) => (
              <div key={iso} className="rounded-lg px-2.5 py-1.5" style={{ background: "var(--bg)" }}>
                <div className="flex items-center gap-2.5">
                  <span className="w-[76px] shrink-0 text-[10.5px] font-bold tnum" style={{ color: "var(--mut)" }}>{fmtDayShort(iso)}</span>
                  <div className="h-[7px] flex-1 overflow-hidden rounded-full" style={{ background: "var(--panel2)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(log!.energy ?? 0) * 20}%`, background: (log!.energy ?? 0) >= 4 ? "var(--ok)" : (log!.energy ?? 0) >= 3 ? "var(--warn)" : "var(--danger)" }} />
                  </div>
                  <span className="w-[30px] shrink-0 text-right font-mono text-[11px] font-bold tnum">{log!.energy != null ? `${log!.energy}/5` : "—"}</span>
                  <span className="w-[20px] shrink-0 text-center text-[13px]">{log!.moodEmoji ?? ""}</span>
                </div>
                {log!.mood && <div className="mt-1 pl-[88px] text-[11.5px] leading-snug" style={{ color: "var(--mut)" }}>{log!.mood}</div>}
              </div>
            ))}
          </div>
        ), true)}

        {w.sessionQuality && widgetCard("Session quality", "how you focus", (
          !quality ? <div className="text-[12.5px]" style={{ color: "var(--mut)" }}>No sessions in range.</div> : (
            <div className="grid grid-cols-2 gap-2">
              {[
                { k: "Average session", v: fmtDur(quality.avg) },
                { k: "Longest session", v: fmtDur(quality.longest) },
                { k: "Deep work (≥25m)", v: `${Math.round((quality.deepMin / Math.max(1, totalMin)) * 100)}%` },
                { k: "Pauses", v: String(quality.pauses) },
              ].map((x) => (
                <div key={x.k} className="rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                  <div className="font-mono text-[18px] font-bold tnum" style={{ color: "var(--accent)" }}>{x.v}</div>
                  <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>{x.k}</div>
                </div>
              ))}
              <div className="col-span-2 text-[11px] font-semibold" style={{ color: "var(--mut)" }}>
                Longest session was on “{quality.longestTask}”.
              </div>
            </div>
          )
        ))}

        {w.weekdays && widgetCard("Weekday rhythm", "minutes per weekday", (
          <div className="flex flex-col">
            {WEEKDAYS_SHORT.map((d, i) => (
              <BarRow key={d} label={d} value={byWeekday[i]} max={Math.max(1, ...byWeekday)} color="var(--accent)" right={fmtDur(byWeekday[i])} />
            ))}
          </div>
        ))}

        {w.topTags && widgetCard("Top tags", "share of tracked time", (
          byTag.length === 0 ? <div className="text-[12.5px]" style={{ color: "var(--mut)" }}>No tag data in range.</div> : (
            <div className="flex flex-wrap gap-1.5">
              {byTag.slice(0, 10).map(([tag, min]) => (
                <span key={tag} className="chip" style={{ borderColor: `color-mix(in srgb, ${state.tagColors[tag] ?? "var(--accent)"} 55%, var(--line))` }}>
                  <span className="h-[8px] w-[8px] rounded-full" style={{ background: state.tagColors[tag] ?? "var(--accent)" }} />
                  {tag} <b style={{ color: "var(--accent)" }}>{fmtDur(min)}</b>
                </span>
              ))}
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function DeltaChip({ label, value, prev, fmt }: { label: string; value: number; prev: number; fmt: (n: number) => string }) {
  const pct = prev > 0 ? Math.round(((value - prev) / prev) * 100) : value > 0 ? 100 : 0;
  const flat = value === prev;
  const up = pct >= 0;
  return (
    <span
      className="chip !py-1 text-[11px]"
      style={{
        color: flat ? "var(--mut)" : up ? "var(--ok)" : "var(--danger)",
        borderColor: flat ? "var(--line)" : up ? "color-mix(in srgb, var(--ok) 45%, var(--line))" : "color-mix(in srgb, var(--danger) 45%, var(--line))",
      }}
      title={`Last week: ${fmt(prev)}`}
    >
      {flat ? "＝" : up ? "▲" : "▼"} {label} · now {fmt(value)} · {flat ? "level with last week" : `${Math.abs(pct)}% vs last week`}
    </span>
  );
}
