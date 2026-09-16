// The restyle read (M37.4): the prompt, the answer parser, the part pairing,
// and the whole pass against an injected runner. No provider is ever called —
// a test that spends a request is not a test — so every case drives
// `runRestyle` with a fake runner, or the fetch runner with a fake `fetch`.

import { isNotFound } from "@tanstack/react-router";
import { afterEach, describe, expect, test, vi } from "vitest";
import recipes from "../../../src/db/models/recipe/repo";
import type { Recipe, RecipeInput } from "../../../src/domain/recipe";
import { AiError, type AiRunner } from "../../../src/server/ai/client";
import { applyRestyle, createRestyleRunner, restoreSteps, restyleSettings, restyleSteps, runRestyle } from "../../../src/server/ai/restyle";
import {
  FIXED_RESTYLE_LINE,
  matchParts,
  parseRestyleAnswer,
  partsWithSteps,
  promptParts,
  RESTYLE_JSON_SCHEMA,
  RestyledPartSchema,
  restylePrompt,
  withEmptyParts,
} from "../../../src/server/ai/restylePrompt";
import { createRecipe, getRecipe } from "../../../src/server/fns/recipes";
import { listStyleRules } from "../../../src/server/fns/style";
import { callServerFn, useTempDataDir } from "../../helpers/server";

useTempDataDir();

const ids = {
  butter: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  syrup: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
};

const food = (id: string, name: string, pluralName: string | null = null) => ({
  id,
  name,
  pluralName,
  aliases: [],
  aisle: null,
  recipeId: null,
  skipShopping: false,
});

/** Two parts, so the pairing has something to get wrong: a main body and a named one. */
function doc(): RecipeInput {
  return {
    name: "Anzac biscuits",
    recipeServings: 24,
    parts: [
      {
        name: "",
        ingredients: [
          { quantity: 125, food: food(ids.butter, "butter"), fixed: false },
          { quantity: null, note: "a pinch of salt" },
        ],
        steps: [{ text: "Heat the oven to 180°C." }, { text: "Melt the butter." }, { text: "Bake for 15 minutes until golden." }],
      },
      {
        name: "Golden syrup mixture",
        ingredients: [{ quantity: 2, food: food(ids.syrup, "golden syrup"), fixed: false }],
        steps: [{ text: "Warm the golden syrup for 2 minutes." }],
      },
    ],
  };
}

/** The saved recipe, as `runRestyle` reads it. */
async function saved(): Promise<Recipe> {
  return await callServerFn(createRecipe, doc());
}

/** A runner that answers with `content` and records what it was asked. */
function fakeRunner(content: string): AiRunner & { calls: { prompt: string; timeoutMs: number }[] } {
  const calls: { prompt: string; timeoutMs: number }[] = [];
  const run = (async (prompt, timeoutMs) => {
    calls.push({ prompt, timeoutMs });
    return content;
  }) as AiRunner & { calls: typeof calls };
  run.calls = calls;
  return run;
}

/** A chat completion envelope carrying `content`. */
const completion = (content: string) => ({ choices: [{ message: { content } }] });

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return Object.assign(fetcher, { calls });
}

/** The answer the model would give if it did everything right: same parts, same names, every fact kept. */
const GOOD = {
  parts: [
    {
      name: "",
      steps: ["Heat the oven to 180°C and melt the butter.", "Bake for 15 minutes, until golden."],
    },
    { name: "Golden syrup mixture", steps: ["Warm the golden syrup for 2 minutes."] },
  ],
};

afterEach(() => {
  delete process.env.AI_RESTYLE_MODEL;
  delete process.env.AI_MODEL;
  delete process.env.AI_API_KEY;
  delete process.env.AI_BASE_URL;
  vi.unstubAllGlobals();
});

