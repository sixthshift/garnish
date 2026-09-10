// Cook mode end to end: the route renders one card of the deck per `step`,
// scaled by `servings`, with Prev/Next disabled at the ends and no app nav.
// Stands in for the plan's phone-width manual check (no browser here): the
// layout is a single column with no fixed widths, asserted below by class.
import { describe, expect, test, vi } from "vitest";
import type { Recipe } from "../../src/domain/recipe";
import { Route as CookRoute, positionLabel, stepForKey } from "../../src/routes/recipes/$slug/cook";
import { createRecipe } from "../../src/server/recipes";
import { listUnits } from "../../src/server/units";
import { renderRoute } from "../helpers/routes";
import { callServerFn, useTempDataDir } from "../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../src/server/recipes", local);
vi.mock("../../src/server/units", local);
vi.mock("../../src/server/tags", local);
vi.mock("../../src/server/aisles", local);

useTempDataDir();

const food = (name: string, pluralName: string | null = null) => ({ id: crypto.randomUUID(), name, pluralName });

// Deck: 0 Pastry ingredients, 1 Pastry step, 2 Filling ingredients, 3 Filling step, 4 To finish step.
async function seedTart() {
  const units = await callServerFn(listUnits, {});
  const gram = units.find((u) => u.abbreviation === "g")!;
  return callServerFn(createRecipe, {
    name: "Lemon tart",
    recipeServings: 4,
    components: [
      {
        name: "Pastry",
        ingredients: [{ quantity: 200, unit: gram, food: food("flour") }],
        steps: [{ text: "Rub the butter into the flour." }],
      },
      {
        name: "Filling",
        ingredients: [
          { quantity: 3, food: food("lemon", "lemons") },
          { quantity: 1, food: food("vanilla pod", "vanilla pods"), fixed: true },
        ],
        steps: [{ text: "Whisk everything together." }],
      },
    ],
    steps: [{ text: "Bake for 30 minutes." }],
  });
}

/** Whether the button whose text is `label` carries the `disabled` attribute (not the `disabled:` class prefix). */
function isDisabled(html: string, label: string): boolean {
  const match = html.match(new RegExp(`<button[^>]*>${label}</button>`));
  if (!match) throw new Error(`no button ${label}`);
  return / disabled=""/.test(match[0]);
}

