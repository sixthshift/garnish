// The restyle read (M37.4): the prompt, the answer parser, placing the lines,
// and the whole pass against an injected runner. No provider is ever called —
// a test that spends a request is not a test — so every case drives
// `runRestyle` with a fake runner, or the fetch runner with a fake `fetch`.

import { isNotFound } from "@tanstack/react-router";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createRecipe, getRecipe, listRecipes } from "../../../src/api/rpc/recipes";
import { listStyleRules } from "../../../src/api/rpc/style";
import recipes from "../../../src/db/models/recipe/repo";
import type { Recipe, RecipeInput } from "../../../src/domain/recipes/recipe";
import type { RestyledPart } from "../../../src/domain/recipes/style";
import { AiError } from "../../../src/server/ai/client";
import { apiProvider } from "../../../src/server/ai/provider/api";
import { applyRestyle, createRestyledRecipe, MAX_REVISIONS, restoreSteps, restyleDraft, restyleSteps, runRestyle } from "../../../src/server/ai/restyle";
import {
  AnsweredLineSchema,
  AnsweredPartSchema,
  FIXED_RESTYLE_LINE,
  foodMarker,
  parseRestyleAnswer,
  partsWithSteps,
  placeLines,
  promptParts,
  RESTYLE_JSON_SCHEMA,
  restylePrompt,
} from "../../../src/server/ai/restylePrompt";
import { fakeAi, useChosenModels } from "../../helpers/ai";
import { restyledPart, restyledStep } from "../../helpers/restyle";
import { callServerFn, useTempDataDir } from "../../helpers/server";

const chosen = useChosenModels({ restyle: "test-model" });

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

/** Parts as the model writes them: each line by its number from 1 with its note. */
function answer(parts: readonly RestyledPart[]) {
  return {
    parts: parts.map((part) => ({
      name: part.name,
      ingredients: part.rows.map((row, i) => ({ line: row + 1, note: part.notes[i] ?? "" })),
      steps: part.steps,
    })),
  };
}

/** The rewrite a model would give if it did everything right: same parts, same names, every fact kept. */
const GOOD = {
  parts: [
    { ...restyledPart("", ["Heat the oven to 180°C and melt the butter.", "Bake for 15 minutes, until golden."], [0, 1]), notes: ["", "a pinch of salt"] },
    restyledPart("Golden syrup mixture", ["Warm the golden syrup for 2 minutes."], [2]),
  ],
};

/** GOOD as the model's JSON. */
const GOOD_JSON = JSON.stringify(answer(GOOD.parts));

afterEach(() => {
  delete process.env.AI_PROVIDER;
  delete process.env.AI_API_KEY;
  delete process.env.AI_BASE_URL;
  vi.unstubAllGlobals();
});

