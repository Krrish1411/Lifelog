import type { Habit, Note, Project, Session, State, Task, TimerMode } from "../types";
import { DEFAULT_SETTINGS, STATE_VERSION } from "../types";
import { getDeviceKey, encryptText } from "../utils/crypto";
import { addDaysIso, fmtNoteName, isoDate, todayIso, uid } from "../utils/core";

/* Deterministic PRNG so first-run data is stable */
let seedNum = 987654321;
function rnd(): number {
  seedNum = (seedNum * 1664525 + 1013904223) % 4294967296;
  return seedNum / 4294967296;
}

function mkTask(p: Partial<Task> & { projectId: string; title: string }): Task {
  return {
    id: uid(),
    notes: "",
    emoji: null,
    priority: "medium",
    tags: [],
    estimateMin: 0,
    due: null,
    dueTime: null,
    durationMin: 60,
    snoozedUntil: null,
    done: false,
    doneAt: null,
    createdAt: Date.now() - 20 * 86400000,
    subtasks: [],
    recurrence: null,
    completions: [],
    privateNote: null,
    ...p,
  };
}

function mkSession(
  taskId: string | null,
  startedAt: number,
  minutes: number,
  mode: TimerMode | "break",
  plannedMin: number | null,
  withPause = false,
): Session {
  const pauses =
    withPause && mode !== "break"
      ? [{ at: startedAt + 10 * 60000, resumeAt: startedAt + 12 * 60000 }]
      : [];
  const pauseMs = pauses.reduce((a, p) => a + ((p.resumeAt ?? startedAt) - p.at), 0);
  return {
    id: uid(),
    taskId,
    subtaskId: null,
    mode,
    startedAt,
    endedAt: startedAt + minutes * 60000 + pauseMs,
    plannedMin,
    pauses,
    status: "done",
  };
}

