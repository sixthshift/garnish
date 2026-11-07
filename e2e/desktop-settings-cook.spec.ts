// A desktop's Settings and cooking from the recipe page (decisions.md rows 207, 214): the places as a
// menu down the left, Foods an editable grid with a details pane and a bar for
// ticked rows; cooking the recipe page folded into one header line.
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

test("cooking folds the page into one line, ticking a step moves Now on, and Finish logs the cook with what was noted", async ({ page, open }) => {
  const name = unique("Desk Rice");
  await createRecipe(page, open, {
    name,
    servings: 2,
    ingredients: ["200 g rice"],
    steps: ["Rinse the rice.", "Simmer the rice for 12 minutes.", "Rest the rice, covered."],
  });
  const recipe = new URL(page.url()).pathname;
  await page.getByRole("link", { name: "Start cooking" }).click();
  await expect(page).toHaveURL(/cooking=true/);

  const header = page.getByTestId("cooking-header");
  await expect(header).toContainText(name);
  // The top bar steps aside: the one header line is all there is above the columns.
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  const now = page.locator('[data-now="true"]');
  await expect(now).toContainText("Rinse the rice.");
  await now.getByTestId("step-toggle").click();
  await expect(now).toContainText("Simmer the rice for 12 minutes.");

  const side = page.getByTestId("cooking-side");
  await side.getByRole("textbox").fill("Needed a splash more water");
  await side.getByRole("button", { name: "Note it" }).click();
  await expect(side).toContainText("Needed a splash more water");

  // ✕ keeps the session: the page offers to resume it.
  await page.getByRole("link", { name: "Stop cooking for now" }).click();
  await expect(page.getByRole("link", { name: "Resume cooking" })).toBeVisible();
  await page.getByRole("link", { name: "Resume cooking" }).click();
  await page.getByTestId("finish-cooking").click();

  await expect(page.getByRole("heading", { level: 1, name: "How did it go?" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Comment" })).toHaveValue("Noted: Needed a splash more water.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(new RegExp(`${recipe}$`));
  await expect(page.getByRole("link", { name: "Start cooking" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
