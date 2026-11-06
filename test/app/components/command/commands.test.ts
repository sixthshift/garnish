// The command bar's reading of what was typed (decisions.md row 207): a day at
// the end plans, anything else adds to the shopping list, and the words match
// recipes and places.
import { describe, expect, test } from "vitest";
import {
  buildOptions,
  type CommandRecipe,
  highlight,
  isDayWord,
  matchRecipes,
  parseQuery,
  resolveDay,
  searchTermOf,
  suggestions,
} from "../../../../src/app/components/command/commands";

// A Saturday.
const today = "2026-11-07";

const ragu: CommandRecipe = { id: "00000000-0000-4000-8000-000000000001", slug: "beef-ragu", name: "Slow Cooked Beef Ragu", image: "ragu.jpg" };
const rice: CommandRecipe = { id: "00000000-0000-4000-8000-000000000002", slug: "fried-rice", name: "Chicken Fried Rice", image: null };

describe("day words", () => {
  test("the weekdays, short and whole, and today, tonight and tomorrow, in any case", () => {
    for (const word of ["mon", "Tues", "WED", "thur", "thurs", "friday", "sat", "sun", "tonight", "tomorrow", "today"]) expect(isDayWord(word)).toBe(true);
    for (const word of ["ragu", "milk", "m", "satay", "monday's"]) expect(isDayWord(word)).toBe(false);
  });

  test("a weekday is its next date that is today or later", () => {
    expect(resolveDay("sat", today)).toBe("2026-11-07");
    expect(resolveDay("sun", today)).toBe("2026-11-08");
    expect(resolveDay("tue", today)).toBe("2026-11-10");
    expect(resolveDay("Friday", today)).toBe("2026-11-13");
  });

  test("tonight is today and tomorrow the day after, across a month's end", () => {
    expect(resolveDay("tonight", today)).toBe(today);
    expect(resolveDay("tomorrow", "2026-11-30")).toBe("2026-12-01");
    expect(resolveDay("mon", "2026-12-29")).toBe("2027-01-04");
  });

  test("anything else names no day", () => {
    expect(resolveDay("ragu", today)).toBeNull();
  });
});

describe("parseQuery", () => {
  test("a trailing day comes off the words as a date", () => {
    expect(parseQuery("  Ragu  TUE ", today)).toEqual({ words: ["ragu", "tue"], terms: ["ragu"], date: "2026-11-10" });
  });

  test("a day not at the end is a word like any other", () => {
    expect(parseQuery("sunday roast", today)).toEqual({ words: ["sunday", "roast"], terms: ["sunday", "roast"], date: null });
  });

  test("nothing typed is no words", () => {
    expect(parseQuery("   ", today)).toEqual({ words: [], terms: [], date: null });
  });
});

describe("searching", () => {
  test("asks for the longest term, and keeps the recipes holding every term in any order", () => {
    expect(searchTermOf(["rice", "chicken"])).toBe("chicken");
    expect(searchTermOf([])).toBeNull();
    expect(matchRecipes([ragu, rice], ["rice", "chicken"])).toEqual([rice]);
    expect(matchRecipes([ragu, rice], [])).toEqual([]);
  });
});

