// All dates are local calendar dates as "YYYY-MM-DD" strings (no timezone drift).

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = fromISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Monday of the week containing the date */
export function weekStart(s: string): string {
  const d = fromISODate(s);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

export function today(): string {
  return toISODate(new Date());
}

/** On Sundays you plan the coming week, so default to next week. */
export function defaultPlanningWeek(): string {
  const d = new Date();
  const t = toISODate(d);
  return d.getDay() === 0 ? addDays(weekStart(t), 7) : weekStart(t);
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isoWeekNumber(s: string): number {
  const d = fromISODate(s);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.valueOf() - firstThursday.valueOf();
  return 1 + Math.round((diff / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const DAY_LONG = new Intl.DateTimeFormat("en-GB", { weekday: "long" });
const DM = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

export function fmtDay(s: string) {
  return DAY.format(fromISODate(s));
}
export function fmtDayLong(s: string) {
  return DAY_LONG.format(fromISODate(s));
}
export function fmtDM(s: string) {
  return DM.format(fromISODate(s));
}
export function fmtWeekRange(start: string) {
  return `${fmtDM(start)} – ${fmtDM(addDays(start, 6))}`;
}

export function daysAgo(s: string): number {
  return Math.round((fromISODate(today()).valueOf() - fromISODate(s).valueOf()) / 86400000);
}
