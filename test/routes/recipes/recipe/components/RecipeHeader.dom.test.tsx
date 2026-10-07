// The header's folded rating, pressed: an unrated recipe shows "Rate", and
// pressing it opens the five stars with focus on the first, so the next
// press rates. The node suite asserts the folded markup.
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { Recipe } from "../../../../../src/domain/recipe";
import { RecipeHeader } from "../../../../../src/routes/recipes/recipe/components/RecipeHeader";
import { renderInRouter } from "../../../../helpers/dom";

const unrated: Recipe = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "chickpea-curry",
  name: "Chickpea curry",
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
  parts: [{ id: "22222222-2222-4222-8222-222222222222", name: "", ingredients: [], steps: [] }],
  restyledAt: null,
  createdAt: "2026-03-04T02:30:00.000Z",
  updatedAt: "2026-09-11T02:30:00.000Z",
};

test("Rate opens the stars, focuses the first, and a star rates", async () => {
  const onRate = vi.fn();
  await renderInRouter(<RecipeHeader recipe={unrated} onRate={onRate} />);
  expect(screen.queryByRole("button", { name: "Rate 1 out of 5" })).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: "Rate" }));
  expect(screen.queryByRole("button", { name: "Rate" })).toBeNull();
  expect(screen.getByRole("button", { name: "Rate 1 out of 5" })).toHaveFocus();

  await userEvent.click(screen.getByRole("button", { name: "Rate 4 out of 5" }));
  expect(onRate).toHaveBeenCalledWith(4);
});
