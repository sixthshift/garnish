// The meal plan document: its date arithmetic, the week layout, and what the
// write schemas accept and refuse.
import { describe, expect, test } from "vitest";
import {
  addDays,
  dayLabel,
  entryLabel,
  isToday,
  reorderMove,
  servingsLabel,
  todayIso,
  weekLabel,
  weekMonday,
  groupByDay,
  isoDate,
  mondayOf,
  planDaySchema,
  planEntryInputSchema,
  planEntryPatchSchema,
  planEntrySchema,
  planWeekAdditions,
  weekDates,
  type PlanDay,
  type PlanEntry,
} from "../../../src/domain/plan/plan";
import { recipeSchema, type Recipe } from "../../../src/domain/recipe/recipe";

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

// --- Labels (M33.2) ----------------------------------------------------------

test.each([
  ["2026-09-14", "Mon 14 Sep"],
  ["2026-09-20", "Sun 20 Sep"],
  ["2027-01-01", "Fri 1 Jan"],
])("dayLabel(%s) is %s", (date, expected) => {
  expect(dayLabel(date)).toBe(expected);
});

test.each([
  ["2026-09-14", "14 – 20 Sep 2026"], // inside one month
  ["2026-09-28", "28 Sep – 4 Oct 2026"], // across two
  ["2026-12-28", "28 Dec 2026 – 3 Jan 2027"], // across New Year
])("weekLabel(%s) is %s", (monday, expected) => {
  expect(weekLabel(monday)).toBe(expected);
});

test("todayIso reads the local calendar date, not the UTC one", () => {
  // Built from local parts, so this holds wherever the container thinks it is.
  const at = new Date(2026, 8, 14, 9, 30);
  expect(todayIso(at)).toBe("2026-09-14");
  expect(todayIso(new Date(2026, 0, 5))).toBe("2026-01-05");
});

test("isToday marks one day of the week and no other", () => {
  const today = "2026-09-16";
  expect(weekDates("2026-09-14").filter((date) => isToday(date, today))).toEqual([today]);
});

test.each([
  ["2026-09-16", "2026-09-14"], // mid-week normalises to its Monday
  ["2026-09-14", "2026-09-14"], // a Monday is left alone
  [undefined, "2026-09-14"], // no param: the week containing today
  ["nonsense", "2026-09-14"], // and so is a param that is not a date
  ["2026-02-30", "2026-09-14"], // ... or is one that does not exist
])("weekMonday(%s) is %s", (week, expected) => {
  expect(weekMonday(week, "2026-09-16")).toBe(expected);
});

test("entryLabel prefers the live recipe and falls back to the copied name", () => {
  const recipe = { id: ids.recipe, slug: "lemon-tart", name: "Lemon tart", image: null };
  // A recipe entry copies its name into `text`; a rename shows through anyway.
  expect(entryLabel({ recipe: { ...recipe, name: "Lemon tart (new)" }, text: "Lemon tart" })).toBe("Lemon tart (new)");
  // The recipe is deleted, `recipe_id` goes null, and the day still reads.
  expect(entryLabel({ recipe: null, text: "Lemon tart" })).toBe("Lemon tart");
  expect(entryLabel({ recipe: null, text: "Leftovers" })).toBe("Leftovers");
});

test.each([
  [null, ""],
  [4, "serves 4"],
  [2.5, "serves 2.5"],
  [1, "serves 1"],
])("servingsLabel(%s) is '%s'", (servings, expected) => {
  expect(servingsLabel(servings)).toBe(expected);
});

describe("reorderMove", () => {
  test("an unchanged order is not a move", () => {
    expect(reorderMove(["a", "b", "c"], ["a", "b", "c"])).toBeNull();
    expect(reorderMove([], [])).toBeNull();
  });

  test("a row dragged down reports itself and where it landed", () => {
    expect(reorderMove(["a", "b", "c"], ["b", "c", "a"])).toEqual({ id: "a", position: 2 });
    expect(reorderMove(["a", "b", "c"], ["b", "a", "c"])).toEqual({ id: "a", position: 1 });
  });

  test("a row dragged up reports itself and where it landed", () => {
    expect(reorderMove(["a", "b", "c"], ["c", "a", "b"])).toEqual({ id: "c", position: 0 });
    expect(reorderMove(["a", "b", "c", "d"], ["c", "a", "b", "d"])).toEqual({ id: "c", position: 0 });
  });

  test("a swap of two neighbours is read as the first one moving down", () => {
    // Either reading produces the same order, so the ambiguity is harmless;
    // this pins which one the page sends.
    expect(reorderMove(["a", "b", "c", "d"], ["a", "c", "b", "d"])).toEqual({ id: "b", position: 2 });
  });

  test("arrays of different lengths are not a reorder", () => {
    expect(reorderMove(["a", "b"], ["a"])).toBeNull();
  });
});

