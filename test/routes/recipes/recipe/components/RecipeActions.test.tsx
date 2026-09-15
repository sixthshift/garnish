// RecipeActions: the recipe page's action menu, now that Edit and Cook have
// left it for buttons of their own in the header (M25.5). Rendered inside a
// throwaway router since `useNavigate` (duplicate, delete) needs one, even
// though the menu itself no longer holds any `Link`.
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { describe, expect, expectTypeOf, test } from "vitest";
import { Menu } from "../../../../../src/components/ui/Menu";
import type { Recipe } from "../../../../../src/domain/recipe";
import { RecipeActions, type RecipeActionsProps } from "../../../../../src/routes/recipes/recipe/components/RecipeActions";

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
  restyledAt: null,
  createdAt: "2026-03-04T02:30:00.000Z",
  updatedAt: "2026-09-11T02:30:00.000Z",
};

/** Render inside a throwaway router, so `useNavigate` resolves. */
async function render(recipe: Recipe, props: Partial<RecipeActionsProps> = {}): Promise<string> {
  const rootRoute = createRootRoute({ component: () => <RecipeActions recipe={recipe} {...props} /> });
  const slugRoute = createRoute({ getParentRoute: () => rootRoute, path: "/recipes/$slug", component: () => null });
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => null });
  const router = createRouter({
    routeTree: rootRoute.addChildren([slugRoute, indexRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}

test("takes the recipe, and M37.6's model flag and restyle-on-arrival pair", () => {
  expectTypeOf<RecipeActionsProps>().toEqualTypeOf<{
    recipe: Recipe;
    aiAvailable?: boolean;
    restyleOpen?: boolean;
    onRestyleClose?: () => void;
  }>();
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

describe("the menu's items", () => {
  test('"Make this a food" sits with the other non-destructive items', () => {
    const html = renderToString(
      <Menu label="Recipe actions" open>
        <Menu.Item onSelect={() => {}}>Duplicate</Menu.Item>
        <Menu.Item onSelect={() => {}}>Make this a food</Menu.Item>
      </Menu>
    );
    expect(html).toContain("Make this a food");
  });

  test("the closed menu shows no items, including the new one", async () => {
    const html = await render(base);
    expect(html).not.toContain("Make this a food");
  });
});

describe("Copy as Cooklang (M34.2)", () => {
  test('"Copy as Cooklang" sits with the other Copy items', () => {
    const html = renderToString(
      <Menu label="Recipe actions" open>
        <Menu.Item onSelect={() => {}}>Copy link</Menu.Item>
        <Menu.Item onSelect={() => {}}>Copy ingredients</Menu.Item>
        <Menu.Item onSelect={() => {}}>Copy as Cooklang</Menu.Item>
      </Menu>
    );
    expect(html).toContain("Copy as Cooklang");
  });

  test("the closed menu shows no Copy as Cooklang item", async () => {
    const html = await render(base);
    expect(html).not.toContain("Copy as Cooklang");
  });
});

describe("Plan (M33.4)", () => {
  test('"Plan" sits with the other non-destructive items', () => {
    const html = renderToString(
      <Menu label="Recipe actions" open>
        <Menu.Item onSelect={() => {}}>Make this a food</Menu.Item>
        <Menu.Item onSelect={() => {}}>Plan</Menu.Item>
      </Menu>
    );
    expect(html).toContain("Plan");
  });

  test("the closed menu shows no Plan item, and its popover is not in the markup", async () => {
    const html = await render(base);
    expect(html).not.toMatch(/>Plan</);
    expect(html).not.toContain('data-testid="plan-popover"');
  });
});

describe("Restyle steps (M37.6)", () => {
  test('"Restyle steps" sits with the other non-destructive items', () => {
    const html = renderToString(
      <Menu label="Recipe actions" open>
        <Menu.Item onSelect={() => {}}>Plan</Menu.Item>
        <Menu.Item onSelect={() => {}}>Restyle steps</Menu.Item>
      </Menu>
    );
    expect(html).toContain("Restyle steps");
  });

  test("the closed menu shows no Restyle item, with a model or without one", async () => {
    expect(await render(base)).not.toContain("Restyle steps");
    expect(await render(base, { aiAvailable: true })).not.toContain("Restyle steps");
  });

  test("the sheet paints nothing until it is open on the client", async () => {
    // `Sheet` mounts through a portal, so even `restyleOpen` renders nothing
    // here; test/routes/recipe-view-restyle.test.tsx stubs it to check the
    // `?restyle` wiring.
    const html = await render(base, { aiAvailable: true, restyleOpen: true });
    expect(html).not.toContain('data-testid="restyle-rules"');
  });
});
