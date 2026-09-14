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
    { id: "p-onboarding", name: "Getting Started with LifeLog", emoji: "🚀", color: "#6366f1", createdAt: now - 5 * day },
    { id: "p-work", name: "Deep Work & Projects", emoji: "💼", color: "#4fa3a5", createdAt: now - 30 * day },
    { id: "p-life", name: "Personal & Wellness", emoji: "🌱", color: "#10b981", createdAt: now - 45 * day },
  ];

  /* ------- Guided Onboarding & Productive Sample Tasks ------- */
  const tWelcome = mkTask({
    projectId: "p-onboarding",
    title: "Welcome to LifeLog! Complete your first 3-minute setup",
    emoji: "🚀",
    priority: "high",
    tags: ["setup"],
    estimateMin: 5,
    due: today,
    dueTime: "09:00",
    durationMin: 30,
    notes: "Welcome! LifeLog is designed to be calm, local-first, and distraction-free. Don't worry about using every feature at once — start by exploring at your own pace.",
    subtasks: [
      { id: uid(), title: "Explore today's agenda on the Cockpit dashboard", done: true, doneAt: now - 1 * day },
      { id: uid(), title: "Check off your first task or subtask", done: false, doneAt: null },
      { id: uid(), title: "Press Ctrl+K (or Cmd+K) to open the Universal Command Palette", done: false, doneAt: null },
      { id: uid(), title: "Head to Settings to pick your favorite theme and layout engine", done: false, doneAt: null },
    ],
  });

  const tNotes = mkTask({
    projectId: "p-onboarding",
    title: "Explore Notes: Discover your Sovereign Second Brain",
    emoji: "🧠",
    priority: "high",
    tags: ["notes", "guide"],
    estimateMin: 15,
    due: today,
    dueTime: "11:00",
    durationMin: 45,
    notes: "LifeLog includes a full Markdown knowledge base with client-side AES-256 encryption. Read the structured guides in the 'Guides & Principles' folder to learn about mentions and architecture.",
    subtasks: [
      { id: uid(), title: "Navigate to Notes in the sidebar or press '6'", done: false, doneAt: null },
      { id: uid(), title: "Read 'Welcome to LifeLog: The Sovereign Workspace Guide'", done: false, doneAt: null },
      { id: uid(), title: "Try typing @, #, or [ inside a note to link to tasks or projects", done: false, doneAt: null },
      { id: uid(), title: "Create your first personal note or daily log entry", done: false, doneAt: null },
    ],
  });

  const tFocus = mkTask({
    projectId: "p-onboarding",
    title: "Try a 25-minute Pomodoro or Flow focus session",
    emoji: "⏱️",
    priority: "medium",
    tags: ["focus"],
    estimateMin: 25,
    due: today,
    dueTime: "14:00",
    durationMin: 25,
    notes: "Distraction-free focus stage with synthetic audio chimes, pause-duration auditing, and background soundscapes.",
    subtasks: [
      { id: uid(), title: "Click the focus timer icon next to any task or press '3'", done: false, doneAt: null },
      { id: uid(), title: "Select your preferred ambient soundscape (Rain, Brown noise, Waves)", done: false, doneAt: null },
      { id: uid(), title: "Complete one focused block without switching tabs", done: false, doneAt: null },
    ],
  });

  const tCalendar = mkTask({
    projectId: "p-onboarding",
    title: "Schedule your afternoon by dragging a task onto the Calendar",
    emoji: "🗓️",
    priority: "medium",
    tags: ["calendar"],
    estimateMin: 10,
    due: today,
    notes: "Switch to Calendar view (key '4'). Drag any unscheduled task onto the timeline grid to block time. Drag it back to the top bar to unschedule anytime.",
    subtasks: [
      { id: uid(), title: "Open the Calendar view (press '4')", done: false, doneAt: null },
      { id: uid(), title: "Drag an unscheduled task from the top bar into an open time slot", done: false, doneAt: null },
      { id: uid(), title: "Drag a scheduled block back up to the top bar to unblock it", done: false, doneAt: null },
    ],
  });

  const tSync = mkTask({
    projectId: "p-onboarding",
    title: "Pair a second device using zero-cloud P2P Sync",
    emoji: "📡",
    priority: "low",
    tags: ["sync"],
    estimateMin: 15,
    notes: "Sync your desktop and phone directly over your local network without any central cloud servers.",
    subtasks: [
      { id: uid(), title: "Open Settings > Sync & Storage", done: false, doneAt: null },
      { id: uid(), title: "Start P2P pairing on your laptop and phone while on the same Wi-Fi", done: false, doneAt: null },
      { id: uid(), title: "Scan the pairing QR code to establish an encrypted direct link", done: false, doneAt: null },
    ],
  });

  const tGoals = mkTask({
    projectId: "p-work",
    title: "Draft weekly project sprint goals",
    emoji: "🎯",
    priority: "medium",
    tags: ["planning"],
    estimateMin: 30,
    due: today,
  });

  const tDesign = mkTask({
    projectId: "p-work",
    title: "Review client design deliverables",
    emoji: "🎨",
    priority: "high",
    tags: ["design"],
    estimateMin: 45,
    due: addDaysIso(today, 1),
  });

  const tWalk = mkTask({
    projectId: "p-life",
    title: "Afternoon 20-minute walk & recharge",
    emoji: "🚶",
    priority: "medium",
    tags: ["wellness"],
    estimateMin: 20,
    due: today,
  });

  const tRead = mkTask({
    projectId: "p-life",
    title: "Read 15 pages of non-fiction",
    emoji: "📖",
    priority: "low",
    tags: ["reading"],
    estimateMin: 20,
    due: today,
  });

  const done = (t: Task, daysAgo: number): Task => ({ ...t, done: true, doneAt: now - daysAgo * day });
  const cInstall = done(mkTask({ projectId: "p-onboarding", title: "Installed LifeLog v1.0.0 Sovereign Edition", emoji: "✨", tags: ["setup"], estimateMin: 5, createdAt: now - 3 * day }), 2);
  const cVault = done(mkTask({ projectId: "p-onboarding", title: "Configured local encrypted vault", emoji: "🔒", tags: ["security"], estimateMin: 10, createdAt: now - 2 * day }), 1);
  const cLayout = done(mkTask({ projectId: "p-onboarding", title: "Explored 5 visual layout engines", emoji: "🎨", tags: ["appearance"], estimateMin: 15, createdAt: now - 1 * day }), 1);

  const tasks = [tWelcome, tNotes, tFocus, tCalendar, tSync, tGoals, tDesign, tWalk, tRead, cInstall, cVault, cLayout];

  /* ------- sessions: realistic history across ~5 weeks ------- */
  const sessions: Session[] = [];
  const pool = [tWelcome, tNotes, tFocus, tGoals, tDesign, cVault, cLayout];
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
  sessions.push(mkSession(cInstall.id, now - 2 * day + 10 * 3600000, 45, "flow", null));
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
    { id: "f-guides", name: "Guides & Principles" },
    { id: "f-daily", name: "Daily Log" },
    { id: "f-ideas", name: "Ideas & Scratchpad" },
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

  const guideWelcome = `# Welcome to LifeLog: The Sovereign Workspace Guide

> **A Note on Getting Started Without Overwhelm:**  
> LifeLog has deep capabilities — visual time blocking, Pomodoro focus auditing, habit heatmaps, Markdown notes, and peer-to-peer sync. **You do NOT need to use everything at once.**  
> Start simple: pick 2 or 3 priorities in the Cockpit or Today list. Check them off. When you're ready to focus, start a timer. Let the system adapt to your flow.

---

## 🧭 The 3-Minute Mental Model

LifeLog is organized around three natural daily rhythms:

1. **Capture & Prioritize (Morning):**
   - Open **Cockpit** or **Tasks**.
   - Jot down your priorities. Assign them to a Project or add an estimated duration.
   - Use the **Today** view to keep your immediate focus narrow and calm.

2. **Immerse in Deep Work (Mid-day):**
   - Click the **Focus** timer next to any task.
   - Choose between **Pomodoro** (classic 25m/5m cadence), **Countdown** (custom time budget), or **Flow** (open-ended stopwatch).
   - Turn on synthesized background audio (White Noise, Rain, Waves, or Binaural beats) to drown out distractions.
   - Any pauses you take are honestly recorded — no cheating your own history!

3. **Reflect & Calibrate (Evening):**
   - In **Daily Log**, log your energy level (1–5) and a quick 1-sentence mood check-in.
   - Review your **Reports** to see how closely your actual focus time matched your morning estimates.

---

## ⚡ Power Tips to Feel at Home

- **Universal Command Palette:** Press \`Ctrl+K\` (or \`Cmd+K\` on Mac) anywhere to search tasks, jump across views, or run actions instantly.
- **Customizable Layouts:** LifeLog includes 5 complete aesthetic engines (Glass, Planify, Control, Desk, and Zen). Switch between them in **Settings > Appearance**.
- **No Cloud Required:** Everything you write is saved locally into your device's SQLite/IndexedDB vault. It works with 100% fidelity offline.`;

  const guideMentions = `# Power User Guide: Mentions, Wiki-Links & Shortcuts

LifeLog connects your knowledge base directly with your execution pipeline.

---

## 🔗 Instant Dynamic Dropdowns (@, #, [)

Whenever you type in a note, task notes, or checklist item, trigger instant dynamic link dropdowns:

- Type \`@\` to open the dynamic task selector. Continue typing to filter by task title.
- Type \`#\` to open the dynamic project selector. Filter and link projects on the fly.
- Type \`[\` to trigger dynamic Wiki-style cross-linking across your entire vault.

Press \`Enter\` or click on any suggestion to insert the link. Clicking a link later takes you directly to that task or project!

---

## ⌨️ Single-Key Quick Navigation

When you are not typing in a text field, LifeLog supports rapid single-key navigation:

| Key | Action |
|:---:|:---|
| \`1\` | Jump to Cockpit Dashboard |
| \`2\` | Jump to Tasks & Projects |
| \`3\` | Jump to Deep Focus Stage |
| \`4\` | Jump to Time-Grid Calendar |
| \`5\` | Jump to Habits Tracker |
| \`6\` | Jump to Notes & Second Brain |
| \`7\` | Jump to Reports & Analytics |
| \`8\` | Jump to Daily Log & Reflection |
| \`9\` | Jump to Settings |
| \`Space\` | Start / Pause Active Focus Timer |
| \`Ctrl+K\` | Open Universal Command Palette |

*Need custom keys? Remap every shortcut to your preference in **Settings > General**.*`;

  const guideArchitecture = `# Zero-Cloud Architecture & Cryptographic Sovereignty

### Why Sovereign Computing Matters
Most modern "productivity" apps are actually marketing conduits: they store your private thoughts on multi-tenant cloud databases, scan text for AI training, and hold your data hostage behind monthly paywalls.

LifeLog is built on four non-negotiable architectural pillars:

1. **Zero External Telemetry:**
   - No tracking SDKs (no Google Analytics, no Sentry, no Mixpanel).
   - Zero background network requests on boot. The update checker in Settings only queries GitHub when you click it.

2. **Native SQLite WAL Engine:**
   - Desktop and mobile builds leverage local SQLite with Write-Ahead Logging (WAL) for sub-millisecond ACID transactions and zero data corruption.

3. **AES-256-GCM Vault:**
   - Your notes are encrypted with PBKDF2 key derivation and AES-256-GCM authenticated encryption. Even someone inspecting your raw device disk cannot read your notes without your device key or master password.

4. **Pure Peer-to-Peer DTLS Sync:**
   - When synchronizing between your laptop and phone, data travels directly over your local Wi-Fi via WebRTC DTLS data channels. No central server ever sees or stores your data.

Your data is yours — forever.`;

  const notes: Note[] = [
    await mkNote("Welcome to LifeLog: The Sovereign Workspace Guide", "f-guides", guideWelcome, false, null, 2),
    await mkNote("Power User Guide: Mentions, Wiki-Links & Shortcuts", "f-guides", guideMentions, false, null, 1),
    await mkNote("Zero-Cloud Architecture & Cryptographic Sovereignty", "f-guides", guideArchitecture, false, null, 3),
    await mkNote(fmtNoteName(today), "f-daily", `Intentions for today:\n— Explore the new LifeLog onboarding guide in Notes\n— Complete a 25-minute Pomodoro focus block\n— Take an afternoon walk & recharge\n\nGratitude: A calm morning, a clear workspace, and zero distractions.`, true, today, 0),
    await mkNote("App ideas", "f-ideas", "• Weekly review template with 3 reflection questions\n• Offline voice memo attachments\n• Quick capture hotkey from anywhere in OS", false, null, 4),
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
      setup: "#6366f1",
      notes: "#3b82f6",
      guide: "#8b5cf6",
      focus: "#f59e0b",
      calendar: "#10b981",
      sync: "#06b6d4",
      planning: "#4fa3a5",
      design: "#ec4899",
      wellness: "#14b8a6",
      reading: "#84cc16",
      security: "#64748b",
      appearance: "#a855f7",
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
