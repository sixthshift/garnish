// Cook mode end to end: the route renders one card of the deck per `step`,
// scaled by `servings`, with Prev/Next disabled at the ends and no app nav.
// Stands in for the plan's phone-width manual check (no browser here): the
// layout is a single column with no fixed widths, asserted below by class.
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Recipe } from "../../src/domain/recipe";
import { Route as CookRoute, positionLabel, stepForKey } from "../../src/routes/recipes/$slug/cook";
import { createRecipe } from "../../src/server/recipes";
import { listUnits } from "../../src/server/units";
import { setIngredientTicked, type StorageLike } from "../../src/lib/ticks";
import { renderRoute } from "../helpers/routes";
import { callServerFn, useTempDataDir } from "../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../src/server/recipes", local);
vi.mock("../../src/server/timeline", local);
vi.mock("../../src/server/units", local);
vi.mock("../../src/server/tags", local);
vi.mock("../../src/server/aisles", local);
// The wake lock only ever turns on from an effect that never fires in a
// renderToString test, so the header's indicator is forced on here to render
// and assert it (M26.4).
vi.mock("../../src/lib/useWakeLock", () => ({ useWakeLock: () => true }));

useTempDataDir();

const food = (name: string, pluralName: string | null = null) => ({ id: crypto.randomUUID(), name, pluralName });

// Deck: 0 Pastry ingredients, 1 Pastry step, 2 Filling ingredients, 3 Filling step, 4 the unnamed part's step.
async function seedTart() {
  const units = await callServerFn(listUnits, {});
  const gram = units.find((u) => u.abbreviation === "g")!;
  return callServerFn(createRecipe, {
    name: "Lemon tart",
    recipeServings: 4,
    parts: [
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
      { name: "", steps: [{ text: "Bake for 30 minutes." }] },
    ],
  });
}

/** Whether the button whose text is `label` carries the `disabled` attribute (not the `disabled:` class prefix). */
function isDisabled(html: string, label: string): boolean {
  const match = html.match(new RegExp(`<button[^>]*>${label}</button>`));
  if (!match) throw new Error(`no button ${label}`);
  return / disabled=""/.test(match[0]);
}

