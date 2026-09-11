// duplicateRecipe against a temp DATA_DIR: the copy round-trips through the
// database as its own recipe, with a fresh slug and fresh child ids.
import { isNotFound } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { recipeSchema, type RecipeInput } from "../../src/domain/recipe";
import type { NotFoundData } from "../../src/server/fn";
import { createRecipe, duplicateRecipe, getRecipe, listRecipes, setFavourite } from "../../src/server/recipes";
import { callServerFn, useTempDataDir } from "../helpers/server";

useTempDataDir();

const missing = "99999999-9999-4999-8999-999999999999";
const food = (name: string) => ({ id: crypto.randomUUID(), name, pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false });

function doc(overrides: Partial<RecipeInput> = {}): RecipeInput {
  return {
    name: "Flatbread",
    description: "Quick.",
    recipeServings: 2,
    prepTime: 10,
    performTime: 5,
    sourceUrl: "https://example.test/flatbread",
    tags: [{ id: crypto.randomUUID(), name: "Weeknight", slug: "weeknight" }],
    notes: [{ title: "Tip", text: "Rest the dough." }],
    components: [
      {
        name: "Dough",
        ingredients: [
          { quantity: 200, food: food("flour"), fixed: false },
          { quantity: 1, food: food("bay leaf"), fixed: true },
        ],
        steps: [{ text: "Mix." }],
      },
    ],
    steps: [{ text: "Serve warm." }],
    ...overrides,
  };
}

test("duplicateRecipe stores a second recipe with the copy name and a fresh slug", async () => {
  const original = await callServerFn(createRecipe, doc());
  const copy = await callServerFn(duplicateRecipe, { id: original.id });

  expect(recipeSchema.safeParse(copy).success).toBe(true);
  expect(copy.name).toBe("Flatbread (copy)");
  expect(copy.slug).toBe("flatbread-copy");
  expect(copy.id).not.toBe(original.id);

  // Both are in the list, and the copy reads back by its own slug.
  expect((await callServerFn(listRecipes, {})).map((row) => row.slug).sort()).toEqual(["flatbread", "flatbread-copy"]);
  await expect(callServerFn(getRecipe, { slug: "flatbread-copy" })).resolves.toEqual(copy);
  await expect(callServerFn(getRecipe, { slug: "flatbread" })).resolves.toEqual(original);
});

test("the copy carries the content but not the ids, the last-made date or the favourite flag", async () => {
  const original = await callServerFn(createRecipe, doc());
  await callServerFn(setFavourite, { id: original.id, favourite: true });
  const copy = await callServerFn(duplicateRecipe, { id: original.id });

  expect(copy).toMatchObject({
    description: "Quick.",
    recipeServings: 2,
    prepTime: 10,
    performTime: 5,
    sourceUrl: "https://example.test/flatbread",
    favourite: false,
    lastMade: null,
  });
  expect(copy.tags).toEqual(original.tags); // reference rows are shared, ids and all
  expect(copy.notes.map((note) => note.text)).toEqual(["Rest the dough."]);
  expect(copy.notes[0]!.id).not.toBe(original.notes[0]!.id);

  const line = (recipe: typeof copy) => recipe.components[0]!.ingredients.map((row) => [row.food?.name, row.quantity, row.fixed]);
  expect(line(copy)).toEqual(line(original));
  expect(copy.components[0]!.id).not.toBe(original.components[0]!.id);
  expect(copy.components[0]!.ingredients[0]!.id).not.toBe(original.components[0]!.ingredients[0]!.id);
  expect(copy.components[0]!.steps.map((step) => step.text)).toEqual(["Mix."]);
  expect(copy.steps.map((step) => step.text)).toEqual(["Serve warm."]);
  // Foods are reference rows: the copy points at the same ones, no duplicates made.
  expect(copy.components[0]!.ingredients[0]!.food!.id).toBe(original.components[0]!.ingredients[0]!.food!.id);
});

test("duplicating a duplicate gets its own slug again", async () => {
  const original = await callServerFn(createRecipe, doc());
  const first = await callServerFn(duplicateRecipe, { id: original.id });
  const second = await callServerFn(duplicateRecipe, { id: original.id });
  expect(second.name).toBe("Flatbread (copy)");
  expect(second.slug).not.toBe(first.slug);
  expect(second.slug.startsWith("flatbread-copy")).toBe(true);
});

test("an unknown id is a notFound", async () => {
  const caught = await callServerFn(duplicateRecipe, { id: missing }).catch((error: unknown) => error);
  expect(isNotFound(caught)).toBe(true);
  expect((caught as { data: NotFoundData }).data).toEqual({ entity: "recipe", id: missing, message: `recipe ${missing} not found` });
});

test("a malformed id fails validation before touching the database", async () => {
  await expect(callServerFn(duplicateRecipe, { id: "not-a-uuid" } as never)).rejects.toThrow();
});
