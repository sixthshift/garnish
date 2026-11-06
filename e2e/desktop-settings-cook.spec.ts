// A desktop's Settings and cook mode (decisions.md row 207): the places as a
// menu down the left, Foods an editable grid with a details pane and a bar for
// ticked rows; cook mode a filmstrip that ← → and Space move along.
import { createRecipe, expect, test, unique } from "./fixtures";

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test("Settings is a menu down the left, and a press shows that place beside it", async ({ page, open }) => {
  await open("/settings");
  const menu = page.getByRole("navigation", { name: "Settings" });
  await expect(menu.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Foods" })).toBeVisible();
  await expect(page.locator("tbody tr[data-row]").first()).toBeVisible();

  await menu.getByRole("button", { name: "Units" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Units" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search units" })).toBeVisible();
  await menu.getByRole("button", { name: /^Appearance/ }).click();
  await expect(page.locator('[data-section="appearance"]')).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Units" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Foods: a cell edits in place, a row opens its details, and the bar deletes what is ticked", async ({ page, open }) => {
  const name = unique("Finger lime").toLowerCase();
  await open("/settings");
  await page.getByRole("button", { name: "Add food" }).click();
  const sheet = page.getByRole("dialog", { name: "New food" });
  await sheet.getByRole("textbox", { name: "Name" }).fill(name);
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("textbox", { name: "Search foods" }).fill(name);
  const renamed = `${name} caviar`;
  await page.getByRole("button", { name: `Edit name: ${name}` }).dblclick();
  await page.getByRole("textbox", { name: `Edit name: ${name}` }).fill(renamed);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: `Edit name: ${renamed}` })).toBeVisible();

  // Saved, not just shown: it is still renamed after a reload.
  await open("/settings");
  await page.getByRole("textbox", { name: "Search foods" }).fill(renamed);
  const row = page.locator("tbody tr[data-row]", { hasText: renamed });
  await expect(row).toHaveCount(1);

  // Esc puts a cell back.
  await page.getByRole("button", { name: `Edit also called: ${renamed}` }).dblclick();
  await page.getByRole("textbox", { name: `Edit also called: ${renamed}` }).fill("never saved");
  await page.keyboard.press("Escape");
  await expect(row).not.toContainText("never saved");

  // A click opens the details beside the grid; a name added there shows in the row.
  await row.locator("td").nth(7).click();
  const pane = page.getByRole("region", { name: renamed });
  await expect(pane).toBeVisible();
  await expect(pane.getByRole("heading", { name: "Used in 0 recipes" })).toBeVisible();
  await pane.getByRole("button", { name: "Add a name" }).click();
  await pane.getByRole("textbox", { name: "New name" }).fill("citrus caviar");
  await page.keyboard.press("Enter");
  await expect(row).toContainText("citrus caviar");

  await page.getByRole("checkbox", { name: `Select ${renamed}` }).click();
  const bar = page.getByRole("region", { name: "Selected foods" });
  await expect(bar).toContainText("1 selected");
  await bar.getByRole("button", { name: "Delete 1" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(row).toHaveCount(0);
  await expect(bar).toHaveCount(0);
});

test("cook mode is a filmstrip that ← → and Space move along, and a neighbouring step goes to itself", async ({ page, open }) => {
  const name = unique("Filmstrip Rice");
  await createRecipe(page, open, {
    name,
    servings: 2,
    ingredients: ["200 g rice"],
    steps: ["Rinse the rice.", "Simmer the rice for 12 minutes.", "Rest the rice, covered."],
  });
  await open(`${new URL(page.url()).pathname}/cook`);

  const position = page.locator("[data-position]");
  await expect(page.locator('[data-cook-layout="filmstrip"]')).toBeVisible();
  await expect(position).toHaveText("Ingredients");
  await expect(page.getByRole("button", { name: "Next: Step 1 of 3" })).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(position).toHaveText("Step 1 of 3");
  await expect(page.getByRole("complementary", { name: "This step" })).toContainText("Simmer the rice for 12 minutes.");
  await page.keyboard.press("Space");
  await expect(position).toHaveText("Step 2 of 3");
  await page.keyboard.press("ArrowLeft");
  await expect(position).toHaveText("Step 1 of 3");

  await page.getByRole("button", { name: "Previous: Ingredients" }).click();
  await expect(position).toHaveText("Ingredients");
  await page.getByRole("button", { name: "Next: Step 1 of 3" }).click();
  await expect(position).toHaveText("Step 1 of 3");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