describe("buildOptions", () => {
  test("empty: tonight's recipe, plan next week, import, and the places", () => {
    const options = buildOptions({ query: "", today, recipes: [], tonight: [ragu], nextWeek: { monday: "2026-11-09", emptyNights: 5 } });
    expect(options.map((option) => [option.group, option.label])).toEqual([
      ["Tonight", "Slow Cooked Beef Ragu"],
      ["Do", "Plan next week"],
      ["Do", "Import a recipe"],
      ["Go to", "Home"],
      ["Go to", "Plan"],
      ["Go to", "Shopping"],
      ["Go to", "Recipes"],
      ["Go to", "Settings"],
    ]);
    expect(options[1]).toMatchObject({ kind: "go", hint: "5 empty nights", target: { to: "/plan/fill", search: { week: "2026-11-09" } } });
  });

  test("empty with nothing on tonight and the plan unread: no Tonight, and next week with no hint", () => {
    const options = buildOptions({ query: "", today, recipes: [] });
    expect(options[0]).toEqual({ kind: "go", group: "Do", label: "Plan next week", target: { to: "/plan/fill" } });
  });

  test("words: the matching recipes, the places the first word starts, and the line for the shopping list last", () => {
    const options = buildOptions({ query: "rice", today, recipes: [ragu, rice] });
    expect(options).toEqual([
      { kind: "open", group: "Recipes", label: "Chicken Fried Rice", recipe: rice },
      { kind: "shop", group: "Shopping", label: "Add “rice” to the shopping list", text: "rice" },
    ]);
    expect(buildOptions({ query: "pl", today, recipes: [] }).map((option) => option.label)).toEqual(["Plan", "Add “pl” to the shopping list"]);
  });

  test("words and a day: the recipes put on that day first, then opened, and nothing for the shopping list", () => {
    const options = buildOptions({ query: "ragu tue", today, recipes: [ragu, rice] });
    expect(options).toEqual([
      { kind: "plan", group: "Plan", label: "Put Slow Cooked Beef Ragu on Tuesday 10 November", recipe: ragu, date: "2026-11-10" },
      { kind: "open", group: "Recipes", label: "Slow Cooked Beef Ragu", recipe: ragu },
    ]);
  });

  test("at most four recipes to plan and six to open", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ ...rice, id: `id-${i}`, slug: `rice-${i}`, name: `Rice ${i}` }));
    const options = buildOptions({ query: "rice fri", today, recipes: many });
    expect(options.filter((option) => option.kind === "plan")).toHaveLength(4);
    expect(options.filter((option) => option.kind === "open")).toHaveLength(6);
  });
});

describe("highlight", () => {
  test("marks the words typed, in any case, and not a trailing day or a single letter", () => {
    expect(highlight("Put Slow Cooked Beef Ragu on Tuesday 10 November", "ragu tue", today)).toEqual([
      { text: "Put Slow Cooked Beef ", match: false },
      { text: "Ragu", match: true },
      { text: " on Tuesday 10 November", match: false },
    ]);
    expect(highlight("Chicken Fried Rice", "c rice", today)).toEqual([
      { text: "Chicken Fried ", match: false },
      { text: "Rice", match: true },
    ]);
    expect(highlight("Home", "", today)).toEqual([{ text: "Home", match: false }]);
  });

  test("a word with a regular expression's characters in it is matched as written", () => {
    expect(highlight("Add “1+1” to the shopping list", "1+1", today)).toContainEqual({ text: "1+1", match: true });
  });
});

describe("suggestions", () => {
  // 2026-11-07 is a Saturday.
  test("puts up to two planned recipes on the days after today, by the last word of the name, then a line and a place", () => {
    expect(suggestions([ragu, rice, { name: "Lemon Tart" }], today)).toEqual(["ragu sun", "rice mon", "milk", "settings"]);
  });

  test("each example finds the recipe it was made from, on the day it names", () => {
    const [example] = suggestions([rice], today);
    const options = buildOptions({ query: example ?? "", today, recipes: [ragu, rice] });
    expect(options[0]).toMatchObject({ kind: "plan", recipe: rice, date: "2026-11-08" });
  });

  test("skips names with no word long enough, and with nothing planned offers the fixed two", () => {
    expect(suggestions([{ name: "Bo ga" }, { name: "Pho ga" }], today)).toEqual(["pho sun", "milk", "settings"]);
    expect(suggestions([{ name: "Weeknight Stir-fry" }, { name: "Pasta (Quick)" }], today)).toEqual(["stir-fry sun", "quick mon", "milk", "settings"]);
    expect(suggestions([], today)).toEqual(["milk", "settings"]);
  });
});
