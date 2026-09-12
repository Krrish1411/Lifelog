import type { Recurrence, Session } from "../types";

/* ---------------- ids ---------------- */
export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* ---------------- dates ---------------- */
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
export function todayIso(): string {
  return isoDate(new Date());
}
export function addDaysIso(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
export function dayNum(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000);
}
export function dayDiff(fromIso: string, toIso: string): number {
  return dayNum(toIso) - dayNum(fromIso);
}
/** Monday-start week start */
export function weekStartIso(iso: string): string {
  const d = parseIso(iso);
  const wd = (d.getDay() + 6) % 7;
  return addDaysIso(iso, -wd);
}
export function listDates(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  let cur = fromIso;
  let guard = 0;
  while (dayNum(cur) <= dayNum(toIso) && guard < 4000) {
    out.push(cur);
    cur = addDaysIso(cur, 1);
    guard++;
  }
  return out;
}

export function safeInt(v: unknown, fallback = 0, min = -Infinity, max = Infinity): number {
  const n = parseInt(String(v ?? ""), 10);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/* ---------------- formatting ---------------- */
export function fmtDur(min: number): string {
  if (min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
export function fmtClock(ts: number, format: "12h" | "24h" = "24h"): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  if (format === "12h") {
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }
  return `${String(h).padStart(2, "0")}:${m}`;
}

export function parseTimeMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0] || "0", 10);
  const m = parseInt(parts[1] || "0", 10);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

