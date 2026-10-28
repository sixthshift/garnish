import { expect, test } from "vitest";
import { type PlanDay, planEntrySchema } from "../../../../src/domain/plan";
import type { RecipeSummary } from "../../../../src/domain/recipe";
import { entryCount, isWeekend, nextMonday, todayTitle, tonightEntry, toTry } from "../../../../src/routes/home/components/today";

const DAY = "2026-09-16";
const recipe = { id: "11111111-1111-4111-8111-111111111111", slug: "lemon-tart", name: "Lemon tart", image: null };

let n = 0;
function entry(over: Record<string, unknown> = {}) {
  n += 1;
  return planEntrySchema.parse({ id: `99999999-9999-4999-8999-${String(n).padStart(12, "0")}`, date: DAY, position: n, ...over });
}

test("tonight is the day's dinner when one is marked, wherever it sits", () => {
  const dinner = entry({ text: "Soup", meal: "dinner" });
  const day: PlanDay = { date: DAY, entries: [dinner, entry({ recipe, text: "Lemon tart" })] };
  expect(tonightEntry(day)).toBe(dinner);
});

test("with no dinner marked, tonight is the last recipe entry, else the last line", () => {
  const tart = entry({ recipe, text: "Lemon tart" });
  expect(tonightEntry({ date: DAY, entries: [tart, entry({ text: "Leftovers" })] })).toBe(tart);
  const last = entry({ text: "Eating out" });
  expect(tonightEntry({ date: DAY, entries: [entry({ text: "Toast" }), last] })).toBe(last);
});

test("an empty or missing day has no tonight", () => {
  expect(tonightEntry({ date: DAY, entries: [] })).toBeNull();
  expect(tonightEntry(undefined)).toBeNull();
});

test("the weekend is Saturday and Sunday", () => {
  expect(["2026-09-14", "2026-09-18", "2026-09-19", "2026-09-20"].map(isWeekend)).toEqual([false, false, true, true]);
});

test("entryCount counts across the week", () => {
  expect(
    entryCount([
      { date: DAY, entries: [entry({ text: "a" }), entry({ text: "b" })] },
      { date: "2026-09-17", entries: [] },
    ])
  ).toBe(2);
});

test("toTry keeps the never-made recipes, in the order given, up to the limit", () => {
  const summary = (name: string, lastMade: string | null) => ({ name, lastMade }) as RecipeSummary;
  const list = [summary("A", null), summary("B", "2026-09-01T00:00:00.000Z"), summary("C", null), summary("D", null)];
  expect(toTry(list, 2).map((r) => r.name)).toEqual(["A", "C"]);
});

test("todayTitle splits the day's full name into the title and the line under it", () => {
  expect(todayTitle(DAY)).toEqual({ weekday: "Wednesday", date: "16 September" });
});

test("nextMonday is seven days on", () => {
  expect(nextMonday("2026-09-14")).toBe("2026-09-21");
});
