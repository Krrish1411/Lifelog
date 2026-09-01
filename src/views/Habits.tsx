import { useMemo, useState } from "react";
import { Check, Flame, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Habit } from "../types";
import { useApp } from "../store";
import { addDaysIso, fmtDayShort, fmtNoteName, streakStats, todayIso, uid } from "../utils/core";
import { Btn, ColorPicker, EmojiPicker, EmptyState, Labeled, Modal, TextInput, cn } from "../components/ui";

export function HabitsView() {
  const { state, set, toast, confirm } = useApp();
  const today = todayIso();
  const [dialog, setDialog] = useState<{ open: boolean; habit: Habit | null }>({ open: false, habit: null });
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("💪");
  const [color, setColor] = useState("#6fbf8e");
  const [backfillId, setBackfillId] = useState<string | null>(null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);

  const weeks = useMemo(() => {
    const start = addDaysIso(today, -83); // 12 weeks
    return Array.from({ length: 12 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDaysIso(start, w * 7 + d)));
  }, [today]);

  const openDialog = (h: Habit | null) => {
    setDialog({ open: true, habit: h });
    setName(h?.name ?? "");
    setEmoji(h?.emoji ?? "💪");
    setColor(h?.color ?? "#6fbf8e");
  };
  const save = () => {
    if (!name.trim()) return toast("Habit needs a name", "err");
    if (dialog.habit) {
      set((s) => ({ ...s, habits: s.habits.map((h) => (h.id === dialog.habit!.id ? { ...h, name: name.trim(), emoji, color } : h)) }));
      toast("Habit updated", "ok");
    } else {
      set((s) => ({ ...s, habits: [...s.habits, { id: uid(), name: name.trim(), emoji, color, createdAt: Date.now(), completions: [] }] }));
      toast("Habit created — check it off below", "ok");
    }
    setDialog({ open: false, habit: null });
  };
  const remove = async (h: Habit) => {
    const ok = await confirm({
      title: "Delete habit",
      body: `“${h.name}” and its ${h.completions.length} logged day(s) will be removed.`,
      confirmLabel: "Delete", danger: true,
    });
    if (!ok) return;
    set((s) => ({ ...s, habits: s.habits.filter((x) => x.id !== h.id) }));
    toast("Habit deleted", "warn");
  };

  const toggleDay = (h: Habit, iso: string) => {
    if (iso > today) return; // future locked
    const has = h.completions.includes(iso);
    set((s) => ({
      ...s,
      habits: s.habits.map((x) =>
        x.id === h.id ? { ...x, completions: has ? x.completions.filter((d) => d !== iso) : [...x.completions, iso] } : x,
      ),
    }));
  };

  const backfillHabit = state.habits.find((h) => h.id === backfillId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-tight">Habits</h1>
          <p className="text-[13px] font-semibold" style={{ color: "var(--mut)" }}>
            Tap today to check off · past days stay locked unless you open “Edit past days”
          </p>
        </div>
        <Btn variant="primary" onClick={() => openDialog(null)}><Plus size={13} /> Habit</Btn>
      </div>

      {state.habits.length === 0 && (
        <div className="card">
          <EmptyState icon={Flame} title="No habits yet" body="Small daily actions, tracked honestly. Create your first habit and build a streak.">
            <Btn variant="primary" onClick={() => openDialog(null)}><Plus size={13} /> New habit</Btn>
          </EmptyState>
        </div>
      )}

      <div className="stagger flex flex-col gap-4">
        {state.habits.map((h) => {
          const st = streakStats(h.completions);
          const doneToday = h.completions.includes(today);
          const editing = backfillId === h.id;
          return (
            <div key={h.id} className="card card-hover overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl text-[19px]" style={{ background: `color-mix(in srgb, ${h.color} 20%, transparent)` }}>{h.emoji}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-[15.5px] font-bold tracking-tight">{h.name}</span>
                    <span className="h-[9px] w-[9px] rounded-full" style={{ background: h.color }} />
                  </div>
                  <div className="text-[11px] font-semibold" style={{ color: "var(--mut)" }}>
                    {h.completions.length} day(s) logged ·{" "}
                    {st.current > 0 ? (
                      <b style={{ color: "var(--accent)" }}>on a {st.current}-day streak</b>
                    ) : (
                      "no active streak"
                    )}
                  </div>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {[
                    { k: "Current streak", v: st.current > 0 ? `${st.current} days` : "0", strong: true },
                    { k: "Longest streak", v: `${st.longest} days` },
                    { k: "Shortest streak", v: `${st.shortest} day${st.shortest === 1 ? "" : "s"}` },
                    { k: "Longest skip", v: `${st.longestGap} days` },
                  ].map((x) => (
                    <div key={x.k} className="rounded-xl border px-2.5 py-1.5 text-center" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                      <div className="font-mono text-[14px] font-bold tnum" style={{ color: x.strong ? "var(--accent)" : "var(--text)" }}>{x.v}</div>
                      <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>{x.k}</div>
                    </div>
                  ))}
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-1">
                      <Btn size="sm" variant="ghost" onClick={() => openDialog(h)}><Pencil size={12} /></Btn>
                      <Btn size="sm" variant="ghost" onClick={() => remove(h)}><Trash2 size={12} /></Btn>
                    </div>
                    <Btn size="sm" variant={editing ? "primary" : "outline"} onClick={() => setBackfillId(editing ? null : h.id)}>
                      {editing ? <><X size={11} /> Done editing</> : <><Lock size={11} /> Edit past days</>}
                    </Btn>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                {/* today toggle */}
                <button
                  onClick={() => { toggleDay(h, today); toast(doneToday ? `“${h.name}” unchecked for today` : `“${h.name}” done today — streak ${streakStats(doneToday ? h.completions.filter((d) => d !== today) : [...h.completions, today]).current}d`, doneToday ? "warn" : "ok"); }}
                  className="flex items-center gap-2.5 rounded-2xl border-2 px-4 py-2.5 transition-all hover:scale-[1.03] active:scale-95"
                  style={{
                    borderColor: doneToday ? h.color : "var(--line)",
                    background: doneToday ? `color-mix(in srgb, ${h.color} 18%, transparent)` : "var(--bg)",
                    cursor: "pointer",
                  }}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full transition-all" style={{ background: doneToday ? h.color : "var(--panel2)" }}>
                    <Check size={15} style={{ color: doneToday ? "var(--on-accent)" : "var(--mut)", opacity: doneToday ? 1 : 0.5 }} />
                  </span>
                  <span className="text-left">
                    <span className="block text-[13px] font-bold">{doneToday ? "Done today" : "Mark today"}</span>
                    <span className="block text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>{fmtDayShort(today)}</span>
                  </span>
                </button>

                {/* 12-week grid */}
                <div className="flex flex-wrap gap-1">
                  {weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-1">
                      {week.map((iso) => {
                        const done = h.completions.includes(iso);
                        const future = iso > today;
                        const locked = future || (!editing && iso !== today);
                        const isToday = iso === today;
                        const canClick = !future && (editing || isToday);
                        return (
                          <button
                            key={iso}
                            onClick={() => canClick && toggleDay(h, iso)}
                            onMouseEnter={() => setHoverDay(iso)}
                            onMouseLeave={() => setHoverDay(null)}
                            disabled={locked}
                            title={`${fmtDayShort(iso)}${future ? " · future (locked)" : locked ? " · locked — use Edit past days" : done ? " · done" : ""}`}
                            className="h-[13px] w-[13px] rounded-[3.5px] transition-all"
                            style={{
                              background: done ? h.color : "var(--panel2)",
                              outline: isToday ? `1.5px solid ${done ? "var(--text)" : h.color}` : "none",
                              outlineOffset: 1.5,
                              opacity: future ? 0.28 : locked && !done ? 0.75 : 1,
                              cursor: canClick ? "pointer" : future ? "not-allowed" : "default",
                              transform: hoverDay === iso && canClick ? "scale(1.35)" : "scale(1)",
                            }}
                            aria-label={iso}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>

                {hoverDay && hoverDay <= today && (
                  <span className="chip text-[10.5px]" style={{ color: "var(--mut)" }}>
                    {fmtNoteName(hoverDay)}{h.completions.includes(hoverDay) ? " · done" : ""}
                  </span>
                )}
              </div>

              {editing && (
                <div className="flex items-center gap-2 border-t px-4 py-2 text-[11.5px] font-semibold" style={{ borderColor: "var(--line)", color: "var(--warn)", background: "color-mix(in srgb, var(--warn) 8%, transparent)" }}>
                  <Pencil size={12} /> Backfill mode: click any past day to check or uncheck it. Future days stay locked. Press “Done editing” when finished.
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal open={dialog.open} onClose={() => setDialog({ open: false, habit: null })}
        title={dialog.habit ? "Edit habit" : "New habit"} width={460}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setDialog({ open: false, habit: null })}>Cancel</Btn>
            <Btn variant="primary" onClick={save}>{dialog.habit ? "Save" : "Create"}</Btn>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Labeled label="Name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning run" /></Labeled>
          <Labeled label="Emoji"><EmojiPicker value={emoji} onChange={setEmoji} /></Labeled>
          <Labeled label="Colour" hint="custom hex always available"><ColorPicker value={color} onChange={setColor} /></Labeled>
        </div>
      </Modal>
    </div>
  );
}
