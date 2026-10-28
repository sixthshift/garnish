// Changes made at the stove (decisions.md row 193): an amount and a step
// changed in cook mode, one kept in the recipe and one just for this time,
// which becomes the cook log's comment.
import { createRecipe, expect, test, unique } from "./fixtures";

test("an amount changed while cooking is kept in the recipe; a step changed just this time goes to the log", async ({ page, open }) => {
  const name = unique("Cook Rice");
  await createRecipe(page, open, { name, servings: 2, ingredients: ["200 g rice", "2 tbsp soy sauce"], steps: ["Cook the rice.", "Add the soy sauce."] });
  const recipe = new URL(page.url()).pathname;

  await open(`${recipe}/cook`);
  await page.getByRole("button", { name: /^Change the amount of 2 tbsp soy sauce/ }).click();
  await page.getByRole("textbox", { name: "How much soy sauce you used" }).fill("1");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("1 change", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Change this step" }).click();
  await page.getByRole("textbox", { name: "How you did it" }).fill("Cook the rice with a bay leaf.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Cook the rice with a bay leaf.")).toBeVisible();
  await expect(page.getByText("2 changes", { exact: true })).toBeVisible();

  // On to the finish card.
  const next = page.getByRole("button", { name: "Next", exact: true });
  while (await next.isEnabled()) await next.click();
  await expect(page.getByRole("heading", { name: "What you changed" })).toBeVisible();
  await page.getByRole("radiogroup", { name: "What to do with: Step 1 rewritten" }).getByRole("radio", { name: "Just this time" }).click();
  await page.getByRole("button", { name: "Keep 1 change" }).click();
  await expect(page.getByRole("status").filter({ hasText: "1 change kept in the recipe" })).toBeVisible();

  await page.getByRole("button", { name: "Made this" }).click();
  await expect(page.getByRole("textbox", { name: "Comment" })).toHaveValue("This time: step 1: Cook the rice with a bay leaf.");
  await page.keyboard.press("Escape");

  await open(recipe);
  await expect(page.getByRole("list", { name: "Ingredients" })).toContainText("1 tbsp soy sauce");
  await expect(page.getByRole("list", { name: "Steps" })).toContainText("Cook the rice.");
  await expect(page.getByRole("list", { name: "Steps" })).not.toContainText("bay leaf");
});
