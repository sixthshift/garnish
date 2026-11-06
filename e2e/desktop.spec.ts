// A desktop's layout (decisions.md row 206): from 1024px the top bar and no
// tab bar, every page at a laptop's size with nothing wider than the screen.
import { createRecipe, expect, test, unique } from "./fixtures";

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const pages: Array<{ path: string; heading: string | RegExp }> = [
  { path: "/", heading: /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day$/ },
  { path: "/recipes", heading: "Recipes" },
  { path: "/recipes/new", heading: "New recipe" },
  { path: "/plan", heading: "Plan" },
  { path: "/plan/fill", heading: "Plan the week" },
  { path: "/shopping", heading: "Shopping" },
  { path: "/settings", heading: "Settings" },
];

for (const { path, heading } of pages) {
  test(`${path} at a desktop's size: the top bar, and nothing wider than the screen`, async ({ page, open }) => {
    await open(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav).toHaveCount(1);
    expect(await nav.evaluate((element) => element.closest("header") !== null)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.dataset.layout)).toBe("desktop");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("narrowing the window past the line swaps the top bar for the tab bar", async ({ page, open }) => {
  await open("/plan");
  await expect(page.getByRole("banner").getByRole("navigation", { name: "Main" })).toBeVisible();
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(page.getByRole("banner")).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toBeVisible();
  expect(await nav.evaluate((element) => getComputedStyle(element).position)).toBe("fixed");
  await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();
});

test("a recipe opens beside the library in the side panel; Back closes it, and Open the recipe goes to its page", async ({ page, open }) => {
  const name = unique("Panel Soup");
  await createRecipe(page, open, { name, servings: 2, ingredients: ["1 onion"], steps: ["Soften the onion."] });

  await open(`/recipes?q=${encodeURIComponent(name)}`);
  await page.getByRole("link", { name: new RegExp(name) }).click();
  const panel = page.getByRole("complementary", { name: "Recipe" });
  await expect(panel.getByRole("heading", { level: 2, name })).toBeVisible();
  await expect(panel).toContainText("Soften the onion.");
  await expect(page.getByRole("heading", { level: 1, name: "Recipes" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/recipes");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goBack();
  await expect(panel).toHaveCount(0);
  await page.goForward();
  await expect(panel.getByRole("heading", { level: 2, name })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);

  await page.getByRole("link", { name: new RegExp(name) }).click();
  await panel.getByRole("link", { name: "Open the recipe" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(panel).toHaveCount(0);
});
