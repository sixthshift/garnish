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

test("the list by meal shows each planned dish its own share of a line they share, and stays chosen", async ({ page, open }) => {
  const dal = unique("Meal Dal");
  const soup = unique("Meal Soup");
  await createRecipe(page, open, { name: dal, servings: 4, ingredients: ["200 g red lentils", "1 onion"], steps: ["Simmer."] });
  await createRecipe(page, open, { name: soup, servings: 4, ingredients: ["100 g red lentils", "1 carrot"], steps: ["Simmer."] });

  await open("/plan");
  for (const [day, name] of [
    ["Monday", dal],
    ["Tuesday", soup],
  ] as const) {
    await page.getByRole("button", { name: new RegExp(`^Add to ${day}`) }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("combobox", { name: "Search recipes, or type a note" }).fill(name);
    await sheet.getByRole("option", { name }).click();
    await expect(sheet).toBeHidden();
  }
  await page.getByRole("button", { name: "Add this week to the shopping list" }).click();
  await expect(page.getByRole("status").filter({ hasText: "items added" })).toBeVisible();

  await open("/shopping");
  // By aisle, the lentil line says under it which dishes it is for.
  await expect(page.getByRole("region", { name: "Pantry" }).getByText(`${dal}, Mon · ${soup}, Tue`)).toBeVisible();

  await page.getByRole("radio", { name: "Meals" }).click();
  // One lentil line on the list, drawn under each dish at that dish's amount.
  const dalGroup = page.getByRole("region", { name: new RegExp(`^${dal}, Mon `) });
  const soupGroup = page.getByRole("region", { name: new RegExp(`^${soup}, Tue `) });
  await expect(dalGroup.getByRole("checkbox", { name: "200 g red lentils" })).toBeVisible();
  await expect(dalGroup.getByRole("checkbox", { name: "1 onion" })).toBeVisible();
  await expect(soupGroup.getByRole("checkbox", { name: "100 g red lentils" })).toBeVisible();
  await expect(soupGroup.getByRole("checkbox", { name: "1 carrot" })).toBeVisible();

  // Ticking it under one dish ticks the line, so it is ticked under both, and stays where it is.
  await soupGroup.getByRole("checkbox", { name: "100 g red lentils" }).click();
  await expect(dalGroup.getByRole("checkbox", { name: "200 g red lentils" })).toBeChecked();

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("radio", { name: "Meals" })).toBeChecked();
  await expect(soupGroup.getByRole("checkbox", { name: "100 g red lentils" })).toBeChecked();
});

test("a line is rounded up to the sizes its food is sold in, and a size can be added from the list", async ({ page, open }) => {
  const name = unique("Pack Bake");
  // Butter comes in 250 g and 500 g from the starter sizes; red lentils has none.
  await createRecipe(page, open, { name, servings: 4, ingredients: ["150 g butter", "300 g red lentils"], steps: ["Bake."] });

  await open("/plan");
  await page.getByRole("button", { name: /^Add to Wednesday/ }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("combobox", { name: "Search recipes, or type a note" }).fill(name);
  await sheet.getByRole("option", { name }).click();
  await expect(sheet).toBeHidden();
  await page.getByRole("button", { name: "Add this week to the shopping list" }).click();
  await expect(page.getByRole("status").filter({ hasText: "items added" })).toBeVisible();

  await open("/shopping");
  await page.getByRole("radio", { name: "Aisles" }).click();
  const dairy = page.getByRole("region", { name: "Dairy & eggs" });
  await expect(dairy.getByText(/butter → \d+ × (250|500) g/)).toBeVisible();

  // Lentils: a 1 kg bag, added from the row, and the line is rounded at once.
  const lentils = page.getByRole("region", { name: "Pantry" }).getByRole("listitem").filter({ hasText: "red lentils" });
  await lentils
    .getByText(/red lentils/)
    .first()
    .click();
  await lentils.getByRole("textbox", { name: "Size red lentils is sold in" }).fill("1");
  await lentils.getByRole("combobox", { name: "Unit of the size red lentils is sold in" }).click();
  await page.getByRole("option", { name: "kilogram" }).click();
  await lentils.getByRole("button", { name: "Add size" }).click();
  await expect(lentils.getByText(/→ \d+ × 1 kg/)).toBeVisible();
});
