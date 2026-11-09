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

test("a recipe's spread is a screen tall and no taller: a step's hidden label stays in its own column", async ({ page, open }) => {
  // Enough steps that the method column overflows and scrolls on its own. A
  // step's `sr-only` label is absolutely placed; with a static column it was
  // placed against the page instead and stretched it past the screen.
  const name = unique("Tall spread");
  await createRecipe(page, open, {
    name,
    servings: 2,
    ingredients: ["200 g plain flour"],
    steps: Array.from(
      { length: 12 },
      (_, i) => `Step ${i + 1}: stir the plain flour for a good long while, then stir it again until it is ready for the next step.`
    ),
  });
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(900);
});

test("cooking, the spread is a screen tall and no taller: a step's hidden label stays in its own column", async ({ page, open }) => {
  // The cooking spread's columns scroll on their own as the recipe's do, and
  // leaked a step's absolutely placed `sr-only` label the same way.
  await createRecipe(page, open, {
    name: unique("Tall cook"),
    servings: 2,
    ingredients: ["200 g plain flour"],
    steps: Array.from(
      { length: 12 },
      (_, i) => `Step ${i + 1}: stir the plain flour for a good long while, then stir it again until it is ready for the next step.`
    ),
  });
  await page.getByRole("link", { name: "Start cooking" }).click();
  await expect(page.getByTestId("cooking-spread")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(900);
});

test("the editor's columns are a screen tall and no taller: a facet's hidden label stays in its own column", async ({ page, open }) => {
  // The editor's own-scroll columns, as the recipe and cooking spreads', leaked
  // an absolutely placed `sr-only` label (a facet chip's layer name) and
  // stretched the page past the screen. A short window puts the facets below it.
  await open("/recipes/new?source=manual");
  const about = page.getByTestId("about-column");
  await about.getByRole("textbox", { name: "Name" }).fill(unique("Tall editor"));
  await about.getByRole("button", { name: "Add course, cuisine and more" }).click();
  await page.getByTestId("facet-sheet").getByRole("button", { name: "Weekend" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(about.getByTestId("facet-chips")).toBeAttached();
  await page.setViewportSize({ width: 1440, height: 400 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(400);
});
