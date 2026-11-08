import { expect, test } from "vitest";
import { listProgress, longestSinceMade, sinceMadeLabel } from "../../../../src/domain/home/home";
import { nightsPlanned, type PlanDay, planEntrySchema } from "../../../../src/domain/plan/plan";
import { noFacets, type RecipeSummary, type WeekPart } from "../../../../src/domain/recipes/recipe";
import type { ShoppingItem } from "../../../../src/domain/shopping/shopping";

const TODAY = "2026-09-16";

const recipe = (name: string, week: WeekPart | null, lastMade: string | null) =>
  ({ id: name, name, facets: { ...noFacets(), week: week === null ? [] : [week] }, lastMade }) as RecipeSummary;
const made = (date: string) => `${date}T00:00:00.000Z`;

test("nightsPlanned counts the days with anything on them, not the entries", () => {
  const entry = (n: number) => planEntrySchema.parse({ id: `99999999-9999-4999-8999-${String(n).padStart(12, "0")}`, date: TODAY, position: n, text: "Soup" });
  const days: PlanDay[] = [
    { date: "2026-09-14", entries: [entry(1), entry(2)] },
    { date: "2026-09-15", entries: [] },
    { date: "2026-09-16", entries: [entry(3)] },
  ];
  expect(nightsPlanned(days)).toBe(2);
});

test("listProgress counts the ticked lines against the whole list", () => {
  const items = [{ ticked: true }, { ticked: false }, { ticked: false }] as ShoppingItem[];
  expect(listProgress(items)).toEqual({ ticked: 1, total: 3 });
  expect(listProgress([])).toEqual({ ticked: 0, total: 0 });
});

test("longestSinceMade is the rotation only: never made first, then the oldest, leaving out the last fortnight", () => {
  const list = [
    recipe("New regular", "weeknight", null),
    recipe("Weekend roast", "weekend", made("2025-01-01")),
    recipe("Unmarked", null, made("2025-01-01")),
    recipe("Last month", "weeknight", made("2026-08-16")),
    recipe("Last week", "weeknight", made("2026-09-09")),
    recipe("Last year", "weeknight", made("2025-09-01")),
  ];
  expect(longestSinceMade(list, TODAY, 10).map((r) => r.name)).toEqual(["New regular", "Last year", "Last month"]);
  expect(longestSinceMade(list, TODAY, 2).map((r) => r.name)).toEqual(["New regular", "Last year"]);
  expect(longestSinceMade([], TODAY, 4)).toEqual([]);
});

test("a recipe made exactly a fortnight ago has been a while", () => {
  expect(longestSinceMade([recipe("Two weeks", "weeknight", made("2026-09-02"))], TODAY, 4)).toHaveLength(1);
  expect(longestSinceMade([recipe("Thirteen days", "weeknight", made("2026-09-03"))], TODAY, 4)).toHaveLength(0);
});

test("sinceMadeLabel says how long in the largest unit that reads naturally, as the plan's shelf does", () => {
  expect(sinceMadeLabel(null, TODAY)).toBe("Not made yet");
  expect(sinceMadeLabel(made("2026-09-16"), TODAY)).toBe("Today");
  expect(sinceMadeLabel(made("2026-09-12"), TODAY)).toBe("4 days ago");
  expect(sinceMadeLabel(made("2026-08-19"), TODAY)).toBe("4 weeks ago");
  expect(sinceMadeLabel(made("2026-06-16"), TODAY)).toBe("3 months ago");
  expect(sinceMadeLabel(made("2025-09-01"), TODAY)).toBe("A year ago");
  expect(sinceMadeLabel(made("2023-09-01"), TODAY)).toBe("3 years ago");
  // A cook logged later in the day than "today" began is today, never in the future.
  expect(sinceMadeLabel("2026-09-16T20:00:00.000Z", TODAY)).toBe("Today");
});
