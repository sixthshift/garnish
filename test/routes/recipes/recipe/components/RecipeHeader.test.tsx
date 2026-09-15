// The recipe header: its pure helpers, and the rendered markup — both layouts
// (stacked below md, image beside the text from md) asserted through the
// classes on the split container, the order the header's children run in
// (M24.3), and `RecipeMetaFooter`'s source URL as a link when set.
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { Recipe } from "../../../../../src/domain/recipe";
import { formatDateStamp } from "../../../../../src/lib/dates";
import { nextRating } from "../../../../../src/lib/ui/rating";
import { isLinkable, sourceLabel } from "../../../../../src/lib/urls";
import { RecipeHeader, RecipeMetaFooter, timeStats } from "../../../../../src/routes/recipes/recipe/components/RecipeHeader";

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
  parts: [{ id: "22222222-2222-4222-8222-222222222222", name: "", ingredients: [], steps: [] }],
  restyledAt: null,
  createdAt: "2026-03-04T02:30:00.000Z",
  updatedAt: "2026-09-11T02:30:00.000Z",
};

/** Render the header inside a throwaway router, so its tag `Link`s resolve. */
async function render(recipe: Recipe, actions?: ReactNode, onRate?: (rating: number) => void, madeCount?: number): Promise<string> {
  const rootRoute = createRootRoute({ component: () => <RecipeHeader recipe={recipe} actions={actions} onRate={onRate} madeCount={madeCount} /> });
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

  test("no image gives the placeholder; no times or yield still leaves the strip for the last made line", async () => {
    const html = await render({ ...base, image: null, prepTime: null, performTime: null, recipeYieldQuantity: 0, recipeYield: "" });
    expect(html).toContain('data-placeholder="image"');
    expect(html).toContain('data-testid="stat-strip"');
    expect(html).not.toContain('data-stat="prep"');
    expect(html).not.toContain('data-testid="yield"');
    expect(html).toContain("Never made");
  });

  test("no source, added or updated moved into the header: RecipeMetaFooter is a separate component", async () => {
    const html = await render(base);
    expect(html).not.toContain('data-testid="recipe-meta"');
    expect(html).not.toContain('data-testid="source-url"');
    expect(html).not.toContain("Added ");
    expect(html).not.toContain("Updated ");
  });

  test("the header's children run image, name with the actions, stars, the strip, description, tags", async () => {
    const html = await render(base, <button type="button">Edit</button>);

    const image = html.indexOf('src="/api/images/lemon%20tart.webp"');
    const nameAndActions = html.indexOf("Lemon tart");
    const editAction = html.indexOf(">Edit<");
    const stars = html.indexOf('aria-label="Rated 4 out of 5"');
    const strip = html.indexOf('data-testid="stat-strip"');
    const description = html.indexOf("Sharp and short.");
    const tags = html.indexOf('aria-label="Tags"');

    for (const index of [image, nameAndActions, editAction, stars, strip, description, tags]) expect(index).toBeGreaterThan(-1);

    expect(image).toBeLessThan(nameAndActions);
    expect(nameAndActions).toBeLessThan(editAction);
    expect(editAction).toBeLessThan(stars);
    expect(stars).toBeLessThan(strip);
    expect(strip).toBeLessThan(description);
    expect(description).toBeLessThan(tags);
  });
});

describe("the favourite heart (M25.4)", () => {
  test("renders beside the actions, hidden from print", async () => {
    const html = await render(base, <button type="button">Edit</button>);
    expect(html).toMatch(/aria-label="Add to favourites"/);

    const actions = html.indexOf('data-print="hide"');
    const heart = html.indexOf('aria-label="Add to favourites"');
    const edit = html.indexOf(">Edit<");
    expect(actions).toBeGreaterThan(-1);
    expect(heart).toBeGreaterThan(actions);
    expect(heart).toBeLessThan(edit);
  });

  test("reflects a favourited recipe", async () => {
    const html = await render({ ...base, favourite: true });
    expect(html).toMatch(/aria-label="Remove from favourites"/);
    expect(html).toMatch(/aria-pressed="true"/);
  });
});