describe("the prompt", () => {
  const parts = [
    { name: "", ingredients: ["125 g butter"], steps: ["Melt the butter.", "Bake for 15 minutes."] },
    { name: "Topping", ingredients: ["2 tbsp golden syrup"], steps: ["Warm the syrup."] },
  ];

  test("opens with the fixed line, which is not one of the statements", () => {
    const prompt = restylePrompt({ rules: ["Imperative voice."], parts });
    expect(prompt.split("\n")[1]).toBe(FIXED_RESTYLE_LINE);
    expect(FIXED_RESTYLE_LINE).toMatch(/never converted, rounded or dropped/);
    expect(prompt.indexOf(FIXED_RESTYLE_LINE)).toBeLessThan(prompt.indexOf("Imperative voice."));
  });

  test("lists the ticked statements numbered, in the order given", () => {
    const prompt = restylePrompt({ rules: ["One action per step.", "Imperative voice.", "No chatter."], parts });
    expect(prompt).toContain("1. One action per step.");
    expect(prompt).toContain("2. Imperative voice.");
    expect(prompt).toContain("3. No chatter.");
  });

  test("with nothing ticked it says so rather than leaving an empty list", () => {
    const prompt = restylePrompt({ rules: [], parts });
    expect(prompt).toMatch(/no statements are ticked/i);
  });

  test("carries each part's name, its ingredient lines and its steps, in order", () => {
    const prompt = restylePrompt({ rules: [], parts });
    expect(prompt).toContain("(the recipe's main body)");
    expect(prompt).toContain('PART "Topping"');
    expect(prompt).toContain("- 125 g butter");
    expect(prompt).toContain("- 2 tbsp golden syrup");
    expect(prompt).toContain("1. Melt the butter.");
    expect(prompt).toContain("2. Bake for 15 minutes.");
    expect(prompt.indexOf("125 g butter")).toBeLessThan(prompt.indexOf("2 tbsp golden syrup"));
  });

  test("asks for the same parts in the same order, steps only, as JSON", () => {
    const prompt = restylePrompt({ rules: [], parts });
    expect(prompt).toMatch(/same parts, in the same order/);
    expect(prompt).toMatch(/Rewrite `steps` only/);
    expect(prompt).toMatch(/Answer with the JSON only/);
  });

  test("a part with no ingredients or no steps says so", () => {
    const prompt = restylePrompt({ rules: [], parts: [{ name: "Empty", ingredients: [], steps: [] }] });
    expect(prompt).toContain("INGREDIENTS:\n(none)");
    expect(prompt).toContain("STEPS:\n(none)");
  });

  test("ingredient lines are formatted the way the recipe page formats them, falling back to the raw line", () => {
    const lines = promptParts([
      {
        id: "p",
        name: "",
        ingredients: [
          {
            id: "i1",
            quantity: 125,
            unit: null,
            food: { ...food(ids.butter, "butter"), conversions: [] },
            note: "",
            originalText: "",
            fixed: false,
          },
          { id: "i2", quantity: null, unit: null, food: null, note: "", originalText: "  a pinch of salt  ", fixed: false },
        ],
        steps: [{ id: "s", text: "Melt.", ingredientIds: [], image: null }],
      },
    ]);
    expect(lines).toEqual([{ name: "", ingredients: ["125 butter (food: butter)", "a pinch of salt"], steps: ["Melt."] }]);
  });

  test("anchors the rewrite to the author's step boundaries and to the marked food names", () => {
    const prompt = restylePrompt({ rules: ["Plain words."], parts });
    expect(prompt).toMatch(/keep the author's step boundaries/);
    expect(prompt).not.toMatch(/may be merged or split/);
    expect(prompt).toMatch(/food name marked `\(food: …\)`/);
  });
});

describe("empty parts", () => {
  const withSteps = (name: string, ...texts: string[]) => ({
    id: name,
    name,
    ingredients: [],
    steps: texts.map((text) => ({ id: text, text, ingredientIds: [], image: null })),
  });
  const body = withSteps("");
  const sauce = withSteps("Sauce", "Simmer 10 minutes.");
  const topping = withSteps("Topping", "Melt the butter.");

  test("are not sent: only parts with steps go in the prompt", () => {
    expect(partsWithSteps([body, sauce, topping]).map((part) => part.name)).toEqual(["Sauce", "Topping"]);
  });

  test("come back as themselves, in the recipe's positions", () => {
    const answered = [
      { name: "Sauce", steps: ["Simmer for 10 minutes."] },
      { name: "Topping", steps: ["Melt the butter gently."] },
    ];
    expect(withEmptyParts([body, sauce, topping], answered)).toEqual([{ name: "", steps: [] }, answered[0], answered[1]]);
    expect(withEmptyParts([sauce, body], [answered[0]!])).toEqual([answered[0], { name: "", steps: [] }]);
  });

  test("an answer with the wrong count for the parts asked is malformed, and says how many were asked", () => {
    let caught: unknown;
    try {
      withEmptyParts([body, sauce, topping], [{ name: "Sauce", steps: [] }]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AiError);
    expect((caught as AiError).kind).toBe("malformed");
    expect((caught as AiError).message).toMatch(/1 part where the recipe has 2 with steps/);
  });

  test("runRestyle pairs a two-part answer with a three-part recipe whose main body has no steps", async () => {
    const input = doc();
    const recipe = await callServerFn(createRecipe, {
      ...input,
      parts: [{ ...input.parts[0]!, steps: [] }, input.parts[1]!, { name: "Topping", ingredients: [], steps: [{ text: "Melt the butter." }] }],
    });
    const run = fakeRunner(JSON.stringify({ parts: [GOOD.parts[1], { name: "Topping", steps: ["Melt the butter slowly."] }] }));
    const { parts, check } = await runRestyle(recipe, ["Plain words."], { run });
    expect(run.calls[0]!.prompt).not.toContain("main body");
    expect(parts.map((part) => part.name)).toEqual(["", "Golden syrup mixture", "Topping"]);
    expect(parts[0]).toEqual({ name: "", steps: [] });
    expect(check.ok).toBe(true);
    expect(check.parts).toHaveLength(3);

    // Applying that answer leaves the empty part as it was: no kept steps, so `authorSteps` does not list it.
    const written = await callServerFn(applyRestyle, { id: recipe.id, parts: parts.map((part) => ({ name: part.name, steps: [...part.steps] })) });
    expect(written.restyledAt).not.toBeNull();
    const kept = recipes.ref(recipe.id).authorSteps();
    expect([...kept.keys()]).toEqual([recipe.parts[1]!.id, recipe.parts[2]!.id]);
  });
});

describe("the answer's schema", () => {
  test("the JSON Schema names exactly the fields the zod schema does, and requires all of them", () => {
    const zodKeys = Object.keys(RestyledPartSchema.shape).sort();
    const item = RESTYLE_JSON_SCHEMA.properties.parts.items;
    expect(Object.keys(item.properties).sort()).toEqual(zodKeys);
    expect([...item.required].sort()).toEqual(zodKeys);
    expect(item.additionalProperties).toBe(false);
    expect(RESTYLE_JSON_SCHEMA.additionalProperties).toBe(false);
    expect([...RESTYLE_JSON_SCHEMA.required]).toEqual(["parts"]);
  });

  test("a fenced answer is read, and prose is malformed", () => {
    expect(parseRestyleAnswer("```json\n" + JSON.stringify(GOOD) + "\n```")).toHaveLength(2);
    const caught = (() => {
      try {
        parseRestyleAnswer("Sure! Here is your recipe.");
      } catch (cause) {
        return cause;
      }
    })();
    expect(caught).toBeInstanceOf(AiError);
    expect((caught as AiError).kind).toBe("malformed");
  });
});

describe("the model", () => {
  test("AI_RESTYLE_MODEL overrides the model for this pass and defaults to AI_MODEL", () => {
    process.env.AI_MODEL = "import-model";
    expect(restyleSettings().model).toBe("import-model");
    process.env.AI_RESTYLE_MODEL = "big-model";
    expect(restyleSettings().model).toBe("big-model");
  });

  test("the request asks for the restyle schema and the restyle model", async () => {
    process.env.AI_API_KEY = "secret";
    process.env.AI_BASE_URL = "https://provider.test/v1";
    process.env.AI_MODEL = "import-model";
    process.env.AI_RESTYLE_MODEL = "big-model";
    const fetcher = fakeFetch(200, completion(JSON.stringify(GOOD)));
    await createRestyleRunner(fetcher)("PROMPT", 1000);
    const body = JSON.parse(String(fetcher.calls[0]!.init?.body)) as Record<string, unknown>;
    expect(body.model).toBe("big-model");
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "restyle", schema: RESTYLE_JSON_SCHEMA, strict: true },
    });
  });
});

