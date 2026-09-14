// The meal plan week (M33.2): what `PlanWeekView` renders for a week — the
// seven days, today marked, the two week arrows — an entry of each kind
// (a recipe, a plain line, a recipe that has since been deleted), the empty
// day, and the add row; plus the route end to end, loader and all, against a
// temp DATA_DIR.
//
// The view takes its writes as callbacks, so these render it directly; the
// route test below proves the loader, the `?week=` param and the nav item.
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { PlanAddRow, PlanSearchResult, PlanWeekView, searchPlanRecipes } from "../../../src/routes/plan/components/PlanWeekView";
import { groupByDay, planEntrySchema, weekDates, type PlanDay, type PlanEntry } from "../../../src/domain/plan/plan";
import type { RecipeSummary } from "../../../src/domain/recipe/recipe";
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
    component: () => (
      <PlanWeekView monday={MONDAY} days={days} today={TODAY} onAddText={noop} onAddRecipe={noop} onMove={noop} onRemove={noop} {...props} />
    ),
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
  test("seven days, Monday to Sunday, in order", async () => {
    const html = await render(emptyWeek());
    const dates = [...html.matchAll(/data-testid="plan-day" data-date="([^"]+)"/g)].map((match) => match[1]);
    expect(dates).toEqual(weekDates(MONDAY));
    expect(html).toContain("Mon 14 Sep");
    expect(html).toContain("Sun 20 Sep");
  });

  test("today is the only day marked", async () => {
    const html = await render(emptyWeek());
    expect(html.match(/data-today="true"/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`data-date="${TODAY}" data-today="true"`));
    expect(html.match(/>Today</g)).toHaveLength(1);
  });

  test("the arrows step a week either way and the label names the span", async () => {
    const html = await render(emptyWeek());
    expect(elementHtml(html, "plan-week-label")).toContain("14 – 20 Sep 2026");
    expect(html).toContain('href="/plan?week=2026-09-07"');
    expect(html).toContain('href="/plan?week=2026-09-21"');
    expect(html).toContain('aria-label="Previous week"');
    expect(html).toContain('aria-label="Next week"');
  });

  test("the header offers to add the week to the shopping list", async () => {
    const html = await render(emptyWeek());
    expect(elementHtml(html, "plan-add-week")).toContain("Add this week to the shopping list");
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
    expect(html).toContain('aria-label="Drag entry 1"');
    // The row menu is the phone's path and the keyboard's.
    expect(elementHtml(html, "plan-entry")).toContain('aria-label="Actions for Lemon tart"');
  });

});

describe("the empty day", () => {
  test("a day with nothing on it says so and still takes a drop and an add", async () => {
    const html = await render(weekOf([entry(TODAY, { text: "Leftovers" })]));
    const empty = [...html.matchAll(/data-testid="plan-day-empty"/g)];
    expect(empty).toHaveLength(6); // every day but Wednesday
    expect(html).toContain("Nothing planned");
    expect(html.match(/data-testid="plan-add"/g)).toHaveLength(7);
    expect(html).toContain('aria-label="Add to Mon 14 Sep"');
  });
});

describe("the add row", () => {
  test("a day's box is a search box that also takes a plain line", () => {
    const html = renderToString(<PlanAddRow date={MONDAY} onAddText={noop} onAddRecipe={noop} />);
    expect(html).toContain('aria-label="Add to Mon 14 Sep"');
    expect(html).toContain("Add a recipe or a line");
    // Nothing typed, so no results list yet.
    expect(html).not.toContain('role="listbox"');
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
    expect(html).toContain("Nothing planned");
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
