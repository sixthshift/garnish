// Shopping on a desktop (decisions.md row 207): the store walk. The aisles
// across the width, a trolley that a tick moves a line into, and the list's
// meals as a key that lights their lines up.
import { createRecipe, expect, test, unique } from "./fixtures";

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test("a tick moves a line into the trolley, and a meal in the key lights up its lines until it is let go", async ({ page, open }) => {
  const name = unique("Walk Dal");
  // Foods no other spec lists: the specs share one list, and a line here would merge into theirs.
  await createRecipe(page, open, { name, servings: 4, ingredients: ["100 g walnuts", "1 parsnip"], steps: ["Simmer."] });
  await page.getByRole("button", { name: "Add to shopping list" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "added" })).toBeVisible();

  await open("/shopping");
  await expect(page.getByRole("heading", { level: 1, name: "Shopping" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // No Aisles/Meals toggle: the key does that job here.
  await expect(page.getByRole("radio", { name: "Meals" })).toHaveCount(0);

  const meal = page.getByRole("complementary", { name: "Meals" }).getByRole("button", { name: new RegExp(`^${name}: 2 to buy$`) });
  await expect(meal).toBeVisible();
  await meal.click();
  await expect(meal).toHaveAttribute("aria-pressed", "true");
  await meal.click();
  await expect(meal).toHaveAttribute("aria-pressed", "false");

  const parsnip = page
    .getByRole("region", { name: "Fruit & veg" })
    .getByRole("listitem")
    .filter({ hasText: name })
    .getByRole("checkbox", { name: "1 parsnip" });
  await parsnip.click();
  const trolley = page.getByRole("complementary", { name: "In the trolley" });
  await expect(trolley.getByRole("listitem").filter({ hasText: name }).getByRole("checkbox", { name: "1 parsnip" })).toBeChecked();
  await expect(page.getByRole("complementary", { name: "Meals" }).getByRole("button", { name: new RegExp(`^${name}: 1 to buy$`) })).toBeVisible();

  // Stored, not just drawn.
  await page.reload({ waitUntil: "networkidle" });
  await expect(trolley.getByRole("listitem").filter({ hasText: name }).getByRole("checkbox", { name: "1 parsnip" })).toBeChecked();
});
