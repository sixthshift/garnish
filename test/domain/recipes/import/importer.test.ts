// The importer against two fakes: a page fetch and a model. Every entry point
// end to end — an address, a paste, a page's source pasted, a file — with no
// network anywhere. The server's real ports have their own tests beside them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ImportError, Importer, type PageResponse, type Ports, type ScrapedRecipe } from "../../../../src/domain/recipes/import";
import { MAX_PAGE_BYTES, type ModelRequest, parsePageUrl, READ_TIMEOUT_MS } from "../../../../src/domain/recipes/import/importer";
import { MAX_AI_TEXT, SCRAPED_JSON_SCHEMA } from "../../../../src/domain/recipes/import/model";
import { noFacets } from "../../../../src/domain/recipes/recipe";

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
const fetching = (fetchPage: Ports["fetchPage"]): Importer => new Importer({ fetchPage, model: () => Promise.reject(new Error("model was called")) });

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
  facets: { ...noFacets(), course: ["baking"] },
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

  test("a page's imperial amounts and joined lines arrive in the household's terms (decisions.md row 227)", async () => {
    const page = SCHEMA_PAGE.replace('"1 cup plain flour","125 g butter"', '"3 pounds beef chuck","1 large egg + 1 egg yolk"').replace(
      '"Mix."',
      '"Bake at 325°F."'
    );
    const found = await fetching(fakePage(page)).import({ kind: "url", url: URL_UNDER_TEST });
    expect(found.recipe.parts.flatMap((part) => part.ingredients)).toEqual(["1.4 kg beef chuck", "1 large egg", "1 egg yolk"]);
    expect(found.recipe.parts.flatMap((part) => part.steps)).toEqual(["Bake at 163°C."]);
  });

  test("falls back to the stub", async () => {
    expect((await fetching(fakePage(STUB_PAGE)).import({ kind: "url", url: URL_UNDER_TEST })).from).toBe("stub");
  });

  test("keeps the address the fetch landed on, after redirects", async () => {
    const fetchPage: Ports["fetchPage"] = async () => ({ status: 200, url: "https://example.test/moved", bytes: new TextEncoder().encode(SCHEMA_PAGE) });
    expect((await fetching(fetchPage).import({ kind: "url", url: URL_UNDER_TEST })).url).toBe("https://example.test/moved");
  });

  test("a 403 the fetch could not get past names the site; the screen offers the ways round it", async () => {
    await expect(fetching(fakePage("", 403)).import({ kind: "url", url: URL_UNDER_TEST })).rejects.toThrow(/^example\.test is blocking automated requests\.$/);
    await expect(fetching(fakePage("", 403)).import({ kind: "url", url: URL_UNDER_TEST })).rejects.toMatchObject({ kind: "blocked" });
  });

  test("with no browser, the result says it came by the fetch", async () => {
    expect((await fetching(fakePage(SCHEMA_PAGE)).import({ kind: "url", url: URL_UNDER_TEST })).via).toBe("fetch");
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
    const caught = await fetching(fakePage("", 500))
      .import({ kind: "url", url: URL_UNDER_TEST })
      .catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(ImportError);
    expect((caught as ImportError).kind).toBe("failed");
  });
});