export async function buildSeedState(): Promise<State> {
  const key = await getDeviceKey();
  const today = todayIso();
  const now = Date.now();
  const day = 86400000;

  const projects: Project[] = [
    { id: "p-atlas", name: "Atlas — Client Website", emoji: "🌐", color: "#4fa3a5", createdAt: now - 30 * day },
    { id: "p-lifelog", name: "LifeLog App", emoji: "🧠", color: "#e8a33d", createdAt: now - 25 * day },
    { id: "p-home", name: "Home & Admin", emoji: "🏠", color: "#d66853", createdAt: now - 60 * day },
    { id: "p-learn", name: "Learning", emoji: "📚", color: "#6fbf8e", createdAt: now - 45 * day },
  ];

  /* ------- tasks ------- */
  const tHero = mkTask({
    projectId: "p-atlas", title: "Hero section redesign", emoji: "🎨", priority: "high",
    tags: ["design", "client"], estimateMin: 90, due: today, dueTime: "09:30", durationMin: 90,
    notes: "Client wants a calmer headline + product screenshot on the right.",
    subtasks: [
      { id: uid(), title: "Wireframe in grayscale", done: true, doneAt: now - 2 * day },
      { id: uid(), title: "Mobile breakpoint pass", done: false, doneAt: null },
    ],
  });
  const tTimer = mkTask({
    projectId: "p-lifelog", title: "Timer engine — pause/resume edge cases", emoji: "⏱️",
    priority: "high", tags: ["dev"], estimateMin: 60, due: today, dueTime: "14:00", durationMin: 60,
  });
  const tRead = mkTask({
    projectId: "p-learn", title: "Read: Deep Work — chapter 4", emoji: "📖",
    priority: "low", tags: ["reading"], estimateMin: 30, due: today,
  });
  const tDomain = mkTask({
    projectId: "p-home", title: "Renew domain names", emoji: "🧾", priority: "urgent",
    tags: ["admin"], estimateMin: 20, due: addDaysIso(today, -1),
  });
  const tInvoice = mkTask({
    projectId: "p-atlas", title: "Invoice #204 follow-up", emoji: "💶", priority: "medium",
    tags: ["client", "admin"], estimateMin: 15, snoozedUntil: now + 1 * day,
  });
  const tReview = mkTask({
    projectId: "p-lifelog", title: "Weekly review", emoji: "🧭", priority: "medium", tags: ["review"],
    estimateMin: 25, due: addDaysIso(today, (12 - ((new Date().getDay() + 6) % 7)) % 7 || 7),
    recurrence: { freq: "weekly", interval: 1, byWeekday: [4], monthMode: "day", byMonthDay: 1, setPos: 1 },
    completions: [
      { at: now - 7 * day }, { at: now - 14 * day }, { at: now - 21 * day },
    ],
  });
  const tRent = mkTask({
    projectId: "p-home", title: "Pay rent", emoji: "🏦", priority: "high", tags: ["admin"],
    estimateMin: 10, due: addDaysIso(today, 5),
    recurrence: { freq: "monthly", interval: 1, byWeekday: [], monthMode: "day", byMonthDay: 1, setPos: 1 },
  });
  const tMentor = mkTask({
    projectId: "p-learn", title: "Mentor call — monthly", emoji: "📞", priority: "medium", tags: ["call"],
    estimateMin: 45, due: addDaysIso(today, 12),
    recurrence: { freq: "monthly", interval: 1, byWeekday: [3], monthMode: "weekday", byMonthDay: 1, setPos: 1 },
    completions: [{ at: now - 33 * day }],
  });
  const tDnd = mkTask({
    projectId: "p-lifelog", title: "Refine calendar drag & drop", emoji: "🗓️",
    priority: "medium", tags: ["dev", "design"], estimateMin: 45,
  });
  const tCopy = mkTask({
    projectId: "p-atlas", title: "Copy polish — landing page", emoji: "✍️",
    priority: "low", tags: ["writing"], estimateMin: 25, due: today,
  });

  const done = (t: Task, daysAgo: number): Task => ({ ...t, done: true, doneAt: now - daysAgo * day });
  const c1 = done(mkTask({ projectId: "p-atlas", title: "Kickoff notes & moodboard", tags: ["client"], estimateMin: 40, createdAt: now - 9 * day }), 6);
  const c2 = done(mkTask({ projectId: "p-lifelog", title: "Prototype focus screen", emoji: "🎯", tags: ["dev", "design"], estimateMin: 60, createdAt: now - 6 * day }), 3);
  const c3 = done(mkTask({ projectId: "p-learn", title: "Watch: TypeScript generics talk", tags: ["learning"], estimateMin: 50, createdAt: now - 4 * day }), 1);
  const c4 = done(mkTask({ projectId: "p-home", title: "File Q3 receipts", tags: ["admin"], estimateMin: 30, createdAt: now - 5 * day }), 2);
  const c5 = done(mkTask({ projectId: "p-atlas", title: "Accessibility audit — contrast pass", tags: ["design"], estimateMin: 50, createdAt: now - 8 * day }), 5);
  const cYear = done(mkTask({ projectId: "p-lifelog", title: "First LifeLog sketch on paper", emoji: "📝", tags: ["idea"], createdAt: now - 366 * day }), 365);

  const tasks = [tHero, tTimer, tRead, tDomain, tInvoice, tReview, tRent, tMentor, tDnd, tCopy, c1, c2, c3, c4, c5, cYear];

  /* ------- sessions: realistic history across ~5 weeks ------- */
  const sessions: Session[] = [];
  const pool = [tHero, tTimer, tRead, tDnd, tCopy, c2, c3, c5];
  for (let back = 31; back >= 1; back--) {
    if (back <= 21 && rnd() < 0.22) continue; // some rest days
    const iso = addDaysIso(today, -back);
    const count = back <= 21 ? 2 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 2);
    let hour = 8 + Math.floor(rnd() * 2);
    for (let i = 0; i < count; i++) {
      const task = pool[Math.floor(rnd() * pool.length)];
      const minute = rnd() < 0.5 ? 0 : 30;
      const start = new Date(iso + "T00:00:00").getTime() + hour * 3600000 + minute * 60000;
      const roll = rnd();
      if (roll < 0.45) {
        sessions.push(mkSession(task.id, start, 25, "pomodoro", 25, rnd() < 0.25));
        if (rnd() < 0.6) sessions.push(mkSession(null, start + 27 * 60000, 5, "break", 5));
      } else if (roll < 0.75) {
        sessions.push(mkSession(task.id, start, 40 + Math.floor(rnd() * 15), "countdown", 50));
      } else {
        sessions.push(mkSession(task.id, start, 30 + Math.floor(rnd() * 55), "flow", null));
      }
      hour += 1 + Math.floor(rnd() * 3);
      if (hour > 19) hour = 9;
    }
  }
  sessions.push(mkSession(cYear.id, now - 365 * day + 10 * 3600000, 90, "flow", null));
  sessions.sort((a, b) => a.startedAt - b.startedAt);

  /* ------- habits ------- */
  const hReadDates: string[] = [];
  for (let back = 30; back >= 1; back--) if (rnd() < 0.78) hReadDates.push(addDaysIso(today, -back));
  const hRunDates: string[] = [];
  for (let back = 45; back >= 1; back--) if (rnd() < 0.42) hRunDates.push(addDaysIso(today, -back));
  const hMedDates: string[] = [];
  for (let back = 12; back >= 1; back--) hMedDates.push(addDaysIso(today, -back));
  const habits: Habit[] = [
    { id: "h-read", name: "Read 20 pages", emoji: "📖", color: "#6fbf8e", createdAt: now - 31 * day, completions: hReadDates },
    { id: "h-run", name: "Morning run", emoji: "🏃", color: "#4fa3a5", createdAt: now - 46 * day, completions: hRunDates },
    { id: "h-med", name: "Meditate 10 min", emoji: "🧘", color: "#e8a33d", createdAt: now - 13 * day, completions: hMedDates },
  ];

  /* ------- notes (encrypted) ------- */
  const folders = [
    { id: "f-daily", name: "Daily" },
    { id: "f-ideas", name: "Ideas" },
    { id: "f-journal", name: "Journal" },
  ];
  const mkNote = async (
    title: string, folderId: string, body: string, daily = false, dayIso: string | null = null, daysAgo = 0,
  ): Promise<Note> => ({
    id: uid(),
    title,
    folderId,
    createdAt: now - daysAgo * day,
    updatedAt: now - daysAgo * day + 3600000,
    blob: await encryptText(key, body),
    daily,
    day: dayIso,
  });
  const notes: Note[] = [
    await mkNote(fmtNoteName(today), "f-daily", "Intentions for today:\n— Finish hero wireframe before lunch\n— One pomodoro on timer edge cases\n— Walk after the 14:00 block\n\nGratitude: quiet morning, good coffee.", true, today, 0),
    await mkNote(fmtNoteName(addDaysIso(today, -1)), "f-daily", "Shipped the receipts filing. Felt scattered mid-afternoon — energy dip around 15:00.\nIdea: colour-code calendar blocks by project automatically.", true, addDaysIso(today, -1), 1),
    await mkNote("App ideas", "f-ideas", "• Weekly review template with 3 questions\n• \"On this day\" for notes too, not just tasks\n• Keyboard-first quick capture", false, null, 4),
    await mkNote("Reading queue", "f-ideas", "1. Deep Work — Cal Newport (reading now)\n2. The Design of Everyday Things\n3. Thinking in Systems", false, null, 9),
  ];

  /* ------- day logs ------- */
  const moods = [
    "Steady. Deep morning block felt effortless.",
    "A bit restless — too many tabs, too little plan.",
    "Good momentum after the run.",
    "Low energy after lunch; recovered with a walk.",
    "Proud — cleared the admin pile.",
    "Calm, focused, ended early.",
  ];
  const moodEmojis = ["🙂", "😐", "😄", "🙂", "😕", "😄", "🤩", "😐"];
  const dayLogs: State["dayLogs"] = {};
  for (let back = 16; back >= 1; back--) {
    dayLogs[addDaysIso(today, -back)] = {
      energy: 2 + Math.floor(rnd() * 4),
      moodEmoji: moodEmojis[(back + 1) % moodEmojis.length],
      mood: moods[(back + 1) % moods.length],
      updatedAt: now - back * day + 20 * 3600000,
    };
  }

  return {
    version: STATE_VERSION,
    projects,
    tagColors: {
      design: "#c079b8",
      client: "#7f9cd6",
      dev: "#6fbf8e",
      admin: "#8b93a5",
      reading: "#4fa3a5",
      review: "#e8a33d",
      call: "#e0b457",
      writing: "#d66853",
      learning: "#a3b34f",
      idea: "#e8a33d",
    },
    tasks,
    habits,
    folders,
    notes,
    sessions,
    dayLogs,
    settings: { ...DEFAULT_SETTINGS },
    meta: { createdAt: now - 60 * day, lastGreetingDay: null },
  };
}