describe("the prompt", () => {
  const promptStep = (text: string, title = "", summary = "") => ({ title, text, summary });
  const parts = [
    { name: "", ingredients: ["125 g butter"], steps: [promptStep("Melt the butter."), promptStep("Bake for 15 minutes.")] },
    { name: "Topping", ingredients: ["2 tbsp golden syrup"], steps: [promptStep("Warm the syrup.")] },
  ];

  test("opens with the fixed line, which is not one of the statements", () => {
    const prompt = restylePrompt({ rules: ["Imperative voice."], parts });
    expect(prompt.split("\n")[1]).toBe(FIXED_RESTYLE_LINE);
    expect(FIXED_RESTYLE_LINE).toMatch(/never converted, rounded or dropped/);
    expect(prompt.indexOf(FIXED_RESTYLE_LINE)).toBeLessThan(prompt.indexOf("Imperative voice."));
  });

  test("asks for the original read for its intent before writing, and the rewrite read back against it and the house style before answering", () => {
    const prompt = restylePrompt({ rules: ["Imperative voice."], parts });
    expect(prompt).toMatch(/exactly what the author's method does/);
    expect(prompt).toMatch(/read the original as a cook would/);
    expect(prompt).toMatch(/read your rewrite back against the original and against each house style statement, as an editor who did not write it/);
    expect(prompt).toContain("the water, hot");
    expect(prompt.indexOf("as an editor")).toBeLessThan(prompt.indexOf("RECIPE:"));
  });

  test("where the house style lays the recipe out by what is made, asks for the parts decided first, sorting headings turned into what they make, and parts in the order they are made", () => {
    const prompt = restylePrompt({ rules: [], parts });
    expect(prompt).toMatch(/decide the parts before writing any step, and do not keep the author's headings out of habit/);
    expect(prompt).toContain('"For the rest of the dish"');
    expect(prompt).toMatch(
      /a part whose result a later step uses \(a marinade, a sauce mixed ahead\) comes before that step's part, and "To serve" comes last/
    );
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
    // Lines are numbered through the whole recipe, so a line can be moved by its number.
    expect(prompt).toContain("#1 125 g butter");
    expect(prompt).toContain("#2 2 tbsp golden syrup");
    expect(prompt).toContain("1. Melt the butter.");
    expect(prompt).toContain("2. Bake for 15 minutes.");
    expect(prompt.indexOf("125 g butter")).toBeLessThan(prompt.indexOf("2 tbsp golden syrup"));
  });

  test("asks for the parts as the house style lays them out — the recipe's own unless a statement says otherwise — each line once, as JSON", () => {
    const prompt = restylePrompt({ rules: [], parts });
    expect(prompt).toMatch(/as the house style lays them out/);
    expect(prompt).toMatch(/Where no statement asks for a different layout, answer with the same parts, in the same order/);
    expect(prompt).toMatch(/Put every line in exactly one part, by its number/);
    expect(prompt).toMatch(/Each step is three fields/);
    expect(prompt).toMatch(/Never change a quantity, a unit or a food/);
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
            quantityMax: null,
            unit: null,
            food: { ...food(ids.butter, "butter"), conversions: [] },
            note: "",
            originalText: "",
            fixed: false,
            alternatives: [],
          },
          {
            id: "i2",
            quantity: null,
            quantityMax: null,
            unit: null,
            food: null,
            note: "",
            originalText: "  a pinch of salt  ",
            fixed: false,
            alternatives: [],
          },
        ],
        steps: [{ id: "s", text: "Melt.", title: "", summary: "", ingredientIds: [], image: null }],
      },
    ]);
    expect(lines).toEqual([{ name: "", ingredients: ["125 butter (food: butter)", "a pinch of salt"], steps: [{ title: "", text: "Melt.", summary: "" }] }]);
  });

  test("anchors the rewrite to the author's step boundaries and to the marked food names", () => {
    const prompt = restylePrompt({ rules: ["Plain words."], parts });
    expect(prompt).toMatch(/keep the author's step boundaries/);
    expect(prompt).not.toMatch(/may be merged or split/);
    expect(prompt).toMatch(/food name marked `\(food: …\)`/);
  });
});

