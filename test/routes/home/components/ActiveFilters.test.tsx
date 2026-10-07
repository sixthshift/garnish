// The phone's row of active-filter chips under the search box, and the count the
// Filters button shows. Static render; pressing a chip's × is in the .dom test.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ActiveFilters, type ActiveFiltersProps, activeFilterCount } from "../../../../src/routes/home/components/ActiveFilters";

const weeknight = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Weeknight", slug: "weeknight" };
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

function noop() {}

function props(overrides: Partial<ActiveFiltersProps>): ActiveFiltersProps {
  return {
    allTags: [weeknight],
    allFoods: [flour],
    tags: [],
    foods: [],
    favourite: false,
    onTagsChange: noop,
    onFoodsChange: noop,
    onFavouriteChange: noop,
    onClearAll: noop,
    ...overrides,
  };
}

describe("activeFilterCount", () => {
  test("one per tag, one per food, one for favourites", () => {
    expect(activeFilterCount([], [], false)).toBe(0);
    expect(activeFilterCount(["a", "b"], [], false)).toBe(2);
    expect(activeFilterCount(["a"], [flour.id], true)).toBe(3);
  });
});

describe("ActiveFilters", () => {
  test("nothing set renders nothing, not an empty row", () => {
    expect(renderToString(<ActiveFilters {...props({})} />)).toBe("");
  });

  test("one filter: its chip by name, no Clear all", () => {
    const html = renderToString(<ActiveFilters {...props({ tags: ["weeknight"] })} />);
    expect(html).toContain('aria-label="Remove Weeknight"');
    expect(html).not.toContain("Clear all");
  });

  test("tags, foods and favourites each get a chip, named not id'd, and two or more add Clear all", () => {
    const html = renderToString(<ActiveFilters {...props({ tags: ["weeknight"], foods: [flour.id], favourite: true })} />);
    expect(html).toContain('aria-label="Remove Weeknight"');
    expect(html).toContain('aria-label="Remove flour"');
    expect(html).toContain('aria-label="Remove Favourites"');
    expect(html).not.toContain(flour.id);
    expect(html).toContain("Clear all");
  });
});
