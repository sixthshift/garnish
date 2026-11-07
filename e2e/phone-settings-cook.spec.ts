// A phone's Settings and cooking from the recipe page (decisions.md rows 208, 214): Settings one
// grouped list whose places open at `?section=`, Foods filed by letter with
// rows that swipe left to delete and open in a sheet; cooking the recipe
// page with Note and Finish under the thumb.
import { createRecipe, expect, test, unique } from "./fixtures";

test("Settings is one grouped list: a place opens as its own screen, and ‹ Settings and Back return to it", async ({ page, open }) => {
  await open("/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  for (const group of ["Library", "Cooking", "Data", "App"]) await expect(page.getByRole("heading", { level: 2, name: group })).toBeVisible();

  await page.getByRole("link", { name: /^Units/ }).click();
  await expect(page).toHaveURL(/\/settings\?section=units$/);
  await expect(page.getByRole("heading", { level: 1, name: "Units" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search units" })).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();

  await page.getByRole("link", { name: /^Appearance/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Appearance" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // A place that does not exist is the list, not an error.
  await open("/settings?section=nowhere");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
});

test("Foods: a food opens in a sheet whose aisle saves on a tap, and a row swiped left is deleted after the confirm", async ({ page, open }) => {
  const name = unique("Finger lime").toLowerCase();
  await open("/settings?section=foods");
  await page.getByRole("button", { name: "Add food" }).click();
  const create = page.getByRole("dialog", { name: "New food" });
  await create.getByRole("textbox", { name: "Name" }).fill(name);
  await create.getByRole("button", { name: "Save" }).click();
  await expect(create).toBeHidden();

  await page.getByRole("textbox", { name: "Search foods" }).fill(name);
  const row = page.getByRole("button", { name: new RegExp(`^${name}`) });
  await row.click();
  const sheet = page.getByRole("dialog", { name });
  await expect(sheet.getByRole("heading", { name: "Used in 0 recipes" })).toBeVisible();
  await sheet.getByRole("group", { name: "Aisle" }).getByRole("button", { name: "Fruit & veg" }).click();
  await expect(sheet.getByRole("button", { name: "Fruit & veg" })).toHaveAttribute("aria-pressed", "true");
  await sheet.getByRole("button", { name: "+ Add a name" }).click();
  await sheet.getByRole("textbox", { name: "New name" }).fill("citrus caviar");
  await page.keyboard.press("Enter");
  await expect(sheet.getByText("citrus caviar")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(row).toContainText("Fruit & veg");
  await expect(row).toContainText("citrus caviar");

  // Saved, not just shown: still there after a reload.
  await open("/settings?section=foods");
  await page.getByRole("textbox", { name: "Search foods" }).fill(name);
  await expect(row).toContainText("Fruit & veg");

  // Dragged left past the line, the row asks first, as its ⋯ menu's Delete does.
  const box = (await row.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 20, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 80, y, { steps: 4 });
  await page.mouse.move(box.x + box.width - 200, y, { steps: 6 });
  await page.mouse.up();
  const confirm = page.getByRole("dialog");
  await expect(confirm).toContainText(name);
  await confirm.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(row).toHaveCount(0);
});

test("cooking on a phone: the method first, Note and Finish under the thumb, and the review", async ({ page, open }) => {
  const name = unique("Phone Rice");
  await createRecipe(page, open, {
    name,
    servings: 2,
    ingredients: ["200 g rice"],
    steps: ["Rinse the rice.", "Simmer the rice for 12 minutes.", "Rest the rice, covered."],
  });
  await page.getByTestId("cook-bar").getByRole("link", { name: "Start cooking" }).click();
  await expect(page.getByTestId("cooking-header")).toContainText(name);
  await expect(page.getByRole("tab", { name: /^Method/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await expect(page.locator('[data-now="true"]')).toContainText("Rinse the rice.");

  const bar = page.getByTestId("cooking-bar");
  await expect(bar.getByRole("button", { name: "Note" })).toBeInViewport();
  await bar.getByRole("button", { name: "Note" }).click();
  const sheet = page.getByRole("dialog", { name: "Note for the review" });
  await sheet.getByRole("textbox").fill("Rice caught a little");
  await sheet.getByRole("button", { name: "Note it" }).click();
  await expect(sheet).toBeHidden();

  await bar.getByRole("link", { name: "Finish" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "How did it go?" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Comment" })).toHaveValue("Noted: Rice caught a little.");
  await expect(page.getByTestId("no-suggestions")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("cook-bar").getByRole("link", { name: "Start cooking" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
