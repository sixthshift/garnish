// The cooking module (decisions.md row 214): tonight's adjustments drawn on
// the recipe, and the review's suggestions kept in it or left as tonight's.
import { describe, expect, test } from "vitest";
import {
  type Adjustment,
  adjustmentMarks,
  decisionsFor,
  defaultDecision,
  fitsRecipe,
  isStale,
  keptRecipe,
  onceNote,
  type Resolve,
  sessionSuggestions,
  viewSuggestion,
  withAdjustment,
  withAdjustments,
} from "../../../../src/domain/recipes/cooking";
import type { Recipe } from "../../../../src/domain/recipes/recipe";
import type { Food, Unit } from "../../../../src/domain/recipes/reference";

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const food = (n: number, name: string): Food => ({
  id: uid(n),
  name,
  pluralName: null,
  aliases: [],
  aisle: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
});
const unit = (n: number, name: string): Unit => ({
  id: uid(n),
  name,
  pluralName: null,
  abbreviation: "",
  useAbbreviation: false,
  fraction: true,
  portion: false,
  standardQuantity: null,
  standardUnitId: null,
});

const CUP = unit(50, "cup");
const CELERY = uid(1);
const BEEF = uid(2);
const SALT = uid(3);
const SLOW = uid(10);
const SEAR = uid(11);

const ragu = (): Recipe =>
  ({
    id: uid(100),
    slug: "ragu",
    name: "Ragu",
    recipeServings: 4,
    parts: [
      {
        id: uid(200),
        name: "",
        ingredients: [
          { id: CELERY, quantity: 1, unit: CUP, food: food(60, "celery"), note: "diced", originalText: "", fixed: false, alternatives: [] },
          { id: BEEF, quantity: 1000, unit: unit(51, "g"), food: food(61, "chuck beef"), note: "", originalText: "", fixed: false, alternatives: [] },
          { id: SALT, quantity: null, unit: null, food: food(62, "salt"), note: "to taste", originalText: "", fixed: false, alternatives: [] },
        ],
        steps: [
          { id: SEAR, title: "", text: "Sear to brown.", summary: "", ingredientIds: [BEEF, CELERY], image: null },
          { id: SLOW, title: "", text: "Slow cook 2 hrs.", summary: "Lid on.", ingredientIds: [], image: null },
        ],
      },
    ],
  }) as unknown as Recipe;

const swap: Adjustment = { id: uid(900), kind: "swap", ingredientId: CELERY, food: "carrot", quantity: null, unit: null, summary: "Celery → carrot" };
const longer: Adjustment = { id: uid(901), kind: "step", stepId: SLOW, text: "Slow cook 3 hrs.", summary: "Slow cook 3 hrs" };
const tip: Adjustment = { id: uid(902), kind: "tip", stepId: SEAR, tip: "Sear in two batches.", summary: "Sear in batches" };
const less: Adjustment = { id: uid(903), kind: "amount", ingredientId: BEEF, quantity: 800, summary: "Beef 800 g" };
const noCelery: Adjustment = { id: uid(904), kind: "leave-out", ingredientId: CELERY, summary: "No celery" };

describe("tonight on the page", () => {
  test("withAdjustments draws each change and leaves the stored recipe alone", () => {
    const recipe = ragu();
    const tonight = withAdjustments(recipe, [swap, longer, tip, less]);
    const [celery, beef] = tonight.parts[0]!.ingredients;
    expect(celery!.food!.name).toBe("carrot");
    // The renamed food keeps its id, so the step's rows still find it.
    expect(celery!.food!.id).toBe(uid(60));
    expect(celery!.quantity).toBe(1);
    expect(beef!.quantity).toBe(800);
    expect(tonight.parts[0]!.steps[1]!.text).toBe("Slow cook 3 hrs.");
    expect(tonight.parts[0]!.steps[0]!.summary).toBe("Sear in two batches.");
    expect(recipe.parts[0]!.ingredients[0]!.food!.name).toBe("celery");
  });

  test("a swap with a unit draws it; a left-out line is unchanged and marked", () => {
    const tonight = withAdjustments(ragu(), [{ ...swap, quantity: 2, unit: "stalk" }]);
    expect(tonight.parts[0]!.ingredients[0]!.unit!.name).toBe("stalk");
    expect(tonight.parts[0]!.ingredients[0]!.quantity).toBe(2);
    expect(withAdjustments(ragu(), [noCelery]).parts[0]!.ingredients[0]!.food!.name).toBe("celery");
    expect(adjustmentMarks([noCelery]).get(CELERY)).toEqual({ adjustment: noCelery, leftOut: true });
  });

  test("one adjustment per row: a second change to a line replaces the first; a step keeps its words and its tip", () => {
    expect(withAdjustment([less], { ...less, id: uid(905), quantity: 700 }).map((a) => a.id)).toEqual([uid(905)]);
    expect(withAdjustment([swap], noCelery)).toEqual([noCelery]);
    const both = withAdjustment([longer], { ...tip, stepId: SLOW });
    expect(both).toHaveLength(2);
    expect(adjustmentMarks(both).get(SLOW)!.adjustment.kind).toBe("step");
  });

  test("fitsRecipe refuses a row the recipe does not have, and an amount on a line without one", () => {
    expect(fitsRecipe(ragu(), swap)).toBe(true);
    expect(fitsRecipe(ragu(), { ...swap, ingredientId: uid(999) })).toBe(false);
    expect(fitsRecipe(ragu(), { ...longer, stepId: uid(999) })).toBe(false);
    expect(fitsRecipe(ragu(), { ...less, ingredientId: SALT })).toBe(false);
  });

  test("a session is stale after two days", () => {
    const now = new Date("2026-11-07T18:00:00Z");
    expect(isStale({ updatedAt: "2026-11-06T18:00:00.000Z" }, now)).toBe(false);
    expect(isStale({ updatedAt: "2026-11-05T17:00:00.000Z" }, now)).toBe(true);
  });
});

