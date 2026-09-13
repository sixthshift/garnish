// The meal plan document: its date arithmetic, the week layout, and what the
// write schemas accept and refuse.
import { expect, test } from "vitest";
import {
  addDays,
  groupByDay,
  isoDate,
  mondayOf,
  planDaySchema,
  planEntryInputSchema,
  planEntryPatchSchema,
  planEntrySchema,
  weekDates,
  type PlanEntry,
} from "../../src/domain/plan";

const ids = {
  a: "11111111-1111-4111-8111-111111111111",
  b: "22222222-2222-4222-8222-222222222222",
  recipe: "33333333-3333-4333-8333-333333333333",
};

function entry(date: string, position: number, over: Partial<PlanEntry> = {}): PlanEntry {
  return { id: ids.a, date, position, recipe: null, text: "Leftovers", servings: null, ...over };
}

// --- Dates -------------------------------------------------------------------

test.each([
  ["2026-09-13", 1, "2026-09-14"],
  ["2026-09-13", -1, "2026-09-12"],
  ["2026-09-30", 1, "2026-10-01"],
  ["2026-12-31", 1, "2027-01-01"],
  ["2027-01-01", -1, "2026-12-31"],
  ["2028-02-28", 1, "2028-02-29"], // leap year
  ["2026-02-28", 1, "2026-03-01"],
  ["2026-09-13", 0, "2026-09-13"],
  ["2026-09-13", 7, "2026-09-20"],
])("addDays(%s, %i) is %s", (date, days, expected) => {
  expect(addDays(date, days)).toBe(expected);
});

test("addDays refuses a string that is not a date", () => {
  expect(() => addDays("not-a-date", 1)).toThrow(/not a date/);
});

test.each([
  ["2026-09-14", "2026-09-14"], // a Monday is its own Monday
  ["2026-09-15", "2026-09-14"], // Tuesday
  ["2026-09-20", "2026-09-14"], // Sunday belongs to the week that began six days earlier
  ["2026-09-13", "2026-09-07"], // the Sunday before
  ["2026-10-01", "2026-09-28"], // across a month
])("mondayOf(%s) is %s", (date, expected) => {
  expect(mondayOf(date)).toBe(expected);
  expect(mondayOf(expected)).toBe(expected);
});

test("weekDates is Monday to Sunday", () => {
  expect(weekDates("2026-09-14")).toEqual([
    "2026-09-14",
    "2026-09-15",
    "2026-09-16",
    "2026-09-17",
    "2026-09-18",
    "2026-09-19",
    "2026-09-20",
  ]);
});

// --- The week layout ---------------------------------------------------------

test("groupByDay lays entries out over seven days, empty ones included", () => {
  const week = groupByDay("2026-09-14", [
    entry("2026-09-16", 0, { text: "Leftovers" }),
    entry("2026-09-14", 0, { id: ids.b, text: "Out" }),
    entry("2026-09-16", 1, { id: ids.b, text: "Pizza" }),
  ]);

  expect(week.map((d) => d.date)).toEqual(weekDates("2026-09-14"));
  expect(week.map((d) => d.entries.map((e) => e.text))).toEqual([["Out"], [], ["Leftovers", "Pizza"], [], [], [], []]);
  expect(week.every((d) => planDaySchema.safeParse(d).success)).toBe(true);
});

test("groupByDay ignores anything outside the week", () => {
  const week = groupByDay("2026-09-14", [entry("2026-09-13", 0), entry("2026-09-21", 0), entry("2026-09-20", 0)]);
  expect(week.flatMap((d) => d.entries)).toHaveLength(1);
  expect(week[6]!.entries[0]!.date).toBe("2026-09-20");
});

test("an empty plan is still seven days", () => {
  expect(groupByDay("2026-09-14", []).map((d) => d.entries)).toEqual([[], [], [], [], [], [], []]);
});

// --- Schemas -----------------------------------------------------------------

test.each(["2026-9-13", "13-09-2026", "2026-13-01", "2026-02-30", "", "today"])("%s is not a date", (value) => {
  expect(isoDate.safeParse(value).success).toBe(false);
});

test("a read entry keeps its nested recipe", () => {
  const parsed = planEntrySchema.parse({
    id: ids.a,
    date: "2026-09-14",
    position: 0,
    recipe: { id: ids.recipe, slug: "lemon-tart", name: "Lemon tart", image: "x.jpg" },
    text: "",
    servings: 4,
  });
  expect(parsed.recipe?.slug).toBe("lemon-tart");
  expect(parsed.servings).toBe(4);
});

test("an input defaults to a plain line with no recipe and no servings", () => {
  expect(planEntryInputSchema.parse({ date: "2026-09-14", text: "Leftovers" })).toEqual({
    date: "2026-09-14",
    recipeId: null,
    text: "Leftovers",
    servings: null,
  });
});

test("an entry needs a recipe or some text", () => {
  expect(planEntryInputSchema.safeParse({ date: "2026-09-14" }).success).toBe(false);
  expect(planEntryInputSchema.safeParse({ date: "2026-09-14", text: "   " }).success).toBe(false);
  expect(planEntryInputSchema.safeParse({ date: "2026-09-14", recipeId: ids.recipe }).success).toBe(true);
});

test("servings must be positive, and the date must be a date", () => {
  expect(planEntryInputSchema.safeParse({ date: "2026-09-14", text: "x", servings: 0 }).success).toBe(false);
  expect(planEntryInputSchema.safeParse({ date: "2026-09-14", text: "x", servings: -2 }).success).toBe(false);
  expect(planEntryInputSchema.safeParse({ date: "Monday", text: "x" }).success).toBe(false);
});

test("a patch leaves absent fields alone and carries no date", () => {
  expect(planEntryPatchSchema.parse({})).toEqual({});
  expect(planEntryPatchSchema.parse({ servings: 6 })).toEqual({ servings: 6 });
  expect(planEntryPatchSchema.parse({ recipeId: null, text: "Out" })).toEqual({ recipeId: null, text: "Out" });
  expect(planEntryPatchSchema.safeParse({ date: "2026-09-15" }).success).toBe(true); // stripped, not rejected
  expect(planEntryPatchSchema.parse({ date: "2026-09-15" } as never)).toEqual({});
});
