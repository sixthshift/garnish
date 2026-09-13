// RecipeCard: the pure helpers (tag capping) and the rendered markup — stars,
// the total-time chip, capped tags and that the favourite button (moved to
// src/components/ui/FavouriteButton.tsx) still renders over the image. The
// button's own toggle behaviour is tested there.
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { capTags, RecipeCard } from "../../src/components/RecipeCard";
import type { RecipeSummary, Tag } from "../../src/domain/recipe";

const tag = (n: number): Tag => ({ id: `dddddddd-dddd-4ddd-8ddd-dddddddddd0${n}`, name: `Tag ${n}`, slug: `tag-${n}` });

const base: RecipeSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "lemon-tart",
  name: "Lemon tart",
  image: null,
  rating: null,
  prepTime: null,
  performTime: null,
  totalTime: null,
  lastMade: null,
  favourite: false,
  tags: [],
  ingredientPreview: [],
};

/** Render inside a throwaway router, so the card's `Link` resolves. */
async function render(recipe: RecipeSummary, mode?: "grid" | "list"): Promise<string> {
  const rootRoute = createRootRoute({ component: () => <RecipeCard recipe={recipe} mode={mode} /> });
  const slugRoute = createRoute({ getParentRoute: () => rootRoute, path: "/recipes/$slug", component: () => null });
  const router = createRouter({
    routeTree: rootRoute.addChildren([slugRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}

describe("capTags", () => {
  test("shows every tag up to the cap and hides nothing", () => {
    expect(capTags([tag(1), tag(2)], 3)).toEqual({ shown: [tag(1), tag(2)], more: 0 });
  });

  test("caps at the given max and counts the rest", () => {
    const tags = [tag(1), tag(2), tag(3), tag(4), tag(5)];
    expect(capTags(tags, 3)).toEqual({ shown: [tag(1), tag(2), tag(3)], more: 2 });
  });

  test("defaults to a cap of 3", () => {
    const tags = [tag(1), tag(2), tag(3), tag(4)];
    expect(capTags(tags).more).toBe(1);
  });
});

describe("RecipeCard render", () => {
  test("a bare recipe shows only its name: no stars, no time chip, no tags", async () => {
    const html = await render(base);
    expect(html).toContain("Lemon tart");
    expect(html).not.toMatch(/Rated [\d.]+ out of 5/);
    expect(html).not.toContain('aria-label="Tags"');
  });

  test("rating renders as stars and total time as a chip", async () => {
    const html = await render({ ...base, rating: 4, prepTime: 20, performTime: 40, totalTime: 60 });
    expect(html).toMatch(/Rated 4 out of 5/);
    expect(html).toContain("1 hr");
  });

  test("tags beyond the cap fold into a +N badge", async () => {
    const tags = [tag(1), tag(2), tag(3), tag(4)];
    const html = await render({ ...base, tags });
    expect(html).toContain("Tag 1");
    expect(html).toContain("Tag 2");
    expect(html).toContain("Tag 3");
    expect(html).not.toContain("Tag 4");
    expect(html).toContain("+1");
  });

  test("the favourite button reflects favourite: true", async () => {
    const html = await render({ ...base, favourite: true });
    expect(html).toMatch(/aria-label="Remove from favourites"/);
    expect(html).toMatch(/aria-pressed="true"/);
  });

  test("the favourite button reflects favourite: false", async () => {
    const html = await render({ ...base, favourite: false });
    expect(html).toMatch(/aria-label="Add to favourites"/);
    expect(html).toMatch(/aria-pressed="false"/);
  });

  test("a placeholder image renders when the recipe has none", async () => {
    const html = await render(base);
    expect(html).toContain('data-placeholder="image"');
  });
});

describe("RecipeCard ingredient preview (M35.3)", () => {
  test("no ingredients: the card links out plainly, with no tooltip wiring", async () => {
    const html = await render(base);
    expect(html).not.toContain("data-ingredient-preview");
    // The tooltip is closed by default; nothing it would show ever leaks into a static render.
    expect(html).not.toContain("<ul");
  });

  test("carries the first six lines onto the link, in the order the repository gave them", async () => {
    const ingredientPreview = ["200 g spaghetti", "salt, to taste", "50 g butter, cold"];
    const html = await render({ ...base, ingredientPreview });
    expect(html).toContain(`data-ingredient-preview="${JSON.stringify(ingredientPreview).replace(/"/g, "&quot;")}"`);
    // Closed by default: the Tooltip's floating body never renders in a static string.
    expect(html).not.toContain("<ul");
  });
});

describe("RecipeCard view modes", () => {
  test("defaults to grid mode when mode is not given", async () => {
    const html = await render(base);
    expect(html).toContain('data-card-mode="grid"');
  });

  test("grid mode renders the vertical shape: image above the text", async () => {
    const html = await render({ ...base, rating: 4, totalTime: 60, tags: [tag(1)] }, "grid");
    expect(html).toContain('data-card-mode="grid"');
    expect(html).toContain('data-placeholder="image"');
    expect(html).toMatch(/data-placeholder="image"[^]*Lemon tart/);
    expect(html).toMatch(/Rated 4 out of 5/);
    expect(html).toContain("1 hr");
    expect(html).toContain("Tag 1");
  });

  test("list mode renders Mealie's RecipeCardMobile shape: a small image beside the text", async () => {
    const html = await render({ ...base, rating: 4, totalTime: 60, tags: [tag(1)] }, "list");
    expect(html).toContain('data-card-mode="list"');
    expect(html).toContain('data-placeholder="image"');
    expect(html).toMatch(/data-placeholder="image"[^]*Lemon tart/);
    expect(html).toMatch(/Rated 4 out of 5/);
    expect(html).toContain("1 hr");
    expect(html).toContain("Tag 1");
    // The image is a fixed small square, not the grid's full-width 4:3 box.
    expect(html).toMatch(/data-placeholder="image"[^>]*class="[^"]*aspect-square/);
  });

  test("list mode still exposes the favourite button and tags-beyond-cap overflow", async () => {
    const tags = [tag(1), tag(2), tag(3), tag(4)];
    const html = await render({ ...base, favourite: true, tags }, "list");
    expect(html).toMatch(/aria-label="Remove from favourites"/);
    expect(html).toContain("Tag 3");
    expect(html).not.toContain("Tag 4");
    expect(html).toContain("+1");
  });
});
