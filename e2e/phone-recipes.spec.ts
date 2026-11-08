// A phone's library and recipe page (decisions.md row 208): two columns of
// photos found from the search at the foot, the collections as chips and the
// filters in a sheet; then the recipe with Ingredients and Method as tabs and
// Start cooking, the shopping list and the plan held under the thumb.
import { createRecipe, expect, test, unique } from "./fixtures";

test("the library: search at the foot, collections as chips, the order and a count in the filters sheet", async ({ page, open }) => {
  const name = unique("Phone Pho");
  await createRecipe(page, open, { name, servings: 2, ingredients: ["200 g rice noodles"], steps: ["Pour the broth over."] });

  await open("/recipes");
  const grid = page.getByRole("list", { name: "Recipes" });
  // The search sits above the tab bar, held there while the grid scrolls.
  const search = page.getByRole("textbox", { name: "Search recipes" });
  const box = await search.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && box.y > viewport.height / 2).toBe(true);
  await search.fill(name);
  await expect(page).toHaveURL(/q=/);
  await expect(grid.getByRole("link")).toHaveCount(1);
  await expect(grid.getByRole("link", { name })).toBeVisible();

  // Never made, so it is on To try.
  const collection = page.getByRole("radiogroup", { name: "Collection" });
  await collection.getByRole("radio", { name: "To try" }).click();
  await expect(page).toHaveURL(/shelf=try/);
  await expect(grid.getByRole("link", { name })).toBeVisible();

  // The filters sheet rises from the bottom: the order, then Show N recipes closes it.
  await page.getByRole("button", { name: "Filters" }).click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await sheet.getByRole("radiogroup", { name: "Order" }).getByRole("radio", { name: "Name (A–Z)" }).click();
  await expect(page).toHaveURL(/sort=name/);
  await sheet.getByRole("button", { name: "Show 1 recipe" }).click();
  await expect(sheet).toBeHidden();

  // The heart on the card, and the Favourites chip finds it.
  await grid.getByRole("button", { name: "Add to favourites" }).click();
  await expect(grid.getByRole("button", { name: "Remove from favourites" })).toBeVisible();
  await page.getByRole("button", { name: "Favourites", exact: true }).click();
  await expect(page).toHaveURL(/favourite=true/);
  await expect(grid.getByRole("link", { name })).toBeVisible();

  await grid.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
});

test("the recipe page: two tabs held at the top, and Start cooking, the list and the plan under the thumb", async ({ page, open }) => {
  const name = unique("Phone Dal");
  // Foods no other spec plans: it goes on this week, and plan.spec's list would merge its lines.
  await createRecipe(page, open, { name, servings: 4, ingredients: ["200 g mung beans", "1 shallot"], steps: ["Rinse the beans.", "Simmer until soft."] });

  // Ingredients first; the method's tab names how many steps.
  const ingredients = page.getByRole("tab", { name: "Ingredients" });
  const method = page.getByRole("tab", { name: "Method · 2 steps" });
  await expect(ingredients).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("list", { name: "Ingredients" })).toContainText("mung beans");
  await expect(page.getByText("Rinse the beans.")).toBeHidden();
  await method.click();
  await expect(page.getByText("Rinse the beans.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Ingredients" })).toBeHidden();

  // Start cooking is in view without scrolling, above the tab bar.
  const bar = page.getByTestId("cook-bar");
  await expect(bar.getByRole("link", { name: "Start cooking" })).toBeInViewport();

  // Put it on the plan from a sheet.
  await bar.getByRole("button", { name: "Put on the plan" }).click();
  const plan = page.getByRole("dialog", { name: `Plan ${name}` });
  await plan.getByTestId("plan-popover-day").first().click();
  await expect(page.getByRole("status").filter({ hasText: /^Added to/ })).toBeVisible();
  await expect(plan).toBeHidden();

  // The cart opens the shopping list's sheet.
  await bar.getByRole("button", { name: "Add to shopping list" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  await bar.getByRole("link", { name: "Start cooking" }).click();
  await expect(page).toHaveURL(/cooking=true/);
});
