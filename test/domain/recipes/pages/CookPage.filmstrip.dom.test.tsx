// Cook mode on a desktop (decisions.md row 207): the deck as a filmstrip, the
// steps before and after beside the current one, this step's ingredients down
// the left; ← → and Space move, and a neighbouring card goes to itself.
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { Recipe } from "../../../../src/domain/recipes/recipe";
import { CookSearch } from "../../../../src/domain/recipes/routes/cook";
import { atDesktop } from "../../../helpers/layout";

vi.mock("../../../../src/api/rpc/recipes", () => ({ getRecipe: vi.fn(), subRecipesOf: vi.fn(async () => []) }));

const food = (id: string, name: string) => ({ id, name, pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false, conversions: [] });
const row = (id: string, quantity: number, name: string) => ({
  id,
  quantity,
  unit: null,
  food: food(`food-${id}`, name),
  note: "",
  originalText: "",
  fixed: false,
  alternatives: [],
});
const step = (id: string, title: string, text: string, ingredientIds: string[] = []) => ({ id, title, text, summary: "", ingredientIds, image: null });

const rice: Recipe = {
  id: "recipe-rice",
  slug: "fried-rice",
  name: "Fried rice",
  description: "",
  image: null,
  rating: null,
  lastMade: null,
  recipeServings: 2,
  recipeYieldQuantity: 0,
  yieldUnit: null,
  recipeYield: "",
  prepTime: null,
  performTime: null,
  sourceUrl: null,
  favourite: false,
  kind: null,
  notes: [],
  tags: [],
  parts: [
    {
      id: "part-main",
      name: "",
      ingredients: [row("ing-egg", 2, "egg"), row("ing-rice", 3, "rice")],
      steps: [
        step("step-1", "Scramble the egg", "Scramble the egg until just set.", ["ing-egg"]),
        step("step-2", "Fry the rice", "Fry the rice until it crackles.", ["ing-rice"]),
        step("step-3", "Serve", "Serve at once."),
      ],
    },
  ],
  restyledAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

/** The cook route alone, at its real id, over the recipe above. */
async function cook(path = "/recipes/fried-rice/cook") {
  const { CookPage } = await import("../../../../src/domain/recipes/pages/CookPage");
  const root = createRootRoute();
  const recipes = createRoute({ getParentRoute: () => root, path: "recipes" });
  const slug = createRoute({ getParentRoute: () => recipes, path: "$slug" });
  const index = createRoute({ getParentRoute: () => slug, path: "/", component: () => <h1>Recipe</h1> });
  const cookRoute = createRoute({
    getParentRoute: () => slug,
    path: "cook",
    validateSearch: CookSearch,
    loader: () => ({ recipe: rice, subRecipes: [], parentName: null }),
    component: CookPage,
  });
  const router = createRouter({
    routeTree: root.addChildren([recipes.addChildren([slug.addChildren([index, cookRoute])])]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  render(<RouterProvider router={router as never} />);
  await screen.findByRole("heading", { level: 1, name: "Fried rice" });
  return router;
}

const position = () => document.querySelector("[data-position]")?.textContent;

describe("on a desktop", () => {
  atDesktop();

  test("the current step sits between its neighbours, with its ingredients and what is coming up down the left", async () => {
    await cook("/recipes/fried-rice/cook?step=1");
    expect(document.querySelector('[data-cook-layout="filmstrip"]')).not.toBeNull();
    expect(position()).toBe("Step 2 of 3");
    expect(screen.getByRole("button", { name: "Previous: Step 1 of 3" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next: Step 3 of 3" })).toBeTruthy();

    const left = screen.getByRole("complementary", { name: "This step" });
    expect(within(left).getByTestId("filmstrip-ingredients").textContent).toContain("rice");
    expect(within(left).getByTestId("filmstrip-ingredients").textContent).not.toContain("egg");
    expect(within(left).getByTestId("coming-up").textContent).toBe("ServeFinished");
    // The card leaves the ingredients to the column, and the next card to the strip.
    expect(within(screen.getByTestId("filmstrip-current")).queryByTestId("step-ingredients")).toBeNull();
    expect(screen.queryByTestId("next-preview")).toBeNull();
    expect(screen.getByRole("progressbar", { name: "Cook progress" }).getAttribute("aria-valuenow")).toBe("2");
  });

  test("→ and Space go on, ← goes back, and a neighbouring card goes to itself", async () => {
    const user = userEvent.setup();
    const router = await cook();
    expect(position()).toBe("Step 1 of 3");
    expect(screen.queryByRole("button", { name: /^Previous:/ })).toBeNull();

    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(position()).toBe("Step 2 of 3"));
    expect(router.state.location.search).toEqual({ step: 1 });

    await user.keyboard(" ");
    await waitFor(() => expect(position()).toBe("Step 3 of 3"));
    expect(screen.getByRole("button", { name: "Finish" })).toBeTruthy();

    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(position()).toBe("Step 2 of 3"));

    await user.click(screen.getByRole("button", { name: "Previous: Step 1 of 3" }));
    await waitFor(() => expect(position()).toBe("Step 1 of 3"));

    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(position()).toBe("Step 2 of 3"));
  });

  test("past the last step is Finished, its neighbour the last step", async () => {
    await cook("/recipes/fried-rice/cook?step=3");
    expect(position()).toBe("Finished");
    expect(screen.getByRole("button", { name: "Previous: Step 3 of 3" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(true);
  });
});

test("a phone deals one card at a time instead", async () => {
  await cook("/recipes/fried-rice/cook?step=1");
  expect(document.querySelector('[data-cook-layout="filmstrip"]')).toBeNull();
  expect(document.querySelector('[data-cook-layout="cards"]')).not.toBeNull();
});
