// StepCard (M29.1): the one card the recipe page and cook mode both render.
// What is checked here is what the card promises — the linked ingredients as
// real `IngredientRow`s on the shared session ticks, the step's text through
// the safe subset, a footer of timer chips deduplicated by length, the tick
// that dims and collapses it, and the two type scales.
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test } from "vitest";
import { QuickEditProvider } from "../../../../../src/routes/recipes/recipe/components/QuickEdit";
import { StepCard } from "../../../../../src/routes/recipes/recipe/components/StepCard";
import { linkedIngredients, stepDurations } from "../../../../../src/routes/recipes/recipe/components/StepCard";
import type { Ingredient, Recipe, Step } from "../../../../../src/domain/recipe";
import type { Food } from "../../../../../src/domain/reference";
import { setIngredientTicked, setStepTicked, type StorageLike } from "../../../../../src/lib/ticks";

const RECIPE_ID = "11111111-1111-4111-8111-111111111111";
const STEP_ID = "33333333-3333-4333-8333-333333333333";

let seq = 0;
const uuid = () => `55555555-5555-4555-8555-${String(seq++).padStart(12, "0")}`;

const food = (name: string, pluralName: string | null = null): Food => ({
  id: uuid(),
  name,
  pluralName,
  aliases: [],
  aisle: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
});

const ingredient = (quantity: number | null, f: Food): Ingredient => ({
  id: uuid(),
  quantity,
  unit: null,
  food: f,
  note: "",
  originalText: "",
  fixed: false,
});

const step = (text: string, ingredientIds: string[] = [], id = STEP_ID): Step => ({ id, text, ingredientIds, image: null });

/** An in-memory sessionStorage, so the tick hooks read what a test seeds. */
function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
}

