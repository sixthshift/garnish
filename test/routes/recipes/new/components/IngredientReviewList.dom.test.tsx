// The review list pressed: Create all new reaches every unknown row, and Change opens one row's full fields.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test } from "vitest";
import type { IngredientReview } from "../../../../../src/domain/draft";
import { reviewRows } from "../../../../../src/domain/ingredient";
import { IngredientReviewList } from "../../../../../src/routes/recipes/new/components/IngredientReviewList";

function Harness() {
  const [rows, setRows] = useState<IngredientReview[]>(reviewRows(["3 cloves garlic", "salt to taste"], { units: [], foods: [] }));
  return <IngredientReviewList rows={rows} units={[]} searchFoods={async () => []} onRowsChange={setRows} />;
}

test("Create all new turns every unknown food into one to create, and Leave all as text undoes it", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  expect(screen.getByTestId("review-counts")).toHaveTextContent("2 unknown");
  await user.click(screen.getByRole("button", { name: "Create all new" }));
  expect(screen.getByTestId("review-counts")).toHaveTextContent("2 to create");
  expect(screen.getAllByText("New food")).toHaveLength(2);
  await user.click(screen.getByRole("button", { name: "Leave all as text" }));
  expect(screen.getByTestId("review-counts")).toHaveTextContent("2 unknown");
});

test("Change opens one row's full fields and Done folds it again", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole("button", { name: "Change line 1" }));
  const row = screen.getByRole("button", { name: "Done with line 1" }).closest("li")!;
  expect(within(row).getByLabelText("Line 1 food")).toBeInTheDocument();
  await user.click(within(row).getByRole("button", { name: "Done with line 1" }));
  expect(screen.queryByLabelText("Line 1 food")).not.toBeInTheDocument();
});

test("a food the parser misread is corrected by typing part of its name and picking it", async () => {
  const beans = {
    id: "44444444-4444-4444-8444-444444444444",
    name: "green beans",
    pluralName: null,
    aliases: [],
    aisleId: null,
    recipeId: null,
    skipShopping: false,
    conversions: [],
  };
  const library = [beans, { ...beans, id: "55555555-5555-4555-8555-555555555555", name: "butter" }];
  // `listFoods` as the server answers it: every food for no text, else those whose name contains it.
  const searchFoods = async (q: string) => library.filter((food) => food.name.includes(q.trim().toLowerCase()));
  function Beans() {
    // No "oz" unit here, so the parser takes it as part of the food: "oz green beans".
    const [rows, setRows] = useState<IngredientReview[]>(reviewRows(["8 oz green beans"], { units: [], foods: [] }));
    return <IngredientReviewList rows={rows} units={[]} searchFoods={searchFoods} onRowsChange={setRows} />;
  }
  const user = userEvent.setup();
  render(<Beans />);
  expect(screen.getByText("Unknown food")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Change line 1" }));
  const field = screen.getByLabelText("Line 1 food");
  await user.clear(field);
  await user.type(field, "green");
  // The list is portalled out of the row, so it carries its field's name (queue 2 G2).
  expect(await screen.findByRole("listbox", { name: "Line 1 food suggestions" })).toBeInTheDocument();
  await user.click(await screen.findByRole("option", { name: "green beans" }));

  expect(screen.getByTestId("review-counts")).toHaveTextContent("1 matched");
  expect(screen.queryByText("Unknown food")).not.toBeInTheDocument();
});
