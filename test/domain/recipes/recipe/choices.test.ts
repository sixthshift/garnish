// A line's alternatives (decisions.md row 199): worked out at the line's
// amount, the plan's choice among the ones it picks, and the plan varying that
// choice from one time to the next.
import { describe, expect, test } from "vitest";
import {
  type Alternative,
  alternativeText,
  choiceNames,
  chooseOption,
  type Ingredient,
  type Recipe,
  recipeSchema,
  rotateChoices,
  rowChoices,
  scaleRecipe,
  withChoices,
} from "../../../../src/domain/recipes/recipe";
import type { Food, Unit } from "../../../../src/domain/recipes/reference";

const unit = (id: string, name: string, abbreviation: string, extra: Partial<Unit> = {}): Unit => ({
  id: `00000000-0000-4000-8000-0000000000${id}`,
  name,
  pluralName: null,
  abbreviation,
  useAbbreviation: true,
  fraction: false,
  portion: false,
  standardQuantity: null,
  standardUnitId: null,
  ...extra,
});
const gram = unit("a1", "gram", "g");
const ml = unit("a2", "millilitre", "ml");
const cup = unit("a3", "cup", "cup", { pluralName: "cups", useAbbreviation: false, fraction: true, standardQuantity: 250, standardUnitId: ml.id });
const tbsp = unit("a4", "tablespoon", "tbsp", { fraction: true });
let n = 0;
const food = (name: string): Food => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  name,
  pluralName: null,
  aliases: [],
  aisle: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
});
const chicken = food("chicken thigh");
const beef = food("beef strips");
const prawns = food("prawns");
const tofu = food("firm tofu");
const rice = food("rice");

const ROW = "00000000-0000-4000-8000-0000000000b1";
const recipe: Recipe = recipeSchema.parse({
  id: "00000000-0000-4000-8000-0000000000c1",
  slug: "stir-fry",
  name: "Stir-fry",
  recipeServings: 4,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  parts: [
    {
      id: "00000000-0000-4000-8000-0000000000d1",
      name: "",
      ingredients: [
        {
          id: ROW,
          quantity: 500,
          unit: gram,
          food: chicken,
          originalText: "500 g chicken thigh",
          alternatives: [
            { planPicks: true, items: [{ food: beef }] },
            { planPicks: true, items: [{ quantity: 400, unit: gram, food: prawns }] },
            // Fine to use, but not one the plan rotates through.
            { note: "pressed", items: [{ food: tofu }] },
          ],
        },
        { id: "00000000-0000-4000-8000-0000000000b2", quantity: 300, unit: gram, food: rice },
      ],
    },
  ],
});
const row = (doc: Recipe): Ingredient => doc.parts[0]!.ingredients[0]!;

describe("alternativeText", () => {
  const buttermilk = food("buttermilk");
  const milkAndLemon: Alternative = {
    basisQuantity: 1,
    basisUnit: cup,
    note: "",
    planPicks: false,
    items: [
      { quantity: 1, unit: cup, food: food("milk") },
      { quantity: 1, unit: tbsp, food: food("lemon juice") },
    ],
  };
  const line = { quantity: 500, unit: ml, food: buttermilk };

  test("a straight swap with no amount takes the line's", () => {
    expect(alternativeText(line, row(recipe).alternatives[2]!)).toBe("500 ml firm tofu");
  });

  test("a basis scales every item by the line's amount, through the units' own links", () => {
    // 500 ml is 2 cups.
    expect(alternativeText(line, milkAndLemon)).toBe("2 cups milk and 2 tbsp lemon juice");
  });

  test("a line that cannot be put in the basis unit shows the items as written, per the basis", () => {
    expect(alternativeText({ ...line, quantity: null, unit: null }, milkAndLemon)).toBe("1 cup milk and 1 tbsp lemon juice per 1 cup");
  });

  test("a counted basis scales a counted line: per 1 egg", () => {
    const chia: Alternative = { basisQuantity: 1, basisUnit: null, note: "", planPicks: false, items: [{ quantity: 1, unit: tbsp, food: food("chia seeds") }] };
    expect(alternativeText({ quantity: 3, unit: null, food: food("egg") }, chia)).toBe("3 tbsp chia seeds");
  });
});

describe("withChoices", () => {
  test("no choice is the line's own food", () => {
    expect(withChoices(recipe, {})).toBe(recipe);
    expect(row(withChoices(recipe, { [ROW]: chicken.id }))).toBe(row(recipe));
  });

  test("the choice comes in at its amount; the line's own food becomes one the plan picks, and the rest stay", () => {
    const made = row(withChoices(recipe, { [ROW]: beef.id }));
    expect(made).toMatchObject({ food: { id: beef.id }, quantity: 500, unit: { id: gram.id }, originalText: "" });
    expect(made.alternatives.map((alt) => [alt.items[0]!.food.name, alt.planPicks])).toEqual([
      ["chicken thigh", true],
      ["prawns", true],
      ["firm tofu", false],
    ]);
    expect(row(withChoices(recipe, { [ROW]: prawns.id }))).toMatchObject({ food: { id: prawns.id }, quantity: 400 });
  });

  test("a choice naming nothing the plan picks for the line is ignored", () => {
    expect(row(withChoices(recipe, { [ROW]: tofu.id }))).toBe(row(recipe));
    expect(chooseOption(row(recipe), rice.id)).toBe(row(recipe));
  });
});

describe("rotateChoices", () => {
  test("the line's own food, then each one the plan picks in turn, least used first; never the others", () => {
    expect(rowChoices(row(recipe)).map((item) => item.food.name)).toEqual(["chicken thigh", "beef strips", "prawns"]);
    const first = rotateChoices(recipe, []);
    expect(first).toEqual({ [ROW]: chicken.id });
    const second = rotateChoices(recipe, [first]);
    expect(second).toEqual({ [ROW]: beef.id });
    expect(rotateChoices(recipe, [first, second])).toEqual({ [ROW]: prawns.id });
    // An entry with no choice counts as the line's own food; on a tie, the one used longest ago.
    expect(rotateChoices(recipe, [{}, { [ROW]: beef.id }, { [ROW]: prawns.id }, { [ROW]: beef.id }])).toEqual({ [ROW]: chicken.id });
  });
});

test("a straight swap's own amount scales with the line; one without takes the line's", () => {
  const doubled = row(scaleRecipe(recipe, 8));
  expect(doubled.quantity).toBe(1000);
  expect(doubled.alternatives.map((alt) => alt.items[0]!.quantity)).toEqual([null, 800, null]);
  expect(alternativeText(doubled, doubled.alternatives[1]!)).toBe("800 g prawns");
});

test("the names a choice picks leave out a line on its own food", () => {
  expect(choiceNames(recipe, { [ROW]: prawns.id })).toEqual(["prawns"]);
  expect(choiceNames(recipe, { [ROW]: chicken.id })).toEqual([]);
});
