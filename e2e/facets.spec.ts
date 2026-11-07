// What a recipe is (decisions.md row 209): set from the recipe page's sheet,
// shown as chips, and a chip is the library narrowed to that value.
import { createRecipe, expect, test, unique } from "./fixtures";

test("a recipe's course and cuisine are set from its page, and a chip opens the library narrowed to it", async ({ page, open }) => {
  const name = unique("Facet Kottu");
  await createRecipe(page, open, { name, servings: 2, ingredients: ["2 godhamba roti"], steps: ["Chop and fry."] });

  await page.getByRole("button", { name: "Add course, cuisine and more" }).click();
  const sheet = page.getByTestId("facet-sheet");
  await sheet.getByRole("button", { name: "Main", exact: true }).click();
  await sheet.getByRole("button", { name: "Sri Lankan" }).click();
  await sheet.getByRole("button", { name: "Stovetop" }).click();
  await page.getByRole("button", { name: "Done" }).click();

  const chips = page.getByTestId("facet-chips");
  await expect(chips.getByRole("link", { name: "Main" })).toBeVisible();
  await expect(chips.getByRole("link", { name: "Stovetop" })).toBeVisible();

  // Kept: the page read afresh says the same.
  await page.reload();
  await expect(page.getByTestId("facet-chips").getByRole("link", { name: "Sri Lankan" })).toBeVisible();

  await page.getByTestId("facet-chips").getByRole("link", { name: "Sri Lankan" }).click();
  await expect(page).toHaveURL(/\/recipes\?cuisine=/);
  await expect(page.getByRole("link", { name: new RegExp(name) }).first()).toBeVisible();
});
