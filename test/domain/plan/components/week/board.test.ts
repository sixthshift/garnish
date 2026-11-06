// The desktop board's pure parts (decisions.md row 207): where a dropped entry
// lands, what each week is called, the shelf's tabs and its "made … ago".
import { describe, expect, test } from "vitest";
import { boardWeekTitle } from "../../../../../src/domain/plan/components/week/desktop/BoardWeek";
import { dropPosition } from "../../../../../src/domain/plan/components/week/desktop/PlanBoard";
import { madeAgo, openingTab, shelfTab } from "../../../../../src/domain/plan/components/week/shelf";
import { type PlanDay, planEntrySchema, rangeLabel } from "../../../../../src/domain/plan/plan";
import type { RecipeSummary } from "../../../../../src/domain/recipes/recipe";

const entry = (n: number, date = "2026-09-14") =>
  planEntrySchema.parse({ id: `99999999-9999-4999-8999-${String(n).padStart(12, "0")}`, date, position: n, text: `e${n}` });
const monday: PlanDay = { date: "2026-09-14", entries: [entry(0), entry(1), entry(2)] };

describe("dropPosition", () => {
  test("another day's entry lands where it is dropped, or at the end", () => {
    const other = entry(9, "2026-09-15");
    expect(dropPosition(monday, other, 1)).toBe(1);
    expect(dropPosition(monday, other, null)).toBe(3);
  });

  test("within its own day, a place after itself counts the day without it", () => {
    expect(dropPosition(monday, monday.entries[0]!, 2)).toBe(1);
    expect(dropPosition(monday, monday.entries[0]!, null)).toBe(2);
    expect(dropPosition(monday, monday.entries[2]!, 0)).toBe(0);
  });

  test("a drop where it already is moves nothing", () => {
    expect(dropPosition(monday, monday.entries[1]!, 1)).toBeNull();
    expect(dropPosition(monday, monday.entries[1]!, 2)).toBeNull();
    expect(dropPosition(monday, monday.entries[2]!, null)).toBeNull();
  });
});

test("boardWeekTitle names this, next and last week, and any other by its dates", () => {
  const today = "2026-09-16";
  expect(boardWeekTitle("2026-09-14", today)).toBe("This week");
  expect(boardWeekTitle("2026-09-21", today)).toBe("Next week");
  expect(boardWeekTitle("2026-09-07", today)).toBe("Last week");
  expect(boardWeekTitle("2026-09-28", today)).toBe("Week of 28 Sep – 4 Oct 2026");
});

test("rangeLabel says two weeks the way weekLabel says one", () => {
  expect(rangeLabel("2026-09-14", "2026-09-27")).toBe("14 – 27 Sep 2026");
  expect(rangeLabel("2026-09-28", "2026-10-11")).toBe("28 Sep – 11 Oct 2026");
  expect(rangeLabel("2026-12-28", "2027-01-10")).toBe("28 Dec 2026 – 10 Jan 2027");
});

describe("the shelf", () => {
  const r = (name: string, kind: RecipeSummary["kind"], lastMade: string | null) => ({ name, kind, lastMade }) as RecipeSummary;
  const recipes = [
    r("Tacos", "rotation", "2026-09-10T00:00:00.000Z"),
    r("Dal", "rotation", "2026-08-01T00:00:00.000Z"),
    r("Lamb", "weekend", null),
    r("Bread", null, null),
  ];

  test("Rotation and Weekend are the marked kinds, longest since made first; To try is never made; All is by name", () => {
    expect(shelfTab(recipes, "rotation").map((x) => x.name)).toEqual(["Dal", "Tacos"]);
    expect(shelfTab(recipes, "weekend").map((x) => x.name)).toEqual(["Lamb"]);
    expect(shelfTab(recipes, "try").map((x) => x.name)).toEqual(["Lamb", "Bread"]);
    expect(shelfTab(recipes, "all").map((x) => x.name)).toEqual(["Bread", "Dal", "Lamb", "Tacos"]);
  });

  test("the shelf opens on the first tab with a recipe on it, Rotation while they load", () => {
    expect(openingTab(recipes)).toBe("rotation");
    expect(openingTab(recipes.filter((x) => x.kind !== "rotation"))).toBe("weekend");
    expect(openingTab([r("Bread", null, "2026-09-01T00:00:00.000Z")])).toBe("all");
    expect(openingTab(null)).toBe("rotation");
  });

  test("madeAgo says how long since, in the unit that reads easiest", () => {
    const today = "2026-09-16";
    expect(madeAgo(null, today)).toBe("never made");
    expect(madeAgo("2026-09-16T08:00:00.000Z", today)).toBe("made today");
    expect(madeAgo("2026-09-15T08:00:00.000Z", today)).toBe("made yesterday");
    expect(madeAgo("2026-09-06T08:00:00.000Z", today)).toBe("made 10 days ago");
    expect(madeAgo("2026-08-19T08:00:00.000Z", today)).toBe("made 4 weeks ago");
    expect(madeAgo("2026-03-16T08:00:00.000Z", today)).toBe("made 6 months ago");
    expect(madeAgo("2023-09-16T08:00:00.000Z", today)).toBe("made 3 years ago");
  });
});
