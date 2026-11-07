// A phone's recipe page (decisions.md row 208): Ingredients and Method as two
// tabs, one shown at a time and both kept for a printout; the photo held at
// the top with its round buttons; and the bar at the foot whose Start cooking
// goes to the page, cooking, at the page's servings, beside the shopping list and the
// plan.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { CookBar } from "../../../../../src/domain/recipes/components/mobile/CookBar";
import { PhoneRecipe, type PhoneRecipeProps } from "../../../../../src/domain/recipes/components/mobile/PhoneRecipe";
import type { Recipe } from "../../../../../src/domain/recipes/recipe";
import { noFacets } from "../../../../../src/domain/recipes/recipe";
import { renderInRouter } from "../../../../helpers/dom";

vi.mock("../../../../../src/api/rpc/recipes", () => ({ setFavourite: vi.fn(async () => ({})), setKind: vi.fn(async () => ({})) }));
const addPlanEntry = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("../../../../../src/api/rpc/plan", () => ({ addPlanEntry }));
vi.mock("../../../../../src/api/rpc/shopping", () => ({ addShoppingItems: vi.fn(), listShoppingItems: vi.fn(), mergeShoppingItems: vi.fn() }));

const recipe: Recipe = {
  id: crypto.randomUUID(),
  slug: "laksa",
  name: "Laksa",
  description: "",
  image: "laksa.jpg",
  rating: null,
  lastMade: null,
  recipeServings: 4,
  recipeYieldQuantity: 0,
  yieldUnit: null,
  recipeYield: "",
  prepTime: 15,
  performTime: 30,
  sourceUrl: null,
  favourite: false,
  kind: null,
  facets: noFacets(),
  notes: [],
  tags: [{ id: crypto.randomUUID(), name: "Weeknight", slug: "weeknight" }],
  parts: [
    {
      id: crypto.randomUUID(),
      name: "",
      ingredients: [],
      steps: [
        { id: crypto.randomUUID(), title: "", summary: "", text: "Fry the paste.", image: null, ingredientIds: [] },
        { id: crypto.randomUUID(), title: "", summary: "", text: "Add the stock.", image: null, ingredientIds: [] },
      ],
    },
  ],
  restyledAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as Recipe;

function page(overrides: Partial<PhoneRecipeProps> = {}) {
  return (
    <PhoneRecipe
      recipe={recipe}
      madeCount={0}
      onRate={() => {}}
      actions={(className) => (
        <div className={className}>
          <button type="button" data-testid="menu-trigger" aria-label="Recipe actions">
            ⋯
          </button>
        </div>
      )}
      servings={undefined}
      ingredients={<p>200 g paste</p>}
      method={<p>Fry the paste.</p>}
      after={<p>Notes and history</p>}
      cookBar={<div data-testid="cook-bar" />}
      {...overrides}
    />
  );
}

describe("the photo and its buttons", () => {
  test("the photo is held at the top, with back, the heart, Edit and the menu over it; the facts follow the name", async () => {
    await renderInRouter(page());
    const photo = screen.getByTestId("recipe-photo");
    expect(photo).toHaveClass("sticky", "top-0");
    expect(within(photo).getByRole("link", { name: "Back to recipes" })).toHaveAttribute("href", "/recipes");
    expect(within(photo).getByRole("button", { name: "Add to favourites" })).toBeInTheDocument();
    expect(within(photo).getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/recipes/laksa/edit");
    expect(within(photo).getByRole("button", { name: "Recipe actions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Laksa" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Weeknight" })).toHaveAttribute("href", "/recipes?tag=weeknight");
    const facts = screen.getByTestId("recipe-facts");
    expect(facts).toHaveTextContent("Prep15 min");
    expect(facts).toHaveTextContent("Total45 min");
    expect(facts).toHaveTextContent("Never made");
  });

  test("a recipe with no photo holds no space for one: the buttons sit in a row above the name", async () => {
    await renderInRouter(page({ recipe: { ...recipe, image: null } }));
    expect(screen.queryByTestId("recipe-photo")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to recipes" })).toBeInTheDocument();
  });
});

describe("the segmented switch", () => {
  test("Ingredients shows first; Method · N steps shows the method and hides the ingredients, both kept for print", async () => {
    const user = userEvent.setup();
    await renderInRouter(page());
    const tabs = screen.getByRole("tablist", { name: "Recipe" });
    expect(tabs).toHaveClass("sticky");
    const ingredients = screen.getByRole("tab", { name: "Ingredients" });
    const method = screen.getByRole("tab", { name: "Method · 2 steps" });
    expect(ingredients).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Ingredients" })).toHaveTextContent("200 g paste");
    // The other panel is drawn but hidden, and a printout shows it.
    expect(screen.getByTestId("method-column")).toHaveClass("hidden", "print:flex");

    await user.click(method);
    expect(method).toHaveAttribute("aria-selected", "true");
    expect(ingredients).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel", { name: "Method · 2 steps" })).toHaveTextContent("Fry the paste.");
    expect(screen.getByTestId("ingredients-column")).toHaveClass("hidden");
    expect(screen.getByTestId("ingredients-column")).toHaveAttribute("data-print", "keep");

    // The arrows move between them, as a tab list's do.
    await user.keyboard("{ArrowLeft}");
    expect(ingredients).toHaveAttribute("aria-selected", "true");
    expect(ingredients).toHaveFocus();
  });

  test("what belongs to neither tab follows both", async () => {
    const user = userEvent.setup();
    await renderInRouter(page());
    expect(screen.getByText("Notes and history")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: /^Method/ }));
    expect(screen.getByText("Notes and history")).toBeVisible();
  });
});

describe("the bar at the foot", () => {
  test("Start cooking cooks from the page at its servings and choices", async () => {
    const user = userEvent.setup();
    const { router } = await renderInRouter(<CookBar recipe={recipe} servings={6} choices={undefined} />);
    const bar = screen.getByTestId("cook-bar");
    expect(bar).toHaveClass("sticky");
    const cook = within(bar).getByRole("link", { name: "Start cooking" });
    expect(cook).toHaveAttribute("href", "/recipes/laksa?servings=6&cooking=true");
    expect(within(bar).getByRole("button", { name: "Add to shopping list" })).toBeInTheDocument();
    await user.click(cook);
    expect(router.state.location.search).toMatchObject({ cooking: true, servings: 6 });
  });

  test("the calendar puts it on a day from a sheet", async () => {
    const user = userEvent.setup();
    await renderInRouter(<CookBar recipe={recipe} servings={undefined} choices={undefined} />);
    await user.click(screen.getByRole("button", { name: "Put on the plan" }));
    const sheet = await screen.findByRole("dialog", { name: "Plan Laksa" });
    const days = within(sheet).getAllByTestId("plan-popover-day");
    expect(days).toHaveLength(7);
    await user.click(days[1]!);
    expect(addPlanEntry).toHaveBeenCalledWith({ data: expect.objectContaining({ recipeId: recipe.id, text: "Laksa", servings: 4 }) });
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
