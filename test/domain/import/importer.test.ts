// The importer against two fakes: a page fetch and a model. Every entry point
// end to end — an address, a paste, a page's source pasted, a file — with no
// network anywhere. The server's real ports have their own tests beside them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ImportError, Importer, type PageResponse, type Ports, type ScrapedRecipe } from "../../../src/domain/import";
import { MAX_PAGE_BYTES, type ModelRequest, parsePageUrl, READ_TIMEOUT_MS } from "../../../src/domain/import/importer";
import { SCRAPED_JSON_SCHEMA } from "../../../src/domain/import/model";
import { MAX_AI_TEXT } from "../../../src/domain/import/model";

const URL_UNDER_TEST = "https://example.test/anzac-biscuits";

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

/** A model that answers with `content` and records what it was asked. */
function fakeModel(content: string): Ports["model"] & { calls: ModelRequest[] } {
  const calls: ModelRequest[] = [];
  const run = (async (request: ModelRequest) => {
    calls.push(request);
    return content;
  }) as Ports["model"] & { calls: typeof calls };
  run.calls = calls;
  return run;
}

/** No model configured: what the real port throws when `AI_API_KEY` is unset. */
const noModel: Ports["model"] = () => Promise.reject(new ImportError("unavailable", "No model is configured here."));

/** A page fetch that must not be reached: the text and file paths never fetch. */
const noFetch: Ports["fetchPage"] = () => Promise.reject(new Error("fetchPage was called"));

/** A page fetch answering `html` with `status`, recording what it was asked for. */
function fakePage(html: string, status = 200): Ports["fetchPage"] & { calls: URL[] } {
  const calls: URL[] = [];
  const fetchPage = (async (url: URL): Promise<PageResponse> => {
    calls.push(url);
    return { status, url: url.href, bytes: new TextEncoder().encode(html) };
  }) as Ports["fetchPage"] & { calls: URL[] };
  fetchPage.calls = calls;
  return fetchPage;
}

/** An importer over a model, with a fetch that must not be reached. */
const reading = (model: Ports["model"]): Importer => new Importer({ fetchPage: noFetch, model });

/** An importer over a page fetch, with a model that must not be reached. */
const fetching = (fetchPage: Ports["fetchPage"]): Importer =>
  new Importer({ fetchPage, model: () => Promise.reject(new Error("model was called")) });

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

/** A page carrying a schema.org Recipe. */
const SCHEMA_PAGE = `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
  {"@type":"Recipe","name":"Anzac biscuits","recipeYield":"24 biscuits",
   "recipeIngredient":["1 cup plain flour","125 g butter"],
   "recipeInstructions":[{"@type":"HowToStep","text":"Mix."}]}
]}</script></head><body></body></html>`;

/** A page with only OpenGraph tags. */
const STUB_PAGE = `<html><head><meta property="og:title" content="Nan's shortbread"></head><body><p>Cream the butter…</p></body></html>`;

const BARE_PAGE = "<html><head><title>Nothing here</title></head><body><p>Prose.</p></body></html>";

describe("parsePageUrl", () => {
  test.each(["https://example.com/r", "http://192.168.1.4:8080/r"])("accepts %s", (raw) => {
    expect(parsePageUrl(raw)?.href).toBe(new URL(raw).href);
  });

  test("trims surrounding whitespace", () => {
    expect(parsePageUrl("  https://example.com/r \n")?.pathname).toBe("/r");
  });

  test.each(["", "not a url", "/local/page", "file:///etc/passwd", "javascript:alert(1)", "data:text/html,x"])("rejects %j", (raw) => {
    expect(parsePageUrl(raw)).toBeNull();
  });
});

