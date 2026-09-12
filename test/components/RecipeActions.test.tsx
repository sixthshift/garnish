// RecipeActions: the recipe page's action menu, now that Edit and Cook have
// left it for buttons of their own in the header (M25.5). Rendered inside a
// throwaway router since `useNavigate` (duplicate, delete) needs one, even
// though the menu itself no longer holds any `Link`.
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { describe, expect, expectTypeOf, test } from "vitest";
import { RecipeActions, type RecipeActionsProps } from "../../src/components/RecipeActions";
import type { Recipe } from "../../src/domain/recipe";

const base: Recipe = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "lemon-tart",
  name: "Lemon tart",
  description: "Sharp and short.",
  image: null,
  rating: null,
  lastMade: null,
  favourite: false,
  recipeServings: 4,
  recipeYieldQuantity: 1,
  yieldUnit: null,
  recipeYield: "tart",
  prepTime: null,
  performTime: null,
  sourceUrl: null,
  notes: [],
  tags: [],
  parts: [{ id: "22222222-2222-4222-8222-222222222222", name: "", ingredients: [], steps: [] }],
  createdAt: "2026-03-04T02:30:00.000Z",
  updatedAt: "2026-09-11T02:30:00.000Z",
};

/** Render inside a throwaway router, so `useNavigate` resolves. */
async function render(recipe: Recipe): Promise<string> {
  const rootRoute = createRootRoute({ component: () => <RecipeActions recipe={recipe} /> });
  const slugRoute = createRoute({ getParentRoute: () => rootRoute, path: "/recipes/$slug", component: () => null });
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => null });
  const router = createRouter({
    routeTree: rootRoute.addChildren([slugRoute, indexRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}

test("takes only the recipe now: Edit and Cook's servings moved to the header buttons", () => {
  expectTypeOf<RecipeActionsProps>().toEqualTypeOf<{ recipe: Recipe }>();
});

describe("RecipeActions render", () => {
  test("shows the trigger, closed, with no menu items in the tree", async () => {
    const html = await render(base);
    expect(html).toContain('data-testid="menu-trigger"');
    expect(html).toContain('aria-label="Recipe actions"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="menuitem"');
  });

  test("carries no Edit or Cook link: those live beside it in the header, not in the menu", async () => {
    const html = await render(base);
    expect(html).not.toContain("/recipes/lemon-tart/edit");
    expect(html).not.toContain("/recipes/lemon-tart/cook");
    expect(html).not.toContain(">Edit<");
    expect(html).not.toContain(">Cook<");
  });

  test("no confirm dialog is open by default", async () => {
    const html = await render(base);
    expect(html).not.toContain('aria-label="Delete recipe"');
    expect(html).not.toContain("This cannot be undone");
  });
});
