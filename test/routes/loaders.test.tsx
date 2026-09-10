// Route loaders end to end: each page's loader calls its server function (run
// in-process through runLocally against a temp DATA_DIR), and the component
// renders what came back. Type assertions at the bottom pin each loader's
// data to the zod-inferred domain types, so a drift fails `bun run check`.
import { describe, expect, expectTypeOf, test, vi } from "vitest";
import type { Aisle, Recipe, RecipeSummary, Tag, Unit } from "../../src/domain/recipe";
import { Route as IndexRoute, type RecipeListData, searchParam } from "../../src/routes/index";
import { Route as EditRoute } from "../../src/routes/recipes/$slug/edit";
import { Route as ViewRoute, nextServings } from "../../src/routes/recipes/$slug/index";
import { Route as NewRoute } from "../../src/routes/recipes/new";
import { Route as SettingsRoute } from "../../src/routes/settings";
import { createRecipe, getRecipe, listRecipes } from "../../src/server/recipes";
import { listTags } from "../../src/server/tags";
import { listUnits } from "../../src/server/units";
import { renderRoute } from "../helpers/routes";
import { callServerFn, useTempDataDir } from "../helpers/server";

// vi.mock is hoisted above imports and needs literal specifiers, so the shared
// factory is hoisted with it and there is one call per module.
const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../src/server/recipes", local);
vi.mock("../../src/server/units", local);
vi.mock("../../src/server/tags", local);
vi.mock("../../src/server/aisles", local);

useTempDataDir();

const weeknight = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Weeknight", slug: "weeknight" };

function seed(name: string, opts: { servings?: number; tags?: Array<typeof weeknight>; image?: string } = {}) {
  return callServerFn(createRecipe, {
    name,
    image: opts.image ?? null,
    recipeServings: opts.servings ?? 2,
    tags: opts.tags ?? [],
    components: [{ name: "", ingredients: [{ quantity: 200, note: "flour" }], steps: [{ text: "Mix." }] }],
  });
}