describe('import({ kind: "url" })', () => {
  test("fetches the page and reads a schema page, without asking the model", async () => {
    const page = fakePage(SCHEMA_PAGE);
    const found = await fetching(page).import({ kind: "url", url: URL_UNDER_TEST });
    expect(found.from).toBe("schema");
    expect(found.recipe.name).toBe("Anzac biscuits");
    expect(found.url).toBe(URL_UNDER_TEST);
    expect(page.calls.map((url) => url.href)).toEqual([URL_UNDER_TEST]);
  });

  test("falls back to the stub", async () => {
    expect((await fetching(fakePage(STUB_PAGE)).import({ kind: "url", url: URL_UNDER_TEST })).from).toBe("stub");
  });

  test("keeps the address the fetch landed on, after redirects", async () => {
    const fetchPage: Ports["fetchPage"] = async () => ({ status: 200, url: "https://example.test/moved", bytes: new TextEncoder().encode(SCHEMA_PAGE) });
    expect((await fetching(fetchPage).import({ kind: "url", url: URL_UNDER_TEST })).url).toBe("https://example.test/moved");
  });

  test("a 403 the fetch could not get past names the site and suggests the paste box", async () => {
    await expect(fetching(fakePage("", 403)).import({ kind: "url", url: URL_UNDER_TEST })).rejects.toThrow(
      /example\.test is blocking automated requests.*pasting the recipe text, or the page's HTML \(view source, select all, copy\)/,
    );
  });

  test.each([500, 404])("a %i names the host and the status", async (status) => {
    await expect(fetching(fakePage("", status)).import({ kind: "url", url: URL_UNDER_TEST })).rejects.toThrow(`example.test returned ${status}`);
  });

  test("a page with neither says so, and suggests the way forward", async () => {
    await expect(fetching(fakePage(BARE_PAGE)).import({ kind: "url", url: URL_UNDER_TEST })).rejects.toThrow(/No recipe data on that page/);
  });

  test.each([
    ["", /http or https/],
    ["file:///etc/passwd", /http or https/],
  ])("refuses %j before fetching anything", async (raw, message) => {
    const page = fakePage(SCHEMA_PAGE);
    await expect(fetching(page).import({ kind: "url", url: raw })).rejects.toThrow(message);
    expect(page.calls).toHaveLength(0);
  });

  test("an unreachable host says so rather than leaking the cause", async () => {
    const failing: Ports["fetchPage"] = () => Promise.reject(new Error("ECONNREFUSED 10.0.0.1:443"));
    await expect(fetching(failing).import({ kind: "url", url: URL_UNDER_TEST })).rejects.toThrow("Could not reach example.test");
  });

  test("an empty page says so", async () => {
    await expect(fetching(fakePage("")).import({ kind: "url", url: URL_UNDER_TEST })).rejects.toThrow("empty page");
  });

  test("an oversized page is refused before it is parsed", async () => {
    const huge = `<html>${"x".repeat(MAX_PAGE_BYTES + 1)}</html>`;
    await expect(fetching(fakePage(huge)).import({ kind: "url", url: URL_UNDER_TEST })).rejects.toThrow("too large");
  });

  test("every failure is an ImportError the screen can show", async () => {
    const caught = await fetching(fakePage("", 500)).import({ kind: "url", url: URL_UNDER_TEST }).catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(ImportError);
    expect((caught as ImportError).kind).toBe("failed");
  });
});

