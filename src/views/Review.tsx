import { useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, Flame, History, Lock, PenLine, Save, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import type { Note } from "../types";
import { useApp } from "../store";
import { decryptText, encryptText, getDeviceKey } from "../utils/crypto";
import {
  addDaysIso, fmtDateLong, fmtDayShort, fmtDur, fmtNoteName, isoDate, listDates,
  parseIso, sessionMinutes, streakStats, todayIso, trackedByDay, uid, weekStartIso,
} from "../utils/core";
import { Btn, Modal, Seg, cn } from "../components/ui";

type Period = "this-week" | "last-week" | "this-month" | "last-month";

export function ReviewView() {
  const { state, set, setView, toast } = useApp();
  const today = todayIso();
  const [period, setPeriod] = useState<Period>("this-week");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [historyOpen, setHistoryOpen] = useState<{ title: string; text: string | null } | null>(null);

  const reviewNotes = useMemo(
    () => state.notes.filter((n) => n.folderId === "f-reviews" || n.title.startsWith("Review ·")).sort((a, b) => b.updatedAt - a.updatedAt),
    [state.notes],
  );
  const openHistory = (n: Note) => {
    setHistoryOpen({ title: n.title, text: null });
    getDeviceKey().then((k) => decryptText(k, n.blob)).then((text) =>
      setHistoryOpen((h) => (h && h.title === n.title ? { ...h, text } : h)),
    );
  };

  const range = useMemo(() => {
    const d = parseIso(today);
    if (period === "this-week") return { from: weekStartIso(today), to: today };
    if (period === "last-week") {
      const ws = addDaysIso(weekStartIso(today), -7);
      return { from: ws, to: addDaysIso(ws, 6) };
    }
    if (period === "this-month") return { from: isoDate(new Date(d.getFullYear(), d.getMonth(), 1)), to: today };
    const lm = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return { from: isoDate(lm), to: isoDate(new Date(d.getFullYear(), d.getMonth(), 0)) };
  }, [period, today]);

  const days = useMemo(() => listDates(range.from, range.to), [range]);

  const stats = useMemo(() => {
    const tracked = trackedByDay(state.sessions);
    let total = 0, sessions = 0, withWork = 0, bestDay = range.from, bestMin = -1;
    for (const iso of days) {
      const m = tracked.get(iso) ?? 0;
      total += m;
      if (m > 0) { withWork++; if (m > bestMin) { bestMin = m; bestDay = iso; } }
    }
    sessions = state.sessions.filter((s) => s.taskId && s.mode !== "break" && isoDate(new Date(s.startedAt)) >= range.from && isoDate(new Date(s.startedAt)) <= range.to).length;

    let done = 0;
    for (const t of state.tasks) {
      if (t.done && t.doneAt) { const d = isoDate(new Date(t.doneAt)); if (d >= range.from && d <= range.to) done++; }
      done += t.completions.filter((c) => { const d = isoDate(new Date(c.at)); return d >= range.from && d <= range.to; }).length;
    }

    const byProject = new Map<string, number>();
    for (const s of state.sessions) {
      if (!s.taskId || s.mode === "break") continue;
      const d = isoDate(new Date(s.startedAt));
      if (d < range.from || d > range.to) continue;
      const t = state.tasks.find((x) => x.id === s.taskId);
      if (t) byProject.set(t.projectId, (byProject.get(t.projectId) ?? 0) + sessionMinutes(s));
    }
    const top = [...byProject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    const energies = days.map((iso) => state.dayLogs[iso]?.energy ?? null).filter((e): e is number => e != null);
    const avgEnergy = energies.length ? energies.reduce((a, b) => a + b, 0) / energies.length : null;
    const half = Math.floor(energies.length / 2);
    const trend = energies.length >= 4 ? (energies.slice(half).reduce((a, b) => a + b, 0) / Math.max(1, energies.length - half)) - (energies.slice(0, half).reduce((a, b) => a + b, 0) / Math.max(1, half)) : 0;

    const habits = state.habits.map((h) => ({ h, st: streakStats(h.completions) })).sort((a, b) => b.st.current - a.st.current);

    return { total, sessions, withWork, bestDay, bestMin: Math.max(0, bestMin), done, top, avgEnergy, trend, habits };
  }, [state, days, range]);

  const QUESTIONS = [
    { k: "wins", q: "What went well?", hint: "Wins, flow moments, things to repeat" },
    { k: "stuck", q: "What felt heavy or got stuck?", hint: "Friction, procrastination, blockers" },
    { k: "learned", q: "What did you learn?", hint: "About your work or about yourself" },
    { k: "next", q: "What will you carry into the next period?", hint: "One or two concrete intentions" },
  ];

  const saveReview = async () => {
    const lines: string[] = [
      `LifeLog review · ${period.replace("-", " ")} (${fmtDayShort(range.from)} → ${fmtDayShort(range.to)})`,
      ``,
      `— Numbers —`,
      `Focused: ${fmtDur(stats.total)} across ${stats.sessions} sessions on ${stats.withWork}/${days.length} day(s)`,
      `Best day: ${fmtDayShort(stats.bestDay)} (${fmtDur(stats.bestMin)})`,
      `Completed: ${stats.done} task(s)${stats.top.length ? ` · top project: ${state.projects.find((p) => p.id === stats.top[0][0])?.name ?? "?"}` : ""}`,
      stats.avgEnergy != null ? `Average energy: ${(Math.round(stats.avgEnergy * 10) / 10)}/5` : `Average energy: no check-ins`,
      ``,
      `— Reflections —`,
      ...QUESTIONS.flatMap((qq) => [`• ${qq.q}`, answers[qq.k]?.trim() ? `  ${answers[qq.k].trim()}` : `  (skipped)`, ``]),
    ];
    const key = await getDeviceKey();
    const folderId = state.folders.find((f) => f.name === "Reviews")?.id ?? null;
    const noteId = uid();
    set((s) => {
      const folders = folderId ? s.folders : [...s.folders, { id: "f-reviews", name: "Reviews" }];
      return {
        ...s,
        folders,
        notes: [
          { id: noteId, title: `Review · ${fmtDayShort(range.from)} → ${fmtDayShort(range.to)}`, folderId: folderId ?? "f-reviews", createdAt: Date.now(), updatedAt: Date.now(), blob: { plain: "" }, daily: false, day: null },
          ...s.notes,
        ],
      };
    });
    // encrypt after state has the folder (blob set async)
    const blob = await encryptText(key, lines.join("\n"));
    set((s) => ({ ...s, notes: s.notes.map((n) => (n.id === noteId ? { ...n, blob } : n)) }));
    setAnswers({});
    toast("Review saved as an encrypted note in “Reviews”", "ok");
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-full min-w-0 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 w-full min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[24px] font-bold tracking-tight truncate">Review</h1>
          <p className="text-[13px] font-semibold truncate" style={{ color: "var(--mut)" }}>
            A guided look back — numbers first, then your own words. Saved as an encrypted note.
          </p>
        </div>
        <div className="w-full sm:w-auto overflow-x-auto scrollbar-none py-0.5 min-w-0">
          <Seg
            options={[
              { value: "this-week", label: "This week" },
              { value: "last-week", label: "Last week" },
              { value: "this-month", label: "This month" },
              { value: "last-month", label: "Last month" },
            ]}
            value={period}
            onChange={setPeriod}
          />
        </div>
      </div>

      {/* insights */}
      <div className="stagger grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 w-full min-w-0">
        <InsightCard icon={<Flame size={16} />} title="Focused time" big={fmtDur(stats.total)} sub={`${stats.sessions} sessions · ${stats.withWork}/${days.length} active days`} />
        <InsightCard icon={<Sparkles size={16} />} title="Best day" big={stats.bestMin > 0 ? fmtDur(stats.bestMin) : "—"} sub={stats.bestMin > 0 ? `${fmtDateLong(parseIso(stats.bestDay))}` : "no tracked work"} />
        <InsightCard icon={<CheckCircle2 size={16} />} title="Completed" big={String(stats.done)} sub="tasks & recurring check-offs" />
        <InsightCard
          icon={stats.trend > 0.2 ? <TrendingUp size={16} /> : stats.trend < -0.2 ? <TrendingDown size={16} /> : <ArrowUpRight size={16} />}
          title="Energy trend"
          big={stats.avgEnergy != null ? `${(Math.round(stats.avgEnergy * 10) / 10)}/5` : "—"}
          sub={stats.avgEnergy == null ? "no check-ins in range" : stats.trend > 0.2 ? "trending up across the period" : stats.trend < -0.2 ? "trending down — worth a look" : "holding steady"}
          tone={stats.trend < -0.2 ? "warn" : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] w-full min-w-0">
        {/* top projects + habits */}
        <div className="card engine-panel p-4 w-full min-w-0 overflow-hidden">
          <div className="font-display text-[15px] font-bold tracking-tight">Where the time went</div>
          {stats.top.length === 0 ? (
            <div className="mt-3 text-[12.5px]" style={{ color: "var(--mut)" }}>No focus recorded in this period.</div>
          ) : (
            <div className="mt-3 flex flex-col gap-2.5">
              {stats.top.map(([pid, min], i) => {
                const p = state.projects.find((x) => x.id === pid);
                const pct = Math.round((min / Math.max(1, stats.total)) * 100);
                return (
                  <div key={pid} className="flex items-center gap-3 min-w-0 w-full">
                    <span className="tnum font-mono text-[12px] font-bold shrink-0" style={{ color: "var(--mut)" }}>#{i + 1}</span>
                    <span className="text-[16px] shrink-0">{p?.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between text-[12.5px] font-bold min-w-0 gap-2">
                        <span className="truncate">{p?.name ?? "Deleted project"}</span>
                        <span className="tnum font-mono shrink-0" style={{ color: "var(--accent)" }}>{fmtDur(min)} · {pct}%</span>
                      </div>
                      <div className="mt-1 h-[7px] overflow-hidden rounded-full w-full" style={{ background: "var(--bg)" }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: p?.color }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-5 font-display text-[15px] font-bold tracking-tight">Habit streaks right now</div>
          {stats.habits.length === 0 ? (
            <div className="mt-2 text-[12.5px]" style={{ color: "var(--mut)" }}>No habits yet.</div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2 min-w-0">
              {stats.habits.slice(0, 4).map(({ h, st }) => (
                <span key={h.id} className="chip truncate max-w-full" style={{ borderColor: `color-mix(in srgb, ${h.color} 55%, var(--line))` }}>
                  {h.emoji} {h.name} · <b style={{ color: "var(--accent)" }}>{st.current}d</b>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* reflection */}
        <div className="card engine-panel p-4 w-full min-w-0 overflow-hidden">
          <div className="flex items-center gap-2">
            <PenLine size={15} style={{ color: "var(--accent)" }} />
            <span className="font-display text-[15px] font-bold tracking-tight">Reflection</span>
          </div>
          <div className="mt-3 flex flex-col gap-3 w-full min-w-0">
            {QUESTIONS.map((qq) => (
              <div key={qq.k} className="review-q rounded-xl border p-2.5 w-full min-w-0 overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                <div className="text-[12.5px] font-bold truncate">{qq.q}</div>
                <div className="mb-1.5 text-[10.5px] font-semibold truncate" style={{ color: "var(--mut)" }}>{qq.hint}</div>
                <textarea
                  className="inp min-h-[52px] resize-y !border-0 !bg-transparent !p-0 !shadow-none text-[13px] w-full min-w-0"
                  value={answers[qq.k] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [qq.k]: e.target.value }))}
                  placeholder="A few honest words…"
                />
              </div>
            ))}
            <Btn variant="primary" size="lg" onClick={saveReview} className={cn("w-full")}>
              <Save size={14} /> Save this review
            </Btn>
          </div>
        </div>
      </div>

      {/* history */}
      <div className="card engine-panel p-4 w-full min-w-0 overflow-hidden">
        <div className="flex items-center gap-2">
          <History size={15} style={{ color: "var(--accent)" }} />
          <span className="font-display text-[15px] font-bold tracking-tight">Past reviews</span>
          <span className="text-[11px] font-semibold" style={{ color: "var(--mut)" }}>
            ({reviewNotes.length}) · encrypted in your vault
          </span>
        </div>
        {reviewNotes.length === 0 ? (
          <div className="mt-3 text-[12.5px]" style={{ color: "var(--mut)" }}>
            No saved reviews yet. Finish the reflection above and save to start your record.
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-1.5 w-full min-w-0">
            {reviewNotes.map((n) => (
              <button
                key={n.id}
                onClick={() => openHistory(n)}
                className="flex flex-col items-start rounded-xl border p-3 text-left transition-all hover:translate-x-[2px] w-full min-w-0 cursor-pointer"
                style={{ borderColor: "var(--line)", background: "var(--bg)" }}
              >
                <div className="flex items-center gap-2 font-display text-[13.5px] font-bold w-full min-w-0">
                  <Lock size={11} className="shrink-0" style={{ color: "var(--accent)" }} />
                  <span className="truncate flex-1 min-w-0">{n.title}</span>
                </div>
                <div className="mt-0.5 text-[10.5px] font-semibold tnum truncate" style={{ color: "var(--mut)" }}>
                  saved {fmtDayShort(isoOf(n.updatedAt))} · click to read the summary
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* history reader */}
      <Modal open={!!historyOpen} onClose={() => setHistoryOpen(null)} title={historyOpen?.title ?? "Review"} width={640}>
        {historyOpen?.text === null ? (
          <div className="py-8 text-center text-[13px]" style={{ color: "var(--mut)" }}>Decrypting…</div>
        ) : (
          <pre className="note-page whitespace-pre-wrap font-body text-[13.5px]" style={{ color: "var(--text)" }}>{historyOpen?.text}</pre>
        )}
      </Modal>
    </div>
  );
}

function isoOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function InsightCard({ icon, title, big, sub, tone }: { icon: React.ReactNode; title: string; big: string; sub: string; tone?: "warn" }) {
  return (
    <div className="card card-hover p-4 w-full min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider truncate" style={{ color: "var(--mut)" }}>
        <span className="shrink-0" style={{ color: tone === "warn" ? "var(--warn)" : "var(--accent)" }}>{icon}</span>
        <span className="truncate">{title}</span>
      </div>
      <div className="mt-2 font-mono text-[24px] font-bold leading-none tnum truncate" style={{ color: tone === "warn" ? "var(--warn)" : "var(--text)" }}>{big}</div>
      <div className="mt-1.5 text-[11.5px] font-semibold truncate" style={{ color: "var(--mut)" }}>{sub}</div>
    </div>
  );
}
