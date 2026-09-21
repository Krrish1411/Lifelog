import type { Habit, Note, Project, Session, State, Task } from "../types";

export const SEED_TASK_TITLES = new Set([
  // Legacy demo tasks
  "hero section redesign",
  "timer engine — pause/resume edge cases",
  "read: deep work — chapter 4",
  "renew domain names",
  "invoice #204 follow-up",
  "weekly review",
  "pay rent",
  "mentor call — monthly",
  "refine calendar drag & drop",
  "copy polish — landing page",
  "kickoff notes & moodboard",
  "prototype focus screen",
  "watch: typescript generics talk",
  "file q3 receipts",
  "accessibility audit — contrast pass",
  "first lifelog sketch on paper",
  // Guided Onboarding tasks
  "welcome to lifelog! complete your first 3-minute setup",
  "explore notes: discover your sovereign second brain",
  "try a 25-minute pomodoro or flow focus session",
  "schedule your afternoon by dragging a task onto the calendar",
  "pair a second device using zero-cloud p2p sync",
  "draft weekly project sprint goals",
  "review client design deliverables",
  "afternoon 20-minute walk & recharge",
  "read 15 pages of non-fiction",
  "installed lifelog v1.0.0 sovereign edition",
  "configured local encrypted vault",
  "explored 5 visual layout engines",
]);

export const SEED_PROJECT_IDS = new Set([
  "p-atlas",
  "p-lifelog",
  "p-home",
  "p-learn",
  "p-onboarding",
  "p-work",
  "p-life",
]);
export const SEED_PROJECT_NAMES = new Set([
  "atlas — client website",
  "lifelog app",
  "home & admin",
  "learning",
  "getting started with lifelog",
  "deep work & projects",
  "personal & wellness",
]);

export const SEED_HABIT_IDS = new Set(["h-read", "h-run", "h-med"]);
export const SEED_HABIT_NAMES = new Set([
  "read 20 pages",
  "morning run",
  "meditate 10 min",
]);

export const SEED_NOTE_TITLES = new Set([
  "app ideas",
  "reading queue",
  "welcome to lifelog: the sovereign workspace guide",
  "power user guide: mentions, wiki-links & shortcuts",
  "zero-cloud architecture & cryptographic sovereignty",
]);

export interface SeedCleanResult {
  cleanedState: State;
  stats: {
    tasksRemoved: number;
    habitsRemoved: number;
    projectsRemoved: number;
    notesRemoved: number;
    sessionsRemoved: number;
  };
}

/**
 * Checks whether a given task is part of the predefined demo/seed set.
 */
export function isSeedTask(t: Task): boolean {
  const normTitle = t.title.trim().toLowerCase();
  if (SEED_TASK_TITLES.has(normTitle)) return true;
  if (SEED_PROJECT_IDS.has(t.projectId) && SEED_TASK_TITLES.has(normTitle)) return true;
  return false;
}

/**
 * Checks whether a given habit is part of the predefined demo/seed set.
 */
export function isSeedHabit(h: Habit): boolean {
  if (SEED_HABIT_IDS.has(h.id)) return true;
  if (SEED_HABIT_NAMES.has(h.name.trim().toLowerCase())) return true;
  return false;
}

/**
 * Checks whether a given project is part of the predefined demo/seed set.
 */
export function isSeedProject(p: Project): boolean {
  if (SEED_PROJECT_IDS.has(p.id)) return true;
  if (SEED_PROJECT_NAMES.has(p.name.trim().toLowerCase())) return true;
  return false;
}

/**
 * Checks whether a given note is part of the predefined demo/seed set.
 */
export function isSeedNote(n: Note): boolean {
  const normTitle = n.title.trim().toLowerCase();
  if (SEED_NOTE_TITLES.has(normTitle)) return true;
  // Check if it's the starter daily note with default demo intentions
  if (n.folderId === "f-daily" && (normTitle.includes("daily note") || normTitle.includes("intentions"))) return true;
  return false;
}