describe('import({ kind: "url" }) with a browser (decisions.md row 202)', () => {
  /** An importer over a fetch and a browser, with a model that must not be reached. */
  const withBrowser = (fetchPage: Ports["fetchPage"], renderPage: Ports["renderPage"]) =>
    new Importer({ fetchPage, renderPage, model: () => Promise.reject(new Error("model was called")) });

  test("a schema page from the fetch never opens the browser", async () => {
    const browser = fakePage(SCHEMA_PAGE);
    const found = await withBrowser(fakePage(SCHEMA_PAGE), browser).import({ kind: "url", url: URL_UNDER_TEST });
    expect(found.via).toBe("fetch");
    expect(browser.calls).toHaveLength(0);
  });

  test.each([403, 402, 429, 503, 500])("a %i, then the browser's recipe", async (status) => {
    const browser = fakePage(SCHEMA_PAGE);
    const found = await withBrowser(fakePage("", status), browser).import({ kind: "url", url: URL_UNDER_TEST });
    expect(found.from).toBe("schema");
    expect(found.via).toBe("render");
    expect(found.recipe.name).toBe("Anzac biscuits");
    expect(browser.calls.map((url) => url.href)).toEqual([URL_UNDER_TEST]);
  });

  test("an unreachable host, then the browser's recipe", async () => {
    const failing: Ports["fetchPage"] = () => Promise.reject(new Error("ETIMEDOUT"));
    expect((await withBrowser(failing, fakePage(SCHEMA_PAGE)).import({ kind: "url", url: URL_UNDER_TEST })).via).toBe("render");
  });

  test("a page with no recipe, or an empty one, then the browser's: a recipe a script draws", async () => {
    expect((await withBrowser(fakePage(BARE_PAGE), fakePage(SCHEMA_PAGE)).import({ kind: "url", url: URL_UNDER_TEST })).via).toBe("render");
    expect((await withBrowser(fakePage(""), fakePage(SCHEMA_PAGE)).import({ kind: "url", url: URL_UNDER_TEST })).via).toBe("render");
  });

  test("a stub from the fetch, then the browser's recipe", async () => {
    const found = await withBrowser(fakePage(STUB_PAGE), fakePage(SCHEMA_PAGE)).import({ kind: "url", url: URL_UNDER_TEST });
    expect(found.from).toBe("schema");
    expect(found.via).toBe("render");
  });

  test("a stub from the fetch stays the answer when the browser finds no more, or fails", async () => {
    const stubAgain = await withBrowser(fakePage(STUB_PAGE), fakePage(STUB_PAGE)).import({ kind: "url", url: URL_UNDER_TEST });
    expect([stubAgain.from, stubAgain.via]).toEqual(["stub", "fetch"]);
    const broken: Ports["fetchPage"] = () => Promise.reject(new Error("Chromium exited 1"));
    const stubKept = await withBrowser(fakePage(STUB_PAGE), broken).import({ kind: "url", url: URL_UNDER_TEST });
    expect([stubKept.from, stubKept.via]).toEqual(["stub", "fetch"]);
  });

  test.each([404, 410])("a %i never opens the browser", async (status) => {
    const browser = fakePage(SCHEMA_PAGE);
    await expect(withBrowser(fakePage("", status), browser).import({ kind: "url", url: URL_UNDER_TEST })).rejects.toThrow(`example.test returned ${status}`);
    expect(browser.calls).toHaveLength(0);
  });

  test("a page too large, or an address that is not http(s), never opens the browser", async () => {
    const browser = fakePage(SCHEMA_PAGE);
    const huge = `<html>${"x".repeat(MAX_PAGE_BYTES + 1)}</html>`;
    await expect(withBrowser(fakePage(huge), browser).import({ kind: "url", url: URL_UNDER_TEST })).rejects.toThrow("too large");
    await expect(withBrowser(fakePage(SCHEMA_PAGE), browser).import({ kind: "url", url: "file:///etc/passwd" })).rejects.toThrow(/http or https/);
    expect(browser.calls).toHaveLength(0);
  });

  test("refused, and the browser drew a wall's page (no recipe, or only its title): one error naming the host", async () => {
    for (const wall of [BARE_PAGE, STUB_PAGE]) {
      const caught = await withBrowser(fakePage("", 403), fakePage(wall))
        .import({ kind: "url", url: URL_UNDER_TEST })
        .catch((cause: unknown) => cause);
      expect(caught).toBeInstanceOf(ImportError);
      expect((caught as ImportError).message).toBe("Couldn't get this recipe from example.test.");
      expect((caught as ImportError).kind).toBe("blocked");
    }
  });

  test("refused, and the browser failed too: the same one error", async () => {
    const broken: Ports["fetchPage"] = () => Promise.reject(new Error("Chromium exited 137"));
    await expect(withBrowser(fakePage("", 403), broken).import({ kind: "url", url: URL_UNDER_TEST })).rejects.toThrow(
      "Couldn't get this recipe from example.test."
    );
  });

  test("a page the fetch reached with no recipe, and the browser found none either, has no recipe data", async () => {
    await expect(withBrowser(fakePage(BARE_PAGE), fakePage(BARE_PAGE)).import({ kind: "url", url: URL_UNDER_TEST })).rejects.toThrow(
      /No recipe data on that page/
    );
  });

  test("the browser's result is the shape the fetch's is: the same page gives the same recipe and page text", async () => {
    const fetched = await fetching(fakePage(SCHEMA_PAGE)).import({ kind: "url", url: URL_UNDER_TEST });
    const rendered = await withBrowser(fakePage("", 403), fakePage(SCHEMA_PAGE)).import({ kind: "url", url: URL_UNDER_TEST });
    expect({ ...rendered, via: undefined }).toEqual({ ...fetched, via: undefined });
  });
});