describe('import({ kind: "text" })', () => {
  test("a fixture comes back as an importable recipe from the `ai` rung", async () => {
    const run = fakeModel(answer);
    const imported = await reading(run).import({ kind: "text", text: "Anzac biscuits\n1 cup plain flour\nMix and bake." });
    expect(imported.from).toBe("ai");
    expect(imported.url).toBe("");
    expect(imported.recipe.name).toBe("Anzac biscuits");
    expect(run.calls).toHaveLength(1);
    expect(run.calls[0]!.timeoutMs).toBe(READ_TIMEOUT_MS);
    expect(run.calls[0]!.prompt).toContain("Anzac biscuits");
    // The importer says what shape the answer must take; the port is told, not trusted to know.
    expect(run.calls[0]!.schema).toBe(SCRAPED_JSON_SCHEMA);
    expect(run.calls[0]!.schemaName).toBe("recipe");
  });

  test("a fenced answer is read the same way", async () => {
    const imported = await reading(fakeModel("```json\n" + answer + "\n```")).import({ kind: "text", text: "text" });
    expect(imported.recipe.name).toBe("Anzac biscuits");
  });

  test("garbage is malformed, and nothing about it looks like a recipe", async () => {
    const caught = await reading(fakeModel("here is your recipe!")).import({ kind: "text", text: "text" }).catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(ImportError);
    expect((caught as ImportError).kind).toBe("malformed");
    expect((caught as Error).message).toMatch(/nothing was imported/i);
  });

  test("a source URL is carried through so the draft keeps it", async () => {
    const imported = await reading(fakeModel(answer)).import({ kind: "text", text: "text", sourceUrl: "https://example.test/x" });
    expect(imported.url).toBe("https://example.test/x");
  });

  test("the model port's own errors keep their kind", async () => {
    const caught = await reading(noModel).import({ kind: "text", text: "text" }).catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(ImportError);
    expect((caught as ImportError).kind).toBe("unavailable");
  });

  test("a model that throws something else is a plain failure", async () => {
    const caught = await reading(() => Promise.reject(new Error("boom"))).import({ kind: "text", text: "text" }).catch((cause: unknown) => cause);
    expect((caught as ImportError).kind).toBe("failed");
    expect((caught as Error).message).toMatch(/boom/);
  });

  test("empty and oversized pastes never reach the model", async () => {
    const run = fakeModel(answer);
    await expect(reading(run).import({ kind: "text", text: "   " })).rejects.toThrow(/Paste the recipe/);
    await expect(reading(run).import({ kind: "text", text: "x".repeat(MAX_AI_TEXT + 1) })).rejects.toThrow(/too much text/);
    expect(run.calls).toHaveLength(0);
  });

  // M36.4: the anchor reaches the model, and it counts against the same cap
  // the text does, because the request carries both.
  test("an anchor is passed through as the anchored prompt", async () => {
    const run = fakeModel(answer);
    await reading(run).import({ kind: "text", text: "# To finish\nBake.", anchor: ANCHOR });
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
    const imported = await reading(fakeModel(JSON.stringify(sorted))).import({ kind: "text", text: "# To finish\nBake.", anchor: ANCHOR });
    expect(imported.from).toBe("ai");
    expect(imported.check?.ok).toBe(true);
    expect(imported.rejected).toBeUndefined();
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
    const imported = await reading(fakeModel(JSON.stringify(placed))).import({
      kind: "text",
      text: "# Ragu\n1 cup plain flour\n# To serve\n125 g butter",
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
    const imported = await reading(fakeModel(JSON.stringify(invented))).import({
      kind: "text",
      text: "prose",
      anchor: ANCHOR,
      sourceUrl: "https://example.test/x",
    });
    expect(imported.from).toBe("schema");
    expect(imported.recipe).toEqual(ANCHOR);
    expect(imported.url).toBe("https://example.test/x");
    expect(imported.check).toMatchObject({ ok: false, addedLines: ["a pinch of salt"] });
    expect(imported.rejected?.parts[0]?.ingredients).toContain("a pinch of salt");
  });

  test("with no anchor there is nothing to check, and no check is attached", async () => {
    const imported = await reading(fakeModel(answer)).import({ kind: "text", text: "text" });
    expect(imported.from).toBe("ai");
    expect(imported.check).toBeUndefined();
    expect(imported.rejected).toBeUndefined();
  });

  test("text and anchor are measured against the cap together", async () => {
    const run = fakeModel(answer);
    const text = "x".repeat(MAX_AI_TEXT - 10);
    await expect(reading(run).import({ kind: "text", text })).resolves.toBeTruthy();
    await expect(reading(run).import({ kind: "text", text, anchor: ANCHOR })).rejects.toThrow(/too much text/);
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
  test("with no model, the recorded 200 fixture comes back from the schema rung with its page text filled", async () => {
    const imported = await reading(noModel).import({ kind: "text", text: RECIPE_200, sourceUrl: "https://example.test/x" });
    expect(imported.from).toBe("schema");
    expect(imported.recipe.name).toBe("Golden syrup dumplings");
    expect(imported.pageText).not.toBe("");
    expect(imported.pageText).not.toContain("ld+json");
    expect(imported.url).toBe("https://example.test/x");
  });

  test("with a model, the schema rung is the anchor and the answer is checked against it", async () => {
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
    const run = fakeModel(JSON.stringify(sorted));
    const imported = await reading(run).import({ kind: "text", text: RECIPE_200 });
    expect(run.calls[0]!.prompt).toContain("ANCHOR:");
    expect(run.calls[0]!.prompt).not.toContain("<script");
    expect(imported.from).toBe("ai");
    expect(imported.check?.ok).toBe(true);
    // `normaliseScraped` keeps the unnamed part in front of the named ones.
    expect(imported.recipe.parts.map((part) => part.name)).toEqual(["", "Dumplings", "Syrup"]);
  });

  test("prose is untouched by the split and still goes straight to the model", async () => {
    const run = fakeModel(answer);
    const imported = await reading(run).import({ kind: "text", text: "Anzac biscuits\n1 cup plain flour\nMix and bake." });
    expect(imported.from).toBe("ai");
    expect(run.calls[0]!.prompt).toContain("Anzac biscuits\n1 cup plain flour");
    expect(run.calls[0]!.prompt).not.toContain("ANCHOR:");
  });

  test("the same page with its ld+json cut out is a stub, and the model then reads it unanchored", async () => {
    const run = fakeModel(answer);
    const imported = await reading(run).import({ kind: "text", text: RECIPE_200_NO_LD });
    expect(run.calls).toHaveLength(1);
    expect(run.calls[0]!.prompt).not.toContain("ANCHOR:");
    expect(imported.from).toBe("ai");
    expect(imported.recipe.name).toBe("Anzac biscuits");
    expect(imported.check).toBeUndefined();
  });

  test("a stub whose read fails keeps the stub rather than losing the shell", async () => {
    const imported = await reading(noModel).import({ kind: "text", text: RECIPE_200_NO_LD, sourceUrl: "https://example.test/x" });
    expect(imported.from).toBe("stub");
    expect(imported.recipe.name).not.toBe("");
    expect(imported.pageText).not.toBe("");
  });

  test("markup the rules can make nothing of still reaches the model, as readable text", async () => {
    const run = fakeModel(answer);
    const imported = await reading(run).import({
      kind: "text",
      text: "<!doctype html><html><body><p>1 cup plain flour</p><script>var x = 1;</script></body></html>",
    });
    expect(imported.from).toBe("ai");
    expect(run.calls[0]!.prompt).toContain("1 cup plain flour");
    expect(run.calls[0]!.prompt).not.toContain("var x");
  });
});

describe('import({ kind: "file" })', () => {
  test("reads a Mealie recipe's JSON without touching either port", async () => {
    const bytes = new Uint8Array(readFileSync(join(import.meta.dirname, "../../fixtures/mealie/lemon-tart.json")));
    const recipes = await reading(noModel).import({ kind: "file", file: { name: "lemon-tart.json", bytes } });
    expect(recipes).toHaveLength(1);
    expect(recipes[0]!.name).toBe("Lemon tart");
  });

  test("an empty file is refused", async () => {
    await expect(reading(noModel).import({ kind: "file", file: { name: "x.json", bytes: new Uint8Array() } })).rejects.toThrow("That file is empty");
  });
});
