// A recipe planned for the week and the week sent to the shopping list: the
// plan, its search, and the list's aggregation into aisles.
import { createRecipe, expect, test, unique } from "./fixtures";

test("a planned week becomes a shopping list sorted into aisles", async ({ page, open }) => {
  const name = unique("Plan Dal");
  await createRecipe(page, open, { name, servings: 4, ingredients: ["200 g red lentils", "1 onion"], steps: ["Simmer."] });

  // Monday, so the spec does not depend on what day it runs.
  await open("/plan");
  await page
    .getByRole("list", { name: /^Week of/ })
    .getByRole("button", { name: /^Add to Monday/ })
    .click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Dinner" }).click();
  await sheet.getByRole("combobox", { name: "Search recipes, or type a note" }).fill(name);
  await sheet.getByRole("option", { name }).click();
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toBeHidden();

  const week = page.getByRole("list", { name: /^Week of/ });
  await expect(week.getByRole("link", { name })).toBeVisible();

  await page.getByRole("button", { name: "Add this week to the shopping list" }).click();
  await expect(page.getByRole("status").filter({ hasText: "items added" })).toBeVisible();

  await open("/shopping");
  await expect(page.getByRole("region", { name: "Pantry" }).getByRole("checkbox", { name: "200 g red lentils" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Fruit & veg" }).getByRole("checkbox", { name: "1 onion" })).toBeVisible();

  // A tick moves the line into the trolley, and is stored, not just drawn: it is still there after a cold reload.
  await page.getByRole("checkbox", { name: "1 onion" }).click();
  await expect(page.getByRole("region", { name: "Fruit & veg" }).getByRole("checkbox", { name: "1 onion" })).toHaveCount(0);
  const trolley = page.getByRole("dialog", { name: "In the trolley" });
  await page.getByRole("button", { name: /in the trolley/ }).click();
  await expect(trolley.getByRole("checkbox", { name: "1 onion" })).toBeChecked();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /in the trolley/ }).click();
  await expect(trolley.getByRole("checkbox", { name: "1 onion" })).toBeChecked();
});

test("the list shows each planned dish its own share of a line they share, and a meal chip narrows it to one dish", async ({ page, open }) => {
  const dal = unique("Meal Dal");
  const soup = unique("Meal Soup");
  await createRecipe(page, open, { name: dal, servings: 4, ingredients: ["200 g red lentils", "1 onion"], steps: ["Simmer."] });
  await createRecipe(page, open, { name: soup, servings: 4, ingredients: ["100 g red lentils", "1 carrot"], steps: ["Simmer."] });

  await open("/plan");
  for (const [day, name] of [
    ["Monday", dal],
    ["Tuesday", soup],
  ] as const) {
    await page
      .getByRole("list", { name: /^Week of/ })
      .getByRole("button", { name: new RegExp(`^Add to ${day}`) })
      .click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("combobox", { name: "Search recipes, or type a note" }).fill(name);
    await sheet.getByRole("option", { name }).click();
    await sheet.getByRole("button", { name: "Done" }).click();
    await expect(sheet).toBeHidden();
  }
  await page.getByRole("button", { name: "Add this week to the shopping list" }).click();
  await expect(page.getByRole("status").filter({ hasText: "items added" })).toBeVisible();

  await open("/shopping");
  // By aisle, the lentil line says under it which dishes it is for, each a link with its own share.
  const lentils = page.getByRole("region", { name: "Pantry" }).getByRole("listitem").filter({ hasText: "red lentils" });
  await expect(lentils.getByRole("link", { name: `${dal} Mon 200 g` })).toBeVisible();
  await expect(lentils.getByRole("link", { name: `${soup} Tue 100 g` })).toBeVisible();

  // A phone's meal chip narrows the list to one dish's lines (decisions.md row 208): the soup's carrot and
  // the shared lentils, still saying each dish's share, and not the dal's onion.
  const meals = page.getByRole("group", { name: "Meals" });
  await meals.getByRole("button", { name: `${soup}, Tue: 2 to buy` }).click();
  const list = page.getByTestId("shopping-groups");
  await expect(list.getByRole("listitem").filter({ hasText: soup })).toHaveCount(2);
  await expect(list.getByRole("listitem").filter({ hasText: "carrot" })).toBeVisible();
  await expect(lentils.getByRole("link", { name: `${dal} Mon 200 g` })).toBeVisible();
  await expect(list.getByRole("listitem").filter({ hasText: dal }).filter({ hasNotText: soup })).toHaveCount(0);

  // Ticking the shared line ticks it for both dishes: each chip counts one fewer to buy.
  await lentils.getByRole("checkbox").click();
  await expect(meals.getByRole("button", { name: `${soup}, Tue: 1 to buy` })).toBeVisible();
  await expect(meals.getByRole("button", { name: `${dal}, Mon: 1 to buy` })).toBeVisible();

  // All brings the dal's lines back.
  await meals.getByRole("button", { name: /^All · / }).click();
  await expect(list.getByRole("listitem").filter({ hasText: dal })).toHaveCount(1);
});

test("a line is rounded up to the sizes its food is sold in, and its dish links back to the recipe", async ({ page, open }) => {
  const name = unique("Pack Bake");
  // Butter comes in 250 g and 500 g from the starter sizes.
  await createRecipe(page, open, { name, servings: 4, ingredients: ["150 g butter", "300 g red lentils"], steps: ["Bake."] });

  await open("/plan");
  await page
    .getByRole("list", { name: /^Week of/ })
    .getByRole("button", { name: /^Add to Wednesday/ })
    .click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("combobox", { name: "Search recipes, or type a note" }).fill(name);
  await sheet.getByRole("option", { name }).click();
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toBeHidden();
  await page.getByRole("button", { name: "Add this week to the shopping list" }).click();
  await expect(page.getByRole("status").filter({ hasText: "items added" })).toBeVisible();

  await open("/shopping");
  const butter = page
    .getByRole("region", { name: "Dairy & eggs" })
    .getByRole("listitem")
    .filter({ hasText: /butter → \d+ × (250|500) g/ });
  await expect(butter).toBeVisible();

  // The dish under the line is a link to its recipe.
  await butter.getByRole("link", { name: new RegExp(`^${name}`) }).click();
  await expect(page).toHaveURL(/\/recipes\/pack-bake-/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
});
