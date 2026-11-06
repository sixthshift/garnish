// The library and the recipe page at a laptop's size (decisions.md row 207):
// the library in three panes (filters, the wall, the side panel) that the
// arrow keys flip through, and the recipe page as a spread whose steps light
// up their ingredients.
import { createRecipe, expect, test, unique } from "./fixtures";

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test("the library is three panes: the filters column filters the wall, a card opens beside it, and the keys flip", async ({ page, open }) => {
  const stem = unique("Pane");
  const names = [`${stem} Apple`, `${stem} Banana`, `${stem} Cherry`];
  for (const name of names) await createRecipe(page, open, { name, servings: 2, ingredients: ["1 onion"], steps: ["Soften the onion."] });

  await open("/recipes?sort=name&dir=asc");
  const filters = page.getByRole("complementary", { name: "Filters" });
  await expect(filters.getByRole("region", { name: "Collections" }).getByRole("button", { name: /^Everything \d+$/ })).toHaveAttribute("aria-pressed", "true");
  await filters.getByRole("textbox", { name: "Search recipes" }).fill(stem);
  const wall = page.getByRole("list", { name: "Recipes" });
  await expect(wall.getByRole("link")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await wall.getByRole("link", { name: new RegExp(names[0]!) }).click();
  const panel = page.getByRole("complementary", { name: "Recipe" });
  await expect(panel.getByRole("heading", { level: 2, name: names[0] })).toBeVisible();
  // The filters, the wall and the panel, side by side and none off the screen.
  const [left, middle, right] = await Promise.all([filters.boundingBox(), wall.boundingBox(), panel.boundingBox()]);
  expect(left!.x + left!.width).toBeLessThanOrEqual(middle!.x);
  expect(middle!.x + middle!.width).toBeLessThanOrEqual(right!.x);
  expect(right!.x + right!.width).toBeLessThanOrEqual(1440);

  await page.keyboard.press("ArrowRight");
  await expect(panel.getByRole("heading", { level: 2, name: names[1] })).toBeVisible();
  await page.keyboard.press("j");
  await expect(panel.getByRole("heading", { level: 2, name: names[2] })).toBeVisible();
  await page.keyboard.press("k");
  await expect(panel.getByRole("heading", { level: 2, name: names[1] })).toBeVisible();

  // Back closes the panel rather than stepping back through each flip.
  await page.goBack();
  await expect(panel).toHaveCount(0);
  await page.goForward();
  await expect(panel.getByRole("heading", { level: 2, name: names[1] })).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: names[1] })).toBeVisible();
  expect(new URL(page.url()).pathname).toMatch(/^\/recipes\/[^/]+$/);
});

test("the recipe page is a spread: the ingredients beside the method, and a step lights up what it uses", async ({ page, open }) => {
  const name = unique("Spread Rice");
  await createRecipe(page, open, { name, servings: 2, ingredients: ["200 g rice", "2 eggs"], steps: ["Rinse the rice.", "Fry the eggs."] });

  const ingredients = page.getByTestId("ingredients-column");
  const method = page.getByTestId("method-column");
  await expect(ingredients.getByText("rice")).toBeVisible();
  const [list, steps] = await Promise.all([ingredients.boundingBox(), method.boundingBox()]);
  // Side by side, each a screen tall under the top bar.
  expect(list!.x + list!.width).toBeLessThanOrEqual(steps!.x + 1);
  expect(Math.abs(list!.y - steps!.y)).toBeLessThan(2);
  expect(await ingredients.evaluate((element) => getComputedStyle(element).overflowY)).toBe("auto");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // Whatever the editor linked, the lighting agrees with what each step card lists as its own rows,
  // so the link is on the page with nothing pointed at.
  const fry = method.getByTestId("step-card").filter({ hasText: "Fry the eggs." });
  const uses = await fry.getByTestId("step-ingredients").getByTestId("ingredient-row").count();
  await fry.hover();
  await expect(ingredients.locator('[data-testid="ingredient-row"][data-lit="true"]')).toHaveCount(uses);

  const eggs = ingredients.getByTestId("ingredient-row").filter({ hasText: "eggs" });
  const using = await method
    .getByTestId("step-card")
    .filter({ has: page.getByTestId("step-ingredients").filter({ hasText: "eggs" }) })
    .count();
  await eggs.hover();
  await expect(method.locator('[data-testid="step-card"][data-lit="lit"]')).toHaveCount(using);
  if (using > 0) await expect(method.locator('[data-testid="step-card"][data-lit="dim"]')).toHaveCount(2 - using);
});
