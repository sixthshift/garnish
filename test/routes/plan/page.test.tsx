// The meal plan week (M33.2, rebuilt as one list by critique #9): what
// `PlanWeekView` renders for a week — the seven days as rows of one card, each
// with its "+", today marked, the two week arrows — an entry of each kind (a
// recipe, a plain line, a recipe that has since been deleted), the empty day,
// and the add sheet's form; plus the route end to end, loader and all, against
// a temp DATA_DIR.
//
// The view takes its writes as callbacks, so these render it directly; the
// route test below proves the loader, the `?week=` param and the nav item.
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { groupByDay, type PlanDay, type PlanEntry, planEntrySchema, weekDates } from "../../../src/domain/plan";
import type { RecipeSummary } from "../../../src/domain/recipe";
import { nextMeal } from "../../../src/routes/plan/components/MealPicker";
import { PlanAddForm } from "../../../src/routes/plan/components/PlanAddForm";
import { PlanSearchResult } from "../../../src/routes/plan/components/PlanSearchResult";
import { PlanWeekView } from "../../../src/routes/plan/components/PlanWeekView";
import { searchPlanRecipes } from "../../../src/routes/plan/components/searchPlanRecipes";
import { addPlanEntry, listPlanWeek } from "../../../src/server/fns/plan";
import { createRecipe } from "../../../src/server/fns/recipes";
import { elementHtml, renderRoute } from "../../helpers/routes";
import { callServerFn, useTempDataDir } from "../../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../../src/server/fns/plan", local);
vi.mock("../../../src/server/fns/recipes", local);

const MONDAY = "2026-09-14"; // a Monday; the week runs to Sunday 2026-09-20
const TODAY = "2026-09-16"; // ... and Wednesday is the day being lived

const tart = { id: "11111111-1111-4111-8111-111111111111", slug: "lemon-tart", name: "Lemon tart", image: "tart.jpg" };

let n = 0;
function entry(date: string, over: Record<string, unknown> = {}): PlanEntry {
  n += 1;
  return planEntrySchema.parse({
    id: `99999999-9999-4999-8999-${String(n).padStart(12, "0")}`,
    date,
    position: n,
    ...over,
  });
}

const noop = () => {};