describe("runRestyle", () => {
  test("an answer that keeps every fact passes the check, and nothing is written", async () => {
    const recipe = await saved();
    const run = fakeRunner(JSON.stringify(GOOD));
    const { parts, check } = await runRestyle(recipe, ["One action per step."], { run });

    expect(check.ok).toBe(true);
    expect(check.missingFacts).toEqual([]);
    expect(check.missingFoods).toEqual([]);
    expect(parts.map((part) => part.name)).toEqual(["", "Golden syrup mixture"]);
    expect(parts[0]!.steps).toEqual(GOOD.parts[0]!.steps);
    // The rules and the recipe both reached the prompt.
    expect(run.calls[0]!.prompt).toContain("1. One action per step.");
    expect(run.calls[0]!.prompt).toContain("Heat the oven to 180°C.");
    // Nothing written: the recipe still has the steps it was saved with.
    const again = await saved();
    expect(again.parts[0]!.steps.map((step) => step.text)).toEqual(doc().parts[0]!.steps!.map((step) => step.text));
  });

  test("a dropped number is reported rather than thrown", async () => {
    const recipe = await saved();
    const dropped = {
      parts: [
        { name: "", steps: ["Heat the oven and melt the butter.", "Bake until golden."] },
        { name: "Golden syrup mixture", steps: ["Warm the golden syrup for 2 minutes."] },
      ],
    };
    const { parts, check } = await runRestyle(recipe, [], { run: fakeRunner(JSON.stringify(dropped)) });
    expect(parts).toHaveLength(2);
    expect(check.ok).toBe(false);
    expect(check.missingFacts).toEqual(["180c", "15min"]);
    expect(check.parts[1]!.ok).toBe(true);
  });

  test("a missing part is malformed: the pairing is verified, never assumed", async () => {
    const recipe = await saved();
    const short = { parts: [{ name: "", steps: ["Heat the oven to 180°C and bake for 15 minutes."] }] };
    const caught = await runRestyle(recipe, [], { run: fakeRunner(JSON.stringify(short)) }).catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(AiError);
    expect((caught as AiError).kind).toBe("malformed");
    expect((caught as AiError).message).toMatch(/1 part where the recipe has 2/);
  });

  test("a renamed part is malformed, but a recased one is not", async () => {
    const recipe = await saved();
    const renamed = {
      parts: [
        { name: "", steps: ["Heat the oven to 180°C, melt the butter, bake 15 minutes."] },
        { name: "Syrup", steps: ["Warm the golden syrup for 2 minutes."] },
      ],
    };
    const caught = await runRestyle(recipe, [], { run: fakeRunner(JSON.stringify(renamed)) }).catch((cause: unknown) => cause);
    expect((caught as AiError).kind).toBe("malformed");

    const recased = { parts: [GOOD.parts[0]!, { name: "  GOLDEN SYRUP MIXTURE ", steps: GOOD.parts[1]!.steps }] };
    const { check } = await runRestyle(recipe, [], { run: fakeRunner(JSON.stringify(recased)) });
    expect(check.ok).toBe(true);
  });

  test("matchParts passes a matching answer and the runner's own failures come through untouched", async () => {
    const recipe = await saved();
    expect(() => matchParts(recipe.parts, GOOD.parts)).not.toThrow();

    const boom: AiRunner = async () => {
      throw new AiError("timeout", "The model took too long to answer.");
    };
    const caught = await runRestyle(recipe, [], { run: boom }).catch((cause: unknown) => cause);
    expect((caught as AiError).kind).toBe("timeout");
  });
});

