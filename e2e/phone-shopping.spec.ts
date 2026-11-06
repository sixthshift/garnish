// Shopping on a phone, in the shop (decisions.md row 208): the meals as chips
// that narrow the list to one dish, big rows that a tap or a swipe right puts
// in the trolley, a swipe left onto the row's own Delete, and the trolley as a
// bar at the foot that opens a sheet to take a line back out or clear it.
import type { Browser, Locator, Page } from "@playwright/test";
import { createRecipe, expect, test, unique } from "./fixtures";

/**
 * Put a new recipe's ingredients on the list. Done at a desktop's size, in a
 * page of its own, since what this spec is about is the phone's list, not how
 * a recipe reaches it.
 */
async function listRecipe(browser: Browser, recipe: { name: string; ingredients: string[] }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desk = await context.newPage();
  await createRecipe(desk, (path) => desk.goto(path, { waitUntil: "networkidle" }).then(() => {}), { ...recipe, servings: 4, steps: ["Cook."] });
  await desk.getByRole("button", { name: "Add to shopping list" }).click();
  await desk.getByRole("dialog").getByRole("button", { name: "Add", exact: true }).click();
  await expect(desk.getByRole("status").filter({ hasText: "added" })).toBeVisible();
  await context.close();
}

/**
 * A finger's drag across `row`, `dx` to the right (negative, to the left):
 * real touches through the browser's own input, so the pointer events and
 * their capture are the ones a phone makes.
 */
async function swipe(page: Page, row: Locator, dx: number) {
  const box = (await row.boundingBox())!;
  const y = Math.round(box.y + box.height / 2);
  const x = Math.round(box.x + box.width / 2 - dx / 2);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", at: number) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: at, y }] });
  await touch("touchStart", x);
  for (let step = 1; step <= 10; step++) await touch("touchMove", Math.round(x + (dx * step) / 10));
  await touch("touchEnd", x + dx);
  await cdp.detach();
}

test("a meal chip narrows the list to its dish, a swipe right puts a line in the trolley, and the trolley gives it back", async ({ page, open, browser }) => {
  const name = unique("Shop Stew");
  // Foods no other spec lists, so these lines are this spec's own.
  await listRecipe(browser, { name, ingredients: ["2 turnips", "1 celeriac"] });

  await open("/shopping");
  await expect(page.getByRole("heading", { level: 1, name: "Shopping" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("radio", { name: "Meals" })).toHaveCount(0);
  await expect(page.getByRole("progressbar", { name: "In the trolley" })).toBeVisible();

  const meals = page.getByRole("group", { name: "Meals" });
  await meals.getByRole("button", { name: `${name}: 2 to buy` }).click();
  const list = page.getByTestId("shopping-groups");
  await expect(list.getByRole("listitem")).toHaveCount(2);

  // The aisle's name holds at the top of the screen while its lines go under it.
  const heading = page.getByRole("region", { name: "Fruit & veg" }).getByRole("heading", { level: 2 });
  expect(await heading.evaluate((el) => getComputedStyle(el.parentElement!).position)).toBe("sticky");

  // A swipe right: the turnips go in the trolley.
  await swipe(page, list.getByRole("listitem").filter({ hasText: "turnips" }), 200);
  await expect(list.getByRole("checkbox", { name: "2 turnips" })).toHaveCount(0);
  await expect(meals.getByRole("button", { name: `${name}: 1 to buy` })).toBeVisible();

  // A tap on the line: the celeriac too, and the dish is all in the trolley.
  await page.getByText("1 celeriac", { exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: `All of ${name} is in the trolley.` })).toBeVisible();

  // Stored, not just drawn: after a cold reload both are in the trolley's sheet.
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /in the trolley/ }).click();
  const sheet = page.getByRole("dialog", { name: "In the trolley" });
  await expect(sheet.getByRole("checkbox", { name: "2 turnips" })).toBeChecked();
  await expect(sheet.getByRole("checkbox", { name: "1 celeriac" })).toBeChecked();

  // A tap in the sheet takes a line back out, onto the list.
  await sheet.getByText("2 turnips", { exact: true }).click();
  await expect(sheet.getByRole("checkbox", { name: "2 turnips" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("shopping-groups").getByRole("checkbox", { name: "2 turnips" })).not.toBeChecked();
});

test("a swipe left opens the row's Delete, which removes the line", async ({ page, open }) => {
  await open("/shopping");
  const line = unique("Shop matches");
  await page.getByRole("textbox", { name: "Add an item" }).fill(line);
  await page.getByRole("textbox", { name: "Add an item" }).press("Enter");
  const row = page.getByTestId("shopping-groups").getByRole("listitem").filter({ hasText: line });
  await expect(row).toBeVisible();

  await swipe(page, row.getByTestId("shopping-row-body"), -150);
  await row.getByRole("button", { name: `Remove ${line}` }).click();
  await expect(row).toHaveCount(0);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByText(line)).toHaveCount(0);
});

test("Clear the trolley asks first, and empties it", async ({ page, open }) => {
  await open("/shopping");
  const line = unique("Shop candles");
  await page.getByRole("textbox", { name: "Add an item" }).fill(line);
  await page.getByRole("textbox", { name: "Add an item" }).press("Enter");
  await page.getByRole("checkbox", { name: line }).click();

  await page.getByRole("button", { name: /in the trolley/ }).click();
  await page.getByRole("dialog", { name: "In the trolley" }).getByRole("button", { name: "Clear the trolley" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "cleared" })).toBeVisible();
  await expect(page.getByRole("button", { name: /in the trolley/ })).toHaveCount(0);
  await expect(page.getByText(line)).toHaveCount(0);
});

test("offline, a swipe into the trolley waits on the phone and lands when the network is back", async ({ page, open, context }) => {
  await open("/shopping");
  const line = unique("Shop foil");
  await page.getByRole("textbox", { name: "Add an item" }).fill(line);
  await page.getByRole("textbox", { name: "Add an item" }).press("Enter");
  const row = page.getByTestId("shopping-groups").getByRole("listitem").filter({ hasText: line });
  await expect(row).toBeVisible();

  await context.setOffline(true);
  await swipe(page, row, 200);
  await expect(row).toHaveCount(0);
  await expect(page.getByTestId("shopping-pending")).toHaveText("1 change waiting");

  await context.setOffline(false);
  // The browser's online event is not something Playwright's offline switch reliably raises, so the
  // phone is brought back to the app instead: regaining focus is the outbox's other flush.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByTestId("shopping-pending")).toHaveCount(0);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /in the trolley/ }).click();
  await expect(page.getByRole("dialog", { name: "In the trolley" }).getByRole("checkbox", { name: line })).toBeChecked();
});
