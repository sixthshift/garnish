// M24.1: from `md` the recipe page is two columns — every ingredient list in
// the sticky aside, every step list in the main column — in both ingredient
// modes. Rendered through the real route tree (see test/helpers/routes.tsx);
// `elementHtml` slices one column out of the markup so containment, not just
// presence, can be asserted.
import { afterEach, describe, expect, test, vi } from "vitest";
import { clearTicksNow, getTicks, type StorageLike, setIngredientTicked } from "../../../../src/lib/ticks";
import { createRecipe } from "../../../../src/server/fns/recipes";
import { createTimelineEvent } from "../../../../src/server/fns/timeline";
import { elementHtml, renderRoute } from "../../../helpers/routes";
import { callServerFn, useTempDataDir } from "../../../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../../../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../../../src/server/fns/recipes", local);
vi.mock("../../../../src/server/fns/timeline", local);

useTempDataDir();
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

/** Render with the ingredient mode preference already stored, as a reload would. */
function storeMode(mode: "structured" | "summary") {
  const map = new Map<string, string>([["garnish.ingredientMode", JSON.stringify(mode)]]);
  (globalThis as { window?: unknown }).window = {
    localStorage: { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value) },
  };
}

/** An in-memory sessionStorage, so ticks.ts reads and writes what a test seeds. */
function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
}

const food = (name: string) => ({ id: crypto.randomUUID(), name, pluralName: null });

function seedTart() {
  return callServerFn(createRecipe, {
    name: "Lemon tart",
    recipeServings: 4,
    parts: [
      { name: "Pastry", ingredients: [{ quantity: 200, unit: null, food: food("flour") }], steps: [{ text: "Rub the butter in." }] },
      { name: "Filling", ingredients: [{ quantity: 3, unit: null, food: food("lemons") }], steps: [{ text: "Whisk it together." }] },
      { name: "", ingredients: [], steps: [{ text: "Bake for 30 minutes." }] },
    ],
  });
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("two columns from md (M24.1)", () => {
  test("structured mode: the aside holds every part's ingredient list, the main column every step list", async () => {
    await seedTart();
    storeMode("structured");
    const html = await renderRoute("/recipes/lemon-tart");

    const aside = elementHtml(html, "ingredients-column");
    const main = elementHtml(html, "method-column");
    expect(aside).not.toBe("");
    expect(main).not.toBe("");

    // Two parts have ingredients, so two lists, both in the aside.
    expect(count(html, 'aria-label="Ingredients"')).toBe(2);
    expect(count(aside, 'aria-label="Ingredients"')).toBe(2);
    expect(count(main, 'aria-label="Ingredients"')).toBe(0);
    expect(aside).toContain(">flour<");
    expect(aside).toContain(">lemons<");
    // Each list sits under its part's name.
    expect(aside.indexOf(">Pastry<")).toBeLessThan(aside.indexOf(">flour<"));
    expect(aside.indexOf(">Filling<")).toBeLessThan(aside.indexOf(">lemons<"));

    // Three parts have steps, so three lists, all in the main column.
    expect(count(html, 'aria-label="Steps"')).toBe(3);
    expect(count(main, 'aria-label="Steps"')).toBe(3);
    expect(count(aside, 'aria-label="Steps"')).toBe(0);
    expect(main).toContain("Rub the butter in.");
    expect(main).toContain("Whisk it together.");
    // "30 minutes" is its own timer chip (M26.2), so the sentence is no longer one contiguous string.
    expect(main).toContain("Bake for");
    expect(main).toContain("30 minutes");
    // The main column repeats the named parts' headings above their steps.
    expect(main.indexOf(">Pastry<")).toBeLessThan(main.indexOf("Rub the butter in."));
    expect(main.indexOf(">Filling<")).toBeLessThan(main.indexOf("Whisk it together."));
  });

  test("summary mode: the one merged list is in the aside, the steps still in the main column", async () => {
    await seedTart();
    storeMode("summary");
    const html = await renderRoute("/recipes/lemon-tart");

    const aside = elementHtml(html, "ingredients-column");
    const main = elementHtml(html, "method-column");

    expect(count(html, 'aria-label="Ingredients"')).toBe(1);
    expect(count(aside, 'aria-label="Ingredients"')).toBe(1);
    expect(count(main, 'aria-label="Ingredients"')).toBe(0);
    expect(aside).toContain(">flour<");
    expect(aside).toContain(">lemons<");
    // No per-part ingredient headings in summary mode.
    expect(aside).not.toContain(">Pastry<");

    expect(count(main, 'aria-label="Steps"')).toBe(3);
    expect(count(aside, 'aria-label="Steps"')).toBe(0);
    expect(main).toContain("Rub the butter in.");
    // "30 minutes" is its own timer chip (M26.2), so the sentence is no longer one contiguous string.
    expect(main).toContain("Bake for");
    expect(main).toContain("30 minutes");
  });

  test("a flat recipe puts its one list in the aside and its steps in the main column", async () => {
    await callServerFn(createRecipe, {
      name: "Toast",
      parts: [{ name: "", ingredients: [{ quantity: 1, unit: null, food: food("bread slice") }], steps: [{ text: "Toast it." }] }],
    });
    const html = await renderRoute("/recipes/toast");
    expect(elementHtml(html, "ingredients-column")).toContain('aria-label="Ingredients"');
    expect(elementHtml(html, "method-column")).toContain('aria-label="Steps"');
    // The unnamed part is still nameless in both columns; the aside's only
    // heading is the "Ingredients" title M24.2 adds.
    expect(elementHtml(html, "method-column")).not.toContain("<h2");
    expect(elementHtml(html, "ingredients-column")).toContain("<h2");
    expect(elementHtml(html, "ingredients-column")).toContain(">Ingredients<");
    // A single part: the mode toggle has nothing to switch between.
    expect(html).not.toContain('data-testid="ingredient-mode-toggle"');
  });

  test("the grid starts at md, the aside sticks and scrolls itself, and the page widens at lg", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart");
    const columns = elementHtml(html, "recipe-columns");
    expect(columns).toMatch(/class="[^"]*flex flex-col[^"]*md:grid[^"]*md:grid-cols-3/);
    const aside = elementHtml(html, "ingredients-column");
    expect(aside.startsWith("<aside")).toBe(true);
    expect(aside).toMatch(/class="[^"]*md:sticky[^"]*md:top-6/);
    expect(aside).toMatch(/class="[^"]*md:overflow-y-auto/);
    expect(html).toMatch(/<article[^>]*class="[^"]*max-w-6xl/);
  });

  test("the ingredients aside opts out of the print rule that hides the shell's aside", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart");
    expect(elementHtml(html, "ingredients-column")).toContain('data-print="keep"');
  });
});

