// The delete confirm that names the recipes a reference row is used by.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { usageListLimit, UsageConfirmDialogContent, usageNames, usageSummary } from "../../../src/components/ui/UsageConfirmDialog";
import type { RecipeSummary } from "../../../src/domain/recipe/recipe";

function summary(name: string): RecipeSummary {
  return {
    id: name,
    slug: name.toLowerCase(),
    name,
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
}

const effect = "they will keep the ingredient without a food.";

describe("usageSummary", () => {
  test("counts the recipes, singular and plural, and says nothing is affected", () => {
    expect(usageSummary(0, "food", effect)).toBe("No recipes use this food.");
    expect(usageSummary(1, "food", effect)).toBe(`1 recipe uses this food; ${effect}`);
    expect(usageSummary(3, "unit", effect)).toBe(`3 recipes use this unit; ${effect}`);
  });
});

describe("usageNames", () => {
  test("names every recipe when the list is short, with nothing left over", () => {
    expect(usageNames([summary("Shortbread"), summary("Pancakes")])).toEqual({ names: ["Shortbread", "Pancakes"], rest: 0 });
    expect(usageNames([])).toEqual({ names: [], rest: 0 });
  });

  test("caps a long list and counts the rest", () => {
    const many = Array.from({ length: usageListLimit + 4 }, (_, index) => summary(`Recipe ${index}`));
    const { names, rest } = usageNames(many);
    expect(names).toHaveLength(usageListLimit);
    expect(rest).toBe(4);
    expect(usageNames(many, 2)).toEqual({ names: ["Recipe 0", "Recipe 1"], rest: usageListLimit + 2 });
  });
});

describe("UsageConfirmDialogContent render", () => {
  const render = (recipes: RecipeSummary[], busy = false) =>
    renderToString(
      <UsageConfirmDialogContent name="butter" itemName="food" effect={effect} recipes={recipes} busy={busy} onCancel={() => {}} onConfirm={() => {}} />,
    );

  test("asks the question, counts the recipes and lists them", () => {
    const html = render([summary("Shortbread"), summary("Pancakes")]);
    expect(html).toContain("Delete butter?");
    expect(html).toContain("2 recipes use this food");
    expect(html).toContain("Shortbread");
    expect(html).toContain("Pancakes");
    expect(html).toContain("data-usage-list");
    expect(html).toContain(">Delete<");
    expect(html).toContain(">Cancel<");
  });

  test("an unused row says so and shows no list", () => {
    const html = render([]);
    expect(html).toContain("No recipes use this food.");
    expect(html).not.toContain("data-usage-list");
  });

  test("a long list is capped with an 'and N more' line", () => {
    const html = render(Array.from({ length: usageListLimit + 2 }, (_, index) => summary(`Recipe ${index}`)));
    expect(html).toContain(`${usageListLimit + 2} recipes use this food`);
    expect(html.match(/<li[^>]*>/g)).toHaveLength(usageListLimit);
    expect(html).toContain("and ");
    expect(html).toContain("2");
  });

  test("busy disables the buttons and the danger button counts down", () => {
    const html = render([], true);
    expect(html).toContain("Deleting…");
    expect(html.match(/<button[^>]*disabled/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
