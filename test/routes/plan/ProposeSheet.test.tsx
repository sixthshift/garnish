// The proposal sheet (M39.5, M39.7): its pure half — the remembered days and
// meals, the past-day rule and the payload Add sends — and what the sheet's
// content draws in each of its two stages. Static render only, as the restyle sheet's
// tests do; the DOM file beside this one is the one that presses anything.
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { Meal } from "../../../src/domain/plan";
import { PlanWeekView } from "../../../src/routes/plan/components/PlanWeekView";
import { ProposeSheetContent } from "../../../src/routes/plan/components/ProposeSheetContent";
import {
  ALL_DAYS,
  addedMealsMessage,
  applyPayload,
  groupProposal,
  initialTicked,
  PLANNER_DAYS_KEY,
  PLANNER_MEALS_KEY,
  proposalDays,
  readProposalDays,
  readProposalMeals,
  rememberedDays,
  slotKey,
  tickedDates,
  toggleProposalDay,
  toggleProposalMeal,
  writeProposalDays,
  writeProposalMeals,
} from "../../../src/routes/plan/components/proposalSheet";
import type { ProposedWeek } from "../../../src/server/ai/planner";

const MONDAY = "2026-09-14"; // a Monday; the week runs to Sunday 2026-09-20
const WEDNESDAY = "2026-09-16"; // ... and Wednesday is the day being lived
const THURSDAY = "2026-09-17";

/** A `Storage`-shaped map, so a preference test needs no browser. */
function memory(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    map,
  };
}

const ragu = { id: "11111111-1111-4111-8111-111111111111", slug: "beef-ragu", name: "Beef ragu", image: "ragu.jpg" };
const tart = { id: "22222222-2222-4222-8222-222222222222", slug: "lemon-tart", name: "Lemon tart", image: null };

const week: ProposedWeek = {
  entries: [
    { date: WEDNESDAY, meal: "dinner", recipeId: ragu.id, reason: "Nothing slow-cooked in a fortnight.", recipe: ragu },
    { date: THURSDAY, meal: "dinner", recipeId: tart.id, reason: "Uses the lemons.", recipe: tart },
  ],
  dropped: [{ entry: { date: WEDNESDAY, meal: "lunch", recipeId: "nope", reason: "" }, kind: "unknown-recipe", reason: "That recipe is not in the library." }],
  unfilled: [{ date: THURSDAY, meal: "lunch" }],
  taken: [{ date: WEDNESDAY, meal: "lunch", name: "Leftovers" }],
};

const DINNER: Meal[] = ["dinner"];

/** The content with everything defaulted, so a test only says what it cares about. */
function content(overrides: Partial<Parameters<typeof ProposeSheetContent>[0]> = {}): string {
  return renderToString(
    <ProposeSheetContent
      days={proposalDays(MONDAY, ALL_DAYS, WEDNESDAY)}
      onToggleDay={() => {}}
      meals={DINNER}
      onToggleMeal={() => {}}
      week={null}
      ticked={new Set()}
      onToggleRow={() => {}}
      onPropose={() => {}}
      onAdd={() => {}}
      onCancel={() => {}}
      {...overrides}
    />
  );
}

/** The three meal checkboxes, as `[meal, checked]`, in the order they are drawn. */
function mealCells(html: string): { meal: string; checked: boolean }[] {
  return [...html.matchAll(/data-state="(checked|unchecked)"[^>]*?data-meal="([a-z]+)"/g)].map((m) => ({ meal: m[2]!, checked: m[1] === "checked" }));
}

/** The `<label>` wrappers of the seven day checkboxes, as `[date, ticked, past]`. */
function dayCells(html: string): { date: string; ticked: string; past: string }[] {
  return [...html.matchAll(/data-testid="propose-day" data-date="([^"]+)" data-ticked="([^"]+)" data-past="([^"]+)"/g)].map((m) => ({
    date: m[1]!,
    ticked: m[2]!,
    past: m[3]!,
  }));
}

