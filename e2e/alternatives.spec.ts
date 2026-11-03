// A line's alternatives (decisions.md row 199): set in the editor, shown under
// the line, the plan choosing among the ones it picks, and the list buying
// the choice.
import { createRecipe, expect, test, unique } from "./fixtures";

test("a line's alternatives show under it, the plan picks among the ticked ones, and the list buys the choice", async ({ page, open }) => {
  const name = unique("Any Stir-fry");
  const tofu = unique("firm tofu").toLowerCase();
  const tempeh = unique("tempeh").toLowerCase();
  await createRecipe(page, open, { name, servings: 4, ingredients: ["500 g chicken thigh"], steps: ["Stir-fry it."] });
  const ingredients = page.getByRole("list", { name: "Ingredients" });

  // The editor: tofu at 400 g, which the plan picks; tempeh, which it does not.
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Ingredient 1 actions" }).click();
  await page.getByRole("menuitem", { name: /^Alternatives/ }).click();
  const sheet = page.getByRole("dialog", { name: "Ingredient 1 alternatives" });
  await sheet.getByRole("button", { name: "Add alternative" }).click();
  const first = sheet.getByRole("group", { name: "Alternative 1" });
  await first.getByLabel("Alternative 1 food", { exact: true }).fill(tofu);
  // A new food row starts on the line's own unit.
  await expect(first.getByRole("combobox", { name: "Alternative 1 food unit" })).toContainText("gram");
  await first.getByRole("textbox", { name: "Alternative 1 food amount" }).fill("400");
  await first.getByRole("checkbox", { name: "The plan picks it" }).click();
  await sheet.getByRole("heading").click();
  await sheet.getByRole("button", { name: "Add alternative" }).click();
  const second = sheet.getByRole("group", { name: "Alternative 2" });
  await second.getByLabel("Alternative 2 food", { exact: true }).fill(tempeh);
  await second.getByRole("textbox", { name: "Alternative 2 note" }).fill("steam it first");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toBeHidden();
  await page.getByRole("button", { name: /^Save/ }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(ingredients).toContainText(`or 400 g ${tofu}`);
  await expect(ingredients).toContainText(`or 500 g ${tempeh} · steam it first`);

  // The plan: first time round it is the line's own food; Choose offers only the ticked one.
  await open("/plan");
  await page.getByRole("button", { name: /^Add to Monday/ }).click();
  const add = page.getByRole("dialog");
  await add.getByRole("combobox", { name: "Search recipes, or type a note" }).fill(name);
  await add.getByRole("option", { name }).click();
  await expect(add).toBeHidden();
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Choose…" }).click();
  const choose = page.getByRole("dialog", { name: `Choose for ${name}` });
  await expect(choose.getByRole("radio")).toHaveCount(2);
  await choose.getByRole("radio", { name: `400 g ${tofu}` }).click();
  await choose.getByRole("button", { name: "Save" }).click();
  await expect(choose).toBeHidden();
  const week = page.getByRole("list", { name: /^Week of/ });
  const entry = week.getByRole("link", { name: new RegExp(`${name} · ${tofu}`) });
  await expect(entry).toBeVisible();

  // The entry opens the recipe made with tofu.
  await entry.click();
  await expect(ingredients).toContainText(`400 g ${tofu}`);
  await expect(ingredients).toContainText("or 500 g chicken thigh");

  // The list buys tofu.
  await open("/plan");
  await page.getByRole("button", { name: "Add this week to the shopping list" }).click();
  // "1 item added" when this is the week's only line, "n items added" otherwise.
  await expect(page.getByRole("status").filter({ hasText: /items? added/ })).toBeVisible();
  await open("/shopping");
  await expect(page.getByRole("checkbox", { name: `400 g ${tofu}` })).toBeVisible();
});