describe("/ (list)", () => {
  test("empty database renders the empty state with a link to the editor", async () => {
    const html = await renderRoute("/");
    expect(html).toContain("No recipes yet.");
    expect(html).toContain('href="/recipes/new"');
    expect(html).not.toContain("No recipes match");
    expect(html).not.toContain('role="radiogroup"'); // no tags, no filter
  });

  test("renders a card per recipe: name, link, tags, image or placeholder", async () => {
    await seed("Flatbread", { tags: [weeknight], image: "flatbread.jpg" });
    await seed("Pancakes");
    await seed("Lemon tart", { image: "lemon tart.webp" });
    const html = await renderRoute("/");
    expect(html).toContain("3 recipes");
    for (const [name, slug] of [["Flatbread", "flatbread"], ["Pancakes", "pancakes"], ["Lemon tart", "lemon-tart"]]) {
      expect(html).toContain(name);
      expect(html).toContain(`href="/recipes/${slug}"`);
    }
    // Image URLs come from the stored file name; a recipe without one gets the placeholder.
    expect(html).toContain('src="/api/images/flatbread.jpg"');
    expect(html).toContain('src="/api/images/lemon%20tart.webp"');
    expect(html.match(/data-placeholder="image"/g)).toHaveLength(1);
    // Tag chips on the card, and the tag filter offers every tag plus All.
    expect(html).toContain(" tag-chip ");
    expect(html).toContain(">Weeknight</span>");
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain(">All<");
    expect(html).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>(<[^>]*>)*All/);
  });

  test("q and tag search params filter the list", async () => {
    await seed("Flatbread", { tags: [weeknight] });
    await seed("Pancakes");
    let html = await renderRoute("/?q=flat");
    expect(html).toContain("1 recipe<");
    expect(html).toContain("Flatbread");
    expect(html).not.toContain("Pancakes");

    html = await renderRoute("/?tag=weeknight");
    expect(html).toContain("Flatbread");
    expect(html).not.toContain("Pancakes");

    html = await renderRoute("/?q=pan&tag=weeknight");
    expect(html).toContain("No recipes match that search.");
    expect(html).not.toContain("No recipes yet.");
    expect(html).toContain('href="/"'); // clear filters
  });

  test("the search box and active tag reflect the URL", async () => {
    await seed("Flatbread", { tags: [weeknight] });
    const html = await renderRoute("/?q=flat&tag=weeknight");
    expect(html).toContain('role="search"');
    expect(html).toContain('value="flat"');
    expect(html).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>(<[^>]*>)*Weeknight/);
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
      components: [
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
      ],
      steps: [{ text: "Bake for 30 minutes." }],
      notes: [{ title: "Storage", text: "Keeps two days in the fridge." }],
    });
  }

  test("two-component recipe: header, components in order, recipe-level steps, notes, edit link", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart");

    // Header.
    expect(html).toContain("Lemon tart");
    expect(html).toContain("Sharp and buttery.");
    expect(html).toContain('aria-label="Rated 4 out of 5"');
    expect(html).toContain(">Weeknight</span>");
    expect(html).toContain('href="/?tag=weeknight"');
    for (const [label, value] of [["Prep", "20 min"], ["Cook", "40 min"], ["Total", "1 hr"], ["Makes", "1 tart"]]) {
      expect(html).toMatch(new RegExp(`<dt[^>]*>${label}</dt><dd[^>]*>${value}</dd>`));
    }
    expect(html).toContain("Serves 4");
    expect(html).toContain('aria-label="Scale servings"');
    expect(html).not.toContain(">Reset<"); // nothing requested yet
    expect(html).toContain('href="/recipes/lemon-tart/edit"');
    expect(html.match(/data-placeholder="image"/g)).toHaveLength(1);

    // Components in order, each with its ingredients then its steps.
    const pastry = html.indexOf(">Pastry<");
    const filling = html.indexOf(">Filling<");
    expect(pastry).toBeGreaterThan(-1);
    expect(filling).toBeGreaterThan(pastry);
    expect(html.indexOf("200 g flour")).toBeGreaterThan(pastry);
    expect(html.indexOf("200 g flour")).toBeLessThan(filling);
    expect(html.indexOf("Rub the butter into the flour.")).toBeGreaterThan(html.indexOf("200 g flour"));
    expect(html.indexOf("Rub the butter into the flour.")).toBeLessThan(filling);
    expect(html.indexOf("3 lemons")).toBeGreaterThan(filling);
    expect(html.indexOf("Whisk everything together.")).toBeGreaterThan(html.indexOf("3 lemons"));
    expect(html).toContain("salt, to taste");

    // Fixed ingredient is marked.
    expect(html).toMatch(/data-fixed="true"[^>]*>(<[^>]*>)*1 vanilla pod/);
    expect(html.match(/data-fixed="true"/g)).toHaveLength(1);

    // Recipe-level steps after the components, then notes.
    const finish = html.indexOf(">To finish<");
    expect(finish).toBeGreaterThan(html.indexOf("Whisk everything together."));
    expect(html.indexOf("Bake for 30 minutes.")).toBeGreaterThan(finish);
    const notes = html.indexOf(">Notes<");
    expect(notes).toBeGreaterThan(html.indexOf("Bake for 30 minutes."));
    expect(html.indexOf(">Storage<")).toBeGreaterThan(notes);
    expect(html).toContain("Keeps two days in the fridge.");
  });

  test("doubling servings doubles quantities and the yield; a fixed ingredient keeps its amount", async () => {
    await seedTart();
    const html = await renderRoute("/recipes/lemon-tart?servings=8");
    expect(html).toContain("Serves 8");
    expect(html).toContain("400 g flour");
    expect(html).toContain("6 lemons");
    expect(html).toContain("1 vanilla pod");
    expect(html).not.toContain("2 vanilla pods");
    expect(html).toContain("salt, to taste");
    expect(html).toMatch(/<dt[^>]*>Makes<\/dt><dd[^>]*>2 tart<\/dd>/);
    expect(html).toContain(">Reset<"); // a requested scale can be cleared
  });

  test("a single unnamed component renders without a heading, and no servings hides the scale control", async () => {
    await callServerFn(createRecipe, {
      name: "Toast",
      components: [{ name: "", ingredients: [{ quantity: 1, food: food("bread slice", "bread slices") }], steps: [{ text: "Toast it." }] }],
    });
    const html = await renderRoute("/recipes/toast");
    expect(html).toContain("1 bread slice");
    expect(html).toContain("Toast it.");
    expect(html).not.toContain("<h2");
    expect(html).toContain("Servings not set");
    expect(html).not.toContain('aria-label="Scale servings"');
    expect(html).not.toContain(">To finish<"); // no recipe-level steps
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
      components: [{ name: "", ingredients: [], steps: [] }],
    });
    const html = await renderRoute("/recipes/lemon-tart/edit");
    expect(html).toContain("Edit recipe");
    expect(html).toContain('aria-label="Edit recipe"');
    expect(html).toMatch(/<input[^>]*name="name"[^>]*value="Lemon tart"/);
    expect(html).toMatch(/<textarea[^>]*name="description"[^>]*>Sharp and buttery\.<\/textarea>/);
    expect(html).toMatch(/aria-label="Servings".*?<input[^>]*value="6"/);
    expect(html).toContain('aria-label="Rated 4 out of 5"');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(4);
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

  test("a missing slug renders the not-found view", async () => {
    const html = await renderRoute("/recipes/nothing-here/edit");
    expect(html).toContain("Not found");
  });
});

