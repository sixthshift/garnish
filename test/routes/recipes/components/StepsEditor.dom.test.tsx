// A step's ⋯ menu carries its list's moves, which is how a narrow list —
// with no up and down buttons beside the step — reorders without a drag.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { addStep, emptyDraft, type RecipeDraft } from "../../../../src/domain/draft";
import { StepsEditor } from "../../../../src/routes/recipes/components/StepsEditor";

function three(): RecipeDraft {
  return addStep(addStep(addStep(emptyDraft(), 0, "Mix."), 0, "Rest."), 0, "Bake.");
}

const texts = (draft: RecipeDraft) => draft.parts[0]!.steps.map((step) => step.text);

test("the step menu moves the step, and offers no move past either end", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<StepsEditor draft={three()} pi={0} onChange={onChange} />);

  await user.click(screen.getByRole("button", { name: "Step 2 actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Move up" }));
  expect(texts(onChange.mock.calls[0]![0])).toEqual(["Rest.", "Mix.", "Bake."]);

  await user.click(screen.getByRole("button", { name: "Step 1 actions" }));
  expect(screen.getByRole("menuitem", { name: "Move up" })).toBeDisabled();
  await user.click(screen.getByRole("menuitem", { name: "Move down" }));
  expect(texts(onChange.mock.calls[1]![0])).toEqual(["Rest.", "Mix.", "Bake."]);
});