function withStorage(storage: StorageLike) {
  (globalThis as { window?: unknown }).window = { sessionStorage: storage };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("linkedIngredients", () => {
  const eggs = ingredient(2, food("egg", "eggs"));
  const flour = ingredient(200, food("flour"));

  test("resolves the ids in link order, not list order", () => {
    expect(linkedIngredients(step("Mix", [flour.id, eggs.id]), [eggs, flour]).map((row) => row.id)).toEqual([flour.id, eggs.id]);
  });

  test("a step with no links, and an id with no row, resolve to nothing", () => {
    expect(linkedIngredients(step("Mix"), [eggs, flour])).toEqual([]);
    expect(linkedIngredients(step("Mix", ["99999999-9999-4999-8999-999999999999"]), [eggs])).toEqual([]);
  });
});

describe("stepDurations", () => {
  test("one entry per duration, deduplicated by length", () => {
    expect(stepDurations("Simmer 20 minutes, rest 20 minutes, then 5 min.").map((d) => d.seconds)).toEqual([1200, 300]);
  });

  test("text naming no duration has none", () => {
    expect(stepDurations("Crack 2 eggs into the bowl")).toEqual([]);
  });
});

describe("StepCard", () => {
  const eggs = ingredient(2, food("egg", "eggs"));
  const flour = ingredient(200, food("flour"));
  const part = [eggs, flour];

  test("a card with two linked ingredients renders them as rows, in two columns from md", () => {
    withStorage(fakeStorage());
    const html = renderToString(
      <StepCard recipeId={RECIPE_ID} step={step("Beat the **eggs** into the flour", [eggs.id, flour.id])} position={1} ingredients={part} />,
    );
    expect(html).toContain('data-testid="step-card"');
    // A quiet card: a border, no shadow of its own (the checkbox brings one).
    const card = html.slice(0, html.indexOf(">"));
    expect(card).toContain("rounded-xl border border-border-normal");
    expect(card).not.toContain("shadow");
    expect(html).toContain('aria-label="Ingredients for this step"');
    expect((html.match(/data-testid="ingredient-row"/g) ?? []).length).toBe(2);
    expect(html).toContain("2 eggs");
    expect(html).toContain("200 flour");
    expect(html).toContain("md:grid-cols-3");
    expect(html).toMatch(/<strong[^>]*>eggs<\/strong>/);
    expect(html).toContain("Step 1. ");
  });

  test("a card linking nothing has no list and no grid", () => {
    withStorage(fakeStorage());
    const html = renderToString(<StepCard recipeId={RECIPE_ID} step={step("Rest it")} position={2} ingredients={part} />);
    expect(html).not.toContain('data-testid="step-ingredients"');
    expect(html).not.toContain("md:grid-cols-3");
    expect(html).toContain("Step 2. ");
  });

  test("a linked row reads its tick from the shared store", () => {
    const storage = fakeStorage();
    setIngredientTicked(storage, RECIPE_ID, eggs.id, true);
    withStorage(storage);

    const html = renderToString(<StepCard recipeId={RECIPE_ID} step={step("Beat the eggs", [eggs.id])} position={1} ingredients={part} />);
    expect(html).toMatch(/data-testid="ingredient-row"[^>]*data-ticked="true"/);
  });

  test("the same row linked from two steps shows on both cards", () => {
    withStorage(fakeStorage());
    const html = renderToString(
      <ol>
        <StepCard recipeId={RECIPE_ID} step={step("Melt the butter", [flour.id])} position={1} ingredients={part} />
        <StepCard recipeId={RECIPE_ID} step={step("And the rest", [flour.id], "44444444-4444-4444-8444-444444444444")} position={2} ingredients={part} />
      </ol>,
    );
    expect((html.match(/data-testid="ingredient-row"/g) ?? []).length).toBe(2);
  });

  test("an unticked step is neither dimmed nor collapsed", () => {
    withStorage(fakeStorage());
    const html = renderToString(<StepCard recipeId={RECIPE_ID} step={step("Mix")} position={1} />);
    expect(html).not.toContain('data-ticked="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain("line-clamp-1");
    expect(html).not.toContain("opacity-60");
  });

  test("tapping the text still ticks the step: it dims and collapses", () => {
    const storage = fakeStorage();
    setStepTicked(storage, RECIPE_ID, STEP_ID, true);
    withStorage(storage);

    const html = renderToString(<StepCard recipeId={RECIPE_ID} step={step("Mix", [eggs.id])} position={1} ingredients={part} />);
    expect(html).toContain('data-testid="step-toggle"');
    expect(html).toContain('data-ticked="true"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("opacity-60");
    expect(html).toContain("line-clamp-1");
    expect(html).toContain("Step 1. Done. ");
    // A collapsed card is one line: its rows go with the text.
    expect(html).not.toContain('data-testid="step-ingredients"');
  });

  test("ticks are per recipe", () => {
    const storage = fakeStorage();
    setStepTicked(storage, "99999999-9999-4999-8999-999999999999", STEP_ID, true);
    withStorage(storage);

    expect(renderToString(<StepCard recipeId={RECIPE_ID} step={step("Mix")} position={1} />)).not.toContain('data-ticked="true"');
  });

  test("a duration in the text becomes a chip in the footer, not in the prose", () => {
    withStorage(fakeStorage());
    const html = renderToString(<StepCard recipeId={RECIPE_ID} step={step("Rest for 20 minutes.")} position={1} />);
    expect(html).toContain('data-testid="step-timers"');
    expect(html).toContain('data-testid="timer-chip"');
    expect(html).toContain('data-seconds="1200"');
    // The text is untouched: the chip sits after the markdown, not inside it.
    expect(html).toMatch(/whitespace-pre-line">Rest for 20 minutes\.<\/p>/);
  });

  test("two mentions of the same length get one chip; a step naming none gets no footer", () => {
    withStorage(fakeStorage());
    const twice = renderToString(<StepCard recipeId={RECIPE_ID} step={step("Simmer 20 minutes, then rest 20 minutes.")} position={1} />);
    expect((twice.match(/data-testid="timer-chip"/g) ?? []).length).toBe(1);

    const none = renderToString(<StepCard recipeId={RECIPE_ID} step={step("Beat the eggs.")} position={1} />);
    expect(none).not.toContain('data-testid="timer-chip"');
    expect(none).not.toContain('data-testid="step-timers"');
  });

  test("size cook is the same card in the cook deck's type scale", () => {
    withStorage(fakeStorage());
    const props = { recipeId: RECIPE_ID, step: step("Rest for 20 minutes.", [eggs.id]), position: 1, ingredients: part };
    const page = renderToString(<StepCard {...props} size="page" />);
    const cook = renderToString(<StepCard {...props} size="cook" />);

    expect(page).toContain('data-size="page"');
    expect(page).not.toContain("text-3xl");
    expect(cook).toContain('data-size="cook"');
    expect(cook).toContain("text-3xl");
    // Same content at both sizes: the rows, the text and the timer chip.
    for (const html of [page, cook]) {
      expect(html).toContain('data-testid="ingredient-row"');
      expect(html).toContain("Rest for 20 minutes.");
      expect(html).toContain('data-testid="timer-chip"');
    }
  });

  // M35.1: a step's photo, above its text at both sizes, bigger on the deck.
  test("a step with a photo shows it above the text at both sizes", () => {
    withStorage(fakeStorage());
    const photographed = { ...step("Knead until smooth.", [flour.id]), image: "33333333-3333-4333-8333-333333333333.jpg" };
    const props = { recipeId: RECIPE_ID, step: photographed, position: 3, ingredients: part };
    const page = renderToString(<StepCard {...props} size="page" />);
    const cook = renderToString(<StepCard {...props} size="cook" />);

    for (const html of [page, cook]) {
      expect(html).toContain('data-testid="step-image"');
      expect(html).toContain('src="/api/images/steps/33333333-3333-4333-8333-333333333333.jpg"');
      expect(html).toContain('alt="Step 3"');
      // Above the text, not beside it or below it.
      expect(html.indexOf('data-testid="step-image"')).toBeLessThan(html.indexOf('data-testid="step-toggle"'));
    }
    expect(page).toContain("max-h-48");
    expect(cook).toContain("max-h-80");
  });

  test("a step with no photo renders no image, and a ticked one puts its photo away with the rest of the detail", () => {
    withStorage(fakeStorage());
    expect(renderToString(<StepCard recipeId={RECIPE_ID} step={step("Knead it.")} position={1} />)).not.toContain('data-testid="step-image"');

    const storage = fakeStorage();
    setStepTicked(storage, RECIPE_ID, STEP_ID, true);
    withStorage(storage);
    const ticked = renderToString(<StepCard recipeId={RECIPE_ID} step={{ ...step("Knead it."), image: "a.jpg" }} position={1} />);
    expect(ticked).toContain('data-ticked="true"');
    expect(ticked).not.toContain('data-testid="step-image"');
  });
});

// M29.4: the long-press pencil is gone. Inside a QuickEditProvider the card
// gets a quiet "…" menu in its corner instead, one item, "Edit step" —
// checked here rather than in QuickEdit.test.tsx since it is StepCard that
// wires the trigger on.
describe("StepCard's quick-edit menu (M29.4)", () => {
  const PART_ID = "66666666-6666-4666-8666-666666666666";

  const recipe: Recipe = {
    id: "77777777-7777-4777-8777-777777777777",
    slug: "test-recipe",
    name: "Test recipe",
    description: "",
    image: null,
    rating: null,
    lastMade: null,
    favourite: false,
    recipeServings: 4,
    recipeYieldQuantity: 0,
    yieldUnit: null,
    recipeYield: "",
    prepTime: null,
    performTime: null,
    sourceUrl: null,
    notes: [],
    tags: [],
    parts: [{ id: PART_ID, name: "", ingredients: [], steps: [step("Mix")] }],
    restyledAt: null,
    createdAt: "2026-03-04T02:30:00.000Z",
    updatedAt: "2026-03-04T02:30:00.000Z",
  };

  async function renderInProvider(): Promise<string> {
    const rootRoute = createRootRoute({
      component: () => (
        <QuickEditProvider recipe={recipe}>
          <StepCard recipeId={RECIPE_ID} step={step("Mix")} position={1} partId={PART_ID} />
        </QuickEditProvider>
      ),
    });
    const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ["/"] }) });
    await router.load();
    return renderToString(<RouterProvider router={router} />);
  }

  test("carries a 'Step actions' menu trigger, not a pencil, marked hidden from print", async () => {
    withStorage(fakeStorage());
    const html = await renderInProvider();
    expect(html).toContain('data-testid="menu-trigger"');
    expect(html).toContain('aria-label="Step actions"');
    expect(html).toContain('data-print="hide"');
    expect(html).not.toContain('data-testid="quick-edit-trigger"');
  });

  test("closed by default: the Edit step item and the sheet are not in the markup", async () => {
    withStorage(fakeStorage());
    const html = await renderInProvider();
    expect(html).not.toContain('role="menu"');
    expect(html).not.toContain(">Edit step<");
  });
});
