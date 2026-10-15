// A recipe planned for the week and the week sent to the shopping list: the
// plan, its search, and the list's aggregation into aisles.
import { createRecipe, expect, test, unique } from "./fixtures";

test("a planned week becomes a shopping list sorted into aisles", async ({ page, open }) => {
  const name = unique("Plan Dal");
  await createRecipe(page, open, { name, servings: 4, ingredients: ["200 g red lentils", "1 onion"], steps: ["Simmer."] });

  // Monday, so the spec does not depend on what day it runs.
  await open("/plan");
  await page.getByRole("button", { name: /^Add to Monday/ }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Dinner" }).click();
  await sheet.getByRole("combobox", { name: "Search recipes, or type a note" }).fill(name);
  await sheet.getByRole("option", { name }).click();
  await expect(sheet).toBeHidden();

  const week = page.getByRole("list", { name: /^Week of/ });
  await expect(week.getByRole("link", { name })).toBeVisible();

  await page.getByRole("button", { name: "Add this week to the shopping list" }).click();
  await expect(page.getByRole("status").filter({ hasText: "items added" })).toBeVisible();

  await open("/shopping");
  await expect(page.getByRole("region", { name: "Pantry" }).getByRole("checkbox", { name: "200 g red lentils" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Fruit & veg" }).getByRole("checkbox", { name: "1 onion" })).toBeVisible();

  // A tick moves the line under Ticked, and is stored, not just drawn: it is still there after a cold reload.
  await page.getByRole("checkbox", { name: "1 onion" }).click();
  const ticked = page.getByRole("region", { name: "Ticked" });
  await expect(ticked.getByRole("checkbox", { name: "1 onion" })).toBeChecked();
  await page.reload({ waitUntil: "networkidle" });
  await expect(ticked.getByRole("checkbox", { name: "1 onion" })).toBeChecked();
});
