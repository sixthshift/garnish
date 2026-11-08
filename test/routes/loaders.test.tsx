// Route loaders end to end: each page's loader calls its server function (run
// in-process through runLocally against a temp DATA_DIR), and the component
// renders what came back. Type assertions at the bottom pin each loader's
// data to the zod-inferred domain types, so a drift fails `bun run check`.

import { isNotFound } from "@tanstack/react-router";
import { afterEach, describe, expect, expectTypeOf, test, vi } from "vitest";
import { createFood, listFoods } from "../../src/api/rpc/foods";
import type { McpStatus } from "../../src/api/rpc/mcp";
import { createRecipe, deleteRecipe, getRecipe, type listRecipes } from "../../src/api/rpc/recipes";
import type { listTags } from "../../src/api/rpc/tags";
import { listUnits } from "../../src/api/rpc/units";
import { type SettingsData, type settingsRoute as SettingsRoute, SettingsSearch } from "../../src/app/features/settings/routes/settings";
import type { DiagnosticEvent } from "../../src/db/models/diagnostic/repo";
import type { PlannerRule } from "../../src/domain/plan/planner";
import type { FacetCount } from "../../src/domain/recipes/components/facets/facetSearch";
import type { CookSession } from "../../src/domain/recipes/cooking";
import { nextServings, noFacets, type Recipe, type RecipeSummary, type ShelfCounts, type SubRecipe, type TimelineEvent } from "../../src/domain/recipes/recipe";
import type { Aisle, FoodPack, FoodRow, FoodSummary, Tag, TagUsage, Unit } from "../../src/domain/recipes/reference";
import type { recipeEdit as EditRoute } from "../../src/domain/recipes/routes/edit";
import type { recipeNew as NewRoute } from "../../src/domain/recipes/routes/new";
import type { RecipeViewData, recipeIndex as ViewRoute } from "../../src/domain/recipes/routes/recipeIndex";
import type { recipesIndex as IndexRoute, RecipeListData } from "../../src/domain/recipes/routes/recipesIndex";
import type { StyleRule } from "../../src/domain/recipes/style";
import { searchParam } from "../../src/lib/search";
import type { AiStatus } from "../../src/server/ai/client";
import { elementHtml, renderRoute, testRouter } from "../helpers/routes";
import { callServerFn, useTempDataDir } from "../helpers/server";

// vi.mock is hoisted above imports and needs literal specifiers, so the shared
// factory is hoisted with it and there is one call per module.
const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../src/api/rpc/recipes", local);
vi.mock("../../src/api/rpc/timeline", local);
vi.mock("../../src/api/rpc/units", local);
vi.mock("../../src/api/rpc/tags", local);
vi.mock("../../src/api/rpc/aisles", local);
vi.mock("../../src/api/rpc/foods", local);
vi.mock("../../src/api/rpc/style", local);
vi.mock("../../src/api/rpc/planner", local);
vi.mock("../../src/api/rpc/ai", local);
vi.mock("../../src/api/rpc/diagnostics", local);
vi.mock("../../src/api/rpc/mcp", local);
// Run locally there is no request in flight; Settings › MCP builds its address from one, so it gets the LAN's.
vi.mock("@tanstack/react-start/server", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getRequest: () => new Request("http://192.168.1.5:9988/settings"),
}));
vi.mock("../../src/api/rpc/import", local);

useTempDataDir();

const weeknight = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Weeknight", slug: "weeknight" };

function seed(
  name: string,
  opts: { servings?: number; tags?: Array<typeof weeknight>; image?: string; favourite?: boolean; food?: { id: string; name: string } } = {}
) {
  return callServerFn(createRecipe, {
    name,
    image: opts.image ?? null,
    recipeServings: opts.servings ?? 2,
    tags: opts.tags ?? [],
    favourite: opts.favourite ?? false,
    parts: [{ name: "", ingredients: [opts.food ? { quantity: 200, food: opts.food } : { quantity: 200, note: "flour" }], steps: [{ text: "Mix." }] }],
  });
}