describe("placing the lines", () => {
  const part = (name: string, lines: string[], ...texts: string[]) => ({
    id: name,
    name,
    ingredients: lines.map((note, i) => ({
      id: `${name}:${i}`,
      quantity: null,
      quantityMax: null,
      unit: null,
      food: null,
      note,
      originalText: `line ${name} ${i}`,
      fixed: false,
      alternatives: [],
    })),
    steps: texts.map((text) => ({ id: text, text, title: "", summary: "", ingredientIds: [], image: null })),
  });
  // Rows by place: the body holds 0 and 1, Sauce 2, Topping none.
  const body = part("", ["", "sifted"]);
  const sauce = part("Sauce", ["cold"], "Simmer 10 minutes.");
  const topping = part("Topping", [], "Melt the butter.");
  const answered = (name: string, lines: [number, string][], ...texts: string[]) => ({
    name,
    ingredients: lines.map(([line, note]) => ({ line, note })),
    steps: texts.map((text) => ({ title: "", text, summary: "" })),
  });

  test("partsWithSteps names the parts with something to rewrite", () => {
    expect(partsWithSteps([body, sauce, topping]).map((p) => p.name)).toEqual(["Sauce", "Topping"]);
  });

  test("an answer placing every line is taken as it is, its numbers turned into rows", () => {
    const placed = placeLines(
      [body, sauce, topping],
      [
        answered("", [
          [1, ""],
          [2, "sifted"],
        ]),
        answered("Sauce", [[3, "cold"]], "Simmer."),
        answered("Topping", [], "Melt."),
      ]
    );
    expect(placed.map((p) => [p.name, p.rows, p.notes])).toEqual([
      ["", [0, 1], ["", "sifted"]],
      ["Sauce", [2], ["cold"]],
      ["Topping", [], []],
    ]);
  });

  test("an answer may move lines between parts and lay the recipe out afresh", () => {
    const placed = placeLines(
      [body, sauce, topping],
      [
        answered(
          "",
          [
            [3, "cold"],
            [1, ""],
          ],
          "Simmer.",
          "Melt."
        ),
        answered("To serve", [[2, "sifted"]], "Serve."),
      ]
    );
    expect(placed.map((p) => [p.name, p.rows])).toEqual([
      ["", [2, 0]],
      ["To serve", [1]],
    ]);
  });

  test("a line the answer leaves out goes back to its own part, and a part left out comes back where it was, with its notes", () => {
    const placed = placeLines([body, sauce, topping], [answered("Sauce", [[3, "cold"]], "Simmer."), answered("Topping", [], "Melt.")]);
    expect(placed).toEqual([
      { name: "", rows: [0, 1], notes: ["", "sifted"], steps: [] },
      { name: "Sauce", rows: [2], notes: ["cold"], steps: [{ title: "", text: "Simmer.", summary: "" }] },
      { name: "Topping", rows: [], notes: [], steps: [{ title: "", text: "Melt.", summary: "" }] },
    ]);
    const partly = placeLines(
      [body, sauce, topping],
      [answered("", [[2, "sifted"]]), answered("Sauce", [[3, "cold"]], "Simmer."), answered("Topping", [], "Melt.")]
    );
    expect(partly[0]).toMatchObject({ rows: [1, 0], notes: ["sifted", ""] });
  });

  test("a line named twice, or one the recipe does not have, is malformed", () => {
    const malformed = (parts: ReturnType<typeof answered>[]) => {
      try {
        placeLines([body, sauce, topping], parts);
      } catch (error) {
        return error as AiError;
      }
      throw new Error("expected a malformed answer");
    };
    expect(
      malformed([
        answered("", [
          [1, ""],
          [1, ""],
        ]),
      ]).message
    ).toMatch(/ingredient 1 in twice/);
    expect(malformed([answered("", [[4, ""]])]).message).toMatch(/ingredient 4, which the recipe does not have/);
    expect(malformed([answered("", [[0, ""]])]).kind).toBe("malformed");
  });

  test("a recipe with no steps at all is its own answer, and the model is not called", async () => {
    const input = doc();
    const recipe = await callServerFn(createRecipe, { ...input, parts: input.parts.map((part) => ({ ...part, steps: [] })) });
    const ai = fakeAi("never read");
    const { parts, check } = await runRestyle(recipe, ["Plain words."], { ai });
    expect(ai.calls).toEqual([]);
    // An untouched part answers with its own rows and notes, so the check sees it lining up.
    expect(parts).toEqual([
      { name: "", rows: [0, 1], notes: ["", "a pinch of salt"], steps: [] },
      { name: "Golden syrup mixture", rows: [2], notes: [""], steps: [] },
    ]);
    expect(check.ok).toBe(true);
  });

  test("runRestyle takes a two-part answer for a three-part recipe whose main body has no steps, and keeps its layout", async () => {
    const input = doc();
    const recipe = await callServerFn(createRecipe, {
      ...input,
      parts: [{ ...input.parts[0]!, steps: [] }, input.parts[1]!, { name: "Topping", ingredients: [], steps: [{ text: "Melt the butter." }] }],
    });
    const ai = fakeAi(JSON.stringify(answer([GOOD.parts[1]!, restyledPart("Topping", ["Melt the butter slowly."], [])])));
    const { parts, check } = await runRestyle(recipe, ["Plain words."], { ai });
    // The stepless main body is still sent, so the model reads the ingredients it holds.
    expect(ai.calls[0]!.prompt).toContain('PART "" (the recipe\'s main body)');
    expect(ai.calls[0]!.prompt).toContain("a pinch of salt");
    expect(parts.map((part) => part.name)).toEqual(["", "Golden syrup mixture", "Topping"]);
    expect(parts[0]).toEqual({ name: "", rows: [0, 1], notes: ["", "a pinch of salt"], steps: [] });
    expect(check.ok).toBe(true);
    expect(check.rebuilt).toBe(false);
    expect(check.parts).toHaveLength(3);

    const written = await callServerFn(applyRestyle, { id: recipe.id, parts: plain(parts) });
    expect(written.restyledAt).not.toBeNull();
    expect(written.parts.map((part) => part.id)).toEqual(recipe.parts.map((part) => part.id));
    expect(
      recipes
        .ref(recipe.id)
        .authorParts()!
        .map((part) => part.steps.map((step) => step.text))
    ).toEqual([[], ["Warm the golden syrup for 2 minutes."], ["Melt the butter."]]);
  });

  test("notes answered on a stepless main body are written, and its original notes kept", async () => {
    const input = doc();
    const recipe = await callServerFn(createRecipe, { ...input, parts: [{ ...input.parts[0]!, steps: [] }, input.parts[1]!] });
    const body = { name: "", rows: [0, 1], notes: ["sifted", "a pinch of salt"], steps: [] };
    const ai = fakeAi(JSON.stringify(answer([body, GOOD.parts[1]!])));
    const { parts } = await runRestyle(recipe, ["Plain words."], { ai });
    expect(parts[0]).toEqual(body);

    const written = await callServerFn(applyRestyle, { id: recipe.id, parts: plain(parts) });
    expect(written.parts[0]!.ingredients.map((row) => row.note)).toEqual(["sifted", "a pinch of salt"]);
    const restored = await callServerFn(restoreSteps, { id: recipe.id });
    expect(restored.parts[0]!.ingredients.map((row) => row.note)).toEqual(recipe.parts[0]!.ingredients.map((row) => row.note));
  });
});