/** Render the week inside a throwaway router, so its `Link`s resolve. */
async function render(days: PlanDay[], props: Partial<Parameters<typeof PlanWeekView>[0]> = {}): Promise<string> {
  const rootRoute = createRootRoute({
    component: () => <PlanWeekView monday={MONDAY} days={days} today={TODAY} onAddText={noop} onAddRecipe={noop} onMove={noop} onRemove={noop} {...props} />,
  });
  const children = [
    createRoute({ getParentRoute: () => rootRoute, path: "/plan", component: () => null }),
    createRoute({ getParentRoute: () => rootRoute, path: "/recipes/$slug", component: () => null }),
  ];
  const router = createRouter({
    routeTree: rootRoute.addChildren(children),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}

/** An empty week, the shape the loader hands the page. */
function emptyWeek(): PlanDay[] {
  return groupByDay(MONDAY, []);
}

/** The week with `entries` laid into their days. */
function weekOf(entries: PlanEntry[]): PlanDay[] {
  return groupByDay(MONDAY, entries);
}

describe("the week", () => {
  test("seven days, Monday to Sunday, in order, as rows of one card", async () => {
    const html = await render(emptyWeek());
    const dates = [...html.matchAll(/data-testid="plan-day" data-date="([^"]+)"/g)].map((match) => match[1]);
    expect(dates).toEqual(weekDates(MONDAY));
    // Rows of one list, not a card each (design-language rule 2): the days are
    // `<li>`s of the week's `<ol>`, and the only card is the one around it.
    const week = elementHtml(html, "plan-week");
    expect(week.startsWith("<ol")).toBe(true);
    expect(week.match(/<li /g)?.length).toBeGreaterThanOrEqual(7);
    const day = elementHtml(html, "plan-day");
    expect(day.startsWith("<li")).toBe(true);
    expect(day).toContain("<h2");
    expect(day).toContain(">Mon<");
    expect(day).toContain(">14 Sep<");
    expect(html).toContain(">20 Sep<");
  });

  test("each day has one +, named with the day in full, and no form", async () => {
    const html = await render(emptyWeek());
    expect(html).toContain('aria-label="Add to Monday 14 September"');
    expect(html).toContain('aria-label="Add to Sunday 20 September"');
    expect(html.match(/aria-label="Add to /g)).toHaveLength(7);
    // The search and the meal chips live in the sheet the + opens.
    expect(html).not.toContain('data-testid="plan-add"');
    expect(html).not.toContain('data-testid="plan-meal-picker"');
    expect(html).not.toContain("<input");
  });

  test("today is the only day marked, in words and a neutral tint, never the brand", async () => {
    const html = await render(emptyWeek());
    expect(html.match(/data-today="true"/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`data-date="${TODAY}" data-today="true"`));
    expect(html.match(/aria-current="date"/g)).toHaveLength(1);
    const today = elementHtml(html, "plan-today");
    expect(today).toContain("Today");
    expect(html.match(/data-testid="plan-today"/g)).toHaveLength(1);
    // Rule 5: brand is the primary action and state, not a mark.
    expect(html).not.toContain("text-fg-brand");
    expect(html).not.toContain("bg-bg-brand");
  });

  test("the arrows step a week either way and the label names the span", async () => {
    const html = await render(emptyWeek());
    expect(elementHtml(html, "plan-week-label")).toContain("14 – 20 Sep 2026");
    expect(html).toContain('href="/plan?week=2026-09-07"');
    expect(html).toContain('href="/plan?week=2026-09-21"');
    expect(html).toContain('aria-label="Previous week"');
    expect(html).toContain('aria-label="Next week"');
  });

  test("adding the week to the shopping list sits after the days, not in the header", async () => {
    const html = await render(emptyWeek());
    expect(elementHtml(html, "plan-add-week")).toContain("Add this week to the shopping list");
    expect(html.indexOf('data-testid="plan-week"')).toBeLessThan(html.indexOf('data-testid="plan-add-week"'));
    expect(elementHtml(html, "plan-week-actions")).toContain('data-testid="plan-add-week"');
  });

  test("Propose says what it does", async () => {
    const html = await render(emptyWeek(), { plannerAvailable: true });
    const actions = elementHtml(html, "plan-week-actions");
    expect(actions).toContain("Propose a week");
    expect(actions).toContain("Nothing is added until you accept it.");
  });
});

describe("an entry of each kind", () => {
  test("a recipe entry is its picture, its name and a link to it", async () => {
    const html = await render(weekOf([entry(TODAY, { recipe: tart, text: tart.name })]));
    const row = elementHtml(html, "plan-entry");
    expect(row).toContain('data-kind="recipe"');
    expect(row).toContain("Lemon tart");
    expect(row).toContain('href="/recipes/lemon-tart"');
    expect(row).toContain('src="/api/images/tart.jpg"');
    expect(row).not.toContain("serves"); // the recipe's own servings stand
  });

  test("an entry that names a meal says so quietly, beside the servings", async () => {
    const html = await render(weekOf([entry(TODAY, { recipe: tart, text: tart.name, meal: "dinner", servings: 6 })]));
    const row = elementHtml(html, "plan-entry");
    expect(row).toContain("Dinner");
    expect(row).toContain("serves 6");
    // The meal comes before the servings badge, and is not a badge itself.
    expect(row.indexOf("Dinner")).toBeLessThan(row.indexOf("serves 6"));
  });

  test("an entry with no meal draws no label at all", async () => {
    const html = await render(weekOf([entry(TODAY, { text: "Leftovers" })]));
    expect(elementHtml(html, "plan-entry")).not.toContain("plan-entry-meal");
  });

  test("a recipe entry with its own servings says so", async () => {
    const html = await render(weekOf([entry(TODAY, { recipe: tart, text: tart.name, servings: 6 })]));
    expect(elementHtml(html, "plan-entry")).toContain("serves 6");
  });

  test("a plain line is text, with no image and no link", async () => {
    const html = await render(weekOf([entry("2026-09-18", { text: "Leftovers" })]));
    const row = elementHtml(html, "plan-entry");
    expect(row).toContain('data-kind="text"');
    expect(row).toContain("Leftovers");
    expect(row).not.toContain("<img");
    expect(row).not.toContain("<a ");
  });

  test("a recipe deleted since it was planned still reads as what was cooked", async () => {
    // `recipe_id` went null; the name copied into `text` at add time is left.
    const html = await render(weekOf([entry(TODAY, { recipe: null, text: "Lemon tart" })]));
    const row = elementHtml(html, "plan-entry");
    expect(row).toContain('data-kind="text"');
    expect(row).toContain("Lemon tart");
    expect(row).not.toContain("href=");
  });

  test("an entry can be dragged to another day or moved from its row menu", async () => {
    const html = await render(weekOf([entry(TODAY, { recipe: tart, text: tart.name })]));
    // ReorderList's group drag: every day is a list in the one group.
    expect(html.match(/data-reorder-group="plan-week"/g)).toHaveLength(7);
    // The row places its own handle (`narrow="row"`), inside the entry.
    const row = elementHtml(html, "plan-entry");
    expect(row).toContain('aria-label="Drag entry 1"');
    // The row menu is the phone's path and the keyboard's: other days, and up
    // and down on a narrow list, where the arrows leave the row.
    expect(row).toContain('aria-label="Actions for Lemon tart"');
    expect(html).toContain('data-narrow="row"');
    expect(html).toContain('aria-label="Move entry 1 up"');
  });
});

describe("the empty day", () => {
  test("a day with nothing on it is a quiet dash, said in words to a screen reader, and still takes a drop", async () => {
    const html = await render(weekOf([entry(TODAY, { text: "Leftovers" })]));
    expect(html.match(/data-testid="plan-day-empty"/g)).toHaveLength(6); // every day but Wednesday
    expect(elementHtml(html, "plan-day-empty")).toContain("—");
    expect(elementHtml(html, "plan-day-empty")).toContain('aria-hidden="true"');
    expect(html.match(/<span class="sr-only">Nothing planned<\/span>/g)).toHaveLength(6);
    // Every day's list is drawn, empty or not: it is a drop target.
    expect(html.match(/data-reorder-group="plan-week"/g)).toHaveLength(7);
  });
});

describe("the add sheet's form", () => {
  test("the meal chips come first, then the box, with nothing between it and its results", () => {
    const html = renderToString(<PlanAddForm date={MONDAY} onAddText={noop} onAddRecipe={noop} />);
    expect(html).toContain('aria-label="Search recipes, or type a note"');
    expect(html).toContain('placeholder="Search recipes, or type a note"');
    expect(html.indexOf('data-testid="plan-meal-picker"')).toBeLessThan(html.indexOf("<input"));
    // Nothing typed, so no results list yet, and a word on what the box takes.
    expect(html).not.toContain('role="listbox"');
    expect(html).toContain("leftovers");
  });

  test("the picker is three small chips, none of them pressed", () => {
    const html = renderToString(<PlanAddForm date={MONDAY} onAddText={noop} onAddRecipe={noop} />);
    const picker = elementHtml(html, "plan-meal-picker");
    expect(picker).toContain("Breakfast");
    expect(picker).toContain("Lunch");
    expect(picker).toContain("Dinner");
    expect(picker).toContain('aria-label="Meal for Monday 14 September"');
    // Naming a meal is optional, so nothing is chosen until something is pressed.
    expect(picker.match(/aria-pressed="false"/g)).toHaveLength(3);
    expect(picker).not.toContain('aria-pressed="true"');
  });

  test("nextMeal takes the chip just pressed, and none when the pressed one is pressed again", () => {
    expect(nextMeal(null, ["lunch"])).toBe("lunch");
    expect(nextMeal("lunch", [])).toBeNull();
    expect(nextMeal("lunch", ["lunch", "dinner"])).toBe("dinner");
    expect(nextMeal("lunch", ["lunch"])).toBeNull();
    expect(nextMeal(null, ["side"])).toBeNull();
  });

  test("a result is the recipe's picture and name, and not a link — it is picked, not opened", () => {
    const recipe = { id: tart.id, slug: tart.slug, name: tart.name, image: tart.image } as RecipeSummary;
    const html = renderToString(<PlanSearchResult recipe={recipe} />);
    expect(html).toContain("Lemon tart");
    expect(html).toContain('src="/api/images/tart.jpg"');
    expect(html).not.toContain("<a ");
  });
});

describe("/plan", () => {
  useTempDataDir();

  test("an empty database renders a whole empty week inside the shell", async () => {
    const html = await renderRoute(`/plan?week=${MONDAY}`);
    expect(html.match(/data-testid="plan-day"/g)).toHaveLength(7);
    expect(html).toContain("14 – 20 Sep 2026");
    expect(html.match(/data-testid="plan-day-empty"/g)).toHaveLength(7);
    // The nav item sits between Recipes and Shopping, in both navs.
    expect(html.match(/>Plan<\/a>/g)).toHaveLength(2);
    expect(html.indexOf(">Recipes</a>")).toBeLessThan(html.indexOf(">Plan</a>"));
    expect(html.indexOf(">Plan</a>")).toBeLessThan(html.indexOf(">Shopping</a>"));
  });

  test("a mid-week ?week= still lands on the whole week", async () => {
    const html = await renderRoute("/plan?week=2026-09-17");
    expect(html).toContain("14 – 20 Sep 2026");
  });

  test("the loader reads the week's entries and the page draws them on their days", async () => {
    const recipe = await callServerFn(createRecipe, { name: "Lemon tart", parts: [{ name: "", ingredients: [], steps: [] }] });
    await callServerFn(addPlanEntry, { date: "2026-09-15", recipeId: recipe.id, text: recipe.name, servings: 6 });
    await callServerFn(addPlanEntry, { date: "2026-09-18", text: "Leftovers" });
    // The week either side is not this week's business.
    await callServerFn(addPlanEntry, { date: "2026-09-21", text: "Beyond the week" });

    const html = await renderRoute(`/plan?week=${MONDAY}`);
    expect(html).toContain("Lemon tart");
    expect(html).toContain("serves 6");
    expect(html).toContain("Leftovers");
    expect(html).not.toContain("Beyond the week");
    expect(html.match(/data-testid="plan-entry"/g)).toHaveLength(2);
  });

  test("adding a recipe copies its name, so the entry survives the recipe", async () => {
    const recipe = await callServerFn(createRecipe, { name: "Lemon tart", parts: [{ name: "", ingredients: [], steps: [] }] });
    // What the page's onAddRecipe sends.
    await callServerFn(addPlanEntry, { date: MONDAY, recipeId: recipe.id, text: recipe.name });
    const [monday] = await callServerFn(listPlanWeek, { monday: MONDAY });
    expect(monday?.entries[0]?.text).toBe("Lemon tart");
    expect(monday?.entries[0]?.recipe?.slug).toBe(recipe.slug);
  });
});

describe("searchPlanRecipes", () => {
  useTempDataDir();

  test("finds a recipe by name, the way the global search does", async () => {
    await callServerFn(createRecipe, { name: "Lemon tart", parts: [{ name: "", ingredients: [], steps: [] }] });
    await callServerFn(createRecipe, { name: "Roast chicken", parts: [{ name: "", ingredients: [], steps: [] }] });
    expect((await searchPlanRecipes("lemon")).map((found) => found.name)).toEqual(["Lemon tart"]);
  });
});
