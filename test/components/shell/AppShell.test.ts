// Critique #2: the phone's tab bar had no z-index, so any positioned content
// (a card's heart) painted over it and took its taps. The shell's fixed chrome
// takes the design system's named layer, below sheets, popovers and modals;
// the local Menu takes the popover layer so it still opens over the bar.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const src = (path: string) => readFileSync(join(import.meta.dirname, "..", "..", "..", "src", path), "utf8");

test("the phone tab bar sits on the app-bar layer", () => {
  expect(src("components/shell/AppShell.tsx")).toMatch(/<Nav className="fixed inset-x-0 bottom-0 z-app-bar /);
});

test("the menu's scrim and panel sit on the popover layer, above the tab bar", () => {
  const menu = src("components/ui/Menu.tsx");
  expect(menu).toMatch(/data-testid="menu-scrim" className="fixed inset-0 z-popover"/);
  expect(menu).toMatch(/"absolute top-full z-popover /);
});
