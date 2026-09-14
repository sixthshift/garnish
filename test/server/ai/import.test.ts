// The AI import rung (M34.5, M36.1, decisions.md rows 74 and 75): the prompt,
// the answer parser, and the whole read against an injected runner. No
// provider is ever called here — a test that spends a request is not a test —
// so every case drives `runAiImport` with a fake runner, or with a fake
// `fetch` under the client's runner (`client.test.ts` covers the client).
import { afterEach, describe, expect, test } from "vitest";
import {
  anchorJson,
  aiPrompt,
  ImportFromTextInput,
  MAX_AI_TEXT,
  parseAiAnswer,
  runAiImport,
  SCRAPED_JSON_SCHEMA,
} from "../../../src/server/ai/import";
import { AI_TIMEOUT_MS, AiError, type AiRunner, type Fetcher } from "../../../src/server/ai/client";
import { aiImportAvailable, importFromText } from "../../../src/server/ai/import";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ingredientLines, type ScrapedRecipe, ScrapedPartSchema, ScrapedRecipeSchema } from "../../../src/domain/schemaRecipe";
import { callServerFn, useTempDataDir } from "../../helpers/server";

useTempDataDir();

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

/** A `fetch` that answers once with the given status and body, and records the request. */
function fakeFetch(status: number, body: unknown): Fetcher & { calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = ((url, init) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  }) as Fetcher & { calls: typeof calls };
  fetcher.calls = calls;
  return fetcher;
}

/** The chat completion envelope a provider sends back. */
const completion = (content: string): unknown => ({ choices: [{ message: { role: "assistant", content } }] });

const KEYS = ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL"] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

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
    expect(Object.keys(json).sort()).toEqual(
      ["cookMinutes", "description", "image", "name", "parts", "prepMinutes", "servings", "tags", "yieldText"],
    );
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
      expect(caught, content).toBeInstanceOf(AiError);
      expect((caught as AiError).kind, content).toBe("malformed");
    }
  });

  test("an answer with nothing in it is a miss rather than an empty recipe", () => {
    expect(() => parseAiAnswer(JSON.stringify({ name: "", parts: [] }))).toThrow(/no recipe/i);
  });
});

