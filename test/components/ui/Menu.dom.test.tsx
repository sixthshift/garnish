// The arrow keys walk the items a person can see: an item a breakpoint hides
// cannot take focus, and landing on it would strand the keyboard.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Menu } from "../../../src/components/ui/Menu";

test("arrow keys pass over a hidden item", async () => {
  const user = userEvent.setup();
  const style = document.createElement("style");
  style.textContent = ".gone { display: none; }";
  document.head.append(style);
  render(
    <Menu label="Step 1 actions" iconOnly defaultOpen>
      <Menu.Item>Preview</Menu.Item>
      <Menu.Item className="gone">Move up</Menu.Item>
      <Menu.Item>Delete</Menu.Item>
    </Menu>
  );

  screen.getByRole("menuitem", { name: "Preview" }).focus();
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete" }));
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Preview" }));
  await user.keyboard("{End}");
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete" }));
  style.remove();
});