describe("applyRestyle and restoreSteps", () => {
  test("writes the accepted steps, keeps the author's, links them again and stamps the recipe", async () => {
    const recipe = await saved();

    const after = await callServerFn(applyRestyle, { id: recipe.id, parts: GOOD.parts });

    expect(after.parts.map((part) => part.steps.map((step) => step.text))).toEqual(GOOD.parts.map((part) => part.steps));
    expect(after.restyledAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    // The step card's rows: the merged first step names the butter, so it links it.
    const butter = after.parts[0]!.ingredients[0]!.id;
    expect(after.parts[0]!.steps[0]!.ingredientIds).toEqual([butter]);
    expect(after.parts[1]!.steps[0]!.ingredientIds).toEqual([after.parts[1]!.ingredients[0]!.id]);
    // Everything but the steps is untouched.
    expect(after.parts.map((part) => part.ingredients)).toEqual(recipe.parts.map((part) => part.ingredients));

    // And the original comes back, stamp and all.
    const restored = await callServerFn(restoreSteps, { id: recipe.id });
    expect(restored.parts.map((part) => part.steps.map((step) => step.text))).toEqual(recipe.parts.map((part) => part.steps.map((step) => step.text)));
    expect(restored.restyledAt).toBeNull();
  });

  test("an answer with the wrong number of parts is refused", async () => {
    const recipe = await saved();
    const caught = await callServerFn(applyRestyle, { id: recipe.id, parts: [GOOD.parts[0]!] }).catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(Error);
    expect(String(caught)).toContain("1 part where the recipe has 2");
    expect((await callServerFn(getRecipe, { slug: recipe.slug }))!.restyledAt).toBeNull();
  });

  test("an unknown recipe is not found, either way", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    expect(isNotFound(await callServerFn(applyRestyle, { id, parts: [] }).catch((cause: unknown) => cause))).toBe(true);
    expect(isNotFound(await callServerFn(restoreSteps, { id }).catch((cause: unknown) => cause))).toBe(true);
  });
});