export function minutesToTimeStr(totalMin: number): string {
  const normalized = ((totalMin % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Calculates duration between start and end times in minutes.
 * Correctly accounts for overnight schedules (e.g. 23:00 to 07:30 = 510m / 8h 30m).
 */
export function calcDurationBetweenTimes(start: string, end: string): number {
  if (!start || !end) return 0;
  const sMin = parseTimeMinutes(start);
  const eMin = parseTimeMinutes(end);
  let diff = eMin - sMin;
  if (diff <= 0) diff += 1440; // crosses midnight
  return diff;
}

/**
 * Given start time and duration, calculates the end time.
 * e.g. "23:00" + 450m -> "06:30"
 */
export function calcEndTimeFromDuration(start: string, durationMin: number): string {
  if (!start) return "07:00";
  const sMin = parseTimeMinutes(start);
  return minutesToTimeStr(sMin + durationMin);
}

/**
 * Given end time and duration, calculates the start time.
 * e.g. "07:30" - 510m -> "23:00"
 */
export function calcStartTimeFromDuration(end: string, durationMin: number): string {
  if (!end) return "23:00";
  const eMin = parseTimeMinutes(end);
  return minutesToTimeStr(eMin - durationMin);
}

/**
 * Formats a "HH:mm" time string according to 12h or 24h format.
 * e.g. "23:00" -> "11:00 PM" (12h) or "23:00" (24h)
 */
export function fmtTimeStr(timeStr: string, format: "12h" | "24h" = "12h"): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  const h = parseInt(parts[0] || "0", 10);
  const m = parseInt(parts[1] || "0", 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  if (format === "12h") {
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Formats a time range display with duration.
 * e.g. "11:00 PM – 7:30 AM (8h 30m)" or "23:00 – 07:30 (8h 30m)"
 */
export function fmtTimeRange(startTime: string, durationMin: number, format: "12h" | "24h" = "12h"): string {
  if (!startTime) return fmtDur(durationMin);
  const endTime = calcEndTimeFromDuration(startTime, durationMin);
  return `${fmtTimeStr(startTime, format)} – ${fmtTimeStr(endTime, format)} (${fmtDur(durationMin)})`;
}

/**
 * Accurately calculates how many minutes of a task fall on targetDateIso.
 * Properly attributes overnight tasks (such as sleep from 23:00 to 07:00).
 * If logged on targetDate (morning wake-up):
 *   - Evening date (targetDate - 1) gets the evening portion (e.g. 23:00-24:00 = 60m).
 *   - Morning date (targetDate) gets the morning portion (e.g. 00:00-07:00 = 420m).
 */
export function getTaskMinutesForDay(
  task: {
    due: string | null;
    dueTime: string | null;
    durationMin: number;
    estimateMin?: number;
    tags?: string[];
  },
  targetDateIso: string
): number {
  const dur = task.durationMin > 0 ? task.durationMin : (task.estimateMin || 0);
  if (dur <= 0) return 0;
  if (!task.due) return 0;

  // If task has no dueTime, it simply belongs to task.due
  if (!task.dueTime) {
    return task.due === targetDateIso ? dur : 0;
  }

  const startMin = parseTimeMinutes(task.dueTime);
  const endMin = startMin + dur;

  // Does this task cross midnight?
  const isOvernight = endMin > 1440;

  if (!isOvernight) {
    return task.due === targetDateIso ? dur : 0;
  }

  // Crosses midnight!
  const isSleep = task.tags?.includes("sleep");
  let eveningDate = task.due;
  let morningDate = addDaysIso(task.due, 1);

  if (isSleep && startMin >= 1080) {
    // Sleep logged on morning date (wake-up day) with evening start:
    morningDate = task.due;
    eveningDate = addDaysIso(task.due, -1);
  }

  if (targetDateIso === eveningDate) {
    return 1440 - startMin;
  }
  if (targetDateIso === morningDate) {
    return endMin - 1440;
  }

  return 0;
}

export interface TimeClashResult {
  hasConflict: boolean;
  conflictTitle?: string;
  conflictTimeRange?: string;
}

/**
 * Checks if a proposed time block on targetDate clashes with existing sessions or scheduled tasks.
 */
export function checkTimeClash(
  targetDate: string,
  startTime: string,
  durationMin: number,
  tasks: Array<{ id: string; due: string | null; dueTime: string | null; durationMin: number; estimateMin?: number; title: string }>,
  sessions: Session[],
  currentId?: string | null,
  timeFormat: "12h" | "24h" = "12h"
): TimeClashResult {
  if (!targetDate || !startTime || durationMin <= 0) {
    return { hasConflict: false };
  }

  const proposedStart = parseTimeMinutes(startTime);
  const proposedEnd = proposedStart + durationMin;

  // 1. Check existing Focus Sessions on targetDate
  for (const s of sessions) {
    const sDate = isoDate(new Date(s.startedAt));
    if (sDate !== targetDate) continue;
    const sStart = new Date(s.startedAt);
    const sStartMin = sStart.getHours() * 60 + sStart.getMinutes();
    const sDur = Math.max(1, Math.round(sessionMinutes(s)));
    const sEndMin = sStartMin + sDur;

    // Overlap condition: proposedStart < sEndMin && proposedEnd > sStartMin
    if (proposedStart < sEndMin && proposedEnd > sStartMin) {
      const timeRange = fmtTimeRange(minutesToTimeStr(sStartMin), sDur, timeFormat);
      return {
        hasConflict: true,
        conflictTitle: `Focus Session (${s.mode})`,
        conflictTimeRange: timeRange,
      };
    }
  }

  // 2. Check existing tasks/routines with dueTime on targetDate
  for (const t of tasks) {
    if (currentId && t.id === currentId) continue;
    if (t.due !== targetDate || !t.dueTime) continue;
    const tStartMin = parseTimeMinutes(t.dueTime);
    const tDur = Math.max(1, t.durationMin || t.estimateMin || 30);
    const tEndMin = tStartMin + tDur;

    if (proposedStart < tEndMin && proposedEnd > tStartMin) {
      const timeRange = fmtTimeRange(t.dueTime, tDur, timeFormat);
      return {
        hasConflict: true,
        conflictTitle: t.title,
        conflictTimeRange: timeRange,
      };
    }
  }

  return { hasConflict: false };
}

export function fmtDayShort(iso: string): string {
  const d = parseIso(iso);
  const wd = (d.getDay() + 6) % 7;
  return `${WEEKDAYS_SHORT[wd]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function fmtDateLong(d: Date): string {
  const wd = (d.getDay() + 6) % 7;
  const full = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${WEEKDAYS_FULL[wd]}, ${d.getDate()} ${full[d.getMonth()]} ${d.getFullYear()}`;
}
/** Daily note filename format: DD-MMM-YYYY */
export function fmtNoteName(iso: string): string {
  const d = parseIso(iso);
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}
export function greetingFor(hour: number): string {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
export function setPosLabel(n: number): string {
  if (n === -1) return "last";
  return ["first", "second", "third", "fourth"][n - 1] || `${n}th`;
}

/* ---------------- recurrence engine (RRULE-style) ---------------- */
function matchesRecurrence(dIso: string, anchorIso: string, r: Recurrence): boolean {
  const d = parseIso(dIso);
  const diff = dayDiff(anchorIso, dIso);
  const iv = Math.max(1, r.interval);
  if (r.freq === "daily") return diff % iv === 0;
  if (r.freq === "weekly") {
    const anchorMonday = weekStartIso(anchorIso);
    const targetMonday = weekStartIso(dIso);
    const weeksDiff = Math.round(dayDiff(anchorMonday, targetMonday) / 7);
    if (weeksDiff < 0 || weeksDiff % iv !== 0) return false;
    const wd = (d.getDay() + 6) % 7;
    return r.byWeekday.length === 0 || r.byWeekday.includes(wd);
  }
  const anchor = parseIso(anchorIso);
  const mDiff = (d.getFullYear() - anchor.getFullYear()) * 12 + (d.getMonth() - anchor.getMonth());
  if (mDiff <= 0 || mDiff % iv !== 0) return false;
  if (r.monthMode === "day") return d.getDate() === r.byMonthDay;
  const wd = (d.getDay() + 6) % 7;
  if (!r.byWeekday.includes(wd)) return false;
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  if (r.setPos === -1) {
    return daysInMonth - d.getDate() < 7; // the last such weekday of the month
  }
  return Math.floor((d.getDate() - 1) / 7) + 1 === r.setPos;
}

/** Next occurrence strictly after the anchor date. */
export function nextOccurrence(anchorIso: string, r: Recurrence): string {
  const limit = 31 * Math.max(1, r.interval) * 14 + 420;
  let cur = addDaysIso(anchorIso, 1);
  for (let i = 0; i < limit; i++) {
    if (matchesRecurrence(cur, anchorIso, r)) return cur;
    cur = addDaysIso(cur, 1);
  }
  return addDaysIso(anchorIso, 30);
}

export function describeRecurrence(r: Recurrence | null): string {
  if (!r) return "Once";
  const iv = Math.max(1, r.interval);
  if (r.freq === "daily") return iv === 1 ? "Every day" : `Every ${iv} days`;
  if (r.freq === "weekly") {
    const days = [...r.byWeekday].sort((a, b) => a - b).map((w) => WEEKDAYS_SHORT[w]).join(" · ");
    if (iv === 1) return days ? `Every ${days}` : "Every week";
    return days ? `Every ${iv} wks on ${days}` : `Every ${iv} weeks`;
  }
  if (r.monthMode === "day") {
    return iv === 1 ? `Monthly on day ${r.byMonthDay}` : `Every ${iv} months on day ${r.byMonthDay}`;
  }
  const day = WEEKDAYS_FULL[r.byWeekday[0] ?? 0];
  return iv === 1
    ? `The ${setPosLabel(r.setPos)} ${day} of the month`
    : `Every ${iv} months, the ${setPosLabel(r.setPos)} ${day}`;
}

/* ---------------- streak math ---------------- */
export interface StreakStats {
  current: number;
  longest: number;
  shortest: number;
  longestGap: number; // longest skipping streak
  total: number;
}
export function streakStats(dates: string[]): StreakStats {
  const nums = [...new Set(dates)].map(dayNum).sort((a, b) => a - b);
  if (nums.length === 0) return { current: 0, longest: 0, shortest: 0, longestGap: 0, total: 0 };
  const runs: number[] = [];
  let run = 1;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1] + 1) run++;
    else {
      runs.push(run);
      run = 1;
    }
  }
  runs.push(run);
  let longestGap = 0;
  for (let i = 1; i < nums.length; i++) longestGap = Math.max(longestGap, nums[i] - nums[i - 1] - 1);
  const today = dayNum(todayIso());
  const last = nums[nums.length - 1];
  let current = 0;
  if (last === today || last === today - 1) {
    current = 1;
    for (let i = nums.length - 2; i >= 0; i--) {
      if (nums[i] === nums[i + 1] - 1) current++;
      else break;
    }
  }
  return {
    current,
    longest: Math.max(...runs),
    shortest: Math.min(...runs),
    longestGap,
    total: nums.length,
  };
}

/* ---------------- color & contrast (WCAG) ---------------- */
export function normalizeHex(v: string): string | null {
  let s = v.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(s)) s = s.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return "#" + s.toLowerCase();
}
function hexRgb(hex: string): [number, number, number] {
  const n = normalizeHex(hex) ?? "#000000";
  return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)];
}
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexRgb(a);
  const [br, bg, bb] = hexRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return (
    "#" +
    [c(ar, br), c(ag, bg), c(ab, bb)].map((x) => x.toString(16).padStart(2, "0")).join("")
  );
}
export function luminance(hex: string): number {
  const [r, g, b] = hexRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
/** Black-ish or off-white text, whichever reads better on `bg`. */
export function readableOn(bg: string): string {
  return contrast("#101312", bg) >= contrast("#f4f6f4", bg) ? "#101312" : "#f4f6f4";
}
/** Nudge `fg` toward white/black until it passes `target` contrast on `bg`. */
export function ensureContrast(fg: string, bg: string, target = 4.5): string {
  let cur = normalizeHex(fg) ?? "#888888";
  const toward = luminance(bg) > 0.4 ? "#000000" : "#ffffff";
  for (let i = 0; i < 60 && contrast(cur, bg) < target; i++) cur = mix(cur, toward, 0.12);
  return cur;
}

/* ---------------- sessions / time math ---------------- */
export function sessionMinutes(s: Session, now = Date.now()): number {
  return Math.round(sessionSeconds(s, now) / 60);
}
/** Exact elapsed seconds of a session, honouring pauses (works mid-session). */
export function sessionSeconds(s: Session, now = Date.now()): number {
  const end = s.endedAt ?? now;
  let ms = end - s.startedAt;
  for (const p of s.pauses) {
    const r = p.resumeAt ?? end;
    ms -= Math.max(0, Math.min(r, end) - p.at);
  }
  return Math.max(0, Math.floor(ms / 1000));
}
export function fmtHMS(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
/** Stable colour for a tag name (hash → palette), so every tag keeps its own hue. */
export function tagColor(tag: string): string {
  const palette = ["#e8a33d", "#d66853", "#6fbf8e", "#4fa3a5", "#7f9cd6", "#c079b8", "#a3b34f", "#d98fb0", "#5fb3d9", "#b3a06f", "#8fd0c5", "#c98a6b"];
  let h = 0;
  const key = tag.toLowerCase();
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
export function trackedByDay(sessions: Session[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sessions) {
    if (s.taskId === null) continue; // breaks don't count as work
    const key = isoDate(new Date(s.startedAt));
    map.set(key, (map.get(key) ?? 0) + sessionMinutes(s));
  }
  return map;
}
export function minutesInRange(sessions: Session[], fromIso: string, toIso: string): number {
  let total = 0;
  for (const s of sessions) {
    if (s.taskId === null) continue;
    const key = isoDate(new Date(s.startedAt));
    if (dayNum(key) >= dayNum(fromIso) && dayNum(key) <= dayNum(toIso)) total += sessionMinutes(s);
  }
  return total;
}

/* ---------------- misc ---------------- */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
export function download(filename: string, content: string, mime = "application/json"): void {
  const blob = new Blob([content], { type: mime });

  // On native mobile platforms (Android WebView), support system share/save sheet
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      const file = new File([blob], filename, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: filename,
        }).catch(() => {});
        return;
      }
    } catch {}
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
