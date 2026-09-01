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
  return Math.round(parseIso(iso).getTime() / 86400000);
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

/* ---------------- formatting ---------------- */
export function fmtDur(min: number): string {
  if (min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
export function fmtClock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
    const wk = Math.floor(diff / 7);
    if (wk % iv !== 0) return false;
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