describe("/recipes/new", () => {
  test("renders the blank form with the seeded units available", async () => {
    const units = await callServerFn(listUnits, {});
    expect(units.length).toBeGreaterThan(0); // seeded reference data
    const html = await renderRoute("/recipes/new");
    expect(html).toContain("New recipe");
    expect(html).toContain('aria-label="New recipe"');
    expect(html).toMatch(/<input[^>]*name="name"[^>]*value=""/);
    expect(html).toMatch(/<textarea[^>]*name="description"[^>]*><\/textarea>/);
    expect(html).toMatch(/aria-label="Servings".*?<input[^>]*value="0"/);
    expect(html).toContain('aria-label="Rated 0 out of 5"');
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).toMatch(/aria-label="Yield unit"[^>]*><span class="truncate">No unit<\/span>/);
    expect(html).toMatch(/<input[^>]*name="prepTime"[^>]*value=""/);
    expect(html).not.toContain('aria-label="Remove '); // no tags yet
    expect(html).toContain('data-placeholder="image"');
    expect(html).toContain(">Create recipe<");
    expect(html).toContain('href="/"'); // cancel
  });
});

describe("/settings", () => {
  test("loads aisles and units", async () => {
    const units = await callServerFn(listUnits, {});
    const html = await renderRoute("/settings");
    expect(html).toContain("Settings");
    expect(html).toMatch(new RegExp(`\\d+<!-- --> aisles, <!-- -->${units.length}<!-- --> units`));
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
    expectTypeOf<RecipeListData>().toEqualTypeOf<{ recipes: RecipeSummary[]; tags: Tag[] }>();
    expectTypeOf<(typeof ViewRoute)["types"]["loaderData"]>().toEqualTypeOf<Recipe>();
    expectTypeOf<(typeof EditRoute)["types"]["loaderData"]>().toEqualTypeOf<{ recipe: Recipe; units: Unit[]; tags: Tag[] }>();
    expectTypeOf<(typeof NewRoute)["types"]["loaderData"]>().toEqualTypeOf<{ units: Unit[]; tags: Tag[] }>();
    expectTypeOf<(typeof SettingsRoute)["types"]["loaderData"]>().toEqualTypeOf<{ aisles: Aisle[]; units: Unit[] }>();
    // Search params are typed from their zod schemas.
    expectTypeOf<(typeof IndexRoute)["types"]["searchSchema"]>().toEqualTypeOf<{ q?: string | undefined; tag?: string | undefined }>();
    expectTypeOf<(typeof ViewRoute)["types"]["searchSchema"]>().toEqualTypeOf<{ servings?: number | undefined }>();
  });
});
