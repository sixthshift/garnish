// The chooser pressed: an address typed on the first screen is read at once, and each other way in reports itself.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { SourceChooser } from "../../../../../src/routes/recipes/new/components/SourceChooser";

test("an address typed on the chooser is read without a stage of its own first", async () => {
  const onReadUrl = vi.fn();
  const onChoose = vi.fn();
  const user = userEvent.setup();
  render(<SourceChooser onChoose={onChoose} onReadUrl={onReadUrl} />);
  expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  await user.type(screen.getByLabelText("Import from a web page"), "https://example.test/tart{Enter}");
  expect(onReadUrl).toHaveBeenCalledWith("https://example.test/tart");
  expect(onChoose).not.toHaveBeenCalled();
});

test("each other way in reports which one it is", async () => {
  const onChoose = vi.fn();
  const user = userEvent.setup();
  render(<SourceChooser onChoose={onChoose} />);
  await user.click(screen.getByRole("button", { name: /Paste the recipe/ }));
  await user.click(screen.getByRole("button", { name: /Upload an export/ }));
  await user.click(screen.getByRole("button", { name: /Start from scratch/ }));
  expect(onChoose.mock.calls.map(([kind]) => kind)).toEqual(["paste", "file", "manual"]);
});