describe("/recipes/$slug/cook", () => {
  test("step 0 is the first component's ingredient card, Prev disabled, no app nav", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart/cook");
    expect(html).toContain('data-card="ingredients"');
    expect(html).toContain(">Pastry<");
    expect(html).toContain("200 g flour");
    expect(html).not.toContain("3 lemons");
    expect(html).not.toContain("Rub the butter into the flour.");
    expect(html).toContain("1 of 5 · Pastry");
    expect(isDisabled(html, "Prev")).toBe(true);
    expect(isDisabled(html, "Next")).toBe(false);
    // Full-screen: the shell's nav is gone, and the way out is the Exit link.
    expect(html).not.toContain('aria-label="Main"');
    expect(html).toContain('href="/recipes/lemon-tart"');
    expect(html).toContain(">Exit<");
    expect(html).toContain("Lemon tart");
    // Scale control is present and bound to the loaded servings.
    expect(html).toContain('aria-label="Serves"');
    expect(html).toMatch(/aria-label="Serves".*?<input[^>]*value="4"/);
    expect(html).toContain('role="progressbar"');
  });

  test("a step card shows the step alone in large type with its number within the component", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart/cook?step=1");
    expect(html).toContain('data-card="step"');
    expect(html).toContain("Rub the butter into the flour.");
    expect(html).toMatch(/<p class="[^"]*text-3xl[^"]*">Rub the butter into the flour\.<\/p>/);
    expect(html).toContain("Step <!-- -->1<!-- --> of <!-- -->1");
    expect(html).toContain("2 of 5 · Pastry");
    expect(html).not.toContain("200 g flour");
    expect(isDisabled(html, "Prev")).toBe(false);
    expect(isDisabled(html, "Next")).toBe(false);
  });

  test("the second component's ingredient card marks the fixed row and scales the rest", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart/cook?step=2&servings=8");
    expect(html).toContain(">Filling<");
    expect(html).toContain("6 lemons");
    expect(html).toMatch(/data-fixed="true"[^>]*>(<[^>]*>)*1 vanilla pod/);
    expect(html).toContain(">fixed<");
    expect(html).toContain("3 of 5 · Filling");
    expect(html).toMatch(/aria-label="Serves".*?<input[^>]*value="8"/);
    // Exit keeps the scale.
    expect(html).toContain('href="/recipes/lemon-tart?servings=8"');
  });

  test("the last card is the recipe-level step with Next disabled; an overshoot clamps to it", async () => {
    await seedTart();
    for (const step of [4, 99]) {
      const html = await renderRoute(`/recipes/lemon-tart/cook?step=${step}`);
      expect(html).toContain("Bake for 30 minutes.");
      expect(html).toContain("5 of 5 · To finish");
      expect(isDisabled(html, "Next")).toBe(true);
      expect(isDisabled(html, "Prev")).toBe(false);
    }
  });

  test("a malformed step fails validation and renders the error view", async () => {
    await seedTart();
    for (const bad of ["-1", "1.5", "two"]) {
      const html = await renderRoute(`/recipes/lemon-tart/cook?step=${bad}`);
      expect(html).toContain("Something went wrong");
    }
  });

  test("no servings hides the scale control; an unnamed component has no heading in the indicator", async () => {
    await callServerFn(createRecipe, {
      name: "Toast",
      components: [{ name: "", ingredients: [{ quantity: 1, food: food("bread slice", "bread slices") }], steps: [{ text: "Toast it." }] }],
    });
    const html = await renderRoute("/recipes/toast/cook?step=1");
    expect(html).toContain("Toast it.");
    expect(html).toContain(">2 of 2<");
    expect(html).not.toContain('aria-label="Serves"');
  });

  test("a recipe with nothing to cook says so", async () => {
    await callServerFn(createRecipe, { name: "Air", components: [{ name: "" }] });
    const html = await renderRoute("/recipes/air/cook");
    expect(html).toContain("Nothing to cook yet");
    expect(html).toContain(">0 of 0<");
    expect(isDisabled(html, "Prev")).toBe(true);
    expect(isDisabled(html, "Next")).toBe(true);
  });

  test("a missing slug renders the not-found view", async () => {
    expect(await renderRoute("/recipes/nothing-here/cook")).toContain("Not found");
  });

  test("phone width: single column, no fixed widths on the page or its cards", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart/cook");
    // Page column is fluid (w-full, max-w) and the header wraps.
    expect(html).toMatch(/<main class="[^"]*w-full max-w-3xl[^"]*flex-col/);
    expect(html).toMatch(/<header class="[^"]*flex-wrap/);
    // No fixed widths beyond the design system's controls (icon buttons w-8, the stepper input w-20).
    const wide = (html.match(/\bw-\d+\b/g) ?? []).filter((c) => Number(c.slice(2)) > 20);
    expect(wide).toEqual([]);
    expect(html).not.toMatch(/\b(?:min-)?w-\[/);
  });

  test("the view page links to cook mode, carrying the requested scale", async () => {
    await seedTart();
    expect(await renderRoute("/recipes/lemon-tart")).toContain('href="/recipes/lemon-tart/cook"');
    expect(await renderRoute("/recipes/lemon-tart?servings=8")).toContain('href="/recipes/lemon-tart/cook?servings=8"');
  });
});

describe("stepForKey", () => {
  test("arrows move within the deck and stop at the ends; other keys are ignored", () => {
    expect(stepForKey("ArrowRight", 0, 5)).toBe(1);
    expect(stepForKey("ArrowLeft", 3, 5)).toBe(2);
    expect(stepForKey("ArrowLeft", 0, 5)).toBeNull();
    expect(stepForKey("ArrowRight", 4, 5)).toBeNull();
    expect(stepForKey("ArrowRight", 0, 0)).toBeNull();
    expect(stepForKey("Enter", 2, 5)).toBeNull();
  });
});

describe("positionLabel", () => {
  test("counts from one and appends the component name when there is one", () => {
    expect(positionLabel(0, 5, "Pastry")).toBe("1 of 5 · Pastry");
    expect(positionLabel(4, 5, "")).toBe("5 of 5");
  });
});

describe("loader and search types", () => {
  test("compile-time only", () => {
    const data: (typeof CookRoute)["types"]["loaderData"] = undefined as unknown as Recipe;
    const search: (typeof CookRoute)["types"]["searchSchema"] = { step: 0 };
    void data;
    void search;
  });
});
