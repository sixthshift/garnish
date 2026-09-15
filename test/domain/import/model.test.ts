// What the importer asks a model and how it reads the answer (M34.5, M36.1,
// M36.4): the two prompts, the compact anchor, the JSON Schema held to its zod
// twin, and the parser. Pure; no model is ever called.
import { describe, expect, test } from "vitest";
import type { ScrapedRecipe } from "../../../src/domain/import";
import { ImportError } from "../../../src/domain/import/errors";
import { aiPrompt, anchorJson, parseAiAnswer, SCRAPED_JSON_SCHEMA } from "../../../src/domain/import/model";
import { ingredientLines } from "../../../src/domain/import/scraped/parts";
import { ScrapedPartSchema, ScrapedRecipeSchema } from "../../../src/domain/import/scraped/schema";

/** What a good answer looks like: the recipe as JSON in the message content. */
const FIXTURE = {
  name: "Anzac biscuits",
  description: "A family recipe.",
  image: null,
  servings: 24,
  yieldText: "biscuits",
  prepMinutes: 20,
  cookMinutes: 15,
  tags: ["biscuits"],
  parts: [
    { name: "", ingredients: ["1 cup plain flour", "125 g butter"], steps: ["Mix the dry ingredients.", "Bake for 15 minutes."] },
    { name: "Golden syrup mixture", ingredients: ["2 tbsp golden syrup"], steps: ["Melt the butter and syrup."] },
  ],
};

const answer = JSON.stringify(FIXTURE);

/** A schema rung result to anchor a read on: every line on the unnamed part, the steps split by a `HowToSection`. */
const ANCHOR: ScrapedRecipe = {
  name: "Anzac biscuits",
  description: "A family recipe.",
  image: null,
  servings: 24,
  yieldText: "biscuits",
  prepMinutes: 20,
  cookMinutes: 15,
  tags: ["baking"],
  parts: [
    { name: "", ingredients: ["1 cup plain flour", "125 g butter"], steps: ["Rub the butter in."] },
    { name: "To finish", ingredients: [], steps: ["Bake."] },
  ],
};

