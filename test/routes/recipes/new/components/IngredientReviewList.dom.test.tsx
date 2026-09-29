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
