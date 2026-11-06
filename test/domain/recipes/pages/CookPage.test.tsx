// Cook mode end to end on a phone: the route renders one card of the deck per
// `step`, scaled by `servings`, with Back and Next disabled at the ends and no
// app nav. A phone's deck is one step a card, moved sideways (decisions.md row
// 208); the sideways movement itself is driven in CookPage.phone.dom.test.tsx.
import { afterEach, describe, expect, test, vi } from "vitest";
import { createRecipe } from "../../../../src/api/rpc/recipes";
import { listUnits } from "../../../../src/api/rpc/units";
import { stepForKey } from "../../../../src/domain/recipes/recipe";
import type { recipeCook as CookRoute, CookRouteData } from "../../../../src/domain/recipes/routes/cook";
import { type StorageLike, setIngredientTicked } from "../../../../src/lib/ticks";
import { renderRoute } from "../../../helpers/routes";
import { callServerFn, useTempDataDir } from "../../../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../../../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../../../src/api/rpc/recipes", local);
vi.mock("../../../../src/api/rpc/timeline", local);
vi.mock("../../../../src/api/rpc/foods", local);
vi.mock("../../../../src/api/rpc/units", local);
vi.mock("../../../../src/api/rpc/tags", local);
vi.mock("../../../../src/api/rpc/aisles", local);
// The wake lock only ever turns on from an effect that never fires in a
// renderToString test, so the header's indicator is forced on here to render
// and assert it (M26.4).
vi.mock("../../../../src/lib/useWakeLock", () => ({ useWakeLock: () => true }));

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

