// Cook mode on a phone (decisions.md row 208): one step a card, moved
// sideways. ← and → move it, as do Next step and Back at the foot, and a
// finger dragging the card left brings the next on and right the one before;
// a drag up or down is the card's own scroll and moves nothing.
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { Recipe } from "../../../../src/domain/recipes/recipe";
import { CookSearch } from "../../../../src/domain/recipes/routes/cook";

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
const progress = () => screen.getByRole("progressbar", { name: "Cook progress" }).getAttribute("aria-valuenow");

/** A finger on the card: down, across by `dx` and `dy` in two moves, and up. */
function drag(dx: number, dy = 0) {
  const card = screen.getByTestId("cook-cards");
  const at = { pointerId: 7, pointerType: "touch" };
  fireEvent.pointerDown(card, { ...at, clientX: 300, clientY: 400 });
  fireEvent.pointerMove(card, { ...at, clientX: 300 + dx / 2, clientY: 400 + dy / 2 });
  fireEvent.pointerMove(card, { ...at, clientX: 300 + dx, clientY: 400 + dy });
  fireEvent.pointerUp(card, { ...at, clientX: 300 + dx, clientY: 400 + dy });
}

describe("on a phone", () => {
  test("the step's card: where it sits, its label, what it needs as chips and its words", async () => {
    await cook("/recipes/fried-rice/cook?step=1");
    expect(document.querySelector('[data-cook-layout="cards"]')).not.toBeNull();
    const card = screen.getByTestId("cook-card");
    expect(position()).toBe("Step 2 of 3");
    expect(within(card).getByRole("heading", { level: 2, name: "Fry the rice" })).toBeTruthy();
    const needs = within(card).getByRole("list", { name: "Ingredients for this step" });
    expect(within(needs).getByRole("button", { name: "Tick off 3 rice" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(card).getByText("Fry the rice until it crackles.")).toBeTruthy();
    expect(progress()).toBe("2");
  });

  test("Next step and Back move along the deck, and → and ← do the same", async () => {
    const user = userEvent.setup();
    const router = await cook();
    expect(position()).toBe("Step 1 of 3");
    expect(screen.getByRole("button", { name: "Back" }).hasAttribute("disabled")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Next step" }));
    await waitFor(() => expect(position()).toBe("Step 2 of 3"));
    expect(router.state.location.search).toEqual({ step: 1 });
    expect(progress()).toBe("2");

    await user.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(position()).toBe("Step 1 of 3"));

    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(position()).toBe("Step 2 of 3"));
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(position()).toBe("Step 3 of 3"));
    // The last step's Next is Finish, and past it is the finish card.
    await user.click(screen.getByRole("button", { name: "Finish" }));
    await waitFor(() => expect(document.querySelector('[data-card="finished"]')).not.toBeNull());
    expect(screen.getByRole("button", { name: "Next step" }).hasAttribute("disabled")).toBe(true);

    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(position()).toBe("Step 3 of 3"));
  });

  test("a finger drags the card sideways: left brings the next step, right the one before", async () => {
    const router = await cook();
    drag(-160);
    await waitFor(() => expect(position()).toBe("Step 2 of 3"));
    drag(-160);
    await waitFor(() => expect(position()).toBe("Step 3 of 3"));
    drag(160);
    await waitFor(() => expect(position()).toBe("Step 2 of 3"));
    expect(router.state.location.search).toEqual({ step: 1 });
  });

  test("a drag up or down is the card's scroll, a short nudge springs back, and a mouse never drags", async () => {
    await cook("/recipes/fried-rice/cook?step=1");
    drag(-30, 220);
    drag(-20);
    const card = screen.getByTestId("cook-cards");
    fireEvent.pointerDown(card, { pointerId: 1, pointerType: "mouse", clientX: 300, clientY: 400 });
    fireEvent.pointerMove(card, { pointerId: 1, pointerType: "mouse", clientX: 100, clientY: 400 });
    fireEvent.pointerUp(card, { pointerId: 1, pointerType: "mouse", clientX: 100, clientY: 400 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(position()).toBe("Step 2 of 3");
    expect(screen.getByTestId("cook-card").style.transform).toBe("");
  });
});