describe("runAiImport", () => {
  test("with the runner injected, a fixture comes back as an importable recipe from the `ai` rung", async () => {
    const run = fakeRunner(answer);
    const imported = await runAiImport("Anzac biscuits\n1 cup plain flour\nMix and bake.", { run });
    expect(imported.from).toBe("ai");
    expect(imported.url).toBe("");
    expect(imported.recipe.name).toBe("Anzac biscuits");
    expect(run.calls).toHaveLength(1);
    expect(run.calls[0]!.timeoutMs).toBe(AI_TIMEOUT_MS);
    expect(run.calls[0]!.prompt).toContain("Anzac biscuits");
  });

  test("a fenced answer is read the same way", async () => {
    const imported = await runAiImport("text", { run: fakeRunner("```json\n" + answer + "\n```") });
    expect(imported.recipe.name).toBe("Anzac biscuits");
  });

  test("garbage is malformed, and nothing about it looks like a recipe", async () => {
    const caught = await runAiImport("text", { run: fakeRunner("here is your recipe!") }).catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(AiError);
    expect((caught as AiError).kind).toBe("malformed");
    expect((caught as Error).message).toMatch(/nothing was imported/i);
  });

  test("a source URL is carried through so the draft keeps it", async () => {
    const imported = await runAiImport("text", { run: fakeRunner(answer), sourceUrl: "https://example.test/x" });
    expect(imported.url).toBe("https://example.test/x");
  });

  test("a fetch can be injected instead of a runner, and its errors keep their kind", async () => {
    process.env.AI_API_KEY = "k";
    process.env.AI_BASE_URL = "https://provider.test/v1";
    const ok = await runAiImport("text", { fetcher: fakeFetch(200, completion(answer)) });
    expect(ok.recipe.name).toBe("Anzac biscuits");
    const caught = await runAiImport("text", { fetcher: fakeFetch(429, {}) }).catch((cause: unknown) => cause);
    expect((caught as AiError).kind).toBe("failed");
    expect((caught as Error).message).toMatch(/rate-limited/);
  });

  test("no key configured is an unavailable error rather than a crash", async () => {
    delete process.env.AI_API_KEY;
    const caught = await runAiImport("text", { fetcher: fakeFetch(200, completion(answer)) }).catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(AiError);
    expect((caught as AiError).kind).toBe("unavailable");
  });

  test("a runner that throws something else is a plain failure", async () => {
    const run: AiRunner = () => Promise.reject(new Error("boom"));
    const caught = await runAiImport("text", { run }).catch((cause: unknown) => cause);
    expect((caught as AiError).kind).toBe("failed");
    expect((caught as Error).message).toMatch(/boom/);
  });

  test("empty and oversized pastes never reach the runner", async () => {
    const run = fakeRunner(answer);
    await expect(runAiImport("   ", { run })).rejects.toThrow(/Paste the recipe/);
    await expect(runAiImport("x".repeat(MAX_AI_TEXT + 1), { run })).rejects.toThrow(/too much text/);
    expect(run.calls).toHaveLength(0);
  });

  // M36.4: the anchor reaches the model, and it counts against the same cap
  // the text does, because the request carries both.
  test("an anchor is passed through to the runner as the anchored prompt", async () => {
    const run = fakeRunner(answer);
    await runAiImport("# To finish\nBake.", { run, anchor: ANCHOR });
    const prompt = run.calls[0]!.prompt;
    expect(prompt).toContain("ANCHOR:");
    expect(prompt).toContain("125 g butter");
    expect(prompt).toMatch(/byte for byte/);
  });

  // M36.5: the answer is checked against the anchor, and a check that fails
  // discards the structure rather than the content.
  test("an answer that kept the anchor's lines and steps is accepted as the AI result", async () => {
    const sorted = {
      ...FIXTURE,
      parts: [
        { name: "", ingredients: ["1 cup plain flour"], steps: [] },
        { name: "To finish", ingredients: ["125 g butter"], steps: ["Rub the butter in.", "Bake."] },
      ],
    };
    const imported = await runAiImport("# To finish\nBake.", { run: fakeRunner(JSON.stringify(sorted)), anchor: ANCHOR, pageText: "page" });
    expect(imported.from).toBe("ai");
    expect(imported.check?.ok).toBe(true);
    expect(imported.rejected).toBeUndefined();
    expect(imported.pageText).toBe("page");
    expect(imported.recipe.parts.map((part) => part.name)).toEqual(["", "To finish"]);
  });

  // M37.1: the anchor's parts came off the page's step sections and carry no
  // ingredient lines at all. An answer that moves a line onto a part named
  // from an ingredient heading is exactly what the prompt now asks for, and
  // the check passes it because it never compares part names.
  test("lines moved onto a heading-named part the anchor never mentioned pass the check", async () => {
    const stepsOnly = {
      ...ANCHOR,
      parts: [
        { name: "", ingredients: ["1 cup plain flour", "125 g butter"], steps: [] },
        { name: "Ragu", ingredients: [], steps: ["Rub the butter in."] },
        { name: "To finish", ingredients: [], steps: ["Bake."] },
      ],
    };
    const placed = {
      ...FIXTURE,
      parts: [
        { name: "", ingredients: [], steps: [] },
        { name: "Ragu", ingredients: ["1 cup plain flour"], steps: ["Rub the butter in."] },
        { name: "TO SERVE:", ingredients: ["125 g butter"], steps: [] },
        { name: "To finish", ingredients: [], steps: ["Bake."] },
      ],
    };
    const imported = await runAiImport("# Ragu\n1 cup plain flour\n# To serve\n125 g butter", {
      run: fakeRunner(JSON.stringify(placed)),
      anchor: stepsOnly,
    });
    expect(imported.from).toBe("ai");
    expect(imported.check?.ok).toBe(true);
    expect(imported.recipe.parts.map((part) => part.name)).toEqual(["", "Ragu", "To serve", "To finish"]);
    expect(imported.recipe.parts[2]?.ingredients).toEqual(["125 g butter"]);
  });

  test("an answer that changed the content is rejected: the anchor comes back as `schema`, the answer under `rejected`", async () => {
    const invented = {
      ...FIXTURE,
      parts: [{ name: "", ingredients: ["1 cup plain flour", "125 g butter", "a pinch of salt"], steps: ["Rub the butter in.", "Bake."] }],
    };
    const imported = await runAiImport("prose", { run: fakeRunner(JSON.stringify(invented)), anchor: ANCHOR, sourceUrl: "https://example.test/x" });
    expect(imported.from).toBe("schema");
    expect(imported.recipe).toEqual(ANCHOR);
    expect(imported.url).toBe("https://example.test/x");
    expect(imported.check).toMatchObject({ ok: false, addedLines: ["a pinch of salt"] });
    expect(imported.rejected?.parts[0]?.ingredients).toContain("a pinch of salt");
  });

  test("with no anchor there is nothing to check, and no check is attached", async () => {
    const imported = await runAiImport("text", { run: fakeRunner(answer) });
    expect(imported.from).toBe("ai");
    expect(imported.check).toBeUndefined();
    expect(imported.rejected).toBeUndefined();
  });

  test("text and anchor are measured against the cap together", async () => {
    const run = fakeRunner(answer);
    const text = "x".repeat(MAX_AI_TEXT - 10);
    await expect(runAiImport(text, { run })).resolves.toBeTruthy();
    await expect(runAiImport(text, { run, anchor: ANCHOR })).rejects.toThrow(/too much text/);
    expect(run.calls).toHaveLength(1);
  });
});

// M36.7: a paste that is a page's own source takes the rules first, exactly as
// a fetched page does, so view-source-and-paste is not a worse import than the
// fetch would have been.
const RECIPE_200 = readFileSync(join(import.meta.dirname, "../../fixtures/importUrl/recipe-200.html"), "utf8");