/** An in-memory sessionStorage, so useIngredientTick reads what a test seeds. */
function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("/recipes/$slug/cook", () => {
  test("step 0 is the first component's ingredient card, Prev disabled, no app nav", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart/cook");
    expect(html).toContain('data-card="ingredients"');
    expect(html).toContain(">Pastry<");
    expect(html).toContain("200 g flour");
    expect(html).not.toContain("3 lemons");
    // The next step's text doesn't leak into the ingredient list; it appears
    // once, as the "Next: …" preview at the card's foot (M26.4).
    expect(html.match(/Rub the butter into the flour\./g)).toHaveLength(1);
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

  // M26.4: "Screen on" becomes an icon in a tooltip, keeping the wake-lock hook.
  test("the header's wake-lock indicator is an icon in a tooltip, not the words 'Screen on'", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart/cook");
    expect(html).not.toContain("Screen on");
    expect(html).toMatch(/data-wake-lock[^>]*aria-label="The screen stays on while you cook"/);
    expect(html).toMatch(/aria-label="The screen stays on while you cook"[^>]*>\s*<svg/);
  });

  test("a step card shows the step alone in large type with its number within the component", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart/cook?step=1");
    expect(html).toContain('data-card="step"');
    expect(html).toContain("Rub the butter into the flour.");
    // The step is dealt through StepCard (M29.2), the same component as the view page.
    expect(html).toContain('data-testid="step-card"');
    expect(html).toContain('data-size="cook"');
    expect(html).toMatch(/<div class="[^"]*text-3xl[^"]*" data-testid="markdown">/);
    expect(html).toContain('<p class="whitespace-pre-line">Rub the butter into the flour.</p>');
    expect(html).toContain("Step <!-- -->1<!-- --> of <!-- -->1");
    expect(html).toContain("2 of 5 · Pastry");
    // This step links nothing, so the part's list is not on the card either.
    expect(html).not.toContain('data-testid="cook-ingredient"');
    expect(html).not.toContain('data-testid="step-ingredients"');
    expect(isDisabled(html, "Prev")).toBe(false);
    expect(isDisabled(html, "Next")).toBe(false);
  });

  // M29.2: the ingredients card at the front of a part holds only the rows no
  // step of that part links; a linked row is read on its own step card instead.
  test("a linked ingredient appears on its own step card, not on the part's ingredients card", async () => {
    const units = await callServerFn(listUnits, {});
    const gram = units.find((u) => u.abbreviation === "g")!;
    const flourId = crypto.randomUUID();
    const butterId = crypto.randomUUID();
    await callServerFn(createRecipe, {
      name: "Shortcrust",
      parts: [
        {
          name: "Pastry",
          ingredients: [
            { id: flourId, quantity: 200, unit: gram, food: food("flour") },
            { id: butterId, quantity: 100, unit: gram, food: food("butter") },
          ],
          steps: [{ text: "Rub the butter into the flour.", ingredientIds: [butterId] }],
        },
      ],
    });

    const ingredientsCard = await renderRoute("/recipes/shortcrust/cook");
    expect(ingredientsCard).toContain('data-card="ingredients"');
    expect(ingredientsCard).toContain("Tick off 200 g flour");
    expect(ingredientsCard).not.toContain("Tick off 100 g butter");

    const stepCard = await renderRoute("/recipes/shortcrust/cook?step=1");
    expect(stepCard).toContain('data-card="step"');
    expect(stepCard).toContain('data-testid="step-ingredients"');
    expect(stepCard).toContain("Tick off 100 g butter");
  });

  // M29.2: a part where every ingredient is linked gets no ingredients card at all.
  test("a part with everything linked skips the ingredients card", async () => {
    const butterId = crypto.randomUUID();
    await callServerFn(createRecipe, {
      name: "Butter toast",
      parts: [
        {
          name: "",
          ingredients: [{ id: butterId, quantity: 1, food: food("butter knob", "butter knobs") }],
          steps: [{ text: "Spread the butter.", ingredientIds: [butterId] }],
        },
      ],
    });

    const html = await renderRoute("/recipes/butter-toast/cook");
    expect(html).not.toContain('data-card="ingredients"');
    expect(html).toContain('data-card="step"');
    expect(html).toContain("Tick off 1 butter knob");
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

  test("the last card is the unnamed part's step, with Next now enabled onto Finished", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart/cook?step=4");
    // "30 minutes" is its own timer chip now (M26.2), so the sentence is no longer one contiguous string.
    expect(html).toContain("Bake for");
    expect(html).toContain("30 minutes");
    expect(html).toContain("5 of 5");
    expect(isDisabled(html, "Next")).toBe(false);
    expect(isDisabled(html, "Prev")).toBe(false);
  });

  // M26.4: every card ends with a tappable one-line preview of the next one.
  test("a middle card (a step) previews the ingredients card that follows it", async () => {
    await seedTart();
    // Step 1 (deck index 1) is Pastry's only step; its next card is Filling's ingredients.
    const html = await renderRoute("/recipes/lemon-tart/cook?step=1");
    expect(html).toMatch(/data-testid="next-preview"[^>]*>Next: <!-- -->Ingredients for Filling</);
  });

  test("an ingredients card previews the step that follows it", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart/cook");
    expect(html).toContain('data-card="ingredients"');
    expect(html).toMatch(/data-testid="next-preview"[^>]*>Next: <!-- -->Rub the butter into the flour\.</);
  });

  test("the last card previews Finished", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart/cook?step=4");
    expect(html).toMatch(/data-testid="next-preview"[^>]*>Next: <!-- -->Finished</);
  });

  test("Finished follows the last card: a heading, a Made this shortcut and an Exit link, with Next disabled and an overshoot clamping to it", async () => {
    await seedTart();
    for (const step of [5, 99]) {
      const html = await renderRoute(`/recipes/lemon-tart/cook?step=${step}`);
      expect(html).toContain('data-card="finished"');
      expect(html).toContain(">Finished<");
      expect(html).toContain('data-testid="made-this"');
      expect(html).toContain(">Made this<");
      expect(html).toContain('href="/recipes/lemon-tart"');
      expect(html).toContain(">Exit<");
      expect(html).not.toContain("Bake for");
      expect(html).not.toContain("30 minutes");
      expect(isDisabled(html, "Next")).toBe(true);
      expect(isDisabled(html, "Prev")).toBe(false);
      expect(html).toMatch(/aria-live="polite"[^>]*data-announce[^>]*>Finished</);
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
      parts: [{ name: "", ingredients: [{ quantity: 1, food: food("bread slice", "bread slices") }], steps: [{ text: "Toast it." }] }],
    });
    const html = await renderRoute("/recipes/toast/cook?step=1");
    expect(html).toContain("Toast it.");
    expect(html).toContain(">2 of 2<");
    expect(html).not.toContain('aria-label="Serves"');
  });

  test("a recipe with nothing to cook says so", async () => {
    await callServerFn(createRecipe, { name: "Air", parts: [{ name: "" }] });
    const html = await renderRoute("/recipes/air/cook");
    expect(html).toContain("Nothing to cook yet");
    expect(html).toContain(">0 of 0<");
    expect(isDisabled(html, "Prev")).toBe(true);
    expect(isDisabled(html, "Next")).toBe(true);
  });

  test("part pills jump to each part's first card and mark the current one", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart/cook?step=2");
    expect(html).toContain('aria-label="Parts"');
    for (const name of ["Pastry", "Filling", ""]) expect(html).toContain(`data-pill="${name}"`);
    // The Filling card is showing, so only Filling's pill is current.
    expect(html).toMatch(/data-pill="Filling"[^>]*aria-current="true"|aria-current="true"[^>]*data-pill="Filling"/);
    expect(html).not.toMatch(/data-pill="Pastry"[^>]*aria-current/);
  });

  test("a single-component recipe has no pill bar", async () => {
    await callServerFn(createRecipe, {
      name: "Toast",
      parts: [{ name: "", ingredients: [{ quantity: 1, food: food("bread slice", "bread slices") }], steps: [{ text: "Toast it." }] }],
    });
    const html = await renderRoute("/recipes/toast/cook");
    expect(html).not.toContain('aria-label="Parts"');
    expect(html).not.toContain("data-pill=");
  });

  test("a live region announces the card, and the visible position line stays silent", async () => {
    await seedTart();
    const ingredients = await renderRoute("/recipes/lemon-tart/cook?step=2");
    expect(ingredients).toMatch(/aria-live="polite"[^>]*data-announce[^>]*>Ingredients for Filling</);
    const stepCard = await renderRoute("/recipes/lemon-tart/cook?step=1");
    expect(stepCard).toMatch(/data-announce[^>]*>Step 1 of 1</);
    // Only one live region on the page: the footer position line is not one.
    expect([...stepCard.matchAll(/aria-live=/g)]).toHaveLength(1);
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

  test("an ingredient ticked in cook mode reads back ticked on the view page: ticks.ts is shared, keyed by recipe and ingredient id", async () => {
    const tart = await seedTart();
    const flour = tart.parts[0]!.ingredients[0]!;

    const storage = fakeStorage();
    setIngredientTicked(storage, tart.id, flour.id, true);
    (globalThis as { window?: unknown }).window = { sessionStorage: storage };

    const cook = await renderRoute("/recipes/lemon-tart/cook");
    expect(cook).toMatch(/data-testid="cook-ingredient" data-ticked="true"/);

    const view = await renderRoute("/recipes/lemon-tart");
    expect(view).toMatch(/data-testid="ingredient-row" data-ticked="true"/);
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
