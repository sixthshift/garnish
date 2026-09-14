
import { addDays } from "../domain/plan/plan";
// Dates as the app shows and reads them.

/**
 * A timestamp as a date the way en-AU writes one: "11 Sep 2026". Empty for
 * null, blank or an unparseable value, so a missing date renders nothing
 * rather than "Invalid Date". Pure.
 */
export function formatDateStamp(value: string | null): string {
  if (value === null || value.trim() === "") return "";
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(at);
}

/** True for a date the form will accept: a real calendar date in YYYY-MM-DD. Pure. */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const at = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === value;
}

/** The next seven days, today first. Pure over `today`. */
export function nextSevenDays(today: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(today, i));
}

/**
 * Seconds left as a running timer prints them: "m:ss", the minutes not padded
 * and running past 59 for anything over an hour ("90:00"), the seconds always
 * two digits. Negative and fractional inputs clamp and round up, so a timer
 * reads "0:01" right up to the moment it is done. Pure.
 */
export function formatRemaining(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}
