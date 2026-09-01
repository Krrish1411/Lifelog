/* ------------------------------------------------------------------ */
/* LifeLog data model — everything below is persisted locally,         */
/* encrypted at rest with a device key (AES-GCM via Web Crypto).       */
/* ------------------------------------------------------------------ */

export type Priority = "low" | "medium" | "high" | "urgent";
export type LayoutMode = "planify" | "control" | "glass" | "zen" | "desk";
export type ThemeMode = "dark" | "light";
export type FontPair = "manrope" | "sora" | "outfit" | "plex" | "jakarta" | "nunito";
export type TimerMode = "pomodoro" | "countdown" | "flow";
export type ViewId =
  | "dashboard"
  | "tasks"
  | "focus"
  | "calendar"
  | "habits"
  | "notes"
  | "daylog"
  | "reports"
  | "review"
  | "settings"
  | "sync";

/** Encrypted payload. `plain` is only used when Web Crypto is unavailable. */
export interface EncBlob {
  iv?: string;
  d?: string;
  plain?: string;
}

/** RRULE-style recurrence: daily / weekly / monthly with custom intervals. */
export interface Recurrence {
  freq: "daily" | "weekly" | "monthly";
  interval: number; // every N days/weeks/months
  byWeekday: number[]; // 0 = Monday … 6 = Sunday
  monthMode: "day" | "weekday";
  byMonthDay: number; // 1..31 when monthMode = "day"
  setPos: number; // 1..4 or -1 (last) when monthMode = "weekday"
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  doneAt: number | null;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  notes: string;
  emoji: string | null;
  priority: Priority;
  tags: string[]; // casing preserved exactly as typed
  estimateMin: number;
  due: string | null; // ISO yyyy-mm-dd
  dueTime: string | null; // HH:mm time-block start
  durationMin: number; // time-block length
  snoozedUntil: number | null;
  done: boolean;
  doneAt: number | null;
  createdAt: number;
  subtasks: Subtask[];
  recurrence: Recurrence | null;
  completions: { at: number }[]; // history for recurring tasks
  privateNote: EncBlob | null; // encrypted per-task note
}

export interface Project {
  id: string;
  name: string;
  emoji: string;
  color: string;
  createdAt: number;
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  createdAt: number;
  completions: string[]; // ISO dates
}

export interface Folder {
  id: string;
  name: string;
  pinned?: boolean;
}

/** Media attached to a note — stored inside the encrypted state envelope. */
export interface Attachment {
  id: string;
  kind: "image" | "video" | "audio";
  name: string;
  dataUrl: string;
  size: number; // bytes (pre-base64)
  createdAt: number;
}

export interface Note {
  id: string;
  title: string;
  folderId: string;
  createdAt: number;
  updatedAt: number;
  blob: EncBlob; // encrypted body
  daily: boolean; // true for DD-MMM-YYYY daily notes
  day: string | null; // ISO date for daily notes
  pinned?: boolean;
  attachments?: Attachment[];
}

export interface Pause {
  at: number;
  resumeAt: number | null;
}

export interface Session {
  id: string;
  taskId: string | null; // null = break
  subtaskId: string | null;
  mode: TimerMode | "break";
  startedAt: number;
  endedAt: number | null;
  plannedMin: number | null;
  pauses: Pause[];
  status: "running" | "done" | "stopped";
}

export interface DayLog {
  energy: number | null; // 1..5
  moodEmoji: string | null;
  mood: string;
  updatedAt: number | null;
}

/** Theme tokens the user can override individually (all contrast-checked). */
export type TokenKey = "text" | "mut" | "panel" | "panel2" | "line" | "ok" | "warn" | "danger";

export interface Settings {
  layout: LayoutMode;
  themeMode: ThemeMode;
  accent: string;
  bgDark: string;
  bgLight: string;
  tokens: Partial<Record<TokenKey, string>>; // per-token overrides
  greeting: "every" | "daily";
  profileName: string;
  customQuotes: string[]; // user-defined lines mixed into the launch greeting
  zenPanels: { plan: boolean; timer: boolean; checkin: boolean; insights: boolean };
  uiZoom: number; // 100–200 (%)
  fontPair: FontPair;
  customFontName: string | null; // family name registered from an uploaded font file
  reminderLeadMin: number;
  pomodoroMin: number;
  breakMin: number;
  countdownMin: number;
  notifyEnabled: boolean;
  reportWidgets: Record<string, boolean>;
  shortcuts: Record<string, string>; // action → key (lowercase; "space" for spacebar)
}