/** The same page with its structured data cut out: OpenGraph and prose, nothing for the schema rung. */
const RECIPE_200_NO_LD = RECIPE_200.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, "");

describe("a pasted page's HTML", () => {
  test("the recorded 200 fixture comes back from the schema rung with its page text filled", async () => {
    delete process.env.AI_API_KEY;
    const imported = await runAiImport(RECIPE_200, { sourceUrl: "https://example.test/x" });
    expect(imported.from).toBe("schema");
    expect(imported.recipe.name).toBe("Golden syrup dumplings");
    expect(imported.pageText).not.toBe("");
    expect(imported.pageText).not.toContain("ld+json");
    expect(imported.url).toBe("https://example.test/x");
  });

  test("with a model configured, the schema rung is the anchor and the answer is checked against it", async () => {
    const sorted = {
      name: "Golden syrup dumplings",
      description: "Golden syrup dumplings, a family favourite for a cold night.",
      image: null,
      servings: 6,
      yieldText: "dumplings",
      prepMinutes: 15,
      cookMinutes: null,
      tags: [],
      parts: [
        { name: "Dumplings", ingredients: ["1 cup self-raising flour", "60 g butter"], steps: ["Rub butter into flour."] },
        { name: "Syrup", ingredients: ["1 cup golden syrup"], steps: ["Simmer in syrup."] },
      ],
    };
    const run = fakeRunner(JSON.stringify(sorted));
    const imported = await runAiImport(RECIPE_200, { run });
    expect(run.calls[0]!.prompt).toContain("ANCHOR:");
    expect(run.calls[0]!.prompt).not.toContain("<script");
    expect(imported.from).toBe("ai");
    expect(imported.check?.ok).toBe(true);
    // `normaliseScraped` keeps the unnamed part in front of the named ones.
    expect(imported.recipe.parts.map((part) => part.name)).toEqual(["", "Dumplings", "Syrup"]);
  });

  test("prose is untouched by the split and still goes straight to the model", async () => {
    const run = fakeRunner(answer);
    const imported = await runAiImport("Anzac biscuits\n1 cup plain flour\nMix and bake.", { run });
    expect(imported.from).toBe("ai");
    expect(run.calls[0]!.prompt).toContain("Anzac biscuits\n1 cup plain flour");
    expect(run.calls[0]!.prompt).not.toContain("ANCHOR:");
  });

  test("the same page with its ld+json cut out is a stub, and the model then reads it unanchored", async () => {
    const run = fakeRunner(answer);
    const imported = await runAiImport(RECIPE_200_NO_LD, { run });
    expect(run.calls).toHaveLength(1);
    expect(run.calls[0]!.prompt).not.toContain("ANCHOR:");
    expect(imported.from).toBe("ai");
    expect(imported.recipe.name).toBe("Anzac biscuits");
    expect(imported.check).toBeUndefined();
  });

  test("a stub whose read fails keeps the stub rather than losing the shell", async () => {
    delete process.env.AI_API_KEY;
    const imported = await runAiImport(RECIPE_200_NO_LD, { sourceUrl: "https://example.test/x" });
    expect(imported.from).toBe("stub");
    expect(imported.recipe.name).not.toBe("");
    expect(imported.pageText).not.toBe("");
  });

  test("markup the rules can make nothing of still reaches the model, as readable text", async () => {
    const run = fakeRunner(answer);
    const imported = await runAiImport("<!doctype html><html><body><p>1 cup plain flour</p><script>var x = 1;</script></body></html>", { run });
    expect(imported.from).toBe("ai");
    expect(run.calls[0]!.prompt).toContain("1 cup plain flour");
    expect(run.calls[0]!.prompt).not.toContain("var x");
  });
});

describe("the server functions", () => {
  test("an unset key hides the option and a set one shows it", async () => {
    delete process.env.AI_API_KEY;
    await expect(callServerFn(aiImportAvailable)).resolves.toEqual({ available: false });
    process.env.AI_API_KEY = "k";
    await expect(callServerFn(aiImportAvailable)).resolves.toEqual({ available: true });
  });

  test("a blank paste is refused by the validator, before any request is made", async () => {
    await expect(callServerFn(importFromText, { text: "   " } as never)).rejects.toThrow(/too_small|at least 1/);
    expect(ImportFromTextInput.parse({ text: " hi " })).toEqual({ text: "hi", sourceUrl: "" });
  });

  test("the anchor is optional, and validated through the scraped schema when it is there", () => {
    const parsed = ImportFromTextInput.parse({ text: "hi", anchor: { name: "Anzac biscuits", parts: [{ ingredients: ["1 cup plain flour"] }] } });
    expect(parsed.anchor?.parts[0]?.ingredients).toEqual(["1 cup plain flour"]);
    expect(() => ImportFromTextInput.parse({ text: "hi", anchor: { parts: [] } })).toThrow();
  });
});