describe("/recipes (list)", () => {
  test("empty database renders the empty state with a link to the editor", async () => {
    const html = await renderRoute("/recipes", "desktop");
    expect(html).toContain("No recipes yet.");
    expect(html).toContain('href="/recipes/new"');
    expect(html).not.toContain("No recipes match");
    expect(html).not.toContain('aria-label="Filter by tag"'); // no tags, no filter
    expect(html).toContain("Favourites only"); // the rest of the filter bar still renders
  });

  test("renders a card per recipe: name, link, tags, image or placeholder", async () => {
    await seed("Flatbread", { tags: [weeknight], image: "flatbread.jpg" });
    await seed("Pancakes");
    await seed("Lemon tart", { image: "lemon tart.webp" });
    const html = await renderRoute("/recipes", "desktop");
    // A phone's card goes to the recipe's page; a desktop's opens it in the side panel (decisions.md row 206).
    const phone = await renderRoute("/recipes");
    expect(html).toContain("3 recipes");
    for (const [name, slug] of [
      ["Flatbread", "flatbread"],
      ["Pancakes", "pancakes"],
      ["Lemon tart", "lemon-tart"],
    ]) {
      expect(html).toContain(name);
      expect(phone).toContain(`href="/recipes/${slug}"`);
      expect(html).toContain(`href="/recipes?panel=${encodeURIComponent(JSON.stringify({ slug }))}"`);
    }
    // Image URLs come from the stored file name; a recipe without one gets the placeholder.
    expect(html).toContain('src="/api/images/flatbread.jpg"');
    expect(html).toContain('src="/api/images/lemon%20tart.webp"');
    expect(html.match(/data-placeholder="image"/g)).toHaveLength(1);
    // A phone's card is the photo and the name (decisions.md row 208); a desktop's wall names the tags under the card, and the
    // filters column offers every tag with its count, none selected (decisions.md row 207).
    expect(elementHtml(phone, "photo-grid").match(/data-testid="photo-card"/g)).toHaveLength(3);
    expect(phone).toContain('src="/api/images/flatbread.jpg"');
    expect(elementHtml(html, "photo-wall")).toContain(">Weeknight</span>");
    const filters = elementHtml(html, "filters-column");
    expect(filters).toContain(">Tags<");
    expect(filters).not.toContain(">All<");
    expect(filters).toMatch(/data-state="off"[^>]*><span[^>]*>Weeknight<\/span><span[^>]*>1<\/span>/);
  });

  test("q and tag search params filter the list", async () => {
    await seed("Flatbread", { tags: [weeknight] });
    await seed("Pancakes");
    let html = await renderRoute("/recipes?q=flat", "desktop");
    expect(html).toContain("1 recipe<");
    expect(html).toContain("Flatbread");
    expect(html).not.toContain("Pancakes");

    html = await renderRoute("/recipes?tag=weeknight", "desktop");
    expect(html).toContain("Flatbread");
    expect(html).not.toContain("Pancakes");

    html = await renderRoute("/recipes?q=pan&tag=weeknight", "desktop");
    expect(html).toContain("No recipes match that search.");
    expect(html).not.toContain("No recipes yet.");
    expect(html).toContain('href="/recipes"'); // clear filters
  });

  test("the search box and active tag reflect the URL", async () => {
    await seed("Flatbread", { tags: [weeknight] });
    const html = await renderRoute("/recipes?q=flat&tag=weeknight", "desktop");
    expect(html).toContain("<search>"); // the search landmark, as an element rather than a role
    expect(html).toContain('value="flat"');
    // The legacy singular `tag` param still selects its chip (M12.3 folds it into `tags`).
    expect(html).toMatch(/data-state="on"[^>]*><span[^>]*>Weeknight/);
  });

  test("tags[], match, foods[] and favourite search params filter the list and render as selected", async () => {
    const pasta = { id: "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2", name: "Pasta", slug: "pasta" };
    const flat = await seed("Flatbread", { tags: [weeknight, pasta], favourite: true, food: { id: crypto.randomUUID(), name: "flour" } });
    await seed("Pancakes", { tags: [pasta] });
    await seed("Toast", { tags: [weeknight] });
    const flourId = flat.parts[0]!.ingredients[0]!.food!.id;

    // any (the default): either tag matches.
    let html = await renderRoute(`/recipes?tags=${encodeURIComponent(JSON.stringify(["weeknight", "pasta"]))}`, "desktop");
    expect(html).toContain("Flatbread");
    expect(html).toContain("Pancakes");
    expect(html).toContain("Toast");
    expect(html).toMatch(/data-state="on"[^>]*><span[^>]*>Weeknight/);
    expect(html).toMatch(/data-state="on"[^>]*><span[^>]*>Pasta/);

    // all: only the recipe carrying both.
    html = await renderRoute(`/recipes?tags=${encodeURIComponent(JSON.stringify(["weeknight", "pasta"]))}&match=all`, "desktop");
    expect(html).toContain("Flatbread");
    expect(html).not.toContain("Pancakes");
    expect(html).not.toContain("Toast");
    expect(html).toContain("Match all");
    expect(html).toContain('data-state="checked"');

    // foods[]: only the recipe with that ingredient's food.
    html = await renderRoute(`/recipes?foods=${encodeURIComponent(JSON.stringify([flourId]))}`, "desktop");
    expect(html).toContain("Flatbread");
    expect(html).not.toContain("Pancakes");
    expect(html).toContain('aria-label="Remove flour"'); // selected food renders as a removable chip

    // favourite.
    html = await renderRoute("/recipes?favourite=true", "desktop");
    expect(html).toContain("Flatbread");
    expect(html).not.toContain("Pancakes");
    expect(html).not.toContain("Toast");
  });

  test("the week param narrows to the weeknight recipes, the shelf to the never made, and an old Rotation shelf goes on to the week (row 219)", async () => {
    const laksa = await callServerFn(createRecipe, {
      name: "Laksa",
      parts: [{ name: "" }],
      facets: { ...noFacets(), week: ["weeknight"] },
      lastMade: "2026-09-01T08:00:00.000Z",
    });
    await callServerFn(createRecipe, { name: "Lamb shoulder", parts: [{ name: "" }], facets: { ...noFacets(), week: ["weekend"] } });
    expect(laksa.facets.week).toEqual(["weeknight"]);
    let html = await renderRoute(`/recipes?week=${encodeURIComponent(JSON.stringify(["weeknight"]))}`);
    expect(html).toContain('href="/recipes/laksa"');
    expect(html).not.toContain('href="/recipes/lamb-shoulder"');
    // An old link to the Rotation shelf goes on to the week facet.
    const old = testRouter("/recipes?shelf=rotation");
    await old.load();
    const result = old._serverResult;
    expect(result?.type).toBe("redirect");
    if (result?.type === "redirect") expect(result.redirect.headers.get("Location")).toBe(`/recipes?week=${encodeURIComponent(JSON.stringify(["weeknight"]))}`);
    html = await renderRoute("/recipes?shelf=try");
    expect(html).toContain('href="/recipes/lamb-shoulder"');
    expect(html).not.toContain('href="/recipes/laksa"');
    expect(html).toContain('aria-label="Collection"');
  });

  describe("view mode (M12.2)", () => {
    afterEach(() => {
      delete (globalThis as { window?: unknown }).window;
    });

    test("a phone has the photo grid and no view toggle; a desktop defaults to a grid, which is the wall", async () => {
      await seed("Flatbread");
      const phone = await renderRoute("/recipes");
      expect(phone).toContain('data-testid="photo-grid"');
      expect(phone).not.toContain("data-card-mode");
      expect(phone).not.toContain('aria-label="Grid view"');
      const html = await renderRoute("/recipes", "desktop");
      expect(html).toContain('data-testid="photo-wall"');
      expect(html).not.toContain('data-card-mode="list"');
      expect(html).toMatch(/aria-label="Grid view"[^>]*aria-checked="true"/);
    });

    test("a stored list preference renders every card in list mode", async () => {
      await seed("Flatbread");
      await seed("Pancakes");
      const storage = new Map<string, string>();
      storage.set("garnish.viewMode", JSON.stringify("list"));
      (globalThis as { window?: unknown }).window = {
        localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => void storage.set(key, value) },
      };
      const html = await renderRoute("/recipes", "desktop");
      expect(html.match(/data-card-mode="list"/g)).toHaveLength(2);
      expect(html).not.toContain('data-card-mode="grid"');
      expect(html).toMatch(/aria-label="List view"[^>]*aria-checked="true"/);
    });
  });

  describe("sort and dice (M12.4)", () => {
    test("defaults to the newest-created sort, and the dice button renders", async () => {
      await seed("Flatbread");
      const html = await renderRoute("/recipes", "desktop");
      expect(html).toContain("Sort: Newest created");
      expect(html).toContain('aria-label="Open a random recipe"');
    });

    test("sort and dir search params change the sort menu's trigger and the recipe order", async () => {
      await seed("Banana cake");
      await seed("Apple pie");

      let html = await renderRoute("/recipes?sort=name&dir=asc", "desktop");
      expect(html).toContain("Sort: Name (A–Z)");
      expect(html.indexOf("Apple pie")).toBeLessThan(html.indexOf("Banana cake"));

      html = await renderRoute("/recipes?sort=name&dir=desc", "desktop");
      expect(html).toContain("Sort: Name (Z–A)");
      expect(html.indexOf("Banana cake")).toBeLessThan(html.indexOf("Apple pie"));
    });

    test("sort=random with a seed renders every recipe once", async () => {
      await seed("Banana cake");
      await seed("Apple pie");
      const html = await renderRoute("/recipes?sort=random&seed=abc", "desktop");
      expect(html).toContain("Sort: Random");
      expect(html).toContain("Banana cake");
      expect(html).toContain("Apple pie");
    });
  });
});