describe("restyleSteps", () => {
  test("takes a recipe id and rule ids, and answers with the parts and the check", async () => {
    const recipe = await saved();
    const rules = await callServerFn(listStyleRules);
    process.env.AI_API_KEY = "secret";
    const fetcher = fakeFetch(200, completion(JSON.stringify(GOOD)));
    vi.stubGlobal("fetch", fetcher);

    const result = await callServerFn(restyleSteps, { id: recipe.id, ruleIds: [rules[1]!.id, rules[0]!.id] });
    expect(result.check.ok).toBe(true);
    expect(result.parts.map((part) => part.name)).toEqual(["", "Golden syrup mixture"]);

    // The ticked statements went in the guide's order, not the caller's, and
    // only those two did.
    const prompt = String(JSON.parse(String(fetcher.calls[0]!.init?.body)).messages[0].content);
    expect(prompt).toContain(`1. ${rules[0]!.text}`);
    expect(prompt).toContain(`2. ${rules[1]!.text}`);
    expect(prompt).not.toContain(rules[2]!.text);
  });

  test("an unknown recipe is not found", async () => {
    const caught = await callServerFn(restyleSteps, {
      id: "00000000-0000-4000-8000-000000000000",
      ruleIds: [],
    }).catch((cause: unknown) => cause);
    expect(isNotFound(caught)).toBe(true);
  });
});
