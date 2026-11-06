// A desktop's Settings (decisions.md row 207): the places as a menu down the
// left, grouped, each with its count, and the one pressed filling the rest.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { type SettingsGroup, SettingsMenu } from "../../../../../../src/app/features/settings/components/desktop/SettingsMenu";
import { renderInRouter } from "../../../../../helpers/dom";
import { atDesktop } from "../../../../../helpers/layout";

atDesktop();

const groups: SettingsGroup[] = [
  {
    label: "Library",
    sections: [
      { value: "foods", label: "Foods", wide: true, content: <p>The foods grid</p> },
      { value: "units", label: "Units", wide: true, content: <p>The units table</p> },
    ],
  },
  { label: "Cooking", sections: [{ value: "style", label: "Style", badge: 12, content: <p>The house style</p> }] },
];

test("the menu groups the places, Foods first, and a press shows another in the rest of the page", async () => {
  const user = userEvent.setup();
  await renderInRouter(<SettingsMenu groups={groups} footer={<p>Garnish 1.9.0</p>} />);

  const menu = screen.getByRole("navigation", { name: "Settings" });
  expect(within(menu).getByRole("heading", { level: 1, name: "Settings" })).toBeTruthy();
  expect(
    within(menu)
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent)
  ).toEqual(["Library", "Cooking"]);
  expect(within(menu).getByRole("button", { name: "Foods" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("heading", { level: 2, name: "Foods" })).toBeTruthy();
  expect(screen.getByText("The foods grid")).toBeTruthy();
  expect(within(menu).getByText("Garnish 1.9.0")).toBeTruthy();

  await user.click(within(menu).getByRole("button", { name: "Style 12" }));
  expect(screen.getByRole("heading", { level: 2, name: "Style" })).toBeTruthy();
  expect(screen.getByText("The house style")).toBeTruthy();
  expect(screen.queryByText("The foods grid")).toBeNull();
  expect(within(menu).getByRole("button", { name: "Style 12" }).getAttribute("aria-current")).toBe("page");
  expect(within(menu).getByRole("button", { name: "Foods" }).getAttribute("aria-current")).toBeNull();
});

test("a column of settings keeps a reading measure; a table takes the width", async () => {
  const user = userEvent.setup();
  const { container } = await renderInRouter(<SettingsMenu groups={groups} />);
  const body = () => container.querySelector("[data-section]")?.lastElementChild;
  expect(body()?.className).not.toContain("max-w-3xl");
  await user.click(screen.getByRole("button", { name: "Style 12" }));
  expect(body()?.className).toContain("max-w-3xl");
});
