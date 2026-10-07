// Critique #12: a pencil on every ingredient row and a boxed ⋯ on every step
// card were the loudest marks on a page read and cooked from. At rest each
// trigger is hidden (a pencil visually hidden on a touch screen, the ⋯
// transparent in its place) and fades in on hover with a mouse, always in the
// tab order; the recipe menu's "Fix a line" shows them all until
// "Done fixing". The visibility itself is CSS (checked in the browser); what is
// checked here is the mode that switches it, and that the triggers never leave
// the accessibility tree.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { expect, test } from "vitest";
import type { Recipe } from "../../../../../src/domain/recipe";
import { IngredientsToolbar, QuickEditProvider } from "../../../../../src/routes/recipes/recipe/components/QuickEditContext";
import { RecipeActions } from "../../../../../src/routes/recipes/recipe/components/RecipeActions";
import { StepCard } from "../../../../../src/routes/recipes/recipe/components/StepCard";
import { renderInRouter } from "../../../../helpers/dom";

const PART_ID = "66666666-6666-4666-8666-666666666666";
const step = { id: "33333333-3333-4333-8333-333333333333", title: "", text: "Mix", summary: "", ingredientIds: [], image: null };

const recipe: Recipe = {
  id: "77777777-7777-4777-8777-777777777777",
  slug: "test-recipe",
  name: "Test recipe",
  description: "",
  image: null,
  rating: null,
  lastMade: null,
  favourite: false,
  recipeServings: 4,
  recipeYieldQuantity: 0,
  yieldUnit: null,
  recipeYield: "",
  prepTime: null,
  performTime: null,
  sourceUrl: null,
  notes: [],
  tags: [],
  parts: [{ id: PART_ID, name: "", ingredients: [], steps: [step] }],
  restyledAt: null,
  createdAt: "2026-03-04T02:30:00.000Z",
  updatedAt: "2026-03-04T02:30:00.000Z",
};

async function renderPage() {
  const heading = createRef<HTMLHeadingElement>();
  await renderInRouter(
    <QuickEditProvider recipe={recipe}>
      <RecipeActions recipe={recipe} />
      <h2 ref={heading} tabIndex={-1}>
        Ingredients
      </h2>
      <IngredientsToolbar returnFocus={heading} />
      <ul>
        <StepCard recipeId={recipe.id} step={step} position={1} partId={PART_ID} />
      </ul>
    </QuickEditProvider>
  );
}

/** The step menu's wrapper, which carries the resting classes. */
const stepTriggerWrapper = () => screen.getByRole("button", { name: "Step actions" }).closest("[data-print='hide']") as HTMLElement;

test("at rest the step's ⋯ keeps its place, transparent and untappable, but is still a named button, and there is no Done", async () => {
  await renderPage();
  expect(screen.getByRole("button", { name: "Step actions" })).toBeTruthy();
  expect(stepTriggerWrapper().className).toContain("opacity-0");
  expect(stepTriggerWrapper().className).toContain("pointer-events-none");
  expect(stepTriggerWrapper().className).toContain("transition-opacity");
  // Never taken out of the layout: the step's text must not rewrap when the mode shows it.
  expect(stepTriggerWrapper().className).not.toContain("sr-only");
  expect(screen.queryByRole("button", { name: "Done fixing" })).toBeNull();
});

test("Fix a line shows every trigger until Done fixing", async () => {
  const user = userEvent.setup();
  await renderPage();
  await user.click(screen.getByRole("button", { name: "Recipe actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Fix a line" }));
  expect(stepTriggerWrapper().className).not.toContain("opacity-0");
  expect(stepTriggerWrapper().className).not.toContain("pointer-events-none");

  // The menu offers the way out too.
  await user.click(screen.getByRole("button", { name: "Recipe actions" }));
  expect(screen.getByRole("menuitem", { name: "Done fixing" })).toBeTruthy();
  await user.keyboard("{Escape}");

  await user.click(screen.getByRole("button", { name: "Done fixing" }));
  expect(stepTriggerWrapper().className).toContain("opacity-0");
  // Done took itself away; focus went to the ingredients heading, not the page body.
  expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Ingredients" }));
});

test("the step's ⋯ is unboxed, and still opens Edit step", async () => {
  const user = userEvent.setup();
  await renderPage();
  const trigger = screen.getByRole("button", { name: "Step actions" });
  expect(trigger.className).not.toContain("border");
  await user.click(trigger);
  const menu = screen.getByRole("menu", { name: "Step actions" });
  await user.click(within(menu).getByRole("menuitem", { name: "Edit step" }));
  expect(screen.getByRole("dialog", { name: "Edit step" })).toBeTruthy();
});
