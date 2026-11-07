// A desktop's Settings (decisions.md row 207): the places as a menu down the
// left, grouped, each with its count, and the one pressed filling the rest.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, useState } from "react";
import { expect, test, vi } from "vitest";
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

/** The menu as the page holds it: the choice kept outside it, as the address keeps it. */
function Menu(props: Omit<ComponentProps<typeof SettingsMenu>, "value" | "onChange">) {
  const [value, setValue] = useState<string>();
  return <SettingsMenu {...props} value={value} onChange={setValue} />;
}

test("the menu groups the places, Foods first, and a press shows another in the rest of the page", async () => {
  const user = userEvent.setup();
  await renderInRouter(<Menu groups={groups} footer={<p>Garnish 1.9.0</p>} />);

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
  const { container } = await renderInRouter(<Menu groups={groups} />);
  const body = () => container.querySelector("[data-section]")?.lastElementChild;
  expect(body()?.className).not.toContain("max-w-3xl");
  await user.click(screen.getByRole("button", { name: "Style 12" }));
  expect(body()?.className).toContain("max-w-3xl");
});

test("the place shown is the one it is given, and a press asks for another rather than keeping its own", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  await renderInRouter(<SettingsMenu groups={groups} value="units" onChange={onChange} />);
  expect(screen.getByRole("heading", { level: 2, name: "Units" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Style 12" }));
  expect(onChange).toHaveBeenCalledWith("style");
  // Until the address moves, the place shown stays.
  expect(screen.getByRole("heading", { level: 2, name: "Units" })).toBeTruthy();
});
