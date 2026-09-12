// M24.6: the phone-only "Ingredients" button on the recipe page. Under vitest
// there is no `IntersectionObserver`, so `useScrolledOff` treats the aside as
// scrolled off and the button renders — which is what makes it testable here.
import { describe, expect, test, vi } from "vitest";
import { createRecipe } from "../../src/server/recipes";
import { renderRoute } from "../helpers/routes";
import { callServerFn, useTempDataDir } from "../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../src/server/recipes", local);
vi.mock("../../src/server/timeline", local);

useTempDataDir();

const food = (name: string) => ({ id: crypto.randomUUID(), name, pluralName: null });

describe("the phone's ingredients button (M24.6)", () => {
  test("renders above the tab bar, phone only, and never prints", async () => {
    await callServerFn(createRecipe, {
      name: "Lemon tart",
      recipeServings: 4,
      parts: [{ name: "", ingredients: [{ quantity: 200, unit: null, food: food("flour") }], steps: [{ text: "Bake it." }] }],
    });

    const html = await renderRoute("/recipes/lemon-tart");
    const button = /<button[^>]*data-testid="ingredients-sheet-button"[^>]*>/.exec(html)?.[0] ?? "";

    expect(button).not.toBe("");
    expect(button).toContain('data-print="hide"');
    expect(button).toContain("fixed");
    expect(button).toContain("bottom-20");
    expect(button).toContain("md:hidden");
  });

  test("a recipe with no ingredients has nothing to open, so no button", async () => {
    await callServerFn(createRecipe, {
      name: "Boiled water",
      recipeServings: 1,
      parts: [{ name: "", ingredients: [], steps: [{ text: "Boil it." }] }],
    });

    expect(await renderRoute("/recipes/boiled-water")).not.toContain('data-testid="ingredients-sheet-button"');
  });

  test("the sheet is closed on load, so its body is not in the markup", async () => {
    await callServerFn(createRecipe, {
      name: "Pancakes",
      recipeServings: 2,
      parts: [{ name: "", ingredients: [{ quantity: 100, unit: null, food: food("flour") }], steps: [{ text: "Fry it." }] }],
    });

    expect(await renderRoute("/recipes/pancakes")).not.toContain('data-testid="ingredients-sheet-lists"');
  });
});
