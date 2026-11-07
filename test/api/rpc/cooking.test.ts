// The cooking session's server functions against a temp DATA_DIR (decisions.md row 214).
import { isNotFound } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { adjustCooking, discardCooking, finishCooking, getCooking, noteCooking, startCooking, unadjustCooking, unitNamed } from "../../../src/api/rpc/cooking";
import { createRecipe, deleteRecipe } from "../../../src/api/rpc/recipes";
import type { RecipeInput } from "../../../src/domain/recipes/recipe";
import { callServerFn, useTempDataDir } from "../../helpers/server";

useTempDataDir();

async function seed() {
  return callServerFn(createRecipe, {
    name: "Ragu",
    recipeServings: 4,
    parts: [{ name: "", ingredients: [{ quantity: 1000, food: { id: crypto.randomUUID(), name: "beef" } }], steps: [{ text: "Slow cook 2 hrs." }] }],
  } as RecipeInput);
}

test("a session begins, takes and puts back adjustments, keeps notes, and ends", async () => {
  const recipe = await seed();
  const beef = recipe.parts[0]!.ingredients[0]!;
  const step = recipe.parts[0]!.steps[0]!;
  expect(await callServerFn(getCooking, { recipeId: recipe.id })).toBeNull();

  const started = await callServerFn(startCooking, { recipeId: recipe.id, servings: 2, choices: null });
  expect(started).toMatchObject({ recipeId: recipe.id, servings: 2, adjustments: [], notes: [], messages: [] });

  const adjusted = await callServerFn(adjustCooking, {
    recipeId: recipe.id,
    adjustment: { kind: "amount", ingredientId: beef.id, quantity: 800, summary: "Beef 800 g" },
  });
  expect(adjusted.adjustments).toMatchObject([{ kind: "amount", quantity: 800 }]);
  const withStep = await callServerFn(adjustCooking, {
    recipeId: recipe.id,
    adjustment: { kind: "step", stepId: step.id, text: "Slow cook 3 hrs.", summary: "3 hrs" },
  });
  expect(withStep.adjustments).toHaveLength(2);

  const back = await callServerFn(unadjustCooking, { recipeId: recipe.id, adjustmentId: adjusted.adjustments[0]!.id });
  expect(back.adjustments.map((a) => a.kind)).toEqual(["step"]);

  const noted = await callServerFn(noteCooking, { recipeId: recipe.id, text: "Sauce a bit thin" });
  expect(noted.notes).toMatchObject([{ text: "Sauce a bit thin", origin: "cook" }]);

  // A second Start replaces the session.
  const again = await callServerFn(startCooking, { recipeId: recipe.id, servings: null, choices: null });
  expect(again.adjustments).toEqual([]);

  expect(await callServerFn(discardCooking, { recipeId: recipe.id })).toEqual({ discarded: true });
  expect(await callServerFn(getCooking, { recipeId: recipe.id })).toBeNull();
});

test("an adjustment to a row the recipe does not have is refused", async () => {
  const recipe = await seed();
  await callServerFn(startCooking, { recipeId: recipe.id, servings: null, choices: null });
  await expect(
    callServerFn(adjustCooking, { recipeId: recipe.id, adjustment: { kind: "leave-out", ingredientId: crypto.randomUUID(), summary: "No beef" } })
  ).rejects.toThrow(/does not have/);
});

test("writes to a recipe not being cooked are 404s, and a deleted recipe takes its session", async () => {
  const recipe = await seed();
  const caught = await callServerFn(noteCooking, { recipeId: recipe.id, text: "hi" }).catch((e: unknown) => e);
  expect(isNotFound(caught)).toBe(true);
  await callServerFn(startCooking, { recipeId: recipe.id, servings: null, choices: null });
  await callServerFn(deleteRecipe, { id: recipe.id });
  expect(await callServerFn(getCooking, { recipeId: recipe.id })).toBeNull();
});

test("finishCooking writes what was kept, leaves what was tonight's, and ends the session", async () => {
  const recipe = await seed();
  const beef = recipe.parts[0]!.ingredients[0]!;
  const step = recipe.parts[0]!.steps[0]!;
  await callServerFn(startCooking, { recipeId: recipe.id, servings: null, choices: null });
  const session = await callServerFn(adjustCooking, {
    recipeId: recipe.id,
    adjustment: { kind: "step", stepId: step.id, text: "Slow cook 3 hrs.", summary: "3 hrs" },
  });
  const withSwap = await callServerFn(adjustCooking, {
    recipeId: recipe.id,
    adjustment: { kind: "swap", ingredientId: beef.id, food: "lamb shoulder", quantity: null, unit: null, summary: "Beef → lamb" },
  });
  const [longer, swap] = [session.adjustments[0]!, withSwap.adjustments.find((a) => a.kind === "swap")!];

  const stored = await callServerFn(finishCooking, {
    recipeId: recipe.id,
    kept: [
      { adjustment: longer, decision: "keep" },
      { adjustment: swap, decision: "alternative" },
    ],
  });
  expect(stored.parts[0]!.steps[0]!.text).toBe("Slow cook 3 hrs.");
  const line = stored.parts[0]!.ingredients[0]!;
  expect(line.food!.name).toBe("beef");
  expect(line.alternatives.map((alt) => alt.items[0]!.food.name)).toEqual(["lamb shoulder"]);
  expect(await callServerFn(getCooking, { recipeId: recipe.id })).toBeNull();
});

test("finishCooking with nothing kept leaves the recipe as it was", async () => {
  const recipe = await seed();
  await callServerFn(startCooking, { recipeId: recipe.id, servings: null, choices: null });
  const stored = await callServerFn(finishCooking, { recipeId: recipe.id, kept: [] });
  expect(stored.updatedAt).toBe(recipe.updatedAt);
});

test("unitNamed finds a unit by its name, plural or abbreviation in any case", () => {
  const cup = {
    id: crypto.randomUUID(),
    name: "cup",
    pluralName: "cups",
    abbreviation: "c",
    useAbbreviation: false,
    fraction: true,
    portion: false,
    standardQuantity: null,
    standardUnitId: null,
  };
  expect(unitNamed("Cups", [cup])).toBe(cup);
  expect(unitNamed("C", [cup])).toBe(cup);
  expect(unitNamed("stalk", [cup])).toBeNull();
});
