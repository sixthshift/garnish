// The first test in the DOM project, and a real one: NumberStepper's buttons
// are what the cook page's "Serves" and the Made-this sheet step with, and
// nothing until now could press them.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { NumberStepper } from "../../../src/components/ui/NumberStepper";

test("the buttons step the value, and the minimum disables the one that would go under it", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<NumberStepper label="Servings" value={1} min={1} onChange={onChange} />);

  await user.click(screen.getByRole("button", { name: "Increase Servings" }));
  expect(onChange).toHaveBeenCalledWith(2);

  expect(screen.getByRole("button", { name: "Decrease Servings" })).toBeDisabled();
});
