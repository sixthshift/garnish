// A phone's Settings and cook mode (decisions.md row 208): Settings one
// grouped list whose places open at `?section=`, Foods filed by letter with
// rows that swipe left to delete and open in a sheet; cook mode one step a
// card, moved sideways by a finger, the keys or the big Next step.
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

test("cook mode is one step a card, moved sideways by a finger, the keys and Next step", async ({ page, open }) => {
  const name = unique("Sideways Rice");
  await createRecipe(page, open, {
    name,
    servings: 2,
    ingredients: ["200 g rice"],
    steps: ["Rinse the rice.", "Simmer the rice for 12 minutes.", "Rest the rice, covered."],
  });
  await open(`${new URL(page.url()).pathname}/cook`);

  const position = page.locator("[data-position]");
  const progress = page.getByRole("progressbar", { name: "Cook progress" });
  await expect(page.locator('[data-cook-layout="cards"]')).toBeVisible();
  await expect(progress).toHaveAttribute("aria-valuenow", "1");

  await page.getByRole("button", { name: "Next step" }).click();
  await expect(position).toHaveText("Step 1 of 3");
  await page.keyboard.press("ArrowRight");
  await expect(position).toHaveText("Step 2 of 3");
  await expect(page.getByTestId("cook-card")).toContainText("Simmer the rice for 12 minutes.");
  await expect(page.getByRole("button", { name: "Start 12 minute timer" })).toBeVisible();

  // A finger drags the card: left for the next, right for the one before.
  const cards = page.getByTestId("cook-cards");
  const swipe = async (dx: number) => {
    const box = (await cards.boundingBox())!;
    const at = { pointerId: 9, pointerType: "touch", isPrimary: true, clientY: box.y + box.height / 2 };
    const x = box.x + box.width / 2;
    await cards.dispatchEvent("pointerdown", { ...at, clientX: x });
    await cards.dispatchEvent("pointermove", { ...at, clientX: x + dx / 2 });
    await cards.dispatchEvent("pointermove", { ...at, clientX: x + dx });
    await cards.dispatchEvent("pointerup", { ...at, clientX: x + dx });
  };
  await swipe(-180);
  await expect(position).toHaveText("Step 3 of 3");
  await swipe(180);
  await expect(position).toHaveText("Step 2 of 3");

  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.locator('[data-card="finished"]')).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(position).toHaveText("Step 3 of 3");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
