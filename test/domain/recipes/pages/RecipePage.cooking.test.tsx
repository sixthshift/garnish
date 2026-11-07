// The recipe page cooked from (decisions.md row 214): one header line in
// place of the bars and the left page, tonight's changes drawn in place, and
// Finish to the review; and the review itself.
import { afterEach, expect, test, vi } from "vitest";
import { adjustCooking, startCooking } from "../../../../src/api/rpc/cooking";
import { createRecipe } from "../../../../src/api/rpc/recipes";
import cookingRepo from "../../../../src/db/models/cooking/repo";
import { firstUndoneStep } from "../../../../src/domain/recipes/components/cooking/CookingContext";
import { startingComment } from "../../../../src/domain/recipes/pages/ReviewPage";
import type { RecipeInput } from "../../../../src/domain/recipes/recipe";
import { elementHtml, renderRoute } from "../../../helpers/routes";
import { callServerFn, useTempDataDir } from "../../../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../../../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../../../src/api/rpc/timeline", local);
vi.mock("../../../../src/api/rpc/units", local);
vi.mock("../../../../src/api/rpc/recipes", local);
vi.mock("../../../../src/api/rpc/cooking", local);
vi.mock("../../../../src/api/rpc/ai", local);

useTempDataDir();
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  delete process.env.AI_PROVIDER;
  delete process.env.AI_API_KEY;
});

async function seedRagu() {
  const recipe = await callServerFn(createRecipe, {
    name: "Ragu",
    recipeServings: 4,
    parts: [
      {
        name: "",
        ingredients: [
          { quantity: 1, unit: null, food: { id: crypto.randomUUID(), name: "celery" }, note: "diced" },
          { quantity: 1000, food: { id: crypto.randomUUID(), name: "chuck beef" } },
        ],
        steps: [{ text: "Sear to brown." }, { text: "Slow cook 2 hrs." }],
      },
    ],
  } as RecipeInput);
  await callServerFn(startCooking, { recipeId: recipe.id, servings: null, choices: null });
  const celery = recipe.parts[0]!.ingredients[0]!;
  const slow = recipe.parts[0]!.steps[1]!;
  await callServerFn(adjustCooking, {
    recipeId: recipe.id,
    adjustment: { kind: "swap", ingredientId: celery.id, food: "carrot", quantity: null, unit: null, summary: "Celery → carrot" },
  });
  await callServerFn(adjustCooking, {
    recipeId: recipe.id,
    adjustment: { kind: "step", stepId: slow.id, text: "Slow cook 3 hrs.", summary: "Slow cook 3 hrs" },
  });
  return recipe;
}

test.each(["mobile", "desktop"] as const)("cooking on a %s: the header line, tonight's changes in place, Finish to the review", async (layout) => {
  await seedRagu();
  const html = await renderRoute("/recipes/ragu?cooking=true", layout);
  expect(html).toContain('data-testid="cooking-header"');
  expect(elementHtml(html, "cooking-header")).toContain("Ragu");
  expect(html).toContain('href="/recipes/ragu/review"');
  // The swap reads in place, the line it replaced struck under it.
  expect(html).toMatch(/<strong[^>]*>carrot<\/strong>/);
  expect(html).toContain('data-testid="tonight-was"');
  expect(html).toContain(">1 celery, diced<");
  expect(html).toContain("Slow cook 3 hrs.");
  expect(html).not.toContain("Slow cook 2 hrs.");
  // Neither the photo page nor the Made this button: Finish is the way out.
  expect(html).not.toContain('data-testid="left-page"');
  expect(html).not.toContain('data-testid="made-this"');
  if (layout === "mobile") expect(html).toContain('data-testid="cooking-bar"');
  else expect(html).toContain('data-testid="cooking-side"');
});

test("not cooking, the page is as it was and offers to resume the session", async () => {
  await seedRagu();
  const html = await renderRoute("/recipes/ragu", "desktop");
  expect(html).not.toContain('data-testid="cooking-header"');
  expect(html).toContain("Slow cook 2 hrs.");
  expect(html).toContain(">Resume cooking<");
});

test("the review lists tonight's changes as suggestions on their defaults", async () => {
  await seedRagu();
  const html = await renderRoute("/recipes/ragu/review", "desktop");
  expect(html).toContain("How did it go?");
  const kinds = [...html.matchAll(/data-testid="suggestion" data-kind="([^"]+)" data-decision="([^"]+)"/g)].map((m) => `${m[1]}:${m[2]}`);
  expect(kinds.sort()).toEqual(["step:keep", "swap:once"]);
  expect(html).toContain("Add as an alternative");
  expect(html).toContain("Just this time: Celery → carrot.");
});

test("the first step not ticked is the one being cooked", () => {
  const recipe = { parts: [{ steps: [{ id: "a" }, { id: "b" }] }, { steps: [{ id: "c" }] }] } as never;
  expect(firstUndoneStep(recipe, () => false)).toBe("a");
  expect(firstUndoneStep(recipe, (id) => id !== "c")).toBe("c");
  expect(firstUndoneStep(recipe, () => true)).toBeNull();
});

test("the review's comment opens with tonight's one-offs, then what the cook noted", () => {
  expect(
    startingComment("Just this time: no celery.", [
      { text: "Too salty.", origin: "cook" },
      { text: "Timer run long", origin: "timer" },
    ])
  ).toBe("Just this time: no celery.\nNoted: Too salty.");
  expect(startingComment("", [])).toBe("");
});

test.each(["mobile", "desktop"] as const)("with a model, a %s asks: the chat and its offers, taken or not", async (layout) => {
  process.env.AI_PROVIDER = "api";
  process.env.AI_API_KEY = "k";
  const recipe = await seedRagu();
  const session = cookingRepo.get(recipe.id)!;
  const taken = session.adjustments.find((adjustment) => adjustment.kind === "step")!;
  const at = new Date().toISOString();
  cookingRepo.say(recipe.id, [
    { id: crypto.randomUUID(), role: "cook", text: "beef isn't shredding", offers: [], at },
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "Give it another 30 minutes.",
      offers: [taken, { id: crypto.randomUUID(), kind: "tip", stepId: taken.stepId, tip: "Check with two forks.", summary: "Check with forks" }],
      at,
    },
  ]);
  const html = await renderRoute("/recipes/ragu?cooking=true", layout);
  if (layout === "desktop") {
    expect(html).toContain("Ask about this recipe");
    expect(html).toContain("beef isn&#x27;t shredding");
    expect(html).toContain("Give it another 30 minutes.");
    expect(html).toMatch(/data-testid="assistant-offer" data-taken="true"/);
    expect(html).toContain('aria-label="Use tonight: Check with forks"');
  } else {
    // A phone keeps the chat in a sheet behind Ask.
    expect(elementHtml(html, "cooking-bar")).toContain(">Ask<");
  }
});