describe("the review", () => {
  test("corrections start as Keep, a swap or a left-out as Just this time; only a swap can become an alternative", () => {
    expect([less, longer, tip, swap, noCelery].map(defaultDecision)).toEqual(["keep", "keep", "keep", "once", "once"]);
    expect(decisionsFor(swap)).toEqual(["keep", "once", "alternative"]);
    expect(decisionsFor(less)).toEqual(["keep", "once"]);
    expect(sessionSuggestions({ adjustments: [swap] })).toEqual([{ adjustment: swap, why: "Used tonight.", decision: "once" }]);
  });

  test("viewSuggestion says each change before and after at the session's servings", () => {
    expect(viewSuggestion(ragu(), swap, 4)).toEqual({ label: "Ingredient · swap", before: "1 cup celery, diced", after: "1 cup carrot, diced" });
    expect(viewSuggestion(ragu(), less, 2)!.before).toBe("500 g chuck beef");
    expect(viewSuggestion(ragu(), less, 2)!.after).toBe("400 g chuck beef");
    expect(viewSuggestion(ragu(), noCelery, null)!.after).toBe("Left out");
    expect(viewSuggestion(ragu(), longer, null)).toEqual({ label: "Step 2 · method", before: "Slow cook 2 hrs.", after: "Slow cook 3 hrs." });
    expect(viewSuggestion(ragu(), tip, null)).toEqual({ label: "Step 1 · tip", before: null, after: "Sear in two batches." });
    expect(viewSuggestion(ragu(), { ...swap, ingredientId: uid(999) }, null)).toBeNull();
  });

  test("onceNote opens the comment with what was only tonight's", () => {
    expect(
      onceNote([
        { adjustment: swap, decision: "once" },
        { adjustment: longer, decision: "keep" },
      ])
    ).toBe("Just this time: Celery → carrot.");
    expect(onceNote([{ adjustment: longer, decision: "keep" }])).toBe("");
  });

  const resolve: Resolve = {
    food: (name) => food(70, name),
    unit: (name) => (name === "cup" ? CUP : null),
  };

  test("keptRecipe writes what is kept and nothing else", () => {
    const kept = keptRecipe(
      ragu(),
      [
        { adjustment: longer, decision: "keep" },
        { adjustment: tip, decision: "keep" },
        { adjustment: less, decision: "keep" },
        { adjustment: swap, decision: "once" },
      ],
      resolve
    );
    const part = kept.parts[0]!;
    expect(part.steps[1]!.text).toBe("Slow cook 3 hrs.");
    expect(part.steps[0]!.summary).toBe("Sear in two batches.");
    expect(part.ingredients[1]!.quantity).toBe(800);
    expect(part.ingredients[0]!.food!.name).toBe("celery");
  });

  test("a kept swap takes the resolved food; an unknown unit goes to the front of the note", () => {
    const kept = keptRecipe(ragu(), [{ adjustment: { ...swap, quantity: 2, unit: "stalk" }, decision: "keep" }], resolve);
    const celery = kept.parts[0]!.ingredients[0]!;
    expect(celery.food!.id).toBe(uid(70));
    expect(celery.quantity).toBe(2);
    expect(celery.unit).toBeNull();
    expect(celery.note).toBe("stalk diced");
  });

  test("a swap as an alternative keeps the line's food and adds the other", () => {
    const kept = keptRecipe(ragu(), [{ adjustment: swap, decision: "alternative" }], resolve);
    const celery = kept.parts[0]!.ingredients[0]!;
    expect(celery.food!.name).toBe("celery");
    expect(celery.alternatives).toEqual([
      { basisQuantity: null, basisUnit: null, note: "", planPicks: false, items: [{ quantity: null, unit: CUP, food: food(70, "carrot") }] },
    ]);
  });

  test("a kept left-out line is removed, and its links with it", () => {
    const kept = keptRecipe(ragu(), [{ adjustment: noCelery, decision: "keep" }], resolve);
    expect(kept.parts[0]!.ingredients.map((row) => row.id)).toEqual([BEEF, SALT]);
    expect(kept.parts[0]!.steps[0]!.ingredientIds).toEqual([BEEF]);
  });
});
