// The document title on a recipe page is the recipe's name (the root route's
// "Garnish" everywhere else). `head` is a pure function of the loader's data,
// so it is called here directly rather than through a render.
import { expect, test } from "vitest";
import type { Recipe } from "../../../../src/domain/recipe";
import { type RecipeViewData, Route } from "../../../../src/routes/recipes/recipe/route";

const data = (name: string) => ({ recipe: { name } as Recipe, timeline: [], subRecipes: [], aiAvailable: false }) satisfies RecipeViewData;

/** The title the route's `head` asks for, given some loader data. */
async function titleFor(loaderData: RecipeViewData | undefined): Promise<string | undefined> {
  const head = await Route.options.head?.({ loaderData } as never);
  const titled = head?.meta?.find((entry): entry is { title: string } => entry !== undefined && "title" in entry);
  return titled?.title;
}

test("the title is the recipe's name", async () => {
  expect(await titleFor(data("Lemon tart"))).toBe("Lemon tart");
});

test("a recipe still loading leaves the root's title in place", async () => {
  expect(await titleFor(undefined)).toBeUndefined();
});
