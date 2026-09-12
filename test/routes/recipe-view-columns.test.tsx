// M24.1: from `md` the recipe page is two columns — every ingredient list in
// the sticky aside, every step list in the main column — in both ingredient
// modes. Rendered through the real route tree (see test/helpers/routes.tsx);
// `elementHtml` slices one column out of the markup so containment, not just
// presence, can be asserted.
import { afterEach, describe, expect, test, vi } from "vitest";
import { createRecipe } from "../../src/server/recipes";
import { elementHtml, renderRoute } from "../helpers/routes";
import { callServerFn, useTempDataDir } from "../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../src/server/recipes", local);
vi.mock("../../src/server/timeline", local);

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
    expect(main).toContain("Bake for 30 minutes.");
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
    expect(main).toContain("Bake for 30 minutes.");
  });

  test("a flat recipe puts its one list in the aside and its steps in the main column", async () => {
    await callServerFn(createRecipe, {
      name: "Toast",
      parts: [{ name: "", ingredients: [{ quantity: 1, unit: null, food: food("bread slice") }], steps: [{ text: "Toast it." }] }],
    });
    const html = await renderRoute("/recipes/toast");
    expect(elementHtml(html, "ingredients-column")).toContain('aria-label="Ingredients"');
    expect(elementHtml(html, "method-column")).toContain('aria-label="Steps"');
    // Still no heading anywhere: the unnamed part is nameless in both columns.
    expect(html).not.toContain("<h2");
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
    expect(html).toMatch(/<article[^>]*class="[^"]*max-w-3xl[^"]*lg:max-w-5xl/);
  });

  test("the ingredients aside opts out of the print rule that hides the shell's aside", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart");
    expect(elementHtml(html, "ingredients-column")).toContain('data-print="keep"');
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
