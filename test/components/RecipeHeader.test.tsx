// The recipe header: its pure helpers, and the rendered markup — both layouts
// (stacked below md, image beside the text from md) asserted through the
// classes on the split container, and the source URL as a link when set.
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { RecipeHeader, formatDateStamp, isLinkable, sourceLabel, timeStats } from "../../src/components/RecipeHeader";
import type { Recipe } from "../../src/domain/recipe";

const gram = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  standardQuantity: null,
  standardUnitId: null,
};

const base: Recipe = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "lemon-tart",
  name: "Lemon tart",
  description: "Sharp and short.",
  image: "lemon tart.webp",
  rating: 4,
  lastMade: null,
  favourite: false,
  recipeServings: 4,
  recipeYieldQuantity: 1,
  yieldUnit: null,
  recipeYield: "tart",
  prepTime: 20,
  performTime: 40,
  sourceUrl: null,
  notes: [],
  tags: [{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Weeknight", slug: "weeknight" }],
  components: [{ id: "22222222-2222-4222-8222-222222222222", name: "", ingredients: [], steps: [] }],
  steps: [],
  createdAt: "2026-03-04T02:30:00.000Z",
  updatedAt: "2026-09-11T02:30:00.000Z",
};

/** Render the header inside a throwaway router, so its tag `Link`s resolve. */
async function render(recipe: Recipe): Promise<string> {
  const rootRoute = createRootRoute({ component: () => <RecipeHeader recipe={recipe} /> });
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => null });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}

describe("formatDateStamp", () => {
  test("writes a timestamp the en-AU way", () => {
    expect(formatDateStamp("2026-09-11T02:30:00.000Z")).toMatch(/^\d{1,2} \w{3,5} 2026$/);
  });

  test.each([null, "", "   ", "not a date"])("%s renders nothing", (value) => {
    expect(formatDateStamp(value)).toBe("");
  });
});

describe("sourceLabel", () => {
  test.each([
    ["https://www.nytimes.com/recipes/1234-lemon-tart", "nytimes.com"],
    ["https://cooking.example.org/x", "cooking.example.org"],
    ["Nonna's notebook, page 4", "Nonna's notebook, page 4"],
    [null, ""],
    ["  ", ""],
  ])("%s -> %s", (url, expected) => {
    expect(sourceLabel(url)).toBe(expected);
  });
});

describe("isLinkable", () => {
  test.each([
    ["https://example.com/x", true],
    ["http://example.com", true],
    ["javascript:alert(1)", false],
    ["Nonna's notebook", false],
    [null, false],
    ["", false],
  ])("%s -> %s", (url, expected) => {
    expect(isLinkable(url)).toBe(expected);
  });
});

describe("timeStats", () => {
  test("prep, cook and the total of the two", () => {
    expect(timeStats({ prepTime: 20, performTime: 40 })).toEqual([
      { key: "prep", label: "Prep", value: "20 min" },
      { key: "cook", label: "Cook", value: "40 min" },
      { key: "total", label: "Total", value: "1 hr" },
    ]);
  });

  test("drops the rows with nothing recorded", () => {
    expect(timeStats({ prepTime: 15, performTime: null }).map((row) => row.key)).toEqual(["prep", "total"]);
    expect(timeStats({ prepTime: null, performTime: null })).toEqual([]);
    expect(timeStats({ prepTime: 0, performTime: 0 })).toEqual([]);
  });
});

describe("RecipeHeader", () => {
  test("stacks below md and puts the image beside the text from md", async () => {
    const html = await render(base);
    const container = /<div class="([^"]*)"[^>]*data-layout="split"/.exec(html);
    expect(container).not.toBeNull();
    const classes = (container?.[1] ?? "").split(" ");
    expect(classes).toContain("flex-col"); // phone: image above the text
    expect(classes).toContain("md:flex-row"); // wide: image beside it
    expect(html).toContain("md:w-2/5"); // the image column, wide only
  });

  test("renders name, rating, description and tag chips", async () => {
    const html = await render(base);
    expect(html).toContain("Lemon tart");
    expect(html).toContain('aria-label="Rated 4 out of 5"');
    expect(html).toContain("Sharp and short.");
    expect(html).toContain(">Weeknight</span>");
    expect(html).toContain('src="/api/images/lemon%20tart.webp"');
  });

  test("stat strip carries an icon per time and a yield line", async () => {
    const html = await render(base);
    expect(html).toContain('data-stat="prep"');
    expect(html).toContain('data-stat="cook"');
    expect(html).toContain('data-stat="total"');
    for (const icon of ["prep", "cook", "total"]) expect(html).toContain(`data-icon="${icon}"`);
    expect(html).toContain("20 min");
    expect(html).toContain("40 min");
    expect(html).toContain("1 hr");
    expect(html).toMatch(/<dt[^>]*>Makes<\/dt><dd[^>]*>1 tart<\/dd>/);
  });

  test("no image gives the placeholder, no times or yield gives no stat strip", async () => {
    const html = await render({ ...base, image: null, prepTime: null, performTime: null, recipeYieldQuantity: 0, recipeYield: "" });
    expect(html).toContain('data-placeholder="image"');
    expect(html).not.toContain('data-testid="stat-strip"');
  });

  test("footer shows the source as a link when set, with the created and updated dates", async () => {
    const html = await render({ ...base, sourceUrl: "https://www.nytimes.com/recipes/1234-lemon-tart", yieldUnit: gram });
    expect(html).toContain('href="https://www.nytimes.com/recipes/1234-lemon-tart"');
    expect(html).toMatch(/<a[^>]*data-testid="source-url"/);
    expect(html).toContain("nytimes.com");
    expect(html).toContain("Added ");
    expect(html).toContain("Updated ");
  });

  test("a source that is not a URL is plain text, not a link", async () => {
    const html = await render({ ...base, sourceUrl: "Nonna's notebook" });
    expect(html).toMatch(/<span[^>]*data-testid="source-url"/);
    expect(html).not.toContain("<a href=\"Nonna");
  });

  test("no source at all leaves the footer to the dates alone", async () => {
    const html = await render(base);
    expect(html).not.toContain('data-testid="source-url"');
    expect(html).toContain('data-testid="recipe-meta"');
  });
});
