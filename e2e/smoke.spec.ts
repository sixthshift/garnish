// Every page, loaded cold in the built app, renders its heading and logs no
// error. A page that throws as its bundle loads fails here and nowhere else:
// v1.4.1's New recipe and Style pages passed the whole vitest suite.
import { createRecipe, expect, test, unique } from "./fixtures";

// Home is titled with the day it is, whichever day the run lands on.
const pages: Array<{ path: string; heading: string | RegExp }> = [
  { path: "/", heading: /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day$/ },
  { path: "/recipes", heading: "Recipes" },
  { path: "/recipes/new", heading: "New recipe" },
  { path: "/recipes/new?source=manual", heading: "New recipe" },
  { path: "/plan", heading: "Plan" },
  { path: "/plan/fill", heading: "Plan the week" },
  { path: "/shopping", heading: "Shopping" },
  { path: "/settings", heading: "Settings" },
];

for (const { path, heading } of pages) {
  test(`${path} loads`, async ({ page, open }) => {
    await open(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  });
}

// The recipe's own pages need a recipe; one is typed in, then each is loaded cold.
test("a recipe's pages load", async ({ page, open }) => {
  const name = unique("Smoke Toast");
  await createRecipe(page, open, { name, servings: 1, ingredients: ["2 slices bread"], steps: ["Toast the bread."] });
  const recipe = new URL(page.url()).pathname;

  for (const path of [recipe, `${recipe}/edit`, `${recipe}/cook`, `${recipe}/style`]) {
    await open(path);
    await expect(page.locator("body")).toContainText(name);
  }
});

test.describe(() => {
  // The server answers an unknown path 404 and the browser logs that; the page itself must not throw.
  test.use({ allowedErrors: [/status of 404/] });

  test("an unknown path is the not-found page, not a crash", async ({ page, open }) => {
    await open("/no-such-page");
    await expect(page.getByRole("heading", { level: 1, name: "Not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to recipes" })).toBeVisible();
  });
});

// decisions.md row 169: the server answers every page with the shell — the
// frame and a spinner — and the browser draws the page.
test("a page arrives as the shell, not drawn", async ({ request }) => {
  const html = await (await request.get("/plan")).text();
  expect(html).toContain('aria-label="Main"');
  expect(html).toContain(">Loading<");
  expect(html).not.toContain("<h1");
});

test("/api/health answers", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ ok: true });
});
