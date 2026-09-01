import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Eye, EyeOff, Lock, Plus, Repeat, Trash2, X } from "lucide-react";
import type { Priority, Recurrence, Subtask, Task } from "../types";
import { useApp } from "../store";
import { decryptText, encryptText, getDeviceKey } from "../utils/crypto";
import {
  WEEKDAYS_SHORT,
  describeRecurrence,
  fmtNoteName,
  parseIso,
  setPosLabel,
  todayIso,
  uid,
} from "../utils/core";
import { Btn, ColorPicker, EmojiPicker, Labeled, Modal, Seg, TagInput, TextInput, Toggle, cn } from "./ui";

const defaultRec = (dueIso: string): Recurrence => {
  const wd = dueIso ? (parseIso(dueIso).getDay() + 6) % 7 : 0;
  const dom = dueIso ? parseIso(dueIso).getDate() : 1;
  return { freq: "weekly", interval: 1, byWeekday: [wd], monthMode: "day", byMonthDay: dom, setPos: 1 };
};

function toInput(ts: number | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function TaskDialog() {
  const app = useApp();
  const { state, taskDialog, closeTaskDialog, set, toast, confirm } = app;
  const editing = taskDialog.taskId ? state.tasks.find((t) => t.id === taskDialog.taskId) : undefined;

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [emoji, setEmoji] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [tags, setTags] = useState<string[]>([]);
  const [estimate, setEstimate] = useState("30");
  const [due, setDue] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [reveal, setReveal] = useState(false);
  const [repeats, setRepeats] = useState(false);
  const [rec, setRec] = useState<Recurrence>(defaultRec(todayIso()));
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSub, setNewSub] = useState("");
  const [snooze, setSnooze] = useState("");
  const [newProject, setNewProject] = useState(false);
  const [npName, setNpName] = useState("");
  const [npEmoji, setNpEmoji] = useState("🌐");
  const [npColor, setNpColor] = useState("#4fa3a5");
  const [saving, setSaving] = useState(false);

  /* hydrate on open */
  useEffect(() => {
    if (!taskDialog.open) return;
    setReveal(false);
    setNewProject(false);
    setNpName("");
    setNewSub("");
    setSaving(false);
    if (editing) {
      setTitle(editing.title);
      setProjectId(editing.projectId);
      setEmoji(editing.emoji ?? "");
      setPriority(editing.priority);
      setTags([...editing.tags]);
      setEstimate(String(editing.estimateMin || ""));
      setDue(editing.due ?? "");
      setDueTime(editing.dueTime ?? "");
      setDuration(String(editing.durationMin || 60));
      setNotes(editing.notes);
      setRepeats(!!editing.recurrence);
      setRec(editing.recurrence ?? defaultRec(editing.due ?? todayIso()));
      setSubtasks(editing.subtasks.map((s) => ({ ...s })));
      setSnooze(toInput(editing.snoozedUntil));
      getDeviceKey().then((k) => decryptText(k, editing.privateNote)).then(setPrivateNote);
    } else {
      const preset = taskDialog.presetDate ?? "";
      setTitle("");
      setProjectId(taskDialog.projectId ?? state.projects[0]?.id ?? "");
      setEmoji("");
      setPriority("medium");
      setTags([]);
      setEstimate("30");
      setDue(preset);
      setDueTime("");
      setDuration("60");
      setNotes("");
      setPrivateNote("");
      setRepeats(false);
      setRec(defaultRec(preset || todayIso()));
      setSubtasks([]);
      setSnooze("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskDialog.open, taskDialog.taskId]);

  const projects = state.projects;
  const recSummary = useMemo(() => (repeats ? describeRecurrence(rec) : "Does not repeat"), [repeats, rec]);

  const addSub = () => {
    const v = newSub.trim();
    if (!v) return;
    setSubtasks((s) => [...s, { id: uid(), title: v, done: false, doneAt: null }]);
    setNewSub("");
  };

  const del = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: "Delete task",
      body: `“${editing.title}” and its tracked sessions will remain in history, but the task itself is removed. Continue?`,
      confirmLabel: "Delete task",
      danger: true,
    });
    if (!ok) return;
    set((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== editing.id) }));
    toast("Task deleted", "ok");
    closeTaskDialog();
  };

  const save = async () => {
    if (!title.trim()) {
      toast("Give the task a title first", "err");
      return;
    }
    setSaving(true);
    let pid = projectId;
    if (newProject && npName.trim()) {
      pid = uid();
      set((s) => ({
        ...s,
        projects: [...s.projects, { id: pid, name: npName.trim(), emoji: npEmoji, color: npColor, createdAt: Date.now() }],
      }));
    }
    if (!pid) pid = projects[0]?.id ?? uid();
    const key = await getDeviceKey();
    const encNote = privateNote.trim() ? await encryptText(key, privateNote) : null;
    const dueVal = due || null;
    const snoozeTs = snooze ? new Date(snooze).getTime() : null;
    const base = {
      title: title.trim(),
      projectId: pid,
      emoji: emoji || null,
      priority,
      tags,
      estimateMin: Math.max(0, parseInt(estimate || "0", 10) || 0),
      due: dueVal,
      dueTime: dueVal && dueTime ? dueTime : null,
      durationMin: Math.max(15, parseInt(duration || "60", 10) || 60),
      notes,
      recurrence: repeats ? rec : null,
      subtasks,
      snoozedUntil: snoozeTs,
      privateNote: encNote,
    };
    if (editing) {
      set((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === editing.id ? { ...t, ...base } : t)) }));
      toast("Task updated", "ok");
    } else {
      const t: Task = {
        id: uid(),
        ...base,
        done: false,
        doneAt: null,
        createdAt: Date.now(),
        completions: [],
      };
      set((s) => ({ ...s, tasks: [t, ...s.tasks] }));
      toast("Task created", "ok");
    }
    if (snoozeTs && snoozeTs > Date.now()) {
      const d = new Date(snoozeTs);
      const p = (n: number) => String(n).padStart(2, "0");
      toast(`Snoozed until ${fmtNoteName(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)} · ${p(d.getHours())}:${p(d.getMinutes())}`, "warn");
    }
    setSaving(false);
    closeTaskDialog();
  };

  const quickSnooze = (ts: number) => setSnooze(toInput(ts));
  const tonight = () => {
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    return d.getTime();
  };
  const tomorrow9 = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  };

  return (
    <Modal
      open={taskDialog.open}
      onClose={closeTaskDialog}
      title={editing ? "Edit task" : "New task"}
      width={640}
      footer={
        <>
          {editing && (
            <Btn variant="danger" onClick={del} className="mr-auto">
              <Trash2 size={13} /> Delete
            </Btn>
          )}
          <Btn variant="ghost" onClick={closeTaskDialog}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}>
            {saving ? "Encrypting…" : editing ? "Save changes" : "Create task"}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Labeled label="Title">
          <TextInput autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" />
        </Labeled>

        <div className="grid grid-cols-2 gap-4">
          <Labeled label="Project">
            <div className="flex flex-col gap-2">
              <select className="inp" value={newProject ? "__new" : projectId} onChange={(e) => { setNewProject(e.target.value === "__new"); if (e.target.value !== "__new") setProjectId(e.target.value); }}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
                ))}
                <option value="__new">＋ New project…</option>
              </select>
              {newProject && (
                <div className="rise flex flex-col gap-2 rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                  <TextInput value={npName} onChange={(e) => setNpName(e.target.value)} placeholder="Project name" />
                  <Labeled label="Emoji"><EmojiPicker value={npEmoji} onChange={setNpEmoji} /></Labeled>
                  <Labeled label="Colour" hint="custom hex always available"><ColorPicker value={npColor} onChange={setNpColor} /></Labeled>
                </div>
              )}
            </div>
          </Labeled>
          <Labeled label="Task emoji" hint="optional">
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </Labeled>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Labeled label="Priority">
            <Seg
              options={[
                { value: "low", label: "Low" },
                { value: "medium", label: "Med" },
                { value: "high", label: "High" },
                { value: "urgent", label: "Urgent" },
              ]}
              value={priority}
              onChange={setPriority}
            />
          </Labeled>
          <Labeled label="Estimate" hint="minutes, feeds estimate-vs-actual">
            <TextInput type="number" min={0} step={5} value={estimate} onChange={(e) => setEstimate(e.target.value)} />
          </Labeled>
        </div>

        <Labeled label="Tags" hint="casing preserved, no # prefix">
          <TagInput tags={tags} onChange={setTags} />
        </Labeled>

        <div className="grid grid-cols-3 gap-4">
          <Labeled label="Due date">
            <TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Labeled>
          <Labeled label="Time block" hint="start">
            <TextInput type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} disabled={!due} />
          </Labeled>
          <Labeled label="Block length" hint="min">
            <TextInput type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(e.target.value)} disabled={!dueTime} />
          </Labeled>
        </div>

        <div className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center justify-between">
            <Toggle checked={repeats} onChange={(v) => { setRepeats(v); if (v) setRec(defaultRec(due || todayIso())); }} label="Repeats" />
            <span className="chip" style={{ color: repeats ? "var(--accent)" : "var(--mut)" }}>
              <Repeat size={11} /> {recSummary}
            </span>
          </div>
          {repeats && (
            <div className="rise mt-3 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-bold" style={{ color: "var(--mut)" }}>Every</span>
                <TextInput type="number" min={1} max={60} className="w-[64px]" value={String(rec.interval)} onChange={(e) => setRec({ ...rec, interval: Math.max(1, parseInt(e.target.value || "1", 10)) })} />
                <select className="inp w-[130px]" value={rec.freq} onChange={(e) => setRec({ ...rec, freq: e.target.value as Recurrence["freq"] })}>
                  <option value="daily">day(s)</option>
                  <option value="weekly">week(s)</option>
                  <option value="monthly">month(s)</option>
                </select>
              </div>
              {rec.freq === "weekly" && (
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS_SHORT.map((d, i) => {
                    const on = rec.byWeekday.includes(i);
                    return (
                      <button key={d} onClick={() => setRec({ ...rec, byWeekday: on ? rec.byWeekday.filter((x) => x !== i) : [...rec.byWeekday, i].sort() })} className="chip transition-all" style={on ? { background: "var(--accent)", color: "var(--on-accent)", borderColor: "var(--accent)", cursor: "pointer" } : { cursor: "pointer" }}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              )}
              {rec.freq === "monthly" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Seg size="sm" options={[{ value: "day", label: "On day…" }, { value: "weekday", label: "On the…" }]} value={rec.monthMode} onChange={(v) => setRec({ ...rec, monthMode: v })} />
                  {rec.monthMode === "day" ? (
                    <TextInput type="number" min={1} max={31} className="w-[70px]" value={String(rec.byMonthDay)} onChange={(e) => setRec({ ...rec, byMonthDay: Math.min(31, Math.max(1, parseInt(e.target.value || "1", 10))) })} />
                  ) : (
                    <>
                      <select className="inp w-[110px]" value={String(rec.setPos)} onChange={(e) => setRec({ ...rec, setPos: parseInt(e.target.value, 10) })}>
                        <option value="1">first</option>
                        <option value="2">second</option>
                        <option value="3">third</option>
                        <option value="4">fourth</option>
                        <option value="-1">last</option>
                      </select>
                      <select className="inp w-[120px]" value={String(rec.byWeekday[0] ?? 0)} onChange={(e) => setRec({ ...rec, byWeekday: [parseInt(e.target.value, 10)] })}>
                        {WEEKDAYS_SHORT.map((d, i) => <option key={d} value={i}>{d}</option>)}
                      </select>
                    </>
                  )}
                  <span className="text-[12px]" style={{ color: "var(--mut)" }}>= {setPosLabel(rec.setPos)} occurrence</span>
                </div>
              )}
              {editing?.recurrence && (
                <div className="text-[12px]" style={{ color: "var(--mut)" }}>
                  Completed {editing.completions.length} time(s) · next after save: from {due || "today"}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center justify-between">
            <span className="lbl mb-0">Snooze until</span>
            <div className="flex gap-1.5">
              <Btn size="sm" variant="ghost" onClick={() => quickSnooze(Date.now() + 3600000)}>+1h</Btn>
              <Btn size="sm" variant="ghost" onClick={() => quickSnooze(tonight())}>Tonight 20:00</Btn>
              <Btn size="sm" variant="ghost" onClick={() => quickSnooze(tomorrow9())}>Tomorrow 09:00</Btn>
              {snooze && <Btn size="sm" variant="danger" onClick={() => setSnooze("")}><X size={11} /> Clear</Btn>}
            </div>
          </div>
          <div className="mt-2">
            <TextInput type="datetime-local" value={snooze} onChange={(e) => setSnooze(e.target.value)} />
          </div>
        </div>

        <Labeled label="Subtasks" hint="trackable individually in Focus">
          <div className="flex flex-col gap-1.5">
            {subtasks.map((st) => (
              <div key={st.id} className="flex items-center gap-2">
                <button
                  onClick={() => setSubtasks((all) => all.map((x) => (x.id === st.id ? { ...x, done: !x.done, doneAt: x.done ? null : Date.now() } : x)))}
                  className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-md border transition-all"
                  style={st.done ? { background: "var(--ok)", borderColor: "var(--ok)", color: "#0c120e" } : { borderColor: "var(--line)", cursor: "pointer" }}
                  aria-label="Toggle subtask"
                >
                  {st.done && <Check size={12} />}
                </button>
                <span className={cn("flex-1 text-[13px]", st.done && "line-through opacity-55")}>{st.title}</span>
                <button onClick={() => setSubtasks((all) => all.filter((x) => x.id !== st.id))} style={{ color: "var(--mut)", cursor: "pointer" }} aria-label="Remove subtask">
                  <X size={13} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <TextInput value={newSub} onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSub())} placeholder="Add a subtask…" />
              <Btn onClick={addSub}><Plus size={13} /></Btn>
            </div>
          </div>
        </Labeled>

        <Labeled label="Notes">
          <textarea className="inp min-h-[64px] resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Context, links, acceptance criteria…" />
        </Labeled>

        <div className="rounded-xl border p-3" style={{ borderColor: "color-mix(in srgb, var(--accent) 35%, var(--line))" }}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--accent)" }}>
              <Lock size={12} /> Private note — encrypted at rest
            </span>
            <Btn size="sm" variant="ghost" onClick={() => setReveal((r) => !r)}>
              {reveal ? <EyeOff size={12} /> : <Eye size={12} />} {reveal ? "Hide" : "Reveal"}
            </Btn>
          </div>
          {reveal ? (
            <textarea className="inp mt-2 min-h-[56px] resize-y" value={privateNote} onChange={(e) => setPrivateNote(e.target.value)} placeholder="Thoughts only you can read…" />
          ) : (
            <div className="mt-2 rounded-lg border border-dashed px-3 py-2.5 text-[12px]" style={{ borderColor: "var(--line)", color: "var(--mut)" }}>
              {privateNote ? "•••••••• (hidden — press Reveal to read or edit)" : "Nothing here yet."}
            </div>
          )}
        </div>

        {editing?.done && editing.doneAt && (
          <div className="chip self-start" style={{ color: "var(--ok)" }}>
            <CalendarDays size={11} /> Completed {new Date(editing.doneAt).toLocaleString()}
          </div>
        )}
      </div>
    </Modal>
  );
}