describe("the header's stars (M25.3)", () => {
  test("without onRate they are read-only: no buttons, and an unrated recipe shows none", async () => {
    const rated = await render(base);
    expect(rated).toContain('aria-label="Rated 4 out of 5"');
    expect(rated).not.toContain('aria-label="Rate 4 out of 5"');

    const unrated = await render({ ...base, rating: null });
    expect(unrated).not.toContain("out of 5");
  });

  test("with onRate every star is a button, and an unrated recipe still shows five to press", async () => {
    const html = await render(base, undefined, () => {});
    for (const star of [1, 2, 3, 4, 5]) expect(html).toContain(`aria-label="Rate ${star} out of 5"`);
    expect(html).toContain('aria-pressed="true"');

    const unrated = await render({ ...base, rating: null }, undefined, () => {});
    expect(unrated).toContain('aria-label="Rated 0 out of 5"');
    expect(unrated).toContain('aria-label="Rate 1 out of 5"');
    expect(unrated).not.toContain('aria-pressed="true"');
  });

  test("pressing the star that is already the rating asks for 0, which clears it", () => {
    expect(nextRating(4, 4)).toBe(0);
    expect(nextRating(4, 5)).toBe(5);
  });
});

describe("last made", () => {
  test("zero events: a recipe never cooked says so, in the strip", async () => {
    const html = await render(base, undefined, undefined, 0);
    expect(html).toContain('data-testid="last-made"');
    expect(html).toContain("Never made");
    expect(html.indexOf('data-testid="stat-strip"')).toBeLessThan(html.indexOf('data-testid="last-made"'));
  });

  test("no madeCount given reads the same as zero", async () => {
    const html = await render(base);
    expect(html).toContain("Never made");
  });

  test("one event: the date and a singular count; the header renders no button for it", async () => {
    const html = await render({ ...base, lastMade: "2026-09-11T00:00:00.000Z" }, undefined, undefined, 1);
    expect(html).toContain("Last made");
    expect(html).toMatch(/11 Sept? 2026/);
    expect(html).toContain("1 time");
    expect(html).not.toContain("1 times");
    expect(html).not.toContain("Never made");
    expect(html).not.toContain('data-testid="made-this"');
  });

  test("four events: the date and a plural count", async () => {
    const html = await render({ ...base, lastMade: "2026-09-03T00:00:00.000Z" }, undefined, undefined, 4);
    expect(html).toContain("Last made");
    expect(html).toMatch(/3 Sept? 2026/);
    expect(html).toContain("4 times");
    expect(html).not.toContain("Never made");
  });
});

describe("RecipeMetaFooter", () => {
  test("shows the source as a link when set, with the created and updated dates", () => {
    const html = renderToString(<RecipeMetaFooter recipe={{ ...base, sourceUrl: "https://www.nytimes.com/recipes/1234-lemon-tart", yieldUnit: gram }} />);
    expect(html).toContain('data-testid="recipe-meta"');
    expect(html).toContain('href="https://www.nytimes.com/recipes/1234-lemon-tart"');
    expect(html).toMatch(/<a[^>]*data-testid="source-url"/);
    expect(html).toContain("nytimes.com");
    expect(html).toContain("Added ");
    expect(html).toContain("Updated ");
  });

  test("a source that is not a URL is plain text, not a link", () => {
    const html = renderToString(<RecipeMetaFooter recipe={{ ...base, sourceUrl: "Nonna's notebook" }} />);
    expect(html).toMatch(/<span[^>]*data-testid="source-url"/);
    expect(html).not.toContain('<a href="Nonna');
  });

  test("no source at all leaves the footer to the dates alone", () => {
    const html = renderToString(<RecipeMetaFooter recipe={base} />);
    expect(html).not.toContain('data-testid="source-url"');
    expect(html).toContain('data-testid="recipe-meta"');
  });

  test("nothing to show renders nothing", () => {
    const html = renderToString(<RecipeMetaFooter recipe={{ ...base, sourceUrl: null, createdAt: "", updatedAt: "" }} />);
    expect(html).toBe("");
  });

  test("a restyled recipe says so, quietly, beside the source (M37.5)", () => {
    const html = renderToString(
      <RecipeMetaFooter recipe={{ ...base, sourceUrl: "https://www.nytimes.com/recipes/1234", restyledAt: "2026-09-14T02:30:00.000Z" }} />
    );
    expect(html).toContain('data-testid="restyled"');
    expect(html).toContain(`Restyled ${formatDateStamp("2026-09-14T02:30:00.000Z")}`);
    // Beside the source, not before it.
    expect(html.indexOf('data-testid="source-url"')).toBeLessThan(html.indexOf('data-testid="restyled"'));
  });

  test("a recipe in its author's voice says nothing", () => {
    expect(renderToString(<RecipeMetaFooter recipe={base} />)).not.toContain('data-testid="restyled"');
  });

  test("a stamp that will not parse still marks the recipe as restyled", () => {
    const html = renderToString(<RecipeMetaFooter recipe={{ ...base, restyledAt: "not a date" }} />);
    expect(html).toContain('data-testid="restyled"');
    expect(html).toContain(">Restyled<");
  });
});
