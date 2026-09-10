// Route loaders end to end: each page's loader calls its server function (run
// in-process through runLocally against a temp DATA_DIR), and the component
// renders what came back. Type assertions at the bottom pin each loader's
// data to the zod-inferred domain types, so a drift fails `bun run check`.
import { describe, expect, expectTypeOf, test, vi } from "vitest";
import type { Aisle, Recipe, RecipeSummary, Tag, Unit } from "../../src/domain/recipe";
import { Route as IndexRoute, type RecipeListData, searchParam } from "../../src/routes/index";
import { Route as EditRoute } from "../../src/routes/recipes/$slug/edit";
import { Route as ViewRoute } from "../../src/routes/recipes/$slug/index";
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
});

describe("/recipes/$slug/edit", () => {
  test("loads the recipe plus units and tags", async () => {
    await seed("Lemon tart", { tags: [weeknight] });
    const units = await callServerFn(listUnits, {});
    const tags = await callServerFn(listTags, {});
    const html = await renderRoute("/recipes/lemon-tart/edit");
    expect(html).toContain("Edit recipe");
    expect(html).toContain("Lemon tart");
    expect(html).toContain(`${units.length}<!-- --> units, <!-- -->${tags.length}<!-- --> tags`);
    expect(tags).toHaveLength(1);
  });

  test("a missing slug renders the not-found view", async () => {
    const html = await renderRoute("/recipes/nothing-here/edit");
    expect(html).toContain("Not found");
  });
});

describe("/recipes/new", () => {
  test("loads units and tags for the editor", async () => {
    const units = await callServerFn(listUnits, {});
    const html = await renderRoute("/recipes/new");
    expect(html).toContain("New recipe");
    expect(units.length).toBeGreaterThan(0); // seeded reference data
    expect(html).toContain(`${units.length}<!-- --> units, <!-- -->0<!-- --> tags`);
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
