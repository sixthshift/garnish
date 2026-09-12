// StepList / StepRow: markdown rendering through the safe subset, the HTML
// injection case as it reaches the DOM, and the done state (dimmed, collapsed,
// read back from ticks.ts).
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test } from "vitest";
import { Markdown } from "../../src/components/Markdown";
import { StepList } from "../../src/components/StepList";
import type { Food, Ingredient, Step } from "../../src/domain/recipe";
import { setIngredientTicked, setStepTicked, type StorageLike } from "../../src/lib/ticks";

const RECIPE_ID = "11111111-1111-4111-8111-111111111111";
const STEP_ID = "33333333-3333-4333-8333-333333333333";

const step = (text: string, id = STEP_ID): Step => ({ id, text, ingredientIds: [] });

let seq = 0;
const uuid = () => `55555555-5555-4555-8555-${String(seq++).padStart(12, "0")}`;

const food = (name: string, pluralName: string | null = null, aliases: string[] = []): Food => ({
  id: uuid(),
  name,
  pluralName,
  aliases,
  aisle: null,
  recipeId: null,
  skipShopping: false,
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

/** An in-memory sessionStorage, so useStepTick reads what a test seeds. */
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

describe("Markdown", () => {
  test("bold, italics and a list become real elements", () => {
    const html = renderToString(<Markdown source={"Fold **gently** and *slowly*\n\n- salt\n- pepper"} />);
    expect(html).toMatch(/<strong[^>]*>gently<\/strong>/);
    expect(html).toContain("<em>slowly</em>");
    expect(html).toContain("<ul");
    expect(html).toContain("<li>salt</li>");
  });

  test("an ordered list keeps its start", () => {
    const html = renderToString(<Markdown source="3. simmer" />);
    expect(html).toMatch(/<ol[^>]*start="3"/);
  });

  test("HTML in a step is escaped, never markup", () => {
    const html = renderToString(<Markdown source={'<script>alert("x")</script><b>no</b>'} />);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;no&lt;/b&gt;");
  });

  test("blank source renders nothing", () => {
    expect(renderToString(<Markdown source="   " />)).toBe("");
  });
});

describe("StepList", () => {
  test("numbers each step and renders its markdown", () => {
    withStorage(fakeStorage());
    const html = renderToString(<StepList recipeId={RECIPE_ID} steps={[step("Mix the **dough**"), step("Rest it", "44444444-4444-4444-8444-444444444444")]} />);
    expect(html).toContain('aria-label="Steps"');
    expect(html).toMatch(/<strong[^>]*>dough<\/strong>/);
    expect(html).toContain("Step 1. ");
    expect(html).toContain("Step 2. ");
  });

  test("an unticked step is neither dimmed nor collapsed", () => {
    withStorage(fakeStorage());
    const html = renderToString(<StepList recipeId={RECIPE_ID} steps={[step("Mix")]} />);
    expect(html).not.toContain('data-ticked="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain("line-clamp-1");
    expect(html).not.toContain("opacity-60");
  });

  test("a ticked step dims and collapses its text", () => {
    const storage = fakeStorage();
    setStepTicked(storage, RECIPE_ID, STEP_ID, true);
    withStorage(storage);

    const html = renderToString(<StepList recipeId={RECIPE_ID} steps={[step("Mix")]} />);
    expect(html).toContain('data-ticked="true"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("opacity-60");
    expect(html).toContain("line-clamp-1");
    expect(html).toContain("Step 1. Done. ");
  });

  test("ticks are per recipe", () => {
    const storage = fakeStorage();
    setStepTicked(storage, "99999999-9999-4999-8999-999999999999", STEP_ID, true);
    withStorage(storage);

    const html = renderToString(<StepList recipeId={RECIPE_ID} steps={[step("Mix")]} />);
    expect(html).not.toContain('data-ticked="true"');
  });
});

// M26.1: the step's own ingredients as chips, phone only — from `md` the list
// is in the aside beside the method.
describe("StepRow ingredient chips", () => {
  const eggs = ingredient(2, food("egg", "eggs"));
  const flour = ingredient(200, food("flour"));
  const part = [eggs, flour];

  test("chips the ingredients the step names, amount and food, hidden from md", () => {
    withStorage(fakeStorage());
    const html = renderToString(<StepList recipeId={RECIPE_ID} steps={[step("Beat the eggs into the flour")]} ingredients={part} />);
    expect(html).toContain('aria-label="Ingredients in this step"');
    expect(html).toContain("md:hidden");
    expect(html).toContain("2 eggs");
    expect(html).toContain("200 flour");
    expect((html.match(/data-testid="step-ingredient-chip"/g) ?? []).length).toBe(2);
  });

  test("a step naming nothing gets no chip list, and neither does a list without ingredients", () => {
    withStorage(fakeStorage());
    expect(renderToString(<StepList recipeId={RECIPE_ID} steps={[step("Rest for ten minutes")]} ingredients={part} />)).not.toContain(
      'data-testid="step-ingredients"',
    );
    expect(renderToString(<StepList recipeId={RECIPE_ID} steps={[step("Beat the eggs")]} />)).not.toContain('data-testid="step-ingredients"');
  });

  test("a chip reads its tick from the shared store", () => {
    const storage = fakeStorage();
    setIngredientTicked(storage, RECIPE_ID, eggs.id, true);
    withStorage(storage);

    const html = renderToString(<StepList recipeId={RECIPE_ID} steps={[step("Beat the eggs into the flour")]} ingredients={part} />);
    expect(html).toMatch(/data-testid="step-ingredient-chip"[^>]*data-ticked="true"/);
    expect(html).toContain('aria-label="Tick off 2 eggs"');
  });

  test("a ticked step collapses, chips and all", () => {
    const storage = fakeStorage();
    setStepTicked(storage, RECIPE_ID, STEP_ID, true);
    withStorage(storage);

    const html = renderToString(<StepList recipeId={RECIPE_ID} steps={[step("Beat the eggs")]} ingredients={part} />);
    expect(html).not.toContain('data-testid="step-ingredients"');
  });
});

// M26.2: a duration named in a step's text becomes a TimerChip inline, through Markdown's decorator.
describe("StepRow duration chips", () => {
  test("a step naming a duration renders a timer chip", () => {
    withStorage(fakeStorage());
    const html = renderToString(<StepList recipeId={RECIPE_ID} steps={[step("Rest for 20 minutes.")]} />);
    expect(html).toContain('data-testid="timer-chip"');
    expect(html).toContain("20 minutes");
  });

  test("a step naming nothing gets no timer chip", () => {
    withStorage(fakeStorage());
    const html = renderToString(<StepList recipeId={RECIPE_ID} steps={[step("Beat the eggs.")]} />);
    expect(html).not.toContain('data-testid="timer-chip"');
  });
});
