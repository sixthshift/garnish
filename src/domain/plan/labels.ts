import { addDays, utc } from "./dates";
import type { PlanEntry } from "./schema";

// Written out rather than `Intl`: these strings name a calendar day with no zone, and ICU's short month names shift between builds ("Sep" vs "Sept" in en-AU).
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** A day's whole name: "Mon 14 Sep". What a menu, an aria-label or a shopping part is given. */
export function dayLabel(date: string): string {
  const parts = dayParts(date);
  return `${parts.weekday} ${parts.day}`;
}

/**
 * The same name in the two lines the plan's date rail stacks: "Mon" over
 * "14 Sep". Split here rather than in the component so nothing outside this
 * file takes a label apart again.
 */
export function dayParts(date: string): { weekday: string; day: string } {
  const at = utc(date);
  return { weekday: WEEKDAYS[at.getUTCDay()] ?? "", day: `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}` };
}

/**
 * The week's span, as short as it can be said: "14 – 20 Sep 2026" inside one
 * month, "28 Sep – 4 Oct 2026" across two, and both years across New Year.
 */
export function weekLabel(monday: string): string {
  const from = utc(monday);
  const to = utc(addDays(monday, 6));
  const part = (at: Date) => `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`;
  if (from.getUTCFullYear() !== to.getUTCFullYear()) {
    return `${part(from)} ${from.getUTCFullYear()} – ${part(to)} ${to.getUTCFullYear()}`;
  }
  if (from.getUTCMonth() !== to.getUTCMonth()) return `${part(from)} – ${part(to)} ${to.getUTCFullYear()}`;
  return `${from.getUTCDate()} – ${part(to)} ${to.getUTCFullYear()}`;
}

/**
 * What an entry reads as. The recipe's name when it still has one, and the
 * entry's own `text` otherwise — which is why adding a recipe copies its name
 * into `text`: a recipe deleted a month later leaves a day that still says
 * what was cooked.
 */
export function entryLabel(entry: Pick<PlanEntry, "recipe" | "text">): string {
  const name = entry.recipe?.name ?? "";
  return name !== "" ? name : entry.text;
}

/** "serves 4" under an entry, or nothing when the recipe's own servings stand. */
export function servingsLabel(servings: number | null): string {
  return servings === null ? "" : `serves ${Number(servings.toFixed(2))}`;
}
