// A recipe typed in by hand, found from the list, scaled, edited and saved:
// the editor, the server functions and the store, end to end.
import { createRecipe, expect, test, unique } from "./fixtures";

test("a recipe typed in is listed, scales, and keeps an edit", async ({ page, open }) => {
  const name = unique("Weeknight Dal");
  await createRecipe(page, open, {
    name,
    servings: 4,
    ingredients: ["200 g red lentils", "1 onion"],
    steps: ["Rinse the lentils.", "Simmer until soft."],
  });

  const ingredients = page.getByRole("list", { name: "Ingredients" });
  await expect(ingredients.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByRole("list", { name: "Steps" }).getByRole("listitem")).toHaveCount(2);

  // Found from the list by search.
  await open("/recipes");
  await page.getByRole("textbox", { name: "Search recipes" }).fill(name);
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

  // Doubling the servings doubles the amounts.
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "More servings" }).click();
  await expect(page.getByRole("button", { name: "Serves 8" })).toBeVisible();
  await expect(ingredients).toContainText("400 g");

  // An edit is saved and is what the recipe page shows afterwards, reloaded cold.
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByRole("textbox", { name: "Description" }).fill("Red lentils, on a weeknight.");
  await page.getByRole("button", { name: /^Save/ }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("main")).toContainText("Red lentils, on a weeknight.");
});
