import { todayIso, addDaysIso, parseIso, isoDate } from "./core";
import type { Priority } from "../types";

export interface ParsedTaskInput {
  cleanTitle: string;
  project?: string;
  due?: string | null;
  dueTime?: string | null;
  durationMin?: number;
  priority?: Priority;
  tags?: string[];
  matchedKeywords: string[];
}

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

export function parseNaturalLanguageTask(raw: string): ParsedTaskInput {
  let title = raw;
  const matchedKeywords: string[] = [];
  let project: string | undefined = undefined;
  let due: string | null = null;
  let dueTime: string | null = null;
  let durationMin: number | undefined = undefined;
  let priority: Priority | undefined = undefined;
  const tags: string[] = [];

  // 1. Project: +"Project Name" or +ProjectName
  const quotedProjMatch = title.match(/(?:^|\s)\+["']([^"']+)["']/);
  if (quotedProjMatch) {
    project = quotedProjMatch[1].trim();
    matchedKeywords.push(quotedProjMatch[0].trim());
    title = title.replace(quotedProjMatch[0], " ");
  } else {
    const unquotedProjMatch = title.match(/(?:^|\s)\+([a-zA-Z0-9_\-]+)/);
    if (unquotedProjMatch) {
      project = unquotedProjMatch[1].trim();
      matchedKeywords.push(unquotedProjMatch[0].trim());
      title = title.replace(unquotedProjMatch[0], " ");
    }
  }

  // 2. Priority: !urgent, !high, !med, !medium, !low
  const priorityMatch = title.match(/\b!(urgent|high|med|medium|low)\b/i);
  if (priorityMatch) {
    const rawP = priorityMatch[1].toLowerCase();
    if (rawP === "urgent") priority = "urgent";
    else if (rawP === "high") priority = "high";
    else if (rawP === "med" || rawP === "medium") priority = "medium";
    else if (rawP === "low") priority = "low";
    matchedKeywords.push(priorityMatch[0]);
    title = title.replace(priorityMatch[0], "");
  }

  // 3. Tags: #tag1 #tag-name #work
  const tagMatches = Array.from(title.matchAll(/#([a-zA-Z0-9_\-]+)/g));
  for (const match of tagMatches) {
    tags.push(match[1]);
    matchedKeywords.push(match[0]);
    title = title.replace(match[0], "");
  }

  // 3. Duration: for 90m, for 2h, for 1.5h, 45m, 2h
  const durMatch =
    title.match(/\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours|m|min|mins|minutes)\b/i);
  if (durMatch) {
    const val = parseFloat(durMatch[1]);
    const unit = durMatch[2].toLowerCase();
    if (unit.startsWith("h")) {
      durationMin = Math.round(val * 60);
    } else {
      durationMin = Math.round(val);
    }
    matchedKeywords.push(durMatch[0]);
    title = title.replace(durMatch[0], "");
  }

  // 4. Time: at 2pm, at 2:30pm, at 14:00, 2pm, 10:30am
  const timeMatch = title.match(
    /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i
  ) || title.match(/\bat\s+(\d{1,2}):(\d{2})\b/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3]?.toLowerCase();

    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      dueTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      matchedKeywords.push(timeMatch[0]);
      title = title.replace(timeMatch[0], "");
    }
  }

  // 5. Dates: today, tomorrow, yesterday, in X days, next week, on [weekday]
  const today = todayIso();

  if (/\b(today)\b/i.test(title)) {
    due = today;
    const m = title.match(/\b(today)\b/i)!;
    matchedKeywords.push(m[0]);
    title = title.replace(m[0], "");
  } else if (/\b(tomorrow)\b/i.test(title)) {
    due = addDaysIso(today, 1);
    const m = title.match(/\b(tomorrow)\b/i)!;
    matchedKeywords.push(m[0]);
    title = title.replace(m[0], "");
  } else if (/\b(yesterday)\b/i.test(title)) {
    due = addDaysIso(today, -1);
    const m = title.match(/\b(yesterday)\b/i)!;
    matchedKeywords.push(m[0]);
    title = title.replace(m[0], "");
  } else if (/\bnext\s+week\b/i.test(title)) {
    due = addDaysIso(today, 7);
    const m = title.match(/\bnext\s+week\b/i)!;
    matchedKeywords.push(m[0]);
    title = title.replace(m[0], "");
  } else {
    const inDaysMatch = title.match(/\bin\s+(\d+)\s+days?\b/i);
    if (inDaysMatch) {
      due = addDaysIso(today, parseInt(inDaysMatch[1], 10));
      matchedKeywords.push(inDaysMatch[0]);
      title = title.replace(inDaysMatch[0], "");
    } else {
      const weekdayMatch = title.match(
        /\b(?:on\s+|next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i
      );
      if (weekdayMatch) {
        const targetDay = WEEKDAY_MAP[weekdayMatch[1].toLowerCase()];
        if (targetDay !== undefined) {
          const curDate = parseIso(today);
          const curDay = curDate.getDay(); // 0 is Sunday
          let diff = targetDay - curDay;
          if (diff <= 0) diff += 7; // strictly upcoming
          const nextDate = new Date(curDate);
          nextDate.setDate(curDate.getDate() + diff);
          due = isoDate(nextDate);
          matchedKeywords.push(weekdayMatch[0]);
          title = title.replace(weekdayMatch[0], "");
        }
      }
    }
  }

  // Clean title
  const cleanTitle = title.replace(/\s+/g, " ").trim() || raw.trim();

  return {
    cleanTitle,
    due,
    dueTime,
    durationMin,
    priority,
    tags: tags.length > 0 ? tags : undefined,
    matchedKeywords,
  };
}
