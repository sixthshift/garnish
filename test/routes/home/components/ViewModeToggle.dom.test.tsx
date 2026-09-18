// The view toggle and the recipe grid read the same preference from different
// components, so a press on one has to reach the other at once, not after a
// reload. A probe stands in for the grid.
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import { useIngredientMode, useViewMode } from "../../../../src/lib/prefs";
import { ViewModeToggle } from "../../../../src/routes/home/components/ViewModeToggle";
import { IngredientModeToggle } from "../../../../src/routes/recipes/recipe/components/IngredientModeToggle";

function ViewProbe() {
  const [mode] = useViewMode();
  return <output data-testid="view-probe">{mode}</output>;
}

function IngredientProbe() {
  const [mode] = useIngredientMode();
  return <output data-testid="ingredient-probe">{mode}</output>;
}

beforeEach(() => {
  window.localStorage.clear();
});

test("pressing List view switches every reader of the preference, and it is stored", async () => {
  const user = userEvent.setup();
  render(
    <>
      <ViewModeToggle />
      <ViewProbe />
    </>
  );
  expect(screen.getByTestId("view-probe")).toHaveTextContent("grid");

  await user.click(screen.getByRole("radio", { name: "List view" }));
  expect(screen.getByTestId("view-probe")).toHaveTextContent("list");
  expect(screen.getByRole("radio", { name: "List view" })).toBeChecked();
  expect(window.localStorage.getItem("garnish.viewMode")).toBe('"list"');

  await user.click(screen.getByRole("radio", { name: "Grid view" }));
  expect(screen.getByTestId("view-probe")).toHaveTextContent("grid");
});

test("the recipe page's One list switch reaches its reader the same way", async () => {
  const user = userEvent.setup();
  render(
    <>
      <IngredientModeToggle />
      <IngredientProbe />
    </>
  );
  expect(screen.getByTestId("ingredient-probe")).toHaveTextContent("structured");
  await user.click(screen.getByRole("switch", { name: "One list" }));
  expect(screen.getByTestId("ingredient-probe")).toHaveTextContent("summary");
});

test("a change made in another tab arrives through the storage event", () => {
  render(<ViewProbe />);
  window.localStorage.setItem("garnish.viewMode", '"list"');
  act(() => void window.dispatchEvent(new StorageEvent("storage", { key: "garnish.viewMode" })));
  expect(screen.getByTestId("view-probe")).toHaveTextContent("list");
});