describe('import({ kind: "page" })', () => {
  /** An importer that may reach neither port: a sent page is read by the rules alone. */
  const sealed = () => new Importer({ fetchPage: noFetch, model: () => Promise.reject(new Error("model was called")) });

  test("reads the page the browser sent with the rules, fetching nothing and asking no model", async () => {
    const found = await sealed().import({ kind: "page", html: SCHEMA_PAGE, url: URL_UNDER_TEST });
    expect(found.from).toBe("schema");
    expect(found.recipe.name).toBe("Anzac biscuits");
    expect(found.url).toBe(URL_UNDER_TEST);
  });

  test("gives exactly what a fetch of the same page gives", async () => {
    const sent = await sealed().import({ kind: "page", html: SCHEMA_PAGE, url: URL_UNDER_TEST });
    const fetched = await fetching(fakePage(SCHEMA_PAGE)).import({ kind: "url", url: URL_UNDER_TEST });
    // `via` is how an address's markup was got; the bookmark's came by neither.
    expect(sent).toEqual({ ...fetched, via: undefined });
  });

  test("falls back to the stub", async () => {
    expect((await sealed().import({ kind: "page", html: STUB_PAGE, url: URL_UNDER_TEST })).from).toBe("stub");
  });

  test("a page with neither says so", async () => {
    await expect(sealed().import({ kind: "page", html: BARE_PAGE, url: URL_UNDER_TEST })).rejects.toThrow(/No recipe data on that page/);
  });

  test.each(["", "file:///etc/passwd", "javascript:alert(1)"])("refuses the address %j", async (url) => {
    await expect(sealed().import({ kind: "page", html: SCHEMA_PAGE, url })).rejects.toThrow(/http or https/);
  });

  test("refuses an empty page and an oversized one", async () => {
    await expect(sealed().import({ kind: "page", html: "  ", url: URL_UNDER_TEST })).rejects.toThrow("sent nothing");
    const huge = `<html>${"x".repeat(MAX_PAGE_BYTES + 1)}</html>`;
    await expect(sealed().import({ kind: "page", html: huge, url: URL_UNDER_TEST })).rejects.toThrow("too large");
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
    const imported = await reading(fakeModel(`\`\`\`json\n${answer}\n\`\`\``)).import({ kind: "text", text: "text" });
    expect(imported.recipe.name).toBe("Anzac biscuits");
  });

  test("garbage is malformed, and nothing about it looks like a recipe", async () => {
    const caught = await reading(fakeModel("here is your recipe!"))
      .import({ kind: "text", text: "text" })
      .catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(ImportError);
    expect((caught as ImportError).kind).toBe("malformed");
    expect((caught as Error).message).toMatch(/nothing was imported/i);
  });

  test("markup the rules make nothing of goes to the model as its readable text, and that text is kept as the page", async () => {
    const run = fakeModel(answer);
    const imported = await reading(run).import({ kind: "text", text: BARE_PAGE });
    expect(run.calls[0]!.prompt).toContain("Prose.");
    expect(run.calls[0]!.prompt).not.toContain("<body>");
    // Check shows it beside the editor, so what the model read is not lost (it was "" before).
    expect(imported.pageText).toContain("Prose.");
  });

  test("a source URL is carried through so the draft keeps it", async () => {
    const imported = await reading(fakeModel(answer)).import({ kind: "text", text: "text", sourceUrl: "https://example.test/x" });
    expect(imported.url).toBe("https://example.test/x");
  });

  test("the model port's own errors keep their kind", async () => {
    const caught = await reading(noModel)
      .import({ kind: "text", text: "text" })
      .catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(ImportError);
    expect((caught as ImportError).kind).toBe("unavailable");
  });

  test("a model that throws something else is a plain failure", async () => {
    const caught = await reading(() => Promise.reject(new Error("boom")))
      .import({ kind: "text", text: "text" })
      .catch((cause: unknown) => cause);
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

  // M49.5: the model is never asked for facets, so an accepted answer keeps
  // the anchor's (a diet the page stated has no tag to come back through) and
  // adds what its own tags say.
  test("an accepted answer keeps the anchor's facets and reads its own tags", async () => {
    const sorted = {
      ...FIXTURE,
      tags: ["baking", "Dessert"],
      parts: [
        { name: "", ingredients: ["1 cup plain flour"], steps: [] },
        { name: "To finish", ingredients: ["125 g butter"], steps: ["Rub the butter in.", "Bake."] },
      ],
    };
    const anchor = { ...ANCHOR, facets: { ...ANCHOR.facets, diet: ["vegetarian" as const] } };
    const imported = await reading(fakeModel(JSON.stringify(sorted))).import({ kind: "text", text: "# To finish\nBake.", anchor });
    expect(imported.check?.ok).toBe(true);
    expect(imported.recipe.facets).toEqual({ ...noFacets(), course: ["dessert", "baking"], diet: ["vegetarian"] });
  });

  test("an unanchored answer's tags are read for the layers", async () => {
    const imported = await reading(fakeModel(JSON.stringify({ ...FIXTURE, tags: ["Breakfast", "Gluten free", "quick"] }))).import({ kind: "text", text: "x" });
    expect(imported.recipe.tags).toEqual(["Breakfast", "Gluten free", "quick"]);
    expect(imported.recipe.facets).toEqual({ ...noFacets(), meal: ["breakfast"], diet: ["gluten-free"] });
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
const RECIPE_200 = readFileSync(join(import.meta.dirname, "../../../fixtures/importUrl/recipe-200.html"), "utf8");

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
    const bytes = new Uint8Array(readFileSync(join(import.meta.dirname, "../../../fixtures/mealie/lemon-tart.json")));
    const recipes = await reading(noModel).import({ kind: "file", file: { name: "lemon-tart.json", bytes } });
    expect(recipes).toHaveLength(1);
    expect(recipes[0]!.name).toBe("Lemon tart");
  });

  test("an empty file is refused", async () => {
    await expect(reading(noModel).import({ kind: "file", file: { name: "x.json", bytes: new Uint8Array() } })).rejects.toThrow("That file is empty");
  });
});
