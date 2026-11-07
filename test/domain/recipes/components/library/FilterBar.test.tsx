// The recipe list's filter bar (M12.3): tag chips (any/all switch), the food
// picker (SearchInput with picker()), and the favourites toggle. Static render only
// (no jsdom in this project's vitest config), so these check markup and
// selected state, not click behaviour — the pure helpers behind the
// callbacks are covered in test/domain/recipeFilters.test.ts.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { FilterBar } from "../../../../../src/domain/recipes/components/library/FilterBar";
import { noFacets } from "../../../../../src/domain/recipes/recipe";

const weeknight = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Weeknight", slug: "weeknight", recipes: 6 };
const pasta = { id: "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2", name: "Pasta", slug: "pasta", recipes: 2 };
const flour = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "flour",
  pluralName: null,
  aliases: [],
  aisleId: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
};
const butter = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "butter",
  pluralName: null,
  aliases: [],
  aisleId: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
};

function noop() {}

describe("FilterBar", () => {
  test("no tags: the tag chip group and its switch stay hidden, favourites and food picker still render", () => {
    const html = renderToString(
      <FilterBar
        allTags={[]}
        allFoods={[flour]}
        tags={[]}
        match="any"
        foods={[]}
        favourite={false}
        facets={noFacets()}
        facetCounts={[]}
        onFacetsChange={noop}
        onTagsChange={noop}
        onMatchChange={noop}
        onFoodsChange={noop}
        onFavouriteChange={noop}
      />
    );
    expect(html).not.toContain('aria-label="Filter by tag"');
    expect(html).toContain("Favourites only");
    expect(html).toContain('aria-label="Filter by food"');
  });

  test("renders a chip per tag, unselected by default", () => {
    const html = renderToString(
      <FilterBar
        allTags={[weeknight, pasta]}
        allFoods={[]}
        tags={[]}
        match="any"
        foods={[]}
        favourite={false}
        facets={noFacets()}
        facetCounts={[]}
        onFacetsChange={noop}
        onTagsChange={noop}
        onMatchChange={noop}
        onFoodsChange={noop}
        onFavouriteChange={noop}
      />
    );
    expect(html).toMatch(/data-state="off"[^>]*>Weeknight/);
    expect(html).toMatch(/data-state="off"[^>]*>Pasta/);
    expect(html).toContain("Match all");
  });

  test("selected tags render pressed, and match=all checks the switch", () => {
    const html = renderToString(
      <FilterBar
        allTags={[weeknight, pasta]}
        allFoods={[]}
        tags={["weeknight", "pasta"]}
        match="all"
        foods={[]}
        favourite={false}
        facets={noFacets()}
        facetCounts={[]}
        onFacetsChange={noop}
        onTagsChange={noop}
        onMatchChange={noop}
        onFoodsChange={noop}
        onFavouriteChange={noop}
      />
    );
    expect(html).toMatch(/data-state="on"[^>]*>Weeknight/);
    expect(html).toMatch(/data-state="on"[^>]*>Pasta/);
    expect(html).toContain('data-state="checked"');
  });

  test("selected foods render as removable chips by name, not id", () => {
    const html = renderToString(
      <FilterBar
        allTags={[]}
        allFoods={[flour, butter]}
        tags={[]}
        match="any"
        foods={[flour.id]}
        favourite={false}
        facets={noFacets()}
        facetCounts={[]}
        onFacetsChange={noop}
        onTagsChange={noop}
        onMatchChange={noop}
        onFoodsChange={noop}
        onFavouriteChange={noop}
      />
    );
    expect(html).toContain('aria-label="Remove flour"');
    expect(html).not.toContain(flour.id);
  });

  test("favourite=true checks the favourites switch", () => {
    const html = renderToString(
      <FilterBar
        allTags={[]}
        allFoods={[]}
        tags={[]}
        match="any"
        foods={[]}
        favourite={true}
        facets={noFacets()}
        facetCounts={[]}
        onFacetsChange={noop}
        onTagsChange={noop}
        onMatchChange={noop}
        onFoodsChange={noop}
        onFavouriteChange={noop}
      />
    );
    expect(html).toMatch(/data-state="checked"[^>]*(?:\/>|>)/);
  });
});

describe("FilterBar's layers (decisions.md row 209)", () => {
  test("a row of toggles a layer some recipe has, with counts; none when nothing has been said", () => {
    const props = {
      allTags: [],
      allFoods: [],
      tags: [],
      match: "any" as const,
      foods: [],
      favourite: false,
      onTagsChange: noop,
      onMatchChange: noop,
      onFoodsChange: noop,
      onFavouriteChange: noop,
      onFacetsChange: noop,
    };
    const html = renderToString(
      <FilterBar {...props} facets={{ ...noFacets(), diet: ["vegan"] }} facetCounts={[{ layer: "diet", value: "vegetarian", count: 5 }]} />
    );
    expect(html).toContain('aria-label="Filter by diet"');
    expect(html).toContain("Vegetarian");
    expect(html).toContain("Vegan");
    expect(html).not.toContain('aria-label="Filter by course"');
    expect(renderToString(<FilterBar {...props} facets={noFacets()} facetCounts={[]} />)).not.toContain("Filter by diet");
  });
});
