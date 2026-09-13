// StepList: the ordering around the cards. Everything a single step renders
// is `StepCard`'s (test/components/StepCard.test.tsx); what is checked here is
// that the list numbers its steps, labels itself, and hands each card the
// part's rows so a link resolves.
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test } from "vitest";
import { StepList } from "../../src/components/StepList";
import type { Food, Ingredient, Step } from "../../src/domain/recipe";
import type { StorageLike } from "../../src/lib/ticks";

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

describe("StepList", () => {
  test("numbers each step, in order, as cards", () => {
    withStorage(fakeStorage());
    const html = renderToString(
      <StepList recipeId={RECIPE_ID} steps={[step("Mix the **dough**"), step("Rest it", [], "44444444-4444-4444-8444-444444444444")]} />,
    );
    expect(html).toContain('aria-label="Steps"');
    expect((html.match(/data-testid="step-card"/g) ?? []).length).toBe(2);
    expect(html).toMatch(/<strong[^>]*>dough<\/strong>/);
    expect(html).toContain("Step 1. ");
    expect(html).toContain("Step 2. ");
  });

  test("the part's rows reach the card, so a link resolves", () => {
    withStorage(fakeStorage());
    const eggs = ingredient(2, food("egg", "eggs"));
    const html = renderToString(<StepList recipeId={RECIPE_ID} steps={[step("Beat them in", [eggs.id])]} ingredients={[eggs]} />);
    expect(html).toContain('aria-label="Ingredients for this step"');
    expect(html).toContain("2 eggs");
  });

  test("an empty list of steps is an empty list", () => {
    withStorage(fakeStorage());
    const html = renderToString(<StepList recipeId={RECIPE_ID} steps={[]} />);
    expect(html).toContain('aria-label="Steps"');
    expect(html).not.toContain('data-testid="step-card"');
  });
});