describe("the remembered days", () => {
  test("nothing stored is every day", () => {
    expect(readProposalDays(memory())).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  test("a stored choice comes back, sorted and deduplicated; rubbish falls back to every day", () => {
    expect(readProposalDays(memory({ [PLANNER_DAYS_KEY]: "[4,0,4]" }))).toEqual([0, 4]);
    expect(readProposalDays(memory({ [PLANNER_DAYS_KEY]: "not json" }))).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(readProposalDays(memory({ [PLANNER_DAYS_KEY]: "[]" }))).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(readProposalDays(memory({ [PLANNER_DAYS_KEY]: "[9,-1]" }))).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  test("writing puts the indices under garnish.planner.days", () => {
    const storage = memory();
    writeProposalDays(storage, [5, 4]);
    expect(storage.map.get(PLANNER_DAYS_KEY)).toBe("[4,5]");
  });

  test("a day the household unticked is remembered, and a past day keeps its place for next week", () => {
    const days = toggleProposalDay(proposalDays(MONDAY, ALL_DAYS, WEDNESDAY), 4);
    expect(rememberedDays(days)).toEqual([0, 1, 2, 3, 5, 6]);
  });
});

describe("the day checkboxes", () => {
  test("from the default, every day of the week is ticked", () => {
    const cells = dayCells(content({ days: proposalDays(MONDAY, ALL_DAYS, MONDAY) }));
    expect(cells).toHaveLength(7);
    expect(cells.every((cell) => cell.ticked === "true")).toBe(true);
    expect(content({ days: proposalDays(MONDAY, ALL_DAYS, MONDAY) })).toContain("Mon 14 Sep");
  });

  test("from storage, only the remembered days are ticked", () => {
    const days = proposalDays(MONDAY, readProposalDays(memory({ [PLANNER_DAYS_KEY]: "[3,4]" })), MONDAY);
    expect(tickedDates(days)).toEqual(["2026-09-17", "2026-09-18"]);
    expect(dayCells(content({ days })).map((cell) => cell.ticked)).toEqual(["false", "false", "false", "true", "true", "false", "false"]);
  });

  test("a day before today is unticked and cannot be pressed: a proposal is for what is coming", () => {
    const days = proposalDays(MONDAY, ALL_DAYS, WEDNESDAY);
    expect(days.filter((day) => day.past).map((day) => day.date)).toEqual(["2026-09-14", "2026-09-15"]);
    expect(tickedDates(days)[0]).toBe(WEDNESDAY);
    const cells = dayCells(content({ days }));
    expect(cells.slice(0, 2).every((cell) => cell.past === "true" && cell.ticked === "false")).toBe(true);
    // The two past checkboxes are the only disabled controls on the day row.
    expect(toggleProposalDay(days, 0)[0]!.ticked).toBe(false);
  });
});

describe("the remembered meals", () => {
  test("nothing stored is dinner alone", () => {
    expect(readProposalMeals(memory())).toEqual(["dinner"]);
    expect(readProposalMeals(undefined)).toEqual(["dinner"]);
  });

  test("a stored choice comes back in meal order; rubbish falls back to dinner", () => {
    expect(readProposalMeals(memory({ [PLANNER_MEALS_KEY]: '["dinner","breakfast"]' }))).toEqual(["breakfast", "dinner"]);
    expect(readProposalMeals(memory({ [PLANNER_MEALS_KEY]: "not json" }))).toEqual(["dinner"]);
    expect(readProposalMeals(memory({ [PLANNER_MEALS_KEY]: "[]" }))).toEqual(["dinner"]);
    expect(readProposalMeals(memory({ [PLANNER_MEALS_KEY]: '["supper"]' }))).toEqual(["dinner"]);
  });

  test("writing puts the meals under garnish.planner.meals, in meal order", () => {
    const storage = memory();
    writeProposalMeals(storage, ["dinner", "breakfast"]);
    expect(storage.map.get(PLANNER_MEALS_KEY)).toBe('["breakfast","dinner"]');
  });

  test("toggling adds and removes one meal, keeping meal order", () => {
    expect(toggleProposalMeal(["dinner"], "breakfast")).toEqual(["breakfast", "dinner"]);
    expect(toggleProposalMeal(["breakfast", "dinner"], "dinner")).toEqual(["breakfast"]);
    expect(toggleProposalMeal(["dinner"], "dinner")).toEqual([]);
  });
});

describe("the meal checkboxes", () => {
  test("from the default, dinner alone is ticked", () => {
    expect(mealCells(content())).toEqual([
      { meal: "breakfast", checked: false },
      { meal: "lunch", checked: false },
      { meal: "dinner", checked: true },
    ]);
    expect(content()).toContain("Breakfast");
  });

  test("from storage, the remembered meals are ticked", () => {
    const html = content({ meals: readProposalMeals(memory({ [PLANNER_MEALS_KEY]: '["breakfast","dinner"]' })) });
    expect(mealCells(html)).toEqual([
      { meal: "breakfast", checked: true },
      { meal: "lunch", checked: false },
      { meal: "dinner", checked: true },
    ]);
  });

  test("Propose needs a day and a meal: with either row empty it is disabled", () => {
    expect(content()).not.toMatch(/disabled=""[^>]*data-testid="propose-run"/);
    expect(content({ meals: [] })).toMatch(/disabled=""[^>]*data-testid="propose-run"/);
    expect(content({ days: proposalDays(MONDAY, [], MONDAY) })).toMatch(/disabled=""[^>]*data-testid="propose-run"/);
  });
});

describe("the answer", () => {
  const answered = () => content({ week, ticked: initialTicked(week) });

  test("is grouped by day, newest day last", () => {
    expect(groupProposal(week).map((group) => group.date)).toEqual([WEDNESDAY, THURSDAY]);
  });

  test("draws a row per proposed entry with its picture, name, meal and the model's reason", () => {
    const html = answered();
    expect(html).toContain("Beef ragu");
    expect(html).toContain("Nothing slow-cooked in a fortnight.");
    expect(html).toContain("Uses the lemons.");
    expect(html).toContain('data-slot="2026-09-16 dinner" data-ticked="true"');
    expect(html).toContain("/images/ragu.jpg");
    // The lemon tart has no picture, so its row draws the placeholder square.
    expect(html).toContain('data-placeholder="image"');
  });

  test("says which slot the model left empty, which was already taken, and what was dropped and why", () => {
    const html = answered();
    expect(html).toContain("Lunch: the model left this one empty.");
    expect(html).toContain("Lunch: already taken by Leftovers.");
    expect(html).toContain("Lines dropped");
    expect(html).toContain("That recipe is not in the library.");
  });

  test("a week with nothing proposed says so", () => {
    expect(content({ week: { entries: [], dropped: [], unfilled: [], taken: [] }, ticked: new Set() })).toContain("The model proposed nothing for these days.");
  });

  test("the working line shows while the model is being asked", () => {
    expect(content({ busy: true })).toContain("Reading the week and asking the model…");
  });

  test("a failure keeps the sheet on screen with the error and Try again", () => {
    const html = content({ week, ticked: initialTicked(week), error: "The model could not be reached." });
    expect(html).toContain("The model could not be reached.");
    expect(html).toContain("Try again");
  });
});

describe("what Add sends", () => {
  test("only the ticked rows, in the answer's order", () => {
    expect(applyPayload(week, initialTicked(week))).toEqual([
      { date: WEDNESDAY, meal: "dinner", recipeId: ragu.id },
      { date: THURSDAY, meal: "dinner", recipeId: tart.id },
    ]);
    expect(applyPayload(week, new Set([slotKey(THURSDAY, "dinner")]))).toEqual([{ date: THURSDAY, meal: "dinner", recipeId: tart.id }]);
    expect(applyPayload(week, new Set())).toEqual([]);
  });

  test("the toast counts the meals", () => {
    expect(addedMealsMessage(5)).toBe("5 meals added");
    expect(addedMealsMessage(1)).toBe("1 meal added");
  });
});

describe("the Propose button on the plan header", () => {
  /** The week inside a throwaway router, so its `Link`s resolve. */
  async function renderWeek(props: Partial<Parameters<typeof PlanWeekView>[0]> = {}): Promise<string> {
    const noop = () => {};
    const rootRoute = createRootRoute({
      component: () => (
        <PlanWeekView monday={MONDAY} days={[]} today={WEDNESDAY} onAddText={noop} onAddRecipe={noop} onMove={noop} onRemove={noop} {...props} />
      ),
    });
    const children = [createRoute({ getParentRoute: () => rootRoute, path: "/plan", component: () => null })];
    const router = createRouter({ routeTree: rootRoute.addChildren(children), history: createMemoryHistory({ initialEntries: ["/"] }) });
    await router.load();
    return renderToString(<RouterProvider router={router as never} />);
  }

  test("is absent when no model is configured", async () => {
    expect(await renderWeek()).not.toContain('data-testid="plan-propose"');
  });

  test("is there when one is, and a model is the whole of the gate (M39.7)", async () => {
    const html = await renderWeek({ plannerAvailable: true });
    expect(html).toContain('data-testid="plan-propose"');
    expect(html).not.toMatch(/disabled=""[^>]*data-testid="plan-propose"/);
    expect(html).not.toContain("Settings");
  });
});