/** Parts as `applyRestyle` takes them: plain copies, so a test cannot mutate what it was given. */
function plain(parts: readonly RestyledPart[]) {
  return parts.map((part) => ({ name: part.name, rows: [...part.rows], notes: [...part.notes], steps: part.steps.map((step) => ({ ...step })) }));
}

describe("the answer's schema", () => {
  test("the JSON Schema names exactly the fields the zod schema does, and requires all of them", () => {
    const zodKeys = Object.keys(AnsweredPartSchema.shape).sort();
    const item = RESTYLE_JSON_SCHEMA.properties.parts.items;
    expect(Object.keys(item.properties).sort()).toEqual(zodKeys);
    expect([...item.required].sort()).toEqual(zodKeys);
    expect(item.additionalProperties).toBe(false);
    const line = item.properties.ingredients.items;
    expect(Object.keys(line.properties).sort()).toEqual(Object.keys(AnsweredLineSchema.shape).sort());
    expect([...line.required].sort()).toEqual(Object.keys(AnsweredLineSchema.shape).sort());
    expect(RESTYLE_JSON_SCHEMA.additionalProperties).toBe(false);
    expect([...RESTYLE_JSON_SCHEMA.required]).toEqual(["parts"]);
  });

  test("a fenced answer is read, and prose is malformed", () => {
    expect(parseRestyleAnswer(`\`\`\`json\n${GOOD_JSON}\n\`\`\``)).toHaveLength(2);
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
  test("the model chosen for this pass is asked, and the import's is not", () => {
    chosen.import = "import-model";
    delete chosen.restyle;
    expect(() => apiProvider().model("restyle")).toThrow(/No Restyle model is selected/);
    chosen.restyle = "big-model";
    expect(apiProvider().model("restyle")).toBe("big-model");
  });

  test("the request asks for the restyle schema and the restyle model", async () => {
    process.env.AI_API_KEY = "secret";
    process.env.AI_BASE_URL = "https://provider.test/v1";
    chosen.import = "import-model";
    chosen.restyle = "big-model";
    const fetcher = fakeFetch(200, completion(GOOD_JSON));
    await runRestyle(await saved(), [], { ai: apiProvider(fetcher) });
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
    const ai = fakeAi(GOOD_JSON);
    const { parts, check } = await runRestyle(recipe, ["One action per step."], { ai });

    expect(check.ok).toBe(true);
    expect(check.missingFacts).toEqual([]);
    expect(check.missingFoods).toEqual([]);
    expect(parts.map((part) => part.name)).toEqual(["", "Golden syrup mixture"]);
    expect(parts[0]!.steps).toEqual(GOOD.parts[0]!.steps);
    // The rules and the recipe both reached the prompt.
    expect(ai.calls[0]!.prompt).toContain("1. One action per step.");
    expect(ai.calls[0]!.prompt).toContain("Heat the oven to 180°C.");
    // A rewrite the checks find nothing in is not sent back.
    expect(ai.calls).toHaveLength(1);
    // Nothing written: the recipe still has the steps it was saved with.
    const again = await saved();
    expect(again.parts[0]!.steps.map((step) => step.text)).toEqual(doc().parts[0]!.steps!.map((step) => step.text));
  });

  describe("a rewrite the checks find something in is sent back, while each revision is better, up to three times", () => {
    const dropped = () =>
      answer([
        restyledPart("", ["Heat the oven and melt the butter.", "Bake until golden."], [0, 1]),
        restyledPart("Golden syrup mixture", ["Warm the golden syrup for 2 minutes."], [2]),
      ]);

    test("with what it lost, the original, the house style and the rewrite; a better revision is taken", async () => {
      const recipe = await saved();
      const ai = fakeAi(async (request) => (request.schemaName === "restyle" ? JSON.stringify(dropped()) : GOOD_JSON));
      const result = await runRestyle(recipe, ["One action per step."], { ai });
      expect(ai.calls.map((call) => call.schemaName)).toEqual(["restyle", "restyle-revise"]);
      const revise = ai.calls[1]!.prompt;
      expect(revise).toContain(
        "- A number from the original's “Heat the oven to 180°C.” is not in the rewrite. Put it back, as the author wrote it, where it belongs."
      );
      expect(revise).toContain("1. One action per step.");
      expect(revise).toContain("Heat the oven to 180°C.");
      expect(revise).toContain("Bake until golden.");
      expect(revise).toMatch(/Change nothing else/);
      expect(result.check.ok).toBe(true);
      expect(result.parts[0]!.steps).toEqual(GOOD.parts[0]!.steps);
      expect(result.revisions).toEqual([{ problems: expect.arrayContaining([expect.stringContaining("Bake for 15 minutes until golden.")]), taken: true }]);
    });

    test("a revision that is no better, or that fails, leaves the first rewrite standing", async () => {
      const recipe = await saved();
      const same = await runRestyle(recipe, [], { ai: fakeAi(JSON.stringify(dropped())) });
      expect(same.check.missingFacts).toEqual(["180c", "15min"]);
      expect(same.revisions).toEqual([{ problems: expect.any(Array), taken: false }]);

      const failing = fakeAi(async (request) => {
        if (request.schemaName === "restyle") return JSON.stringify(dropped());
        throw new Error("The model took too long to answer.");
      });
      const failed = await runRestyle(recipe, [], { ai: failing });
      expect(failed.parts[0]!.steps.map((step) => step.text)).toEqual(["Heat the oven and melt the butter.", "Bake until golden."]);
      expect(failed.revisions?.map((revision) => revision.taken)).toEqual([false]);
    });

    test("a better revision that still has something is sent back again, with what is left", async () => {
      const recipe = await saved();
      const half = answer([
        restyledPart("", ["Heat the oven to 180°C and melt the butter.", "Bake until golden."], [0, 1]),
        restyledPart("Golden syrup mixture", ["Warm the golden syrup for 2 minutes."], [2]),
      ]);
      const replies = [dropped(), half, GOOD];
      const ai = fakeAi(async () => JSON.stringify(replies.shift()));
      const result = await runRestyle(recipe, [], { ai });
      expect(ai.calls.map((call) => call.schemaName)).toEqual(["restyle", "restyle-revise", "restyle-revise"]);
      // The second time round, only what the first revision left: the bake time, not the oven.
      expect(ai.calls[2]!.prompt).toContain("Bake for 15 minutes until golden.");
      expect(ai.calls[2]!.prompt).not.toContain("A number from the original's “Heat the oven to 180°C.”");
      expect(ai.calls[2]!.prompt).toContain("Heat the oven to 180°C and melt the butter.");
      expect(result.check.ok).toBe(true);
      expect(result.revisions?.map((revision) => revision.taken)).toEqual([true, true]);
    });

    test("stops after three revisions, keeping the best, even while each is better", async () => {
      const recipe = await saved();
      const idle = (n: number) =>
        answer([
          {
            ...GOOD.parts[0]!,
            steps: [...GOOD.parts[0]!.steps, ...["tray", "bowl", "pan", "spoon"].slice(0, n).map((thing) => restyledStep(`Set the ${thing} aside.`))],
          },
          GOOD.parts[1]!,
        ]);
      const replies = [idle(4), idle(3), idle(2), idle(1), GOOD];
      const ai = fakeAi(async () => JSON.stringify(replies.shift()));
      const result = await runRestyle(recipe, [], { ai });
      expect(ai.calls).toHaveLength(1 + MAX_REVISIONS);
      expect(MAX_REVISIONS).toBe(3);
      expect(result.revisions?.map((revision) => revision.taken)).toEqual([true, true, true]);
      expect(result.check.issues.map((issue) => issue.item)).toEqual(["Set the tray aside."]);
    });
  });

  test("a dropped number is reported rather than thrown", async () => {
    const recipe = await saved();
    const dropped = {
      parts: [
        restyledPart("", ["Heat the oven and melt the butter.", "Bake until golden."], [0, 1]),
        restyledPart("Golden syrup mixture", ["Warm the golden syrup for 2 minutes."], [2]),
      ],
    };
    const { parts, check } = await runRestyle(recipe, [], { ai: fakeAi(JSON.stringify(answer(dropped.parts))) });
    expect(parts).toHaveLength(2);
    expect(check.ok).toBe(false);
    expect(check.missingFacts).toEqual(["180c", "15min"]);
    expect(check.parts[1]!.ok).toBe(true);
  });

  test("a part the answer leaves out comes back with its lines, and the check reports the steps it lost", async () => {
    const recipe = await saved();
    const short = answer([restyledPart("", ["Heat the oven to 180°C and bake for 15 minutes."], [0, 1])]);
    const { parts, check } = await runRestyle(recipe, [], { ai: fakeAi(JSON.stringify(short)) });
    expect(parts.map((part) => [part.name, part.rows])).toEqual([
      ["", [0, 1]],
      ["Golden syrup mixture", [2]],
    ]);
    expect(check.ok).toBe(false);
    expect(check.missingFacts).toContain("2min");
  });

  test("a renamed part lays the recipe out afresh and is checked whole; a recased one keeps the layout", async () => {
    const recipe = await saved();
    const renamed = answer([GOOD.parts[0]!, { ...GOOD.parts[1]!, name: "Syrup" }]);
    const result = await runRestyle(recipe, [], { ai: fakeAi(JSON.stringify(renamed)) });
    expect(result.check.rebuilt).toBe(true);
    expect(result.check.ok).toBe(true);
    expect(result.check.parts).toHaveLength(1);

    const recased = answer([GOOD.parts[0]!, { ...GOOD.parts[1]!, name: "  GOLDEN SYRUP MIXTURE " }]);
    const { check } = await runRestyle(recipe, [], { ai: fakeAi(JSON.stringify(recased)) });
    expect(check.rebuilt).toBe(false);
    expect(check.ok).toBe(true);
  });

  test("the runner's own failures come through untouched", async () => {
    const recipe = await saved();
    const boom = fakeAi(async () => {
      throw new AiError("timeout", "The model took too long to answer.");
    });
    const caught = await runRestyle(recipe, [], { ai: boom }).catch((cause: unknown) => cause);
    expect((caught as AiError).kind).toBe("timeout");
  });
});

describe("applyRestyle and restoreSteps", () => {
  test("writes the accepted steps, keeps the author's, links them again and stamps the recipe", async () => {
    const recipe = await saved();

    const after = await callServerFn(applyRestyle, { id: recipe.id, parts: plain(GOOD.parts) });

    expect(after.parts.map((part) => part.steps.map((step) => step.text))).toEqual(GOOD.parts.map((part) => part.steps.map((step) => step.text)));
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

  test("parts that do not hold every row exactly once are refused", async () => {
    const recipe = await saved();
    const caught = await callServerFn(applyRestyle, { id: recipe.id, parts: plain(GOOD.parts.slice(0, 1)) }).catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(Error);
    expect(String(caught)).toContain("exactly once");
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
    process.env.AI_PROVIDER = "api";
    process.env.AI_API_KEY = "secret";
    const fetcher = fakeFetch(200, completion(GOOD_JSON));
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

describe("the food marker", () => {
  test("is lower cased, so a Title Case library does not read as 'melt Unsalted Butter' mid-sentence", () => {
    expect(foodMarker(" Unsalted Butter ")).toBe("(food: unsalted butter)");
    expect(foodMarker("beef")).toBe("(food: beef)");
  });
});

describe("before the recipe is saved", () => {
  /** The accepted answer as `applyRestyle` takes it. */
  const accepted = () => plain(GOOD.parts);

  test("restyleDraft rewrites a document that has no id, and writes nothing", async () => {
    process.env.AI_PROVIDER = "api";
    process.env.AI_API_KEY = "secret";
    vi.stubGlobal("fetch", fakeFetch(200, completion(GOOD_JSON)));

    const result = await callServerFn(restyleDraft, { doc: doc(), ruleIds: [] });
    expect(result.check.ok).toBe(true);
    expect(result.parts.map((part) => part.steps.map((step) => step.text))).toEqual(GOOD.parts.map((part) => part.steps.map((step) => step.text)));
    expect(await callServerFn(listRecipes, {})).toEqual([]);
  });

  test("createRestyledRecipe saves the styled steps and keeps the author's, so Restore brings them back", async () => {
    const created = await callServerFn(createRestyledRecipe, { doc: doc(), parts: accepted() });
    expect(created.restyledAt).not.toBeNull();
    expect(created.parts.map((part) => part.steps.map((step) => step.text))).toEqual(GOOD.parts.map((part) => part.steps.map((step) => step.text)));

    const restored = await callServerFn(restoreSteps, { id: created.id });
    expect(restored.parts.map((part) => part.steps.map((step) => step.text))).toEqual(doc().parts.map((part) => (part.steps ?? []).map((step) => step.text)));
    expect(restored.restyledAt).toBeNull();
  });

  test("a refused restyle leaves no recipe behind", async () => {
    const caught = await callServerFn(createRestyledRecipe, { doc: doc(), parts: accepted().slice(0, 1) }).catch((cause: unknown) => cause);
    expect(String(caught)).toContain("exactly once");
    expect(await callServerFn(listRecipes, {})).toEqual([]);
  });
});
