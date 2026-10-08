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

// The menu button pattern (WAI-ARIA APG): the keyboard opens the menu onto an item, walks only the items
// that can take focus, and Escape closes from wherever focus is.
const stepMenu = (
  <Menu label="Step 1 actions" iconOnly>
    <Menu.Item>Edit step</Menu.Item>
    <Menu.Item disabled>Move up</Menu.Item>
    <Menu.Item>Move down</Menu.Item>
    <Menu.Item disabled>Split by paragraph</Menu.Item>
  </Menu>
);
const trigger = () => screen.getByRole("button", { name: "Step 1 actions" });
const item = (name: string) => screen.getByRole("menuitem", { name });

test.each(["{Enter}", " ", "{ArrowDown}"])("%s on the trigger opens onto the first item", async (key) => {
  const user = userEvent.setup();
  render(stepMenu);
  trigger().focus();
  await user.keyboard(key);
  expect(trigger().getAttribute("aria-expanded")).toBe("true");
  expect(document.activeElement).toBe(item("Edit step"));
});

test("ArrowUp on the trigger opens onto the last enabled item", async () => {
  const user = userEvent.setup();
  render(stepMenu);
  trigger().focus();
  await user.keyboard("{ArrowUp}");
  expect(document.activeElement).toBe(item("Move down"));
});

test("the arrows wrap through the enabled items and pass over disabled ones", async () => {
  const user = userEvent.setup();
  render(stepMenu);
  trigger().focus();
  await user.keyboard("{ArrowDown}");
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(item("Move down"));
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(item("Edit step"));
  await user.keyboard("{ArrowUp}");
  expect(document.activeElement).toBe(item("Move down"));
  await user.keyboard("{Home}");
  expect(document.activeElement).toBe(item("Edit step"));
  await user.keyboard("{End}");
  expect(document.activeElement).toBe(item("Move down"));
});

test("Escape in the panel closes and returns focus to the trigger", async () => {
  const user = userEvent.setup();
  render(stepMenu);
  trigger().focus();
  await user.keyboard("{ArrowDown}{Escape}");
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(trigger());
});

test("opened by a click, focus stays on the trigger, Escape closes and ArrowDown goes in", async () => {
  const user = userEvent.setup();
  render(stepMenu);
  await user.click(trigger());
  expect(document.activeElement).toBe(trigger());
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(item("Edit step"));
  trigger().focus();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(trigger());
});

test("Escape on the trigger of a closed menu is left to whatever holds the menu", async () => {
  const user = userEvent.setup();
  let escapes = 0;
  render(
    // biome-ignore lint/a11y/noStaticElementInteractions: a stand-in for a sheet's Escape handler
    <div onKeyDown={(event) => event.key === "Escape" && escapes++}>{stepMenu}</div>
  );
  await user.click(trigger());
  await user.keyboard("{Escape}");
  expect(escapes).toBe(0);
  await user.keyboard("{Escape}");
  expect(escapes).toBe(1);
});

test("Tab from the panel closes the menu and moves on past it", async () => {
  const user = userEvent.setup();
  render(
    <>
      {stepMenu}
      <button type="button">Next</button>
    </>
  );
  trigger().focus();
  await user.keyboard("{ArrowDown}");
  await user.tab();
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next" }));
});

// An outside click lands on the scrim, which closes the menu. Focus in the panel would go down with it to
// the page body, so it goes back to the trigger; focus already on the trigger stays there.
test("opened from the keyboard, an outside click closes and returns focus to the trigger", async () => {
  const user = userEvent.setup();
  render(stepMenu);
  trigger().focus();
  await user.keyboard("{Enter}{ArrowDown}");
  expect(document.activeElement).toBe(item("Move down"));
  await user.click(screen.getByTestId("menu-scrim"));
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(trigger());
});

test("opened by a click, an outside click closes and leaves focus on the trigger", async () => {
  const user = userEvent.setup();
  render(stepMenu);
  await user.click(trigger());
  await user.click(screen.getByTestId("menu-scrim"));
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(trigger());
});

test("the panel is named by its trigger", async () => {
  const user = userEvent.setup();
  render(stepMenu);
  await user.click(trigger());
  expect(screen.getByRole("menu", { name: "Step 1 actions" })).toBeTruthy();
});

// Placement: happy-dom has no layout, so the geometry is stubbed. The panel hangs below the trigger
// unless that runs it off the foot of the screen and above has more room.
test.each([
  ["near the top of the screen, it opens downward", 100, false],
  ["near the foot of the screen, it opens upward", 760, true],
])("%s", async (_, triggerTop, upward) => {
  const user = userEvent.setup();
  const original = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const top = this.dataset.testid === "menu-panel" ? triggerTop + 36 : triggerTop;
    const height = this.dataset.testid === "menu-panel" ? 180 : 32;
    return { top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  };
  try {
    render(stepMenu);
    await user.click(trigger());
    const panel = screen.getByRole("menu");
    expect(panel.className.includes("bottom-full")).toBe(upward);
    expect(panel.className.includes("top-full")).toBe(!upward);
  } finally {
    HTMLElement.prototype.getBoundingClientRect = original;
  }
});