describe("servings in the ingredients heading (M24.2)", () => {
  test("the heading row holds the title and the scale control; a multi-part recipe also shows the mode toggle", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart");
    const heading = elementHtml(html, "ingredients-heading");
    expect(heading).toContain(">Ingredients<");
    expect(heading).toContain('aria-label="Scale servings"');
    // The toggle is not part of the heading row itself, but it only shows up
    // in the aside once there is more than one part to merge.
    expect(elementHtml(html, "ingredients-column")).toContain('data-testid="ingredient-mode-toggle"');
    expect(elementHtml(html, "ingredients-column")).toContain(">One list<");
  });
});

describe("the ingredients heading's Clear link (M25.6)", () => {
  test("is absent with nothing ticked", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart");
    expect(elementHtml(html, "ingredients-heading")).not.toContain(">Clear<");
  });

  test("shows once something is ticked, and clears every tick — ingredients and steps — when pressed", async () => {
    const tart = await seedTart();
    const flour = tart.parts[0]!.ingredients[0]!;

    const storage = fakeStorage();
    setIngredientTicked(storage, tart.id, flour.id, true);
    (globalThis as { window?: unknown }).window = { sessionStorage: storage };

    const ticked = await renderRoute("/recipes/lemon-tart");
    const heading = elementHtml(ticked, "ingredients-heading");
    expect(heading).toContain(">Clear<");
    expect(heading).toContain('data-print="hide"');

    // The link's onClick is exactly this call (src/lib/ticks.ts, src/routes/recipes/recipe/Recipe.tsx).
    clearTicksNow(tart.id);
    expect(getTicks(storage, tart.id)).toEqual({ ingredients: [], steps: [] });

    const cleared = await renderRoute("/recipes/lemon-tart");
    expect(elementHtml(cleared, "ingredients-heading")).not.toContain(">Clear<");
  });
});

describe("the meta footer moves to the foot of the page (M24.3)", () => {
  test("recipe-meta renders after the timeline, as the page's last element", async () => {
    const tart = await seedTart();
    await callServerFn(createTimelineEvent, { recipeId: tart.id, event: { occurredOn: "2026-09-11", message: "Crispier at 220.", image: null } });
    const html = await renderRoute("/recipes/lemon-tart");

    expect(html).toContain('data-testid="recipe-meta"');
    // No longer under the header: the header's own markup carries no meta.
    expect(elementHtml(html, "recipe-header")).not.toContain('data-testid="recipe-meta"');
    expect(html.indexOf('data-testid="recipe-header"')).toBeLessThan(html.indexOf('data-testid="timeline"'));
    expect(html.indexOf('data-testid="timeline"')).toBeLessThan(html.indexOf('data-testid="recipe-meta"'));
    // Nothing else follows the footer before the page's <article> closes.
    expect(html).toMatch(/data-testid="recipe-meta"[\s\S]*<\/footer>\s*<\/article>/);
  });
});

describe("elementHtml", () => {
  test("returns the whole element, nesting of the same tag included", () => {
    const html = '<div><div data-testid="a"><div>in</div><span>x</span></div><div>out</div></div>';
    expect(elementHtml(html, "a")).toBe('<div data-testid="a"><div>in</div><span>x</span></div>');
  });

  test("handles a tag other than div, and an unknown testid", () => {
    expect(elementHtml('<p>x</p><aside data-testid="b" class="c">y</aside>', "b")).toBe('<aside data-testid="b" class="c">y</aside>');
    expect(elementHtml("<div>x</div>", "missing")).toBe("");
  });
});
