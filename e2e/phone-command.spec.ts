// A phone's tab bar and its + (decisions.md row 208): Home, Plan, the +,
// Shopping and Recipes, and the + a sheet that plans a recipe on a day,
// adds a line to the shopping list, opens a recipe or goes to a page.
import { createRecipe, expect, test, unique } from "./fixtures";

test("the tab bar holds the four places and the +, and Settings is reached from the sheet", async ({ page, open }) => {
  await open("/");
  const bar = page.getByRole("navigation", { name: "Main" });
  await expect(bar.getByRole("link")).toHaveText(["Home", "Plan", "Shopping", "Recipes"]);
  await expect(bar.getByRole("link", { name: "Settings" })).toHaveCount(0);

  await bar.getByRole("button", { name: "Plan, add or find" }).click();
  const sheet = page.getByRole("dialog", { name: "Plan, add or find" });
  await expect(sheet.getByRole("combobox", { name: "Search, plan or add" })).toBeFocused();
  await sheet.getByRole("button", { name: "settings", exact: true }).click();
  await expect(sheet.getByRole("combobox", { name: "Search, plan or add" })).toHaveValue("settings");
  await sheet.getByRole("option", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings", exact: true }).first()).toBeVisible();
});

test("“<recipe> tonight” from the + puts the recipe on today's plan", async ({ page, open }) => {
  const name = unique("Phone Ragu");
  await createRecipe(page, open, { name, servings: 4, ingredients: ["500 g beef chuck"], steps: ["Braise the beef."] });

  await open("/shopping");
  await page.getByRole("button", { name: "Plan, add or find" }).click();
  const box = page.getByRole("combobox", { name: "Search, plan or add" });
  await box.fill(`${name.toLowerCase()} tonight`);
  const option = page.getByRole("option", { name: new RegExp(`^Put ${name} on `) });
  await expect(option).toHaveAttribute("aria-selected", "true");
  await option.click();
  await expect(page.getByRole("dialog", { name: "Plan, add or find" })).toHaveCount(0);
  await expect(page.getByText(new RegExp(`${name} is on `))).toBeVisible();

  await open("/plan");
  await expect(page.getByText(name).first()).toBeVisible();
});

test("a line that is not a recipe goes on the shopping list with Enter", async ({ page, open }) => {
  const line = unique("oat milk");
  await open("/plan");
  await page.getByRole("button", { name: "Plan, add or find" }).click();
  await page.getByRole("combobox", { name: "Search, plan or add" }).fill(line);
  await expect(page.getByRole("option", { name: `Add “${line}” to the shopping list` })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText(`Added “${line}” to the shopping list`)).toBeVisible();

  await open("/shopping");
  await expect(page.getByText(line).first()).toBeVisible();
});

test("cooking has no tab bar, so no +", async ({ page, open }) => {
  const name = unique("Phone Cook");
  await createRecipe(page, open, { name, servings: 2, ingredients: ["1 egg"], steps: ["Boil the egg."] });
  await open(`${new URL(page.url()).pathname}?cooking=true`);
  await expect(page.getByRole("button", { name: "Plan, add or find" })).toHaveCount(0);
});
