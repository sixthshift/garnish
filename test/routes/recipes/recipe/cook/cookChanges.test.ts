import { expect, test } from "vitest";
import { recipeSchema } from "../../../../../src/domain/recipe";
import {
  amountChange,
  type CookChange,
  changeKey,
  describeChange,
  keptChanges,
  keptDraft,
  onceNote,
  readChanges,
  withChange,
  withChanges,
  withoutChange,
  writeChanges,
} from "../../../../../src/routes/recipes/recipe/cook/components/cookChanges";

const ids = {
  recipe: "00000000-0000-4000-8000-000000000001",
  part: "00000000-0000-4000-8000-000000000002",
  soy: "00000000-0000-4000-8000-000000000003",
  sesame: "00000000-0000-4000-8000-000000000004",
  step: "00000000-0000-4000-8000-000000000005",
};
const tbsp = {
  id: "00000000-0000-4000-8000-0000000000aa",
  name: "tablespoon",
  pluralName: "tablespoons",
  abbreviation: "tbsp",
  useAbbreviation: true,
  fraction: true,
  portion: false,
};

const recipe = recipeSchema.parse({
  id: ids.recipe,
  slug: "salmon",
  name: "Salmon",
  recipeServings: 4,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  parts: [
    {
      id: ids.part,
      name: "",
      ingredients: [
        { id: ids.soy, quantity: 3, unit: tbsp, food: { id: "00000000-0000-4000-8000-0000000000b1", name: "soy sauce" } },
        { id: ids.sesame, quantity: 1, unit: tbsp, food: { id: "00000000-0000-4000-8000-0000000000b2", name: "sesame seeds" }, fixed: true },
      ],
      steps: [{ id: ids.step, text: "Mix the sauce." }],
    },
  ],
});
const [soy, sesame] = recipe.parts[0]!.ingredients;

test("an amount typed at the deck's scale is stored at the recipe's, and a fixed one as typed", () => {
  // The deck at 8 servings shows 6 tbsp soy; the cook types 4.
  const scaledSoy = { ...soy!, quantity: 6 };
  const change = amountChange(scaledSoy, 4, 2)!;
  expect(change).toMatchObject({ kind: "amount", ingredientId: ids.soy, quantity: 2, label: "Soy sauce", before: "6 tbsp", after: "4 tbsp" });
  expect(amountChange(sesame!, 2, 2)).toMatchObject({ quantity: 2 });
  expect(amountChange(scaledSoy, 6, 2)).toBeNull();
  expect(amountChange(scaledSoy, 0, 2)).toBeNull();
  expect(amountChange(scaledSoy, Number.NaN, 2)).toBeNull();
});

test("a second change to a row replaces the first, keeps what the recipe had, and goes when changed back", () => {
  const first = amountChange(soy!, 2, 1)!;
  const second = amountChange({ ...soy!, quantity: 2 }, 1, 1)!;
  const changes = withChange(withChange([], first), second);
  expect(changes).toHaveLength(1);
  expect(describeChange(changes[0]!)).toBe("Soy sauce: 3 tbsp → 1 tbsp");
  expect(withChange(changes, amountChange({ ...soy!, quantity: 1 }, 3, 1)!)).toEqual([]);
  expect(withoutChange(changes, changeKey(first))).toEqual([]);
});

test("the deck is built from the recipe with every change in it", () => {
  const step: CookChange = { kind: "step", stepId: ids.step, position: 1, text: "Mix the sauce with lime." };
  const changed = withChanges(recipe, [amountChange(soy!, 2, 1)!, step]);
  expect(changed.parts[0]!.ingredients[0]!.quantity).toBe(2);
  expect(changed.parts[0]!.steps[0]!.text).toBe("Mix the sauce with lime.");
  expect(withChanges(recipe, [])).toBe(recipe);
});

test("kept changes go into the draft the recipe is saved from; the ones for this time go into the log's comment", () => {
  const amount = amountChange(soy!, 2, 1)!;
  const step: CookChange = { kind: "step", stepId: ids.step, position: 1, text: "Mix the sauce with lime." };
  const decisions = { [changeKey(step)]: "once" as const };
  const kept = keptChanges([amount, step], decisions);
  expect(kept).toEqual([amount]);
  const draft = keptDraft(recipe, kept);
  expect(draft.id).toBe(ids.recipe);
  expect(draft.parts[0]!.ingredients[0]!.quantity).toBe(2);
  expect(draft.parts[0]!.steps[0]!.text).toBe("Mix the sauce.");
  expect(onceNote([amount, step], decisions)).toBe("This time: step 1: Mix the sauce with lime.");
  expect(onceNote([amount], {})).toBe("");
});

test("changes survive in session storage, and a broken or throwing store reads as none", () => {
  const map = new Map<string, string>();
  const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
  const amount = amountChange(soy!, 2, 1)!;
  writeChanges(storage, ids.recipe, [amount]);
  expect(readChanges(storage, ids.recipe)).toEqual([amount]);
  map.set(`garnish.cookChanges.${ids.recipe}`, "{not json");
  expect(readChanges(storage, ids.recipe)).toEqual([]);
  map.set(`garnish.cookChanges.${ids.recipe}`, JSON.stringify([{ kind: "amount" }, amount]));
  expect(readChanges(storage, ids.recipe)).toEqual([amount]);
  const throwing = {
    getItem: () => {
      throw new Error("no");
    },
    setItem: () => {
      throw new Error("no");
    },
  };
  expect(readChanges(throwing, ids.recipe)).toEqual([]);
  expect(() => writeChanges(throwing, ids.recipe, [amount])).not.toThrow();
  expect(readChanges(undefined, ids.recipe)).toEqual([]);
});
