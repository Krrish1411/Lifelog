import type { Habit, Note, Project, Session, State, Task } from "../types";
import { DEFAULT_SETTINGS, STATE_VERSION } from "../types";
import { getDeviceKey, encryptText } from "../utils/crypto";
import { fmtNoteName, todayIso, uid } from "../utils/core";

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
    createdAt: Date.now() - 2 * 86400000,
    subtasks: [],
    recurrence: null,
    completions: [],
    privateNote: null,
    ...p,
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
      { id: uid(), title: "Explore today's agenda on the Cockpit dashboard", done: false, doneAt: null },
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
    notes: "Distraction-free focus stage with synthetic audio chimes and pause-duration auditing.",
    subtasks: [
      { id: uid(), title: "Click the focus timer icon next to any task or press 'F'", done: false, doneAt: null },
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

  /* Starter routine guiding tasks only — no mock completed tasks */
  const tasks = [tWelcome, tNotes, tFocus, tCalendar, tSync];

  /* Clean focus slate — 0 focus sessions, 0 past hours */
  const sessions: Session[] = [];

  /* Fresh habits — 0 mock completions */
  const habits: Habit[] = [
    { id: "h-read", name: "Read 20 pages", emoji: "📖", color: "#6fbf8e", createdAt: now - 3 * day, completions: [] },
    { id: "h-run", name: "Morning run", emoji: "🏃", color: "#4fa3a5", createdAt: now - 3 * day, completions: [] },
    { id: "h-med", name: "Meditate 10 min", emoji: "🧘", color: "#e8a33d", createdAt: now - 3 * day, completions: [] },
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
   - Click the **Focus** timer next to any task or press \`F\`.
   - Choose between **Pomodoro** (classic 25m/5m cadence), **Countdown** (custom time budget), or **Flow** (open-ended stopwatch).
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
| \`H\` | Jump to Cockpit Dashboard |
| \`T\` | Jump to Tasks & Projects |
| \`F\` | Jump to Deep Focus Stage |
| \`C\` | Jump to Time-Grid Calendar |
| \`B\` | Jump to Habits Tracker |
| \`E\` | Jump to Notes & Second Brain |
| \`D\` | Jump to Daily Log & Reflection |
| \`R\` | Jump to Reports & Analytics |
| \`V\` | Jump to Weekly Review |
| \`S\` | Jump to Settings |
| \`Space\` | Start / Pause Active Focus Timer |
| \`Ctrl+K\` | Open Universal Command Palette |
| \`Ctrl+N\` | Create New Task |

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

  /* ------- day logs: clean slate ------- */
  const dayLogs: State["dayLogs"] = {};

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
