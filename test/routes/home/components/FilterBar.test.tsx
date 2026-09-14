// The recipe list's filter bar (M12.3): tag chips (any/all switch), the food
// picker built on Combobox, and the favourites toggle. Static render only
// (no jsdom in this project's vitest config), so these check markup and
// selected state, not click behaviour — the pure helpers behind the
// callbacks are covered in test/domain/recipeFilters.test.ts.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { FilterBar } from "../../../../src/routes/home/components/FilterBar";

const weeknight = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Weeknight", slug: "weeknight" };
const pasta = { id: "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2", name: "Pasta", slug: "pasta" };
const flour = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "flour", pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false, conversions: [] };
const butter = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "butter", pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false, conversions: [] };

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
        onTagsChange={noop}
        onMatchChange={noop}
        onFoodsChange={noop}
        onFavouriteChange={noop}
      />,
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
        onTagsChange={noop}
        onMatchChange={noop}
        onFoodsChange={noop}
        onFavouriteChange={noop}
      />,
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
        onTagsChange={noop}
        onMatchChange={noop}
        onFoodsChange={noop}
        onFavouriteChange={noop}
      />,
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
        onTagsChange={noop}
        onMatchChange={noop}
        onFoodsChange={noop}
        onFavouriteChange={noop}
      />,
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
        onTagsChange={noop}
        onMatchChange={noop}
        onFoodsChange={noop}
        onFavouriteChange={noop}
      />,
    );
    expect(html).toMatch(/data-state="checked"[^>]*(?:\/>|>)/);
  });
});