export const SHORTCUT_ACTIONS: { action: string; label: string }[] = [
  { action: "newTask", label: "New task" },
  { action: "togglePause", label: "Pause / resume running timer" },
  { action: "openFocus", label: "Go to Focus" },
  { action: "openCalendar", label: "Go to Calendar" },
  { action: "openNotes", label: "Go to Notes" },
  { action: "openDayLog", label: "Go to Day Log" },
  { action: "openReports", label: "Go to Reports" },
  { action: "help", label: "Show shortcut help" },
];
export const DEFAULT_SHORTCUTS: Record<string, string> = {
  newTask: "n",
  togglePause: "space",
  openFocus: "f",
  openCalendar: "c",
  openNotes: "e",
  openDayLog: "d",
  openReports: "r",
  help: "?",
};

export interface Meta {
  createdAt: number;
  lastGreetingDay: string | null;
}

export interface State {
  version: number;
  projects: Project[];
  tasks: Task[];
  habits: Habit[];
  folders: Folder[];
  notes: Note[];
  sessions: Session[];
  dayLogs: Record<string, DayLog>;
  tagColors: Record<string, string>; // tag name (exact casing) → hex colour
  settings: Settings;
  meta: Meta;
}

export const REPORT_WIDGETS: { key: string; label: string; desc: string }[] = [
  { key: "timeOfDay", label: "Time-of-day rhythm", desc: "When during the day you actually work" },
  { key: "projects", label: "Projects breakdown", desc: "Tracked time per project in range" },
  { key: "tags", label: "Tags breakdown", desc: "Tracked time per tag in range" },
  { key: "estimates", label: "Estimate vs actual", desc: "Planned (estimates) vs tracked, clearly labeled" },
  { key: "estimateTasks", label: "Estimate calibration", desc: "Exactly which tasks / projects / tags ran over or under estimate" },
  { key: "streaks", label: "Habit streaks", desc: "Current, longest, shortest and skipping streaks" },
  { key: "energy", label: "Energy & mood", desc: "Daily check-ins across the range" },
  { key: "sessionQuality", label: "Session quality", desc: "Average & longest session, pauses" },
  { key: "weekdays", label: "Busiest weekdays", desc: "When during the week you work most" },
  { key: "topTags", label: "Top tags", desc: "Tracked time attributed via task tags" },
  { key: "insights", label: "Productivity insights", desc: "Auto-generated patterns from your history" },
  { key: "analytics", label: "Productivity analytics", desc: "Weekly focus trend with deltas vs last week" },
];

export const DEFAULT_SETTINGS: Settings = {
  layout: "glass",
  themeMode: "dark",
  accent: "#e8a33d",
  bgDark: "#0f1714",
  bgLight: "#eef1ee",
  tokens: {},
  greeting: "daily",
  profileName: "",
  customQuotes: [],
  zenPanels: { plan: true, timer: true, checkin: true, insights: true },
  uiZoom: 100,
  fontPair: "manrope",
  customFontName: null,
  reminderLeadMin: 10,
  pomodoroMin: 25,
  breakMin: 5,
  countdownMin: 45,
  notifyEnabled: false,
  reportWidgets: {
    timeOfDay: true,
    projects: true,
    tags: true,
    estimates: true,
    streaks: true,
    energy: true,
    sessionQuality: true,
    weekdays: true,
    topTags: true,
    insights: true,
    estimateTasks: true,
    analytics: true,
  },
  shortcuts: { ...DEFAULT_SHORTCUTS },
};

export const STATE_VERSION = 1;

/** Built-in motivational lines mixed with the user's own quotes at launch. */
export const QUOTES: string[] = [
  "Small hours, honestly logged, become a life you can look back on.",
  "You don't find time. You decide what it was for.",
  "Focus is a place. Go there on purpose.",
  "The streak you protect today protects you tomorrow.",
  "Done is a fact. Perfect is a rumour.",
  "What you measure, you can remember. What you remember, you can improve.",
  "One honest block of deep work beats ten busy ones.",
  "Your future self reads this log. Make it worth reading.",
  "Motion is not progress — but progress is motion, logged.",
  "Energy is a budget. Spend it where it compounds.",
  "The calendar is a promise. The log is the receipt.",
  "Show up. Start the timer. Let the record speak.",
  "Rest is a task too — schedule it like you mean it.",
  "A day reviewed is a day twice lived.",
];

/** Google-Font interface pairs (loaded in index.html, applied via CSS vars). */
export const FONT_PAIRS: Record<FontPair, { label: string; family: string }> = {
  manrope: { label: "Manrope (default)", family: "Manrope" },
  sora: { label: "Sora", family: "Sora" },
  outfit: { label: "Outfit", family: "Outfit" },
  plex: { label: "IBM Plex Sans", family: "IBM Plex Sans" },
  jakarta: { label: "Plus Jakarta Sans", family: "Plus Jakarta Sans" },
  nunito: { label: "Nunito Sans", family: "Nunito Sans" },
};