describe("searchParam", () => {
  test("keeps a trimmed value and drops blanks so the URL stays clean", () => {
    expect(searchParam("flat")).toBe("flat");
    expect(searchParam("  flat ")).toBe("flat");
    expect(searchParam("")).toBeUndefined();
    expect(searchParam("   ")).toBeUndefined();
    expect(searchParam(undefined)).toBeUndefined();
  });
});

describe("/recipes/$slug (view)", () => {
  test("renders the recipe by slug", async () => {
    await seed("Lemon tart", { servings: 6 });
    const html = await renderRoute("/recipes/lemon-tart");
    expect(html).toContain("Lemon tart");
    expect(html).toContain("Serves 6");
  });

  test("servings search param scales the document", async () => {
    await seed("Lemon tart", { servings: 6 });
    const html = await renderRoute("/recipes/lemon-tart?servings=3");
    expect(html).toContain("Serves 3");
  });

  test("a malformed servings value fails validation and renders the error view", async () => {
    await seed("Lemon tart", { servings: 6 });
    for (const bad of ["lots", "-2"]) {
      const html = await renderRoute(`/recipes/lemon-tart?servings=${bad}`);
      expect(html).toContain("Something went wrong");
      expect(html).not.toContain("Serves");
    }
  });

  test("unknown search params pass through untouched", async () => {
    await seed("Lemon tart", { servings: 6 });
    const html = await renderRoute("/recipes/lemon-tart?servings=3&extra=1");
    expect(html).toContain("Serves 3");
  });

  test("a missing slug renders the not-found view", async () => {
    const html = await renderRoute("/recipes/nothing-here");
    expect(html).toContain("Not found");
  });

  // A two-component recipe with foods and units, so ingredient lines render
  // through formatIngredient and quantities scale. Reference rows are resolved
  // by name, so the ids here only need to be well-formed.
  const food = (name: string, pluralName: string | null = null) => ({ id: crypto.randomUUID(), name, pluralName });
  async function seedTart() {
    const units = await callServerFn(listUnits, {});
    const gram = units.find((u) => u.abbreviation === "g")!;
    return callServerFn(createRecipe, {
      name: "Lemon tart",
      description: "Sharp and buttery.",
      rating: 4,
      recipeServings: 4,
      recipeYieldQuantity: 1,
      recipeYield: "tart",
      prepTime: 20,
      performTime: 40,
      tags: [weeknight],
      parts: [
        {
          name: "Pastry",
          ingredients: [{ quantity: 200, unit: gram, food: food("flour") }],
          steps: [{ text: "Rub the butter into the flour." }],
        },
        {
          name: "Filling",
          ingredients: [
            { quantity: 3, food: food("lemon", "lemons") },
            { quantity: 1, food: food("vanilla pod", "vanilla pods"), fixed: true },
            { quantity: null, food: food("salt"), note: "to taste" },
          ],
          steps: [{ text: "Whisk everything together." }],
        },
        { name: "", steps: [{ text: "Bake for 30 minutes." }] },
      ],
      notes: [{ title: "Storage", text: "Keeps two days in the fridge." }],
    });
  }

  test("two-component recipe: header, notes, components in order, recipe-level steps, action menu", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart");

    // Header.
    expect(html).toContain("Lemon tart");
    expect(html).toContain("Sharp and buttery.");
    expect(html).toContain('aria-label="Rated 4 out of 5"');
    expect(html).toContain(">Weeknight</a>");
    expect(html).toContain('href="/recipes?tag=weeknight"');
    for (const [label, value] of [
      ["Prep", "20 min"],
      ["Cook", "40 min"],
      ["Total", "1 hr"],
      ["Makes", "1 tart"],
    ]) {
      expect(html).toMatch(new RegExp(`<dt[^>]*>${label}</dt><dd[^>]*>${value}</dd>`));
    }
    expect(html).toContain("Serves 4");
    expect(html).not.toContain('data-empty="tags"'); // it has a tag
    expect(html).not.toContain('data-empty="part"'); // every part has content
    expect(html).toContain('aria-label="Scale servings"');
    expect(html).not.toContain(">Reset<"); // nothing requested yet
    // Edit and Cook are their own buttons beside the menu (M25.5); the trigger is what the closed menu shows.
    expect(html).toContain('aria-label="Edit"');
    expect(html).toContain('aria-label="Recipe actions"');
    // No image: no placeholder band holding the space for one (critique #4).
    expect(html).not.toContain('data-placeholder="image"');

    // Two columns from md (M24.1): the parts' ingredients in the aside, their
    // steps in the main column, both in part order.
    const aside = elementHtml(html, "ingredients-column");
    const main = elementHtml(html, "method-column");
    const pastry = aside.indexOf(">Pastry<");
    const filling = aside.indexOf(">Filling<");
    expect(pastry).toBeGreaterThan(-1);
    expect(filling).toBeGreaterThan(pastry);
    // Quantity/unit and food render separately (food bold), so check each in
    // place rather than as one joined string.
    const flourAmount = aside.indexOf('ingredient-amount">200 g<');
    const flourFood = aside.indexOf(">flour<");
    expect(flourAmount).toBeGreaterThan(pastry);
    expect(flourFood).toBeGreaterThan(flourAmount);
    expect(flourFood).toBeLessThan(filling);
    const lemonsAmount = aside.indexOf('ingredient-amount">3<');
    expect(lemonsAmount).toBeGreaterThan(filling);
    expect(aside.indexOf(">lemons<")).toBeGreaterThan(lemonsAmount);
    // The method column repeats each part's name above its own steps.
    const mainPastry = main.indexOf(">Pastry<");
    const mainFilling = main.indexOf(">Filling<");
    expect(mainPastry).toBeGreaterThan(-1);
    expect(main.indexOf("Rub the butter into the flour.")).toBeGreaterThan(mainPastry);
    expect(main.indexOf("Rub the butter into the flour.")).toBeLessThan(mainFilling);
    expect(main.indexOf("Whisk everything together.")).toBeGreaterThan(mainFilling);
    // No amount ("salt to taste"): bold food, note dimmed on its own line, no comma join.
    expect(html).toContain(">salt<");
    expect(html).toContain(">to taste</p>"); // dimmed on its own line, not comma-joined into the visible text

    // Fixed ingredient is marked, and its "fixed" marker is kept.
    expect(html).toMatch(/data-fixed="true"[\s\S]*?>vanilla pod</);
    expect(html.match(/data-fixed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/data-fixed="true"[\s\S]*?>fixed</);

    // The unnamed part's steps come after the named parts, without a heading.
    // "30 minutes" is its own timer chip (M26.2), so the sentence is no longer one contiguous string.
    expect(main.indexOf("Bake for")).toBeGreaterThan(main.indexOf("Whisk everything together."));
    expect(html).not.toContain(">To finish<");
    // Notes follow the method, in its column (critique #4, reversing M24.4).
    const notes = html.indexOf(">Notes<");
    expect(notes).toBeGreaterThan(-1);
    expect(notes).toBeGreaterThan(html.indexOf("Whisk everything together."));
    expect(html.indexOf(">Storage<")).toBeGreaterThan(notes);
    expect(html).toContain("Keeps two days in the fridge.");
  });

  test("doubling servings doubles quantities and the yield; a fixed ingredient keeps its amount", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart?servings=8");
    expect(html).toContain("Serves 8");
    expect(html).toContain('ingredient-amount">400 g<');
    expect(html).toContain(">flour<");
    expect(html).toContain('ingredient-amount">6<');
    expect(html).toContain(">lemons<");
    // Fixed: stays at 1 even though servings doubled.
    expect(html).toMatch(/data-fixed="true"[\s\S]*?ingredient-amount">1</);
    expect(html).not.toMatch(/data-fixed="true"[\s\S]*?ingredient-amount">2</);
    expect(html).toContain(">salt<");
    expect(html).toMatch(/<dt[^>]*>Makes<\/dt><dd[^>]*>2 tart<\/dd>/);
    expect(html).toContain(">Reset<"); // a requested scale can be cleared
    // A requested servings differs from the recipe's own: amounts get the scaled class.
    expect(html).toContain('data-scaled="true"');
    expect(html).toContain("text-fg-brand");
  });

  test("a single unnamed component renders without a heading, and no servings hides the scale control", async () => {
    await callServerFn(createRecipe, {
      name: "Toast",
      parts: [{ name: "", ingredients: [{ quantity: 1, food: food("bread slice", "bread slices") }], steps: [{ text: "Toast it." }] }],
    });
    const html = await renderRoute("/recipes/toast");
    expect(html).toContain('ingredient-amount">1<');
    expect(html).toContain(">bread slice<");
    expect(html).toContain("Toast it.");
    // The single unnamed part still gets no heading of its own; the aside's
    // "Ingredients" title (M24.2) is the page's only heading.
    expect(elementHtml(html, "method-column")).not.toContain("<h2");
    expect(elementHtml(html, "ingredients-column")).toContain(">Ingredients<");
    expect(html).toContain("Servings not set");
    expect(html).not.toContain('aria-label="Scale servings"');
    expect(html).not.toContain(">To finish<"); // no recipe-level steps
    // A phone's page leaves out a tag line it has nothing for; a desktop's header says so.
    expect(html).not.toContain('aria-label="Tags"');
    expect(await renderRoute("/recipes/toast", "desktop")).toContain("No tags");
    // A single part: no toggle to switch between structured and one list.
    expect(html).not.toContain('data-testid="ingredient-mode-toggle"');
    // Only the steps list is empty here, so the component says nothing: a flat
    // recipe keeps its steps at recipe level and "No steps" would be noise.
    expect(html).not.toContain('data-empty="part"');
  });

  test("a component with neither ingredients nor steps says so, and an untagged recipe says No tags on a desktop", async () => {
    await callServerFn(createRecipe, {
      name: "Blank",
      parts: [{ name: "Pastry", ingredients: [], steps: [] }],
    });
    const html = await renderRoute("/recipes/blank");
    expect(html).toContain(">Pastry<");
    expect(html).toContain("No ingredients or steps yet");
    expect(await renderRoute("/recipes/blank", "desktop")).toContain('data-empty="tags"');
    expect(html).not.toContain('aria-label="Ingredients"');
    expect(html).not.toContain('aria-label="Steps"');
  });
});

describe("nextServings", () => {
  test("steps by one, snapping a fraction to the whole number on the side it is heading, never below 1", () => {
    expect(nextServings(4, 1)).toBe(5);
    expect(nextServings(4, -1)).toBe(3);
    expect(nextServings(2.5, 1)).toBe(3);
    expect(nextServings(2.5, -1)).toBe(2);
    expect(nextServings(1, -1)).toBe(1);
    expect(nextServings(0.5, -1)).toBe(1);
    expect(nextServings(0.5, 1)).toBe(1);
  });
});

describe("/recipes/$slug/style", () => {
  const tart = { name: "Lemon tart", parts: [{ name: "", ingredients: [], steps: [{ text: "Blind bake the case until golden." }] }] };

  test("without a model it says what is missing, and offers no restyle", async () => {
    delete process.env.AI_API_KEY;
    await callServerFn(createRecipe, tart);
    const html = await renderRoute("/recipes/lemon-tart/style");
    expect(html).toContain("Lemon tart");
    expect(html).toContain('data-testid="style-unavailable"');
    expect(html).not.toContain('data-testid="style-space"');
  });

  test("with a model it opens the Style space on the recipe's own steps, and Restore only once restyled", async () => {
    process.env.AI_PROVIDER = "api";
    process.env.AI_API_KEY = "secret";
    try {
      await callServerFn(createRecipe, tart);
      const html = await renderRoute("/recipes/lemon-tart/style");
      expect(html).toContain('data-testid="style-space"');
      expect(html).toContain("Blind bake the case until golden.");
      expect(html).not.toContain('data-testid="style-restore"');
    } finally {
      delete process.env.AI_PROVIDER;
      delete process.env.AI_API_KEY;
    }
  });

  test("a missing slug renders the not-found view", async () => {
    expect(await renderRoute("/recipes/nothing-here/style")).toContain("Not found");
  });
});

describe("/recipes/$slug/edit", () => {
  test("renders the form populated from the loaded recipe, with the unit list in the yield picker", async () => {
    const units = await callServerFn(listUnits, {});
    const gram = units.find((u) => u.abbreviation === "g")!;
    await callServerFn(createRecipe, {
      name: "Lemon tart",
      description: "Sharp and buttery.",
      rating: 4,
      recipeServings: 6,
      recipeYieldQuantity: 1,
      yieldUnit: gram,
      recipeYield: "tart",
      prepTime: 20,
      performTime: 40,
      tags: [weeknight],
      parts: [{ name: "", ingredients: [], steps: [] }],
    });
    const html = await renderRoute("/recipes/lemon-tart/edit");
    expect(html).toContain('aria-label="Edit recipe"');
    expect(html).toMatch(/<textarea[^>]*name="name"[^>]*>Lemon tart<\/textarea>/);
    expect(html).toMatch(/<textarea[^>]*name="description"[^>]*>Sharp and buttery\.<\/textarea>/);
    expect(html).toMatch(/aria-label="Servings".*?<input[^>]*value="6"/);
    // Rating and last made are set from the view page, not here (decisions row 51).
    expect(html).not.toContain('aria-label="Rated 4 out of 5"');
    // A recipe with a yield opens it where the servings are (decisions rows 50, 211).
    expect(html).toMatch(/<details open=""[^>]*aria-label="Yield"/);
    expect(html).toMatch(/<input[^>]*name="recipeYieldQuantity"[^>]*value="1"/);
    expect(html).toMatch(/aria-label="Yield unit"[^>]*><span class="truncate">gram<\/span>/);
    expect(html).toMatch(/<input[^>]*name="recipeYield"[^>]*value="tart"/);
    expect(html).toMatch(/<input[^>]*name="prepTime"[^>]*value="20"/);
    expect(html).toMatch(/<input[^>]*name="performTime"[^>]*value="40"/);
    expect(html).toContain(">Weeknight</span>");
    expect(html).toContain('aria-label="Remove Weeknight"');
    expect(html).toContain('data-placeholder="image"');
    expect(html).toContain(">Save changes<");
    expect(html).toContain('href="/recipes/lemon-tart"'); // cancel
  });

  test("the editor is headed by a toolbar naming the recipe, with the save and the JSON toggle's menu (M22.2, M27.6)", async () => {
    await callServerFn(createRecipe, { name: "Lemon tart", parts: [{ name: "", ingredients: [], steps: [] }] });
    const html = await renderRoute("/recipes/lemon-tart/edit");
    expect(html).toContain('data-testid="editor-toolbar"');
    expect(html).toContain('data-testid="menu-trigger"');
    // The toolbar comes first, before any field.
    expect(html.indexOf('data-testid="editor-toolbar"')).toBeLessThan(html.indexOf('name="name"'));
    // A phone saves from the footer; a desktop from the toolbar, with no footer (decisions.md row 206).
    expect(html).toContain('data-testid="save-bar"');
    const wide = await renderRoute("/recipes/lemon-tart/edit", "desktop");
    expect(wide).not.toContain('data-testid="save-bar"');
    expect(elementHtml(wide, "editor-toolbar")).toContain(">Save changes<");
    // Nothing is dirty on open, so neither bar says so.
    expect(html).not.toContain("Unsaved changes");
  });

  test("the editor runs in the recipe page's order: the name, the ingredients, the method, then the notes (decisions rows 135, 211)", async () => {
    await callServerFn(createRecipe, {
      name: "Lemon tart",
      recipeYield: "tart",
      notes: [{ title: "Tip", text: "Chill the pastry." }],
      parts: [{ name: "", ingredients: [], steps: [{ text: "Bake it blind." }] }],
    });
    const order = (html: string, needles: string[]) => needles.map((needle) => html.indexOf(needle));
    const edit = await renderRoute("/recipes/lemon-tart/edit");
    const editAt = order(edit, ['name="name"', 'aria-label="Ingredients"', 'aria-label="Method"', 'aria-label="Notes"']);
    for (const at of editAt) expect(at).toBeGreaterThan(-1);
    expect(editAt).toEqual([...editAt].sort((a, b) => a - b));

    // The view page runs the same way: the method, then the notes.
    const view = await renderRoute("/recipes/lemon-tart");
    const [lastStep, notes] = order(view, ["Bake it blind.", 'aria-label="Notes"']);
    expect(lastStep).toBeGreaterThan(-1);
    expect(notes).toBeGreaterThan(lastStep!);

    // A desktop's three columns: what it is, then the ingredients, then the method; the notes stay in the first.
    const wide = await renderRoute("/recipes/lemon-tart/edit", "desktop");
    const wideAt = order(wide, ['data-testid="about-column"', 'aria-label="Notes"', 'aria-label="Ingredients"', 'aria-label="Method"']);
    for (const at of wideAt) expect(at).toBeGreaterThan(-1);
    expect(wideAt).toEqual([...wideAt].sort((a, b) => a - b));
  });

  test("shows both components of a two-component recipe in order, each with its rows read-only", async () => {
    await callServerFn(createRecipe, {
      name: "Lemon tart",
      parts: [
        { name: "Pastry", ingredients: [{ quantity: 200, note: "flour" }], steps: [{ text: "Rub the butter in." }] },
        { name: "Filling", ingredients: [{ quantity: 3, note: "lemons" }], steps: [{ text: "Whisk everything together." }] },
      ],
    });
    const html = await renderRoute("/recipes/lemon-tart/edit");
    expect(html).toMatch(/<input[^>]*name="parts\.0\.name"[^>]*value="Pastry"/);
    expect(html).toMatch(/<input[^>]*name="parts\.1\.name"[^>]*value="Filling"/);
    const pastry = html.indexOf('value="Pastry"');
    const filling = html.indexOf('value="Filling"');
    expect(pastry).toBeGreaterThan(-1);
    expect(filling).toBeGreaterThan(pastry);
    expect(html.indexOf("Rub the butter in.")).toBeGreaterThan(pastry);
    expect(html.indexOf("Rub the butter in.")).toBeLessThan(filling);
    expect(html.indexOf("Whisk everything together.")).toBeGreaterThan(filling);
    // Each part is moved and removed from its own menu, beside its name.
    expect(html).toContain('aria-label="Pastry actions"');
    expect(html).toContain('aria-label="Filling actions"');
    expect(html).toContain(">Add part<");
  });

  test("a missing slug renders the not-found view", async () => {
    const html = await renderRoute("/recipes/nothing-here/edit");
    expect(html).toContain("Not found");
  });

  // M25.5: the view page's Edit button carries the requested servings so the
  // editor's Cancel link can hand the same scale back.
  test("a servings search param round-trips through Cancel", async () => {
    await callServerFn(createRecipe, { name: "Lemon tart", recipeServings: 4, parts: [{ name: "", ingredients: [], steps: [] }] });
    const html = await renderRoute("/recipes/lemon-tart/edit?servings=8");
    expect(html).toContain('href="/recipes/lemon-tart?servings=8"'); // cancel
  });

  // M11.6 moved Delete out of the editor and into the view page's action menu.
  test("does not host Delete: it lives in the recipe view's action menu", async () => {
    await seed("Lemon tart");
    const html = await renderRoute("/recipes/lemon-tart/edit");
    expect(html).not.toContain('aria-label="Delete recipe"');
    expect(html).not.toContain("Delete recipe");
    expect(html).not.toContain("Delete Lemon tart?");
  });

  // M5.6 Check: delete one of two recipes and it is gone from the list and by slug.
  test("a deleted recipe is gone from the list and its slug is not found", async () => {
    const tart = await seed("Lemon tart");
    await seed("Pancakes");
    // A phone's search names how many there are to search.
    expect(await renderRoute("/recipes")).toContain('placeholder="Search 2 recipes"');

    const gone = await callServerFn(deleteRecipe, { id: tart.id });
    expect(gone.slug).toBe("lemon-tart");

    const html = await renderRoute("/recipes");
    expect(html).toContain('placeholder="Search 1 recipe"');
    expect(html).toContain("Pancakes");
    expect(html).toContain('href="/recipes/pancakes"');
    expect(html).not.toContain("Lemon tart");
    expect(html).not.toContain('href="/recipes/lemon-tart"');

    const caught = await callServerFn(getRecipe, { slug: "lemon-tart" }).catch((e: unknown) => e);
    expect(isNotFound(caught)).toBe(true);
    expect(await renderRoute("/recipes/lemon-tart")).toContain("Not found");
    expect(await renderRoute("/recipes/lemon-tart/edit")).toContain("Not found");
  });
});

describe("/recipes/new", () => {
  test("opens on the source chooser, not the form (M23.6)", async () => {
    const html = await renderRoute("/recipes/new");
    expect(html).toContain('data-source-stage="choose"');
    expect(html).toContain("Import from a web page");
    expect(html).toContain('data-source="url"');
    expect(html).toContain('data-source="manual"');
    expect(html).not.toContain('aria-label="New recipe"'); // the form is not mounted yet
  });

  test("?source=url opens the address field", async () => {
    const html = await renderRoute("/recipes/new?source=url");
    expect(html).toContain('data-source-stage="url"');
    expect(html).toContain('aria-label="Recipe address"');
    expect(html).not.toContain('aria-label="New recipe"');
  });

  test("a share is redirected onto the URL stage, whichever field held the address", async () => {
    // Android's share puts the browser's URL in `text`. Without a `document`
    // the router takes itself for a server and hands the redirect back for a
    // 302 rather than following it, so the Location is what is checked here.
    const router = testRouter("/recipes/new?title=Anzac%20biscuits&text=https%3A%2F%2Fexample.test%2Fanzac");
    await router.load();
    const result = router._serverResult;
    expect(result?.type).toBe("redirect");
    if (result?.type !== "redirect") return;
    expect(result.redirect.headers.get("Location")).toBe("/recipes/new?source=url&url=https%3A%2F%2Fexample.test%2Fanzac");
  });

  test("a share with no address in it is redirected to the chooser", async () => {
    const router = testRouter("/recipes/new?title=Anzac%20biscuits&text=Chewy%20and%20golden");
    await router.load();
    const result = router._serverResult;
    expect(result?.type).toBe("redirect");
    if (result?.type !== "redirect") return;
    expect(result.redirect.headers.get("Location")).toBe("/recipes/new");
  });

  test("where the redirect lands: the URL stage with the address filled in", async () => {
    const html = await renderRoute("/recipes/new?source=url&url=https%3A%2F%2Fexample.test%2Fanzac");
    expect(html).toContain('data-source-stage="url"');
    expect(html).toMatch(/aria-label="Recipe address"[^>]*value="https:\/\/example\.test\/anzac"/);
    // The read itself starts in an effect, which a string render never runs: RecipeSourceShare.dom.test.tsx presses that.
  });

  test("renders the blank form with the seeded units available", async () => {
    const units = await callServerFn(listUnits, {});
    expect(units.length).toBeGreaterThan(0); // seeded reference data
    const html = await renderRoute("/recipes/new?source=manual");
    expect(html).toContain("New recipe");
    expect(html).toContain('aria-label="New recipe"');
    expect(html).toMatch(/<textarea[^>]*name="name"[^>]*><\/textarea>/);
    expect(html).toMatch(/<textarea[^>]*name="description"[^>]*><\/textarea>/);
    expect(html).toMatch(/aria-label="Servings".*?<input[^>]*value="0"/);
    expect(html).not.toContain('aria-label="Rated 0 out of 5"'); // decisions row 51
    // A blank recipe makes nothing, so the yield opens folded — but its
    // fields are still in the form (decisions rows 50, 211).
    expect(html).toMatch(/<details data-disclosure[^>]*aria-label="Yield"/);
    expect(html).not.toContain('<details open=""');
    expect(html).toMatch(/aria-label="Yield unit"[^>]*><span class="truncate">No unit<\/span>/);
    expect(html).toMatch(/<input[^>]*name="prepTime"[^>]*value=""/);
    expect(html).not.toContain('aria-label="Remove '); // no tags yet
    expect(html).toContain('data-placeholder="image"');
    expect(html).toContain(">Create recipe<");
    expect(html).toContain('href="/"'); // cancel
  });
});

describe("/settings", () => {
  // A phone's Settings is one grouped list (decisions.md row 208); each place opens at `?section=`.
  test("a phone's Settings is one grouped list, each place a row to its own screen, with its count", async () => {
    const foods = await callServerFn(listFoods, {});
    const html = await renderRoute("/settings");
    expect(html).toContain(">Settings</h1>");
    for (const group of ["Library", "Cooking", "Data", "App"]) expect(html).toContain(`>${group}</h2>`);
    for (const [value, label] of [
      ["foods", "Foods"],
      ["units", "Units"],
      ["aisles", "Aisles"],
      ["tags", "Tags"],
      ["style", "Style"],
      ["planner", "Planner"],
      ["backup", "Backup"],
      ["ai", "AI"],
      ["mcp", "MCP"],
      ["appearance", "Appearance"],
      ["alerts", "Alerts"],
      ["diagnostics", "Diagnostics"],
    ]) {
      expect(html).toMatch(new RegExp(`href="/settings\\?section=${value}"[^>]*>[\\s\\S]*?>${label}</span>`));
    }
    // Each guide's row counts the statements that are on; the library's, what it holds.
    expect(html).toMatch(/>Style<\/span><span[^>]*>12</);
    expect(html).toMatch(/>Planner<\/span><span[^>]*>5</);
    expect(html).toMatch(new RegExp(`>Foods</span><span[^>]*>${foods.length}<`));
    // Home is the way out; no place is drawn until one is opened.
    expect(html).toMatch(/<a(?=[^>]*href="\/")[^>]*aria-label="Home"/);
    expect(html).not.toContain('aria-label="Search foods"');
  });

  test("?section=foods is the phone's Foods: the search held at the top, the letters, and the alphabet down the side", async () => {
    await callServerFn(createFood, { name: "Apple" });
    await callServerFn(createFood, { name: "Zucchini" });
    const foods = await callServerFn(listFoods, {});
    const html = await renderRoute("/settings?section=foods");
    expect(html).toContain("data-back-to-settings");
    expect(html).toContain(">Foods</h1>");
    expect(html).toContain('aria-label="Search foods"');
    expect(html).toContain(">On hand<");
    expect(html).toContain(`${foods.length} foods`);
    expect(html).toMatch(/data-letter="A"[^>]*>A</);
    expect(html).toContain('aria-label="Jump to a letter"');
    // A letter with foods jumps; one without is greyed and pressed in vain.
    expect(html).toMatch(/<button type="button" aria-label="Jump to Z"/);
    expect(html).toMatch(/<button type="button" disabled="" aria-label="Jump to Q"/);
  });

  test("another place opens on its own screen, back to the list; a place that does not exist is the list", async () => {
    const units = await renderRoute("/settings?section=units");
    expect(units).toContain(">Units</h1>");
    expect(units).toContain('aria-label="Search units"');
    expect(units).toMatch(/<a(?=[^>]*href="\/settings")[^>]*data-back-to-settings/);
    expect(SettingsSearch.parse({ section: "nowhere" })).toEqual({ section: undefined });
  });

  test("each food row opens its sheet and has one actions menu, and no dialog is open by default", async () => {
    await callServerFn(createFood, { name: "Butter" });
    await callServerFn(createFood, { name: "Salt", skipShopping: true, aliases: ["sea salt"] });
    const html = await renderRoute("/settings?section=foods");
    expect(html).toContain('aria-label="Actions for Butter"');
    expect(html).toContain('aria-label="Actions for Salt"');
    // A staple says so under its name, beside its aliases.
    expect(html).toMatch(/on hand(<!-- -->)? · <\/span>sea salt/);
    // The edit sheet, delete confirm and merge dialog all start closed.
    expect(html).not.toContain("Merge into");
    expect(html).not.toContain("Always in the cupboard");
    expect(html).not.toContain("will be deleted");
  });
});

describe("loader data types match the domain schemas", () => {
  test("compile-time only", () => {
    // Server functions return exactly the zod-inferred types...
    expectTypeOf<Awaited<ReturnType<typeof listRecipes>>>().toEqualTypeOf<RecipeSummary[]>();
    expectTypeOf<Awaited<ReturnType<typeof getRecipe>>>().toEqualTypeOf<Recipe>();
    expectTypeOf<Awaited<ReturnType<typeof listUnits>>>().toEqualTypeOf<Unit[]>();
    expectTypeOf<Awaited<ReturnType<typeof listTags>>>().toEqualTypeOf<Tag[]>();
    // ...and each route hands its component the same shape (`types` is the
    // route's phantom type bag; `useLoaderData()` returns `types.loaderData`).
    expectTypeOf<(typeof IndexRoute)["types"]["loaderData"]>().toEqualTypeOf<RecipeListData>();
    expectTypeOf<RecipeListData>().toEqualTypeOf<{
      recipes: RecipeSummary[];
      tags: TagUsage[];
      foods: FoodSummary[];
      shelves: ShelfCounts;
      facetCounts: FacetCount[];
    }>();
    expectTypeOf<(typeof ViewRoute)["types"]["loaderData"]>().toEqualTypeOf<RecipeViewData>();
    expectTypeOf<RecipeViewData>().toEqualTypeOf<{
      recipe: Recipe;
      timeline: TimelineEvent[];
      subRecipes: SubRecipe[];
      aiAvailable: boolean;
      session: CookSession | null;
    }>();
    expectTypeOf<(typeof EditRoute)["types"]["loaderData"]>().toEqualTypeOf<{ recipe: Recipe; units: Unit[]; tags: Tag[] }>();
    expectTypeOf<(typeof NewRoute)["types"]["loaderData"]>().toEqualTypeOf<{ units: Unit[]; tags: Tag[]; aiAvailable: boolean }>();
    expectTypeOf<(typeof SettingsRoute)["types"]["loaderData"]>().toEqualTypeOf<SettingsData>();
    expectTypeOf<SettingsData>().toEqualTypeOf<{
      aisles: Aisle[];
      units: Unit[];
      foods: FoodRow[];
      foodUsage: Record<string, number>;
      foodPacks: FoodPack[];
      tags: TagUsage[];
      recipes: RecipeSummary[];
      styleRules: StyleRule[];
      plannerRules: PlannerRule[];
      ai: AiStatus;
      mcp: McpStatus;
      diagnostics: DiagnosticEvent[];
    }>();
    // Search params are typed from their zod schemas.
    expectTypeOf<(typeof IndexRoute)["types"]["searchSchema"]>().toEqualTypeOf<{
      q?: string | undefined;
      tag?: string | undefined;
      tags?: string[] | undefined;
      match?: "any" | "all" | undefined;
      foods?: string[] | undefined;
      favourite?: boolean | undefined;
      shelf?: "try" | "rotation" | "weekend" | undefined;
      course?: string[] | undefined;
      meal?: string[] | undefined;
      week?: string[] | undefined;
      cuisine?: string[] | undefined;
      diet?: string[] | undefined;
      mainIngredient?: string[] | undefined;
      method?: string[] | undefined;
      season?: string[] | undefined;
      sort?: "name" | "created" | "updated" | "lastMade" | "rating" | "random" | undefined;
      dir?: "asc" | "desc" | undefined;
      seed?: string | undefined;
    }>();
    expectTypeOf<(typeof ViewRoute)["types"]["searchSchema"]>().toEqualTypeOf<{
      servings?: number | undefined;
      choices?: Record<string, string> | undefined;
      cooking?: boolean | undefined;
    }>();
    expectTypeOf<(typeof EditRoute)["types"]["searchSchema"]>().toEqualTypeOf<{ servings?: number | undefined }>();
  });
});
