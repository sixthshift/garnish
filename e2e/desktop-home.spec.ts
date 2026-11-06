// Home on a desktop (decisions.md row 207): the day as tiles across the
// width. The database is shared with the other specs, so this asserts on what
// it adds itself and on the tiles' shape, not on what else is planned.
import { createRecipe, expect, test, unique } from "./fixtures";

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test("Home is tiles: the week across the top, tonight, the list, and the newest recipe opening in the side panel", async ({ page, open }) => {
  const name = unique("Bento Soup");
  await createRecipe(page, open, { name, servings: 2, ingredients: ["1 leek"], steps: ["Sweat the leek."] });

  await open("/");
  await expect(page.getByRole("heading", { level: 1, name: /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day$/ })).toBeVisible();
  await expect(page.getByText(/of 7 nights planned/)).toBeVisible();

  const week = page.getByRole("region", { name: "This week" });
  await expect(week.getByRole("listitem")).toHaveCount(7);
  await expect(week.locator('[aria-current="date"]')).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Tonight" })).toBeVisible();

  // The page fills the width and nothing runs past it.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const recent = page.getByRole("region", { name: "Recently added" });
  await expect(recent.getByRole("link", { name: "Import a recipe" })).toHaveAttribute("href", "/recipes/new");
  await recent.getByRole("link", { name: new RegExp(name) }).click();
  const panel = page.getByRole("complementary", { name: "Recipe" });
  await expect(panel.getByRole("heading", { level: 2, name })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
});

test("a line ticked from the shopping tile is ticked on the list", async ({ page, open }) => {
  // Something to tick, whatever else the list holds.
  const line = unique("Bento milk");
  await open("/shopping");
  await page.getByRole("textbox", { name: "Add an item" }).fill(line);
  await page.getByRole("textbox", { name: "Add an item" }).press("Enter");
  await expect(page.getByRole("checkbox", { name: line })).toBeVisible();

  await open("/");
  const ring = page.getByRole("img", { name: /of \d+ ticked$/ });
  const [ticked, total] = ((await ring.getAttribute("aria-label")) ?? "").match(/\d+/g)?.map(Number) ?? [];
  const first = page.locator("section").filter({ has: ring }).getByRole("checkbox").first();
  const label = (await first.getAttribute("aria-label")) ?? "";
  await first.click();
  await expect(page.getByRole("img", { name: `${(ticked ?? 0) + 1} of ${total} ticked` })).toBeVisible();

  await open("/shopping");
  await expect(page.getByRole("region", { name: "Ticked" }).getByRole("checkbox", { name: label }).first()).toBeChecked();
});
