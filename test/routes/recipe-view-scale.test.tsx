// M11.5 scale control: the "Serves N" chip that opens a popover with a
// number input and Reset. M25.2 added a second form to that same popover —
// pick a scalable ingredient and type the amount you have — replacing the
// per-row "Scale to..." link; M29.4 removed that second form again, leaving
// the one servings form. Rendered through the real route tree, the same way
// as test/routes/loaders.test.tsx, since a popover's body only exists in the
// markup once the design system's Popover is open — these tests stick to
// what a default (closed) render can show: the chip and that no row or
// popover carries the removed "Scale to..." controls.
import { afterEach, describe, expect, test, vi } from "vitest";
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
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

const food = (name: string, pluralName: string | null = null) => ({ id: crypto.randomUUID(), name, pluralName });

async function seedTart() {
  return callServerFn(createRecipe, {
    name: "Lemon tart",
    recipeServings: 4,
    parts: [
      {
        name: "",
        ingredients: [
          { quantity: 200, food: food("flour") },
          { quantity: 1, food: food("vanilla pod"), fixed: true },
          { quantity: null, food: food("salt"), note: "to taste" },
        ],
        steps: [{ text: "Mix." }],
      },
    ],
  });
}

describe("scale control chip and popover", () => {
  test("the servings chip is a popover trigger carrying the current label", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart");
    expect(html).toMatch(/data-testid="servings-chip"[^>]*>Serves 4</);
  });

  test("the chip's popover body (a number input and Set) is closed by default, not in the markup", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart");
    expect(html).not.toContain('aria-label="Servings"');
    expect(html).not.toContain('id="servings-target"');
  });

  test("scaling to 8 moves the chip label and keeps Reset available", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart?servings=8");
    expect(html).toMatch(/data-testid="servings-chip"[^>]*>Serves 8</);
    expect(html).toContain(">Reset<");
  });
});

describe("Scale to... removed again (M29.4)", () => {
  test("no ingredient row renders the old per-row trigger", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart");
    expect(html).not.toContain('data-testid="scale-to-trigger"');
    expect(html).not.toMatch(/aria-label="Scale to a set amount of/);
  });

  test("the popover carries no second form (ingredient select, target amount)", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart");
    expect(html).not.toContain('data-testid="scale-to-form"');
    expect(html).not.toContain('aria-label="Target amount"');
    expect(html).not.toContain('aria-label="Ingredient to scale to"');
  });

  test("a recipe with no servings recorded hides the scale chip too, so there is nothing to scale to", async () => {
    await callServerFn(createRecipe, {
      name: "Toast",
      parts: [{ name: "", ingredients: [{ quantity: 1, food: food("bread slice") }], steps: [{ text: "Toast it." }] }],
    });
    const html = await renderRoute("/recipes/toast");
    expect(html).not.toContain('data-testid="servings-chip"');
    expect(html).not.toContain('data-testid="scale-to-trigger"');
  });
});
