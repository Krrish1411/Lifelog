/* Tiny cross-view signal: "open the daily note for this date" */
let dailyIso: string | null = null;
export function requestDailyNote(iso: string): void {
  dailyIso = iso;
}
export function consumeDailyNote(): string | null {
  const v = dailyIso;
  dailyIso = null;
  return v;
}