/**
 * Checks if a state is predominantly or entirely default demo/seed data.
 */
export function isFreshSeedState(s: State): boolean {
  if (!s || !s.tasks) return false;
  const customTasks = s.tasks.filter((t) => !isSeedTask(t));
  return customTasks.length === 0 && s.tasks.length > 0;
}

/**
 * Purges all seed tasks, habits, projects, notes, and associated sessions.
 * Preserves all user-created personal tasks, projects, habits, and notes.
 */
export function cleanSeedData(state: State): SeedCleanResult {
  const seedTaskIds = new Set<string>();
  const now = Date.now();
  const removedTaskTombstones: Record<string, number> = {};
  const removedHabitTombstones: Record<string, number> = {};
  const removedProjectTombstones: Record<string, number> = {};
  const removedNoteTombstones: Record<string, number> = {};

  // Filter tasks
  const keptTasks: Task[] = [];
  let tasksRemoved = 0;
  for (const t of state.tasks) {
    if (isSeedTask(t)) {
      seedTaskIds.add(t.id);
      removedTaskTombstones[t.id] = now;
      tasksRemoved++;
    } else {
      keptTasks.push(t);
    }
  }

  // Filter habits
  const keptHabits: Habit[] = [];
  let habitsRemoved = 0;
  for (const h of state.habits) {
    if (isSeedHabit(h)) {
      removedHabitTombstones[h.id] = now;
      habitsRemoved++;
    } else {
      keptHabits.push(h);
    }
  }

  // Filter projects: only remove seed projects if no custom task references them!
  const remainingProjectIds = new Set(keptTasks.map((t) => t.projectId));
  const keptProjects: Project[] = [];
  let projectsRemoved = 0;
  for (const p of state.projects) {
    if (isSeedProject(p) && !remainingProjectIds.has(p.id)) {
      removedProjectTombstones[p.id] = now;
      projectsRemoved++;
    } else {
      keptProjects.push(p);
    }
  }

  // Filter notes
  const keptNotes: Note[] = [];
  let notesRemoved = 0;
  for (const n of state.notes) {
    if (isSeedNote(n)) {
      removedNoteTombstones[n.id] = now;
      notesRemoved++;
    } else {
      keptNotes.push(n);
    }
  }

  // Filter sessions: remove sessions linked to removed seed tasks
  const keptSessions: Session[] = [];
  let sessionsRemoved = 0;
  for (const s of state.sessions) {
    if (s.taskId && seedTaskIds.has(s.taskId)) {
      sessionsRemoved++;
    } else {
      keptSessions.push(s);
    }
  }

  // Reset or filter dayLogs if only demo entries
  const cleanedDayLogs: State["dayLogs"] = {};
  if (state.dayLogs) {
    for (const [day, log] of Object.entries(state.dayLogs)) {
      // If the log was created with empty mood and energy, or default text
      if (log.mood || log.energy !== null || log.moodEmoji) {
        cleanedDayLogs[day] = log;
      }
    }
  }

  const cleanedState: State = {
    ...state,
    tasks: keptTasks,
    habits: keptHabits,
    projects: keptProjects,
    notes: keptNotes,
    sessions: keptSessions,
    dayLogs: cleanedDayLogs,
    deleted: {
      tasks: { ...(state.deleted?.tasks ?? {}), ...removedTaskTombstones },
      habits: { ...(state.deleted?.habits ?? {}), ...removedHabitTombstones },
      projects: { ...(state.deleted?.projects ?? {}), ...removedProjectTombstones },
      notes: { ...(state.deleted?.notes ?? {}), ...removedNoteTombstones },
    },
  };

  return {
    cleanedState,
    stats: {
      tasksRemoved,
      habitsRemoved,
      projectsRemoved,
      notesRemoved,
      sessionsRemoved,
    },
  };
}
