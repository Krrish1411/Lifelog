import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  Lock,
  Plus,
  Repeat,
  Trash2,
  X,
  Sparkles,
  Clock,
  Layers,
  FileText,
  Search,
} from "lucide-react";
import type { Priority, Recurrence, Subtask, Task, TaskTimeBlock, LifeLogCategory } from "../types";
import { LIFE_LOG_CATEGORIES, LIFE_LOG_PROJECT_ID } from "../types";
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
  fmtDur,
  calcDurationBetweenTimes,
  calcEndTimeFromDuration,
  fmtTimeStr,
  fmtTimeRange,
} from "../utils/core";
import { parseNaturalLanguageTask } from "../utils/nlp";
import { Btn, ColorPicker, EmojiPicker, Labeled, Modal, Seg, Select, TagInput, TextInput, TextArea, Toggle, cn } from "./ui";

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
  const [endTime, setEndTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [reveal, setReveal] = useState(false);
  const [repeats, setRepeats] = useState(false);
  const [rec, setRec] = useState<Recurrence>(defaultRec(todayIso()));
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSub, setNewSub] = useState("");
  const [timeBlocks, setTimeBlocks] = useState<TaskTimeBlock[]>([]);
  const [linkedNoteIds, setLinkedNoteIds] = useState<string[]>([]);
  const [noteSearch, setNoteSearch] = useState("");
  const [showNoteSearch, setShowNoteSearch] = useState(false);
  const [snooze, setSnooze] = useState("");
  const [newProject, setNewProject] = useState(false);
  const [npName, setNpName] = useState("");
  const [npEmoji, setNpEmoji] = useState("🌐");
  const [npColor, setNpColor] = useState("#4fa3a5");
  const [saving, setSaving] = useState(false);
  const [splitChunkMin, setSplitChunkMin] = useState<number>(120);

  // Custom Category State
  const [newCatModal, setNewCatModal] = useState(false);
  const [newCatEmoji, setNewCatEmoji] = useState("✨");
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<LifeLogCategory["type"]>("routine");

  const allCategories: LifeLogCategory[] = useMemo(() => {
    const custom = state.settings.customLifeLogCategories ?? [];
    return [...LIFE_LOG_CATEGORIES, ...custom];
  }, [state.settings.customLifeLogCategories]);

  const handleCreateCustomCategory = () => {
    const name = newCatName.trim();
    if (!name) return toast("Category needs a name", "err");
    const tag = name.toLowerCase().replace(/[^a-z0-9_-]/g, "-") || `cat-${Date.now()}`;
    const newCat: LifeLogCategory = {
      id: `custom-${Date.now()}`,
      emoji: newCatEmoji || "✨",
      label: name,
      tag,
      type: newCatType,
    };
    set((s) => ({
      ...s,
      settings: {
        ...s.settings,
        customLifeLogCategories: [...(s.settings.customLifeLogCategories ?? []), newCat],
      },
    }));
    const withoutCats = tags.filter((t) => !allCategories.some((c) => c.tag === t));
    setTags([...withoutCats, newCat.tag]);
    setEmoji(newCat.emoji);
    setNewCatModal(false);
    setNewCatName("");
    setNewCatEmoji("✨");
    toast(`Category "${name}" created!`, "ok");
  };

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
      const dMin = editing.durationMin || 60;
      setDuration(String(dMin));
      if (editing.dueTime) {
        setEndTime(calcEndTimeFromDuration(editing.dueTime, dMin));
      } else {
        setEndTime("");
      }
      setNotes(editing.notes);
      setRepeats(!!editing.recurrence);
      setRec(editing.recurrence ?? defaultRec(editing.due ?? todayIso()));
      setSubtasks(editing.subtasks.map((s) => ({ ...s })));
      setTimeBlocks(editing.timeBlocks ? editing.timeBlocks.map((b) => ({ ...b })) : []);
      setLinkedNoteIds(editing.linkedNoteIds ? [...editing.linkedNoteIds] : []);
      setSnooze(toInput(editing.snoozedUntil));
      getDeviceKey().then((k) => decryptText(k, editing.privateNote)).then(setPrivateNote);
    } else {
      const preset = taskDialog.presetDate ?? "";
      const presetTime = taskDialog.presetTime ?? "";
      const isLifeLogDialog = (taskDialog.projectId ?? state.projects[0]?.id) === LIFE_LOG_PROJECT_ID;
      setTitle("");
      setProjectId(taskDialog.projectId ?? state.projects[0]?.id ?? "");
      setEmoji(isLifeLogDialog ? "😴" : "");
      setPriority("medium");
      setTags(isLifeLogDialog ? ["sleep"] : []);
      setEstimate(isLifeLogDialog ? "510" : "30");
      setDue(preset || (isLifeLogDialog ? todayIso() : ""));
      setDueTime(isLifeLogDialog ? "23:00" : presetTime);
      setEndTime(isLifeLogDialog ? "07:30" : "");
      setDuration(isLifeLogDialog ? "510" : "60");
      setNotes("");
      setPrivateNote("");
      setRepeats(false);
      setRec(defaultRec(preset || todayIso()));
      setSubtasks([]);
      setTimeBlocks([]);
      setLinkedNoteIds([]);
      setSnooze("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskDialog.open, taskDialog.taskId]);

  const projects = state.projects;
  const recSummary = useMemo(() => (repeats ? describeRecurrence(rec) : "Does not repeat"), [repeats, rec]);

  // Natural Language parsing preview
  const nlpPreview = useMemo(() => {
    if (!title || editing) return null;
    const parsed = parseNaturalLanguageTask(title);
    if (parsed.matchedKeywords.length > 0) return parsed;
    return null;
  }, [title, editing]);

  const unlinkedNotes = useMemo(() => {
    return state.notes.filter((n) => !linkedNoteIds.includes(n.id));
  }, [state.notes, linkedNoteIds]);

  const recentNotes = useMemo(() => {
    return [...unlinkedNotes]
      .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
      .slice(0, 5);
  }, [unlinkedNotes]);

  const filteredNotes = useMemo(() => {
    if (!noteSearch.trim()) return recentNotes;
    const q = noteSearch.toLowerCase();
    return unlinkedNotes.filter(
      (n) => n.title && n.title.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [unlinkedNotes, recentNotes, noteSearch]);

  const applyNlp = () => {
    if (!nlpPreview) return;
    setTitle(nlpPreview.cleanTitle);
    if (nlpPreview.due) setDue(nlpPreview.due);
    if (nlpPreview.dueTime) setDueTime(nlpPreview.dueTime);
    if (nlpPreview.durationMin) {
      setDuration(String(nlpPreview.durationMin));
      setEstimate(String(nlpPreview.durationMin));
    }
    if (nlpPreview.priority) setPriority(nlpPreview.priority);
    if (nlpPreview.project) {
      const match = projects.find(
        (p) => p.name.toLowerCase() === nlpPreview.project!.toLowerCase()
      );
      if (match) {
        setProjectId(match.id);
        setNewProject(false);
      } else {
        setNewProject(true);
        setNpName(nlpPreview.project);
      }
    }
    if (nlpPreview.tags && nlpPreview.tags.length > 0) {
      setTags((prev) => Array.from(new Set([...prev, ...nlpPreview.tags!])));
    }
    toast("Applied smart schedule & tags!", "ok");
  };

  const addSub = () => {
    const v = newSub.trim();
    if (!v) return;
    setSubtasks((s) => [...s, { id: uid(), title: v, done: false, doneAt: null }]);
    setNewSub("");
  };

  // Calendar Time Block Splitter
  const generateBlocks = (chunkSize: number) => {
    const totalMin = Math.max(15, parseInt(estimate || "60", 10) || 60);
    const count = Math.ceil(totalMin / chunkSize);
    const blocks: TaskTimeBlock[] = [];
    let remaining = totalMin;

    for (let i = 0; i < count; i++) {
      const dur = Math.min(chunkSize, remaining);
      blocks.push({
        id: uid(),
        label: `Block ${i + 1} (${dur}m)`,
        date: due || todayIso(),
        time: null,
        durationMin: dur,
        done: false,
        doneAt: null,
      });
      remaining -= dur;
    }
    setTimeBlocks(blocks);
    toast(`Split into ${blocks.length} calendar blocks (${chunkSize}m each)`, "ok");
  };

  const addTimeBlock = () => {
    const totalMin = parseInt(estimate || "60", 10) || 60;
    const defDur = Math.min(60, totalMin);
    setTimeBlocks((prev) => [
      ...prev,
      {
        id: uid(),
        label: `Block ${prev.length + 1}`,
        date: due || todayIso(),
        time: null,
        durationMin: defDur,
        done: false,
        doneAt: null,
      },
    ]);
  };

  const updateTimeBlock = (id: string, patch: Partial<TaskTimeBlock>) => {
    setTimeBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const removeTimeBlock = (id: string) => {
    setTimeBlocks((prev) => prev.filter((b) => b.id !== id));
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
    if (!pid || pid === "__new") pid = projects[0]?.id ?? uid();
    const key = await getDeviceKey();
    const encNote = privateNote.trim() ? await encryptText(key, privateNote) : null;
    const dueVal = due || (pid === LIFE_LOG_PROJECT_ID ? todayIso() : null);
    const effectiveTags = pid === LIFE_LOG_PROJECT_ID && !tags.some(t => allCategories.some(c => c.tag === t))
      ? [...tags, "watch"]
      : tags;
    const effectiveEmoji = emoji || (pid === LIFE_LOG_PROJECT_ID ? "🌊" : null);
    const parsedSnooze = snooze ? new Date(snooze).getTime() : null;
    const snoozeTs = parsedSnooze && !isNaN(parsedSnooze) ? parsedSnooze : null;
    const base = {
      title: title.trim(),
      projectId: pid,
      emoji: effectiveEmoji,
      priority,
      tags: effectiveTags,
      estimateMin: Math.max(0, parseInt(estimate || "0", 10) || 0),
      due: dueVal,
      dueTime: dueVal && dueTime ? dueTime : null,
      durationMin: Math.max(15, parseInt(duration || "60", 10) || 60),
      notes,
      recurrence: repeats ? rec : null,
      subtasks,
      timeBlocks: timeBlocks.length > 0 ? timeBlocks : undefined,
      linkedNoteIds: linkedNoteIds.length > 0 ? linkedNoteIds : undefined,
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
        order: Date.now(),
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
    <>
      <Modal
      open={taskDialog.open}
      onClose={closeTaskDialog}
      title={editing ? "Edit task" : "New task"}
      width={680}
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
        {/* Title & Natural Language Detection */}
        <div>
          <Labeled label="Title">
            <TextInput
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. "Prepare launch report tomorrow at 2pm for 90m #work !urgent"'
            />
          </Labeled>

          {nlpPreview && (
            <div className="mt-2 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <Sparkles size={13} className="text-amber-500 shrink-0" />
                <span className="font-semibold text-[var(--color-text)]">Smart schedule detected:</span>
                <span className="text-[var(--color-mut)]">
                  {nlpPreview.due && `📅 ${nlpPreview.due}`}
                  {nlpPreview.dueTime && ` ⏰ ${nlpPreview.dueTime}`}
                  {nlpPreview.durationMin && ` ⏳ ${nlpPreview.durationMin}m`}
                  {nlpPreview.priority && ` ⚡ ${nlpPreview.priority}`}
                  {nlpPreview.project && ` 📁 +${nlpPreview.project}`}
                  {nlpPreview.tags && ` #${nlpPreview.tags.join(" #")}`}
                </span>
              </div>
              <Btn size="sm" variant="primary" onClick={applyNlp} className="shrink-0 ml-2">
                Auto-fill
              </Btn>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Labeled label="Project">
            <div className="flex flex-col gap-2">
              <Select
                value={newProject ? "__new" : projectId}
                onChange={(val) => {
                  setNewProject(val === "__new");
                  if (val !== "__new") setProjectId(val);
                }}
                options={[
                  ...projects.map((p) => ({
                    value: p.id,
                    label: p.name,
                    icon: <span>{p.emoji}</span>,
                  })),
                  { value: "__new", label: "＋ New project…" },
                ]}
              />
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

        {projectId === LIFE_LOG_PROJECT_ID ? (
          <div className="rounded-2xl border p-3.5 sm:p-4 space-y-3.5 glass-regular" style={{ borderColor: "var(--line)" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
                <span>🌊</span> Life Stream Activity Category
              </span>
              <span className="text-[11px] text-[var(--mut)]">Auto-tracked in Life Balance report</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {allCategories.map((cat) => {
                const active = tags.includes(cat.tag);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      const withoutCats = tags.filter((t) => !allCategories.some((c) => c.tag === t));
                      setTags([...withoutCats, cat.tag]);
                      setEmoji(cat.emoji);
                      if (!title.trim()) {
                        if (cat.id === "sleep") setTitle("Night Sleep");
                        else if (cat.id === "routine") setTitle("Morning Routine");
                      }
                      if (cat.id === "sleep" && (!duration || Number(duration) <= 60)) {
                        setDuration("450");
                        setEstimate("450");
                      }
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                      active
                        ? "bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)] shadow-xs font-extrabold"
                        : "bg-[var(--panel2)] border-[var(--line)] text-[var(--text)] hover:border-[var(--accent)]"
                    )}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setNewCatModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-dashed text-xs font-bold transition-all cursor-pointer border-[var(--line)] text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                title="Add custom category"
              >
                <Plus size={13} />
                <span>Category</span>
              </button>
            </div>

            {/* Actual Time Entry & Bidirectional Auto-Update */}
            <div className="flex flex-col gap-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Labeled label={tags.includes("sleep") ? "Sleep At" : "Start Time"} hint="start">
                  <TextInput
                    type="time"
                    value={dueTime}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setDueTime(newStart);
                      if (newStart && duration) {
                        setEndTime(calcEndTimeFromDuration(newStart, parseInt(duration, 10) || 60));
                      }
                    }}
                  />
                </Labeled>

                <Labeled label={tags.includes("sleep") ? "Wake-up At" : "End Time"} hint="end">
                  <TextInput
                    type="time"
                    value={endTime}
                    onChange={(e) => {
                      const newEnd = e.target.value;
                      setEndTime(newEnd);
                      if (newEnd && dueTime) {
                        const diff = calcDurationBetweenTimes(dueTime, newEnd);
                        setDuration(String(diff));
                        setEstimate(String(diff));
                      }
                    }}
                  />
                </Labeled>

                <Labeled label="Log Date" hint="defaults to today">
                  <TextInput
                    type="date"
                    value={due || todayIso()}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </Labeled>
              </div>

              {/* Duration and Presets */}
              <div className="flex flex-col gap-2 rounded-xl p-3 border border-[var(--line)] bg-[var(--panel2)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--mut)]">
                    Calculated Duration:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <TextInput
                      type="number"
                      min={5}
                      step={5}
                      value={duration}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDuration(val);
                        setEstimate(val);
                        const durNum = parseInt(val, 10);
                        if (durNum && dueTime) {
                          setEndTime(calcEndTimeFromDuration(dueTime, durNum));
                        }
                      }}
                      className="!w-20 text-right font-mono"
                      placeholder="min"
                    />
                    <span className="text-xs font-mono text-[var(--mut)]">min</span>
                    {duration && Number(duration) >= 60 && (
                      <span className="text-[11px] font-mono text-[var(--accent)] font-bold px-2 py-0.5 rounded bg-[var(--accent-soft)]">
                        {fmtDur(Number(duration))}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-[var(--mut)] mr-1">Presets:</span>
                  {tags.includes("sleep")
                    ? [
                        { m: 360, l: "6h" },
                        { m: 420, l: "7h" },
                        { m: 450, l: "7.5h" },
                        { m: 480, l: "8h" },
                        { m: 510, l: "8.5h" },
                        { m: 540, l: "9h" },
                      ].map((item) => (
                        <button
                          key={item.m}
                          type="button"
                          onClick={() => {
                            setDuration(String(item.m));
                            setEstimate(String(item.m));
                            if (dueTime) {
                              setEndTime(calcEndTimeFromDuration(dueTime, item.m));
                            }
                          }}
                          className={cn(
                            "chip !py-1 !px-2.5 text-xs font-bold cursor-pointer transition-all",
                            duration === String(item.m)
                              ? "!bg-[var(--accent)] !text-[var(--on-accent)] !border-[var(--accent)] shadow-xs"
                              : "hover:border-[var(--accent)]"
                          )}
                        >
                          {item.l}
                        </button>
                      ))
                    : [
                        { m: 15, l: "15m" },
                        { m: 30, l: "30m" },
                        { m: 45, l: "45m" },
                        { m: 60, l: "1h" },
                        { m: 90, l: "1.5h" },
                        { m: 120, l: "2h" },
                      ].map((item) => (
                        <button
                          key={item.m}
                          type="button"
                          onClick={() => {
                            setDuration(String(item.m));
                            setEstimate(String(item.m));
                            if (dueTime) {
                              setEndTime(calcEndTimeFromDuration(dueTime, item.m));
                            }
                          }}
                          className={cn(
                            "chip !py-1 !px-2.5 text-xs font-bold cursor-pointer transition-all",
                            duration === String(item.m)
                              ? "!bg-[var(--accent)] !text-[var(--on-accent)] !border-[var(--accent)] shadow-xs"
                              : "hover:border-[var(--accent)]"
                          )}
                        >
                          {item.l}
                        </button>
                      ))}
                </div>

                {dueTime && (
                  <div className="text-[11.5px] font-mono text-[var(--text)] pt-1 flex items-center gap-1.5 border-t border-[var(--line)]/60 mt-1">
                    <Clock size={12} className="text-[var(--accent)] shrink-0" />
                    <span>
                      {fmtTimeRange(dueTime, Number(duration) || 30, state.settings.timeFormat || "12h")}
                    </span>
                    {tags.includes("sleep") && dueTime > (endTime || "00:00") && (
                      <span className="ml-auto text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                        🌙 Overnight
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 sm:gap-4">
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
              <Labeled label="Estimate (minutes)" hint="feeds calibration">
                <TextInput type="number" min={0} step={5} value={estimate} onChange={(e) => setEstimate(e.target.value)} />
              </Labeled>
            </div>

            <Labeled label="Tags" hint="casing preserved, no # prefix">
              <TagInput tags={tags} onChange={setTags} />
            </Labeled>

            {/* Standard Due Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Labeled label="Due date">
                <TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </Labeled>
              <div className="grid grid-cols-2 gap-2 sm:contents">
                <Labeled label="Time block" hint="start">
                  <TextInput type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} disabled={!due} />
                </Labeled>
                <Labeled label="Block length" hint="min">
                  <TextInput type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(e.target.value)} disabled={!dueTime} />
                </Labeled>
              </div>
            </div>
          </>
        )}

        {/* Multi-Block Calendar Scheduling */}
        <div className="rounded-xl border p-3 sm:p-3.5 space-y-3" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent shrink-0" />
              <span className="text-[13px] font-bold text-[var(--color-text)]">
                Calendar Time Blocks ({timeBlocks.length})
              </span>
            </div>
            <span className="text-xs text-[var(--color-mut)]">
              Split large tasks across multiple days or slots
            </span>
          </div>

          {/* Quick Generator */}
          <div className="flex flex-col gap-2 pt-1 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[var(--color-mut)] font-medium mr-1">Split estimate into:</span>
              <Btn size="sm" variant="ghost" onClick={() => generateBlocks(60)}>60m</Btn>
              <Btn size="sm" variant="ghost" onClick={() => generateBlocks(90)}>90m</Btn>
              <Btn size="sm" variant="ghost" onClick={() => generateBlocks(120)}>120m</Btn>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <TextInput
                  type="number"
                  min={15}
                  step={15}
                  className="w-20 h-8 text-xs"
                  value={String(splitChunkMin)}
                  onChange={(e) => setSplitChunkMin(parseInt(e.target.value, 10) || 60)}
                />
                <Btn size="sm" variant="ghost" onClick={() => generateBlocks(splitChunkMin)}>Custom</Btn>
              </div>
              <Btn size="sm" variant="primary" onClick={addTimeBlock} className="ml-auto">
                <Plus size={12} /> Add Block
              </Btn>
            </div>
          </div>

          {/* Blocks List */}
          {timeBlocks.length > 0 && (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {timeBlocks.map((block, idx) => (
                <div
                  key={block.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-lg border bg-[var(--panel)]"
                  style={{ borderColor: "var(--line)" }}
                >
                  <div className="flex items-center gap-2 w-full sm:flex-1">
                    <span className="text-xs font-mono font-bold text-[var(--color-mut)] w-5 shrink-0">
                      #{idx + 1}
                    </span>
                    <TextInput
                      value={block.label ?? `Block ${idx + 1}`}
                      onChange={(e) => updateTimeBlock(block.id, { label: e.target.value })}
                      placeholder="Block label"
                      className="flex-1 h-8 text-xs"
                    />
                    <button
                      onClick={() => removeTimeBlock(block.id)}
                      className="sm:hidden text-[var(--color-mut)] hover:text-red-500 p-1 cursor-pointer"
                      title="Remove block"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="date"
                      value={block.date ?? ""}
                      onChange={(e) => updateTimeBlock(block.id, { date: e.target.value || null })}
                      className="inp flex-1 sm:w-32 h-8 text-xs"
                    />
                    <input
                      type="time"
                      value={block.time ?? ""}
                      onChange={(e) => updateTimeBlock(block.id, { time: e.target.value || null })}
                      className="inp w-24 h-8 text-xs"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min={15}
                        step={15}
                        value={block.durationMin}
                        onChange={(e) => updateTimeBlock(block.id, { durationMin: parseInt(e.target.value, 10) || 30 })}
                        className="inp w-16 h-8 text-xs text-center"
                      />
                      <span className="text-xs text-[var(--color-mut)]">m</span>
                    </div>
                    <button
                      onClick={() => removeTimeBlock(block.id)}
                      className="hidden sm:inline-block text-[var(--color-mut)] hover:text-red-500 p-1 cursor-pointer"
                      title="Remove block"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bi-directional Linked Notes */}
        <div className="rounded-xl border p-3.5 space-y-2.5" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--text)" }}>
              <FileText size={13} className="text-amber-500" /> Linked Notes ({linkedNoteIds.length})
            </span>
            {state.notes.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowNoteSearch((prev) => !prev);
                  if (showNoteSearch) setNoteSearch("");
                }}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all cursor-pointer",
                  showNoteSearch || noteSearch
                    ? "bg-[var(--accent)] text-[var(--on-accent)]"
                    : "text-[var(--mut)] hover:bg-[var(--panel2)] hover:text-[var(--text)]"
                )}
                title="Search notes to link"
              >
                <Search size={12} />
                <span>{showNoteSearch ? "Hide search" : "Search notes"}</span>
              </button>
            )}
          </div>

          {/* Search Input Bar */}
          {(showNoteSearch || noteSearch) && (
            <div className="relative flex items-center">
              <Search size={13} className="absolute left-2.5 text-[var(--mut)] pointer-events-none" />
              <input
                type="text"
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                placeholder="Search notes by title or content…"
                className="inp !pl-8 !pr-8 !py-1.5 text-xs"
                autoFocus
              />
              {noteSearch && (
                <button
                  type="button"
                  onClick={() => setNoteSearch("")}
                  className="absolute right-2 text-[var(--mut)] hover:text-[var(--text)] p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          {/* Pinned Selected Notes */}
          {linkedNoteIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {linkedNoteIds.map((id) => {
                const n = state.notes.find((x) => x.id === id);
                return (
                  <span
                    key={id}
                    className="chip !py-0.5 !px-2 text-[11px] font-semibold flex items-center gap-1.5"
                    style={{
                      background: "color-mix(in srgb, var(--accent) 18%, var(--panel2))",
                      borderColor: "color-mix(in srgb, var(--accent) 55%, var(--line))",
                      color: "var(--text)",
                    }}
                  >
                    <FileText size={10} style={{ color: "var(--accent)" }} />
                    <span className="truncate max-w-[160px]">{n ? n.title || "Untitled note" : "Unknown note"}</span>
                    <button
                      type="button"
                      onClick={() => setLinkedNoteIds((prev) => prev.filter((x) => x !== id))}
                      className="hover:opacity-75 cursor-pointer ml-0.5"
                      title="Unlink note"
                    >
                      <X size={11} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Available Notes Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {filteredNotes.map((n) => {
              const selected = linkedNoteIds.includes(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setLinkedNoteIds((prev) =>
                      selected ? prev.filter((id) => id !== n.id) : [...prev, n.id]
                    );
                  }}
                  className={cn(
                    "chip text-[11.5px] transition-all cursor-pointer select-none",
                    selected
                      ? "bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)] font-bold shadow-xs"
                      : "hover:border-[var(--accent)] text-[var(--text)] hover:bg-[var(--panel2)]"
                  )}
                >
                  <span className="truncate max-w-[180px]">{n.title || "Untitled note"}</span>
                  <span className="ml-1 opacity-80">{selected ? "✓" : "+"}</span>
                </button>
              );
            })}
            {!noteSearch && unlinkedNotes.length > 5 && (
              <span className="text-[10.5px] text-[var(--mut)] py-0.5 px-1 font-medium">
                +{unlinkedNotes.length - 5} more notes (use Search above)
              </span>
            )}
            {state.notes.length > 0 && filteredNotes.length === 0 && (
              <span className="text-xs text-[var(--mut)] py-1">
                No notes match "{noteSearch}".
              </span>
            )}
            {state.notes.length === 0 && (
              <span className="text-xs text-[var(--mut)]">No notes created yet.</span>
            )}
          </div>
        </div>

        {/* Recurrence */}
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
                <TextInput
                  type="number"
                  min={1}
                  max={60}
                  className="w-[64px]"
                  value={rec.interval ? String(rec.interval) : ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setRec({ ...rec, interval: 0 });
                    } else {
                      setRec({ ...rec, interval: Math.min(60, parseInt(raw, 10) || 1) });
                    }
                  }}
                  onBlur={() => {
                    if (!rec.interval || rec.interval < 1) setRec({ ...rec, interval: 1 });
                  }}
                />
                <Select
                  width={130}
                  value={rec.freq}
                  onChange={(val) => setRec({ ...rec, freq: val as Recurrence["freq"] })}
                  options={[
                    { value: "daily", label: "day(s)" },
                    { value: "weekly", label: "week(s)" },
                    { value: "monthly", label: "month(s)" },
                  ]}
                />
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
                      <Select
                        width={110}
                        value={String(rec.setPos)}
                        onChange={(val) => setRec({ ...rec, setPos: parseInt(val, 10) })}
                        options={[
                          { value: "1", label: "first" },
                          { value: "2", label: "second" },
                          { value: "3", label: "third" },
                          { value: "4", label: "fourth" },
                          { value: "-1", label: "last" },
                        ]}
                      />
                      <Select
                        width={120}
                        value={String(rec.byWeekday[0] ?? 0)}
                        onChange={(val) => setRec({ ...rec, byWeekday: [parseInt(val, 10)] })}
                        options={WEEKDAYS_SHORT.map((d, i) => ({ value: String(i), label: d }))}
                      />
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

        {/* Snooze */}
        <div className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="lbl mb-0 font-bold text-xs">Snooze until</span>
              {snooze && (
                <button
                  type="button"
                  onClick={() => setSnooze("")}
                  className="text-xs text-[var(--danger)] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Btn size="sm" variant="ghost" onClick={() => quickSnooze(Date.now() + 3600000)}>+1h</Btn>
              <Btn size="sm" variant="ghost" onClick={() => quickSnooze(tonight())}>Tonight 20:00</Btn>
              <Btn size="sm" variant="ghost" onClick={() => quickSnooze(tomorrow9())}>Tomorrow 09:00</Btn>
            </div>
          </div>
          <div className="mt-2.5">
            <TextInput type="datetime-local" value={snooze} onChange={(e) => setSnooze(e.target.value)} />
          </div>
        </div>

        {/* Subtasks */}
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

        {/* Notes */}
        <Labeled label="Notes">
          <TextArea className="min-h-[64px] resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Context, links, acceptance criteria…" />
        </Labeled>

        {/* Encrypted Private Note */}
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
            <TextArea className="mt-2 min-h-[56px] resize-y" value={privateNote} onChange={(e) => setPrivateNote(e.target.value)} placeholder="Thoughts only you can read…" />
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

    {/* Custom Category Modal */}
    <Modal
      open={newCatModal}
      onClose={() => setNewCatModal(false)}
      title="Add LifeLog Category"
      width={400}
      compact
      zIndex={80}
      footer={
        <>
          <Btn variant="ghost" size="sm" onClick={() => setNewCatModal(false)}>
            Cancel
          </Btn>
          <Btn variant="primary" size="sm" onClick={handleCreateCustomCategory}>
            Create Category
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3 py-1">
        <Labeled label="Category Name">
          <TextInput
            autoFocus
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="e.g. Gaming, Guitar, Cooking, Gym"
            onKeyDown={(e) => e.key === "Enter" && handleCreateCustomCategory()}
          />
        </Labeled>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Emoji Icon">
            <EmojiPicker value={newCatEmoji} onChange={setNewCatEmoji} />
          </Labeled>
          <Labeled label="Category Type">
            <select
              value={newCatType}
              onChange={(e) => setNewCatType(e.target.value as any)}
              className="inp !py-2 text-xs w-full font-semibold"
            >
              <option value="routine">Routine / Life</option>
              <option value="learning">Learning / Study</option>
              <option value="entertainment">Entertainment</option>
              <option value="creation">Creation / Build</option>
              <option value="health">Health / Fitness</option>
            </select>
          </Labeled>
        </div>
      </div>
    </Modal>
  </>
  );
}