/** Whether the button named `label` (its `aria-label`, or the text it starts with) carries the `disabled` attribute (not the `disabled:` class prefix). */
function isDisabled(html: string, label: string): boolean {
  const match = html.match(new RegExp(`<button(?=[^>]*aria-label="${label}")[^>]*>|<button[^>]*>${label}(?=<)`));
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
  test("step 0 is the first component's ingredient card, Back disabled, no app nav", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart/cook");
    expect(html).toContain('data-card="ingredients"');
    expect(html).toMatch(/data-position[^>]*>Pastry</);
    expect(html).toContain("200 g flour");
    expect(html).not.toContain("3 lemons");
    // One card at a time: the next step's words are not drawn beside it; the big Next is the way on.
    expect(html).not.toContain("Rub the butter into the flour.");
    expect(html).not.toContain("next-preview");
    expect(isDisabled(html, "Back")).toBe(true);
    expect(isDisabled(html, "Next step")).toBe(false);
    // The way out is the ✕, named Exit. Full-screen — the shell's nav gone — is
    // drawn once the page is the browser's (decisions.md row 169), so it is
    // held in test/routes/shell.dom.test.tsx, not in this server render.
    expect(html).toMatch(/<a(?=[^>]*href="\/recipes\/lemon-tart")[^>]*aria-label="Exit"/);
    expect(html).toContain("Lemon tart");
    // Scale control is present and bound to the loaded servings: one
    // "Serves 4" button in the header, opening the stepper (critique #5).
    expect(html).toMatch(/data-serves[^>]*>Serves <!-- -->4</);
    expect(html).toMatch(/data-cook-title="[^"]*">Lemon tart<\/h1>/);
    // A segment per card, Finished included, across the header.
    expect(html).toMatch(/role="progressbar" aria-label="Cook progress" aria-valuemin="1" aria-valuemax="6" aria-valuenow="1"/);
    expect(html).toContain('data-cook-layout="cards"');
  });

  // Critique #5 (reverses M26.4's lone icon): the wake lock is said in
  // words, at the foot under Next, leaving the header to the name.
  test("the wake-lock note is the eye with the words, in the footer", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart/cook");
    expect(html).toMatch(/<footer[\s\S]*data-wake-lock[^>]*>\s*<svg[\s\S]*?<\/svg>The screen stays on while you cook</);
    expect(html).not.toMatch(/<header[\s\S]*data-wake-lock[\s\S]*<\/header>/);
  });

  test("a step card shows the step alone in large type, where it sits at its head", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart/cook?step=1");
    expect(html).toContain('data-card="step"');
    expect(html).toMatch(/<div class="[^"]*text-2xl[^"]*" data-testid="markdown">/);
    expect(html).toContain('<p class="whitespace-pre-line">Rub the butter into the flour.</p>');
    // The card's one counter names the part; the live region says it too.
    expect(html).toMatch(/data-position[^>]*>Pastry · Step 1 of 1</);
    expect(html.match(/Step 1 of 1/g)).toHaveLength(2);
    // This step links nothing, so the part's list is not on the card either.
    expect(html).not.toContain('data-testid="cook-ingredient"');
    expect(html).not.toContain('data-testid="step-ingredients"');
    expect(isDisabled(html, "Back")).toBe(false);
    expect(isDisabled(html, "Next step")).toBe(false);
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

    // What the step needs, as chips at the card's top.
    const stepCard = await renderRoute("/recipes/shortcrust/cook?step=1");
    expect(stepCard).toContain('data-card="step"');
    expect(stepCard).toMatch(/data-testid="step-ingredients"[\s\S]*Tick off 100 g butter[\s\S]*Rub the butter into the flour\./);
    expect(stepCard).toContain('data-testid="need-chip"');
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
    expect(html).toMatch(/data-position[^>]*>Filling</);
    expect(html).toContain("6 lemons");
    expect(html).toMatch(/data-fixed="true"[^>]*>(<[^>]*>)*1 vanilla pod/);
    expect(html).toContain(">fixed<");
    expect(html).toMatch(/data-serves[^>]*>Serves <!-- -->8</);
    // Exit keeps the scale.
    expect(html).toContain('href="/recipes/lemon-tart?servings=8"');
  });

  test("the last card is the unnamed part's step, with Next now enabled onto Finished", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart/cook?step=4");
    // "30 minutes" is its own timer chip now (M26.2), so the sentence is no longer one contiguous string.
    expect(html).toContain("Bake for");
    expect(html).toContain("30 minutes");
    expect(html).toMatch(/data-position[^>]*>Step 1 of 1</);
    // Its timer, at the card's foot.
    expect(html).toContain("Start 30 minute timer");
    // The last card's Next is Finish.
    expect(isDisabled(html, "Finish")).toBe(false);
    expect(isDisabled(html, "Back")).toBe(false);
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
      expect(isDisabled(html, "Next step")).toBe(true);
      expect(isDisabled(html, "Back")).toBe(false);
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

  test("no servings hides the scale control; an unnamed part has no part heading", async () => {
    await callServerFn(createRecipe, {
      name: "Toast",
      parts: [{ name: "", ingredients: [{ quantity: 1, food: food("bread slice", "bread slices") }], steps: [{ text: "Toast it." }] }],
    });
    const html = await renderRoute("/recipes/toast/cook?step=1");
    expect(html).toContain("Toast it.");
    expect(html).toMatch(/data-position[^>]*>Step 1 of 1</);
    expect(html).not.toContain("data-serves");
  });

  test("a recipe with nothing to cook says so", async () => {
    await callServerFn(createRecipe, { name: "Air", parts: [{ name: "" }] });
    const html = await renderRoute("/recipes/air/cook");
    expect(html).toContain("Nothing to cook yet");
    expect(html).not.toContain("data-position");
    expect(isDisabled(html, "Back")).toBe(true);
    expect(isDisabled(html, "Next step")).toBe(true);
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

  // Critique #5: the deck's own controls are 48px targets and brand is Next's
  // alone; the part pills are a step smaller, in the header's row.
  test("the deck's controls are 48px tall, the current part is a neutral fill, and only Next is brand", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart/cook?step=2");
    const buttons = [...html.matchAll(/<(?:button|a)\b[^>]*class="([^"]*)"[^>]*>/g)].map((m) => m[0]);
    const controls = buttons.filter((tag) => /\bbtn\b/.test(tag) && !tag.includes("data-pill"));
    expect(controls.length).toBeGreaterThanOrEqual(4); // Exit, Serves, Back, Next
    for (const tag of controls) expect(tag).toMatch(/\bh-12\b/);
    const current = buttons.find((tag) => tag.includes('data-pill="Filling"'));
    expect(current).toContain('data-intent="neutral"');
    expect(current).toContain('data-variant="solid"');
    const brand = buttons.filter((tag) => tag.includes('data-intent="brand"'));
    expect(brand).toHaveLength(1);
    expect(brand[0]).toContain('data-variant="solid"');
    // Ingredient rows: the text button's overlay covers the whole row.
    expect(html).toMatch(/data-testid="cook-ingredient"[^>]*>/);
    expect(html).toMatch(/<li class="relative[^"]*"[^>]*data-testid="cook-ingredient"/);
    expect(html).toContain("after:inset-0");
  });

  test("the finished card's buttons are 48px too", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart/cook?step=5");
    const card = html.slice(html.indexOf('data-card="finished"'), html.indexOf("</footer>"));
    const tags = [...card.matchAll(/<(?:button|a)\b[^>]*\bbtn\b[^>]*>/g)].map((m) => m[0]);
    expect(tags.length).toBeGreaterThanOrEqual(3);
    for (const tag of tags) expect(tag).toMatch(/\bh-12\b/);
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

  test("phone width: one card filling the screen between the header and the foot, no fixed widths", async () => {
    await seedTart();
    // Cook mode's page, from the shell's <main> on: before hydration the
    // shell's sidebar (w-56) is drawn beside it (decisions.md row 169).
    const rendered = await renderRoute("/recipes/lemon-tart/cook");
    const html = rendered.slice(rendered.indexOf('<main class="min-w-0'));
    // The screen is the deck: the card takes the height left, and scrolls itself when a step runs long.
    expect(html).toMatch(/class="flex h-dvh flex-col overflow-hidden[^"]*"[^>]*data-cook-layout="cards"/);
    expect(html).toMatch(/<main class="[^"]*flex-1[^"]*touch-pan-y/);
    expect(html).toMatch(/class="[^"]*overflow-y-auto[^"]*rounded-\[1\.5rem\][^"]*"[^>]*data-testid="cook-card"/);
    expect(html).toMatch(/<h1 class="[^"]*line-clamp-2[^"]*" data-cook-title/);
    // No fixed widths beyond the design system's controls (a square 48px button is w-12).
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

describe("loader and search types", () => {
  test("compile-time only", () => {
    const data: (typeof CookRoute)["types"]["loaderData"] = undefined as unknown as CookRouteData;
    const search: (typeof CookRoute)["types"]["searchSchema"] = { step: 0, from: "sweet-pastry" };
    void data;
    void search;
  });
});
