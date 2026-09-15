// PlanPopover (M33.4): the recipe page's "Plan" action. `PlanPopoverContent`
// is what renders anywhere and what the render tests exercise (the popover
// itself only paints on the client, the way `AddToShoppingSheetContent` and
// `MadeThisSheetContent` split their own overlays); `planEntryFor` is the
// pure builder for what choosing a day sends, checked here both as a plain
// function and end to end against the real `addPlanEntry`/`listPlanWeek`
// server functions.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { PlanPopoverContent } from "../../../../../src/routes/recipes/recipe/components/PlanPopover";
import { planEntryFor } from "../../../../../src/routes/recipes/recipe/components/PlanPopover";
import type { RecipeInput } from "../../../../../src/domain/recipe";
import { addPlanEntry, listPlanWeek } from "../../../../../src/server/fns/plan";
import { createRecipe } from "../../../../../src/server/fns/recipes";
import { callServerFn, useTempDataDir } from "../../../../helpers/server";

const TODAY = "2026-09-13"; // a Sunday

describe("planEntryFor", () => {
  test("copies the recipe's id and name into the write, the way the plan page's own add row does", () => {
    expect(planEntryFor({ id: "recipe-1", name: "Lemon tart" }, "2026-09-15", 6)).toEqual({
      date: "2026-09-15",
      recipeId: "recipe-1",
      text: "Lemon tart",
      servings: 6,
    });
  });
});

describe("PlanPopoverContent render", () => {
  const render = (recipeServings = 4) =>
    renderToString(
      <PlanPopoverContent recipe={{ id: "recipe-1", name: "Lemon tart", recipeServings }} onChoose={() => {}} today={TODAY} />,
    );

  test("offers the next seven days, today first", () => {
    const html = render();
    expect(html.match(/data-testid="plan-popover-day"/g)).toHaveLength(7);
    expect(html).toContain('data-date="2026-09-13"');
    expect(html).toContain('data-date="2026-09-19"');
    expect(html).toContain("Sun 13 Sep");
    expect(html).toContain("Sat 19 Sep");
    expect(html).toContain(">Today<");
  });

  test("the servings stepper defaults to the page's scale", () => {
    const html = render(8);
    expect(html).toContain('aria-label="Servings"');
    expect(html).toMatch(/value="8"/);
  });

  test("a recipe with no servings recorded still gets a usable stepper", () => {
    expect(render(0)).toMatch(/value="1"/);
  });
});

describe("choosing a day writes an entry", () => {
  useTempDataDir();

  test("planEntryFor's write lands on the chosen day with the recipe's name copied across", async () => {
    const recipe = await callServerFn(createRecipe, {
      name: "Lemon tart",
      parts: [{ name: "", ingredients: [], steps: [] }],
    } as RecipeInput);

    // What choosing "Tue 15 Sep" at 6 servings in the popover sends.
    await callServerFn(addPlanEntry, planEntryFor(recipe, "2026-09-15", 6));

    const week = await callServerFn(listPlanWeek, { monday: "2026-09-14" });
    const tuesday = week.find((day) => day.date === "2026-09-15");
    expect(tuesday?.entries).toHaveLength(1);
    expect(tuesday?.entries[0]).toMatchObject({
      text: "Lemon tart",
      servings: 6,
      recipe: { id: recipe.id, slug: recipe.slug, name: "Lemon tart" },
    });
  });
});
