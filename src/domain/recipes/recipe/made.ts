/**
 * How long since a recipe was last made, said one way wherever it is shown:
 * Home's "Haven't made in a while" and the plan's shelf (decisions.md rows
 * 207 and 208). Each place frames it ("made 3 weeks ago", "3 weeks ago");
 * the units and their thresholds are this file's alone. Pure.
 */

/** Whole days from the date part of `lastMade` to `today`, both `YYYY-MM-DD` in UTC as the plan's arithmetic is; never below 0. */
export function daysSinceMade(lastMade: string, today: string): number {
  return Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastMade.slice(0, 10)}T00:00:00Z`)) / 86_400_000));
}

/**
 * "today", "yesterday", "10 days ago", "4 weeks ago", "6 months ago", "a year
 * ago", "3 years ago", in the largest unit that still reads naturally; null
 * when it has never been made, which each place says its own way.
 */
export function sinceMade(lastMade: string | null, today: string): string | null {
  if (lastMade === null) return null;
  const days = daysSinceMade(lastMade, today);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 61) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30.44)} months ago`;
  const years = Math.floor(days / 365.25);
  return years <= 1 ? "a year ago" : `${years} years ago`;
}
