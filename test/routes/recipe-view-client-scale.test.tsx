// M25.1: scaling is a pure view over the loader's document. The loaders no
// longer depend on `?servings=`, so a step on the servings control re-renders
// the page from what is already in memory; the amounts it shows must still be
// exactly the ones `getRecipe({ servings })` would have returned.
//
// `getRecipe` is wrapped in the mock factory with a counter, so "makes no
// server call" is a call count that does not move across a servings change.
import { afterEach, describe, expect, test, vi } from "vitest";
import { ingredientLineParts } from "../../src/components/IngredientRow";
import { formatIngredient } from "../../src/domain/format";
import type { Recipe } from "../../src/domain/recipe";
import { Route as CookRoute } from "../../src/routes/recipes/$slug/cook";
import { Route as ViewRoute } from "../../src/routes/recipes/$slug/index";
import { createRecipe, getRecipe } from "../../src/server/recipes";
import { renderRoute, renderRouter, testRouter } from "../helpers/routes";
import { callServerFn, useTempDataDir } from "../helpers/server";

const calls = vi.hoisted(() => ({ getRecipe: 0 }));

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../src/server/timeline", local);
vi.mock("../../src/server/units", local);
vi.mock("../../src/server/recipes", async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../helpers/server");
  const mod = runLocally(await importOriginal());
  const original = mod.getRecipe as (opts?: unknown) => unknown;
  const counted = (opts?: unknown) => {
    calls.getRecipe += 1;
    return original(opts);
  };
  return { ...mod, getRecipe: Object.assign(counted, original) };
});

useTempDataDir();
afterEach(() => {
  calls.getRecipe = 0;
  delete (globalThis as { window?: unknown }).window;
});

const food = (name: string, pluralName: string | null = null) => ({ id: crypto.randomUUID(), name, pluralName });

async function seedTart() {
  return callServerFn(createRecipe, {
    name: "Lemon tart",
    recipeServings: 4,
    recipeYieldQuantity: 1,
    recipeYield: "tart",
    parts: [
      {
        name: "Pastry",
        ingredients: [
          { quantity: 200, food: food("flour") },
          { quantity: 1, food: food("vanilla pod", "vanilla pods"), fixed: true },
        ],
        steps: [{ text: "Rub the butter into the flour." }],
      },
      {
        name: "Filling",
        ingredients: [
          { quantity: 3, food: food("lemon", "lemons") },
          { quantity: null, food: food("salt"), note: "to taste" },
        ],
        steps: [{ text: "Whisk everything together." }],
      },
    ],
  });
}

/** Every amount the page rendered, in document order. */
function amountsInHtml(html: string): string[] {
  return [...html.matchAll(/data-testid="ingredient-amount">([^<]*)</g)].map((match) => (match[1] ?? "").trim());
}

/** Every amount the given document would render, in document order. */
function amountsInDoc(doc: Recipe): string[] {
  return doc.parts.flatMap((part) => part.ingredients.map((i) => ingredientLineParts(i).amount)).filter((amount) => amount !== "");
}

describe("the page scales the stored document the way the server would", () => {
  for (const servings of [3, 7, 8, 2.5]) {
    test(`?servings=${servings} shows the amounts getRecipe({ servings: ${servings} }) returns`, async () => {
      await seedTart();
      const fromServer = await callServerFn(getRecipe, { slug: "lemon-tart", servings });
      const html = await renderRoute(`/recipes/lemon-tart?servings=${servings}`);
      expect(amountsInHtml(html)).toEqual(amountsInDoc(fromServer));
      expect(html).toContain(`Serves ${Number(servings.toFixed(2))}`);
    });

    test(`cook mode at ?servings=${servings} shows the same amounts as the server's document`, async () => {
      await seedTart();
      const fromServer = await callServerFn(getRecipe, { slug: "lemon-tart", servings });
      const html = await renderRoute(`/recipes/lemon-tart/cook?step=0&servings=${servings}`);
      // Card 0 is the first part's ingredient list, in large type.
      for (const ingredient of fromServer.parts[0]?.ingredients ?? []) {
        expect(html).toContain(`>${formatIngredient(ingredient)}<`);
      }
      expect(html).toContain(`value="${Number(servings.toFixed(2))}"`);
    });
  }

  test("no servings param renders the stored amounts, unscaled and unmarked", async () => {
    await seedTart();
    const stored = await callServerFn(getRecipe, { slug: "lemon-tart" });
    const html = await renderRoute("/recipes/lemon-tart");
    expect(amountsInHtml(html)).toEqual(amountsInDoc(stored));
    expect(html).not.toContain('data-scaled="true"');
  });

  test("a recipe with no servings recorded is left as stored, as the server leaves it", async () => {
    await callServerFn(createRecipe, {
      name: "Toast",
      parts: [{ name: "", ingredients: [{ quantity: 1, food: food("bread slice", "bread slices") }], steps: [{ text: "Toast it." }] }],
    });
    const html = await renderRoute("/recipes/toast?servings=8");
    expect(amountsInHtml(html)).toEqual(["1"]);
    expect(html).not.toContain('data-scaled="true"');
  });
});

describe("stepping servings makes no server call", () => {
  // The client router only refetches a match whose id or loader deps changed
  // (or one it was told to invalidate); a `stay` navigation to a new href
  // keeps what it has. So "no server call" is: the servings param is not part
  // of either loader's deps, and stepping it leaves the match identical.
  // Asserted structurally because vitest runs the router's server load path,
  // which reloads every match on every `router.load()` whatever the deps.
  test("neither loader declares a servings dependency", () => {
    expect(ViewRoute.options.loaderDeps).toBeUndefined();
    expect(CookRoute.options.loaderDeps).toBeUndefined();
  });

  test("the view page's match is unchanged by a servings step, and the page rescales", async () => {
    await seedTart();
    const router = testRouter("/recipes/lemon-tart");
    const before = await renderRouter(router);
    const first = router.state.matches.at(-1);
    expect(calls.getRecipe).toBe(1);
    expect(before).toContain("Serves 4");

    // What plus does: a replace navigation with a new servings param.
    await router.navigate({ to: "/recipes/$slug", params: { slug: "lemon-tart" }, search: { servings: 5 }, replace: true });
    const second = router.state.matches.at(-1);

    // Same match, same (empty) deps: nothing for the client router to refetch.
    expect(second?.id).toBe(first?.id);
    expect(second?.loaderDeps).toEqual(first?.loaderDeps);
    expect(JSON.stringify(second?.loaderDeps ?? "")).not.toContain("servings");
    expect(second?.id).not.toContain("servings");

    const after = await renderRouter(router);
    expect(after).toContain("Serves 5");
    expect(after).toContain('data-scaled="true"');
    expect(amountsInHtml(after)).toEqual(amountsInDoc(await callServerFn(getRecipe, { slug: "lemon-tart", servings: 5 })));
  });

  test("cook mode's match is unchanged by a servings step, and the deck rescales", async () => {
    await seedTart();
    const router = testRouter("/recipes/lemon-tart/cook?step=0");
    await renderRouter(router);
    const first = router.state.matches.at(-1);

    await router.navigate({ to: "/recipes/$slug/cook", params: { slug: "lemon-tart" }, search: { step: 0, servings: 8 }, replace: true });
    const second = router.state.matches.at(-1);

    expect(second?.id).toBe(first?.id);
    expect(second?.loaderDeps).toEqual(first?.loaderDeps);
    expect(second?.id).not.toContain("servings");

    const after = await renderRouter(router);
    expect(after).toContain(">400 flour<");
  });
});