// --- planWeekAdditions (M33.3) ------------------------------------------------

const gram = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  standardQuantity: null,
  standardUnitId: null,
};

const flour = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "flour", pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false, conversions: [] };
const garlic = { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", name: "garlic", pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: true, conversions: [] };
const butter = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "butter", pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false, conversions: [] };

const planStamp = "2026-09-13T00:00:00.000Z";

/** The tart already scaled to `recipeServings`, as `getRecipe({ servings })` would return it. */
function tartDoc(recipeServings: number): Recipe {
  return recipeSchema.parse({
    id: "44444444-4444-4444-8444-444444444444",
    slug: "lemon-tart",
    name: "Lemon tart",
    recipeServings,
    parts: [
      {
        id: "90000000-0000-4000-8000-000000000001",
        name: "",
        ingredients: [
          { id: "a0000000-0000-4000-8000-000000000001", quantity: 200, unit: gram, food: flour },
          { id: "a0000000-0000-4000-8000-000000000002", quantity: 1, unit: null, food: garlic },
        ],
      },
    ],
    createdAt: planStamp,
    updatedAt: planStamp,
  }) as Recipe;
}

/** A second recipe, already scaled to `recipeServings`. */
function soupDoc(recipeServings: number): Recipe {
  return recipeSchema.parse({
    id: "55555555-5555-4555-8555-555555555555",
    slug: "soup",
    name: "Soup",
    recipeServings,
    parts: [
      {
        id: "90000000-0000-4000-8000-000000000002",
        name: "Broth",
        ingredients: [{ id: "b0000000-0000-4000-8000-000000000001", quantity: 500, unit: gram, food: butter }],
      },
    ],
    createdAt: planStamp,
    updatedAt: planStamp,
  }) as Recipe;
}

describe("planWeekAdditions", () => {
  const MONDAY = "2026-09-14";
  const TUESDAY = "2026-09-15";
  const WEDNESDAY = "2026-09-16";

  const tartRef = { id: "44444444-4444-4444-8444-444444444444", slug: "lemon-tart", name: "Lemon tart", image: null };
  const soupRef = { id: "55555555-5555-4555-8555-555555555555", slug: "soup", name: "Soup", image: null };

  const tartEntry = entry(MONDAY, 0, { id: "99999999-9999-4999-8999-000000000001", recipe: tartRef, text: "Lemon tart", servings: null });
  const soupEntry = entry(TUESDAY, 0, { id: "99999999-9999-4999-8999-000000000002", recipe: soupRef, text: "Soup", servings: 8 });
  const textEntry = entry(WEDNESDAY, 0, { id: "99999999-9999-4999-8999-000000000003", recipe: null, text: "Leftovers" });

  const days: PlanDay[] = [
    { date: MONDAY, entries: [tartEntry] },
    { date: TUESDAY, entries: [soupEntry] },
    { date: WEDNESDAY, entries: [textEntry] },
  ];

  test("a week with two recipes and a text line becomes their ingredients and one free-text line, each stamped with its day", () => {
    // The tart at its own 4 servings (the entry left servings unset); the soup
    // at the 8 the entry asked for.
    const recipesByEntry = new Map<string, Recipe>([
      [tartEntry.id, tartDoc(4)],
      [soupEntry.id, soupDoc(8)],
    ]);

    const additions = planWeekAdditions(days, recipesByEntry);

    expect(additions).toHaveLength(3); // flour, butter and the text line — garlic is skipShopping and dropped

    expect(additions[0]).toMatchObject({
      quantity: 200,
      unit: gram,
      food: flour,
      fixed: false,
      source: { recipeId: tartRef.id, recipeName: "Lemon tart", partName: dayLabel(MONDAY), servings: 4 },
    });

    expect(additions[1]).toMatchObject({
      quantity: 500,
      unit: gram,
      food: butter,
      fixed: false,
      source: { recipeId: soupRef.id, recipeName: "Soup", partName: dayLabel(TUESDAY), servings: 8 },
    });

    expect(additions[2]).toEqual({
      quantity: null,
      unit: null,
      food: null,
      originalText: "Leftovers",
      fixed: false,
      source: { recipeId: null, recipeName: "", partName: dayLabel(WEDNESDAY), servings: null },
    });
  });

  test("a blank text entry contributes nothing", () => {
    const blank = entry(MONDAY, 1, { id: "99999999-9999-4999-8999-000000000004", recipe: null, text: "   " });
    expect(planWeekAdditions([{ date: MONDAY, entries: [blank] }], new Map())).toEqual([]);
  });

  test("a recipe entry with no fetched document contributes nothing", () => {
    expect(planWeekAdditions([{ date: MONDAY, entries: [tartEntry] }], new Map())).toEqual([]);
  });
});
