// Calendar arithmetic on YYYY-MM-DD strings, in UTC so the household and the container agree on which day a string names.

import { isoDate, isRealDate } from "./schema";

/** Midnight UTC of a `YYYY-MM-DD` string. Throws on a string that is not one. */
export function utc(date: string): Date {
  if (!isRealDate(date)) throw new Error(`not a date: ${date}`);
  return new Date(`${date}T00:00:00Z`);
}

/** `YYYY-MM-DD` of a UTC instant. */
function iso(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** The date `days` after `date` (negative goes back). Crosses months and years. */
export function addDays(date: string, days: number): string {
  const at = utc(date);
  at.setUTCDate(at.getUTCDate() + days);
  return iso(at);
}

/**
 * The Monday of the week containing `date`. The week starts on Monday, which is
 * what an en-AU calendar does and what Mealie's plan does; a Sunday belongs to
 * the week that began six days earlier.
 */
export function mondayOf(date: string): string {
  const at = utc(date);
  const weekday = at.getUTCDay(); // 0 Sunday.. 6 Saturday
  return addDays(date, weekday === 0 ? -6 : 1 - weekday);
}

/** The seven dates of the week beginning `monday`, Monday first. */
export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * Today as the household sees it, `YYYY-MM-DD`. Local rather than UTC: the
 * arithmetic above is UTC because a date string has no zone, but "today" is a
 * question about the wall clock in the kitchen, and in Melbourne the UTC date
 * is yesterday for the first ten hours of every day.
 */
export function todayIso(at: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** Whether `date` is the day being lived. Pure; `today` is injectable so tests do not move. */
export function isToday(date: string, today: string = todayIso()): boolean {
  return date === today;
}

/**
 * The Monday the page should show: the `?week=` param when it is a real date
 * (normalised to its Monday, so a mid-week link still lands on a whole week),
 * and the week containing `today` otherwise.
 */
export function weekMonday(week: string | undefined, today: string = todayIso()): string {
  return mondayOf(week !== undefined && isoDate.safeParse(week).success ? week : today);
}