describe("the prompt", () => {
  test("carries the text and the rules that keep the answer honest", () => {
    const prompt = aiPrompt({ text: "some prose" });
    expect(prompt).toContain("some prose");
    expect(prompt).toMatch(/verbatim/);
    expect(prompt).toMatch(/Never invent/);
    // Each part lists its own lines, and what sits under no heading is the
    // unnamed body (M36.2).
    expect(prompt).toMatch(/ingredient lines written under that heading/);
    expect(prompt).toContain('the part named "" (empty)');
  });

  // M36.4. On a page with structured data the question is not "what is the
  // recipe" but "which heading did each of these lines sit under", and the
  // prompt has to be a different prompt for that to be true.
  test("with an anchor the lines are handed over and the copy-exactly rules appear", () => {
    const prompt = aiPrompt({ text: "# Pastry\n125 g butter", anchor: ANCHOR });
    expect(prompt).toContain("# Pastry");
    expect(prompt).toContain("ANCHOR:");
    for (const line of ["125 g butter", "1 cup plain flour", "Rub the butter in.", "Bake."]) {
      expect(prompt).toContain(line);
    }
    expect(prompt).toMatch(/byte for byte/);
    expect(prompt).toMatch(/Never add, drop, merge, split or reword/);
    expect(prompt).toMatch(/copy them from the anchor exactly as given/);
  });

  // M37.1: the ragu page put its lines under "Ragu" and "To Serve" and the
  // model left all eighteen on the unnamed part, because nothing in the prompt
  // said the ingredient list had headings of its own.
  test("the anchored rules make the ingredient headings place the lines", () => {
    const prompt = aiPrompt({ text: "# To Serve\n50 g parmesan", anchor: ANCHOR });
    expect(prompt).toMatch(/\*ingredient\* headings/);
    expect(prompt).toMatch(/independently of the headings the steps sit under/);
    expect(prompt).toMatch(/a new part named after an ingredient heading the anchor never mentions/);
    expect(prompt).toMatch(/lines and no steps, or steps and no lines/);
    expect(prompt).toMatch(/clearly refer to the same thing, they are one part/);
    expect(prompt).toMatch(/is not a part/);
    expect(prompt).toMatch(/leave out a trailing colon and a note marker/);
  });

  test("the anchored rules appear only with an anchor, and the unanchored ones only without", () => {
    const anchored = aiPrompt({ text: "prose", anchor: ANCHOR });
    const plain = aiPrompt({ text: "prose" });
    expect(plain).not.toMatch(/byte for byte/);
    expect(plain).not.toContain("ANCHOR:");
    expect(anchored).not.toMatch(/Never invent an ingredient/);
    expect(anchored).not.toMatch(/Read the recipe out of the text below/);
  });

  test("the anchor is serialised compactly: the fields being copied, and no more", () => {
    const json = JSON.parse(anchorJson(ANCHOR)) as Record<string, unknown>;
    expect(Object.keys(json).sort()).toEqual(["cookMinutes", "description", "image", "name", "parts", "prepMinutes", "servings", "tags", "yieldText"]);
    expect(json.parts).toEqual(ANCHOR.parts);
    expect(json.servings).toBe(24);
  });

  test("the JSON Schema names exactly the fields the zod schema does, and requires all of them", () => {
    const zodKeys = Object.keys(ScrapedRecipeSchema.shape).sort();
    expect(Object.keys(SCRAPED_JSON_SCHEMA.properties).sort()).toEqual(zodKeys);
    expect([...SCRAPED_JSON_SCHEMA.required].sort()).toEqual(zodKeys);
    expect(SCRAPED_JSON_SCHEMA.additionalProperties).toBe(false);

    // And the part's schema names exactly the fields `ScrapedPartSchema` does.
    const partKeys = Object.keys(ScrapedPartSchema.shape).sort();
    expect(Object.keys(SCRAPED_JSON_SCHEMA.properties.parts.items.properties).sort()).toEqual(partKeys);
    expect([...SCRAPED_JSON_SCHEMA.properties.parts.items.required].sort()).toEqual(partKeys);
  });
});

describe("parseAiAnswer", () => {
  test("reads the recipe out of the message content", () => {
    const recipe = parseAiAnswer(answer);
    expect(recipe.name).toBe("Anzac biscuits");
    expect(ingredientLines(recipe)).toEqual(["1 cup plain flour", "125 g butter", "2 tbsp golden syrup"]);
    expect(recipe.parts.map((part) => part.name)).toEqual(["", "Golden syrup mixture"]);
    // Each line stays on the part the answer put it on.
    expect(recipe.parts[1]!.ingredients).toEqual(["2 tbsp golden syrup"]);
  });

  test("reads a fenced answer from a model that fences anyway", () => {
    expect(parseAiAnswer("```json\n" + answer + "\n```").name).toBe("Anzac biscuits");
  });

  test("fills what the answer left out, and always has a main body", () => {
    const recipe = parseAiAnswer(JSON.stringify({ name: "Toast", parts: [{ name: "", ingredients: ["bread"] }] }));
    expect(recipe).toEqual({
      name: "Toast",
      description: "",
      image: null,
      servings: 0,
      yieldText: "",
      prepMinutes: null,
      cookMinutes: null,
      tags: [],
      parts: [{ name: "", ingredients: ["bread"], steps: [] }],
    });
  });

  test("garbage, prose and the wrong shape are all malformed", () => {
    for (const content of [
      "not json at all",
      "",
      "Sorry, I could not find a recipe.",
      JSON.stringify({ name: 42, parts: "flour" }),
      JSON.stringify({ description: "no name" }),
    ]) {
      const caught = (() => {
        try {
          parseAiAnswer(content);
        } catch (cause) {
          return cause;
        }
      })();
      expect(caught, content).toBeInstanceOf(ImportError);
      expect((caught as ImportError).kind, content).toBe("malformed");
    }
  });

  test("an answer with nothing in it is a miss rather than an empty recipe", () => {
    expect(() => parseAiAnswer(JSON.stringify({ name: "", parts: [] }))).toThrow(/no recipe/i);
  });
});
