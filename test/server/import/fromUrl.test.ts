// Reading a recipe from a URL (M23.5): the pure extraction, and the fetch
// against an injected fetcher. M35.4 adds the header profiles that stand in
// for a browser and the retry that tries a second one on a 403.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { FETCH_PROFILES } from "../../../src/domain/fetchProfiles";
import { ingredientLines } from "../../../src/domain/schemaRecipe";
import {
  extractRecipe,
  importFromHtml,
  type Fetcher,
  importRecipeFromUrl,
  MAX_PAGE_BYTES,
  parsePageUrl,
  scrapedFromStub,
} from "../../../src/server/import/fromUrl";

const URL_UNDER_TEST = "https://example.test/anzac-biscuits";

/** Recorded fixtures for the bot-wall retry (M35.4): a real Cloudflare challenge, trimmed, and a schema.org page. */
const BLOCKED_403 = readFileSync(join(import.meta.dirname, "../../fixtures/importUrl/blocked-403.html"), "utf8");
const RECIPE_200 = readFileSync(join(import.meta.dirname, "../../fixtures/importUrl/recipe-200.html"), "utf8");

/** A page carrying a schema.org Recipe. */
const SCHEMA_PAGE = `<html><head>
<meta property="og:title" content="Ignored, the schema wins">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
  {"@type":"WebSite","name":"Site"},
  {"@type":"Recipe","name":"Anzac biscuits","recipeYield":"24 biscuits","prepTime":"PT20M",
   "recipeIngredient":["1 cup plain flour","125 g butter"],
   "recipeInstructions":[{"@type":"HowToStep","text":"Mix."},{"@type":"HowToStep","text":"Bake."}]}
]}</script></head><body></body></html>`;

/** A page with only OpenGraph tags. */
const STUB_PAGE = `<html><head>
<meta property="og:title" content="Nan's shortbread">
<meta property="og:description" content="A family recipe.">
<meta property="og:image" content="https://example.test/sb.jpg">
</head><body><p>Cream the butter and sugar…</p></body></html>`;

/** A page carrying a Recipe node with nothing in it, as some sites emit for SEO. */
const EMPTY_SCHEMA_PAGE = `<html><head>
<script type="application/ld+json">{"@type":"Recipe","name":"Shell"}</script>
<meta property="og:title" content="Shell from OpenGraph">
</head><body></body></html>`;

const BARE_PAGE = "<html><head><title>Nothing here</title></head><body><p>Prose.</p></body></html>";

/** A fetcher returning `body` with `status`, recording what it was called with. */
function stubFetch(body: string, status = 200): Fetcher & { calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(body, { status });
  }) as Fetcher & { calls: typeof calls };
  fetcher.calls = calls;
  return fetcher;
}

/** A fetcher answering one `[body, status]` pair per call, in order; the last pair repeats past the end. */
function sequenceFetch(
  responses: readonly [body: string, status: number][],
): Fetcher & { calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const [body, status] = responses[Math.min(calls.length - 1, responses.length - 1)]!;
    return new Response(body, { status });
  }) as Fetcher & { calls: typeof calls };
  fetcher.calls = calls;
  return fetcher;
}

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

describe("scrapedFromStub", () => {
  test("keeps what it knows and leaves the lists empty", () => {
    const scraped = scrapedFromStub({ name: "Toast", description: "Hot bread.", image: "https://x.test/a.jpg" });
    expect(scraped).toMatchObject({ name: "Toast", description: "Hot bread.", image: "https://x.test/a.jpg", servings: 0 });
    // One empty part, so the draft it builds still validates.
    expect(scraped.parts).toEqual([{ name: "", ingredients: [], steps: [] }]);
  });
});

describe("extractRecipe", () => {
  test("schema.org wins where the page has it", () => {
    const found = extractRecipe(SCHEMA_PAGE, URL_UNDER_TEST);
    expect(found?.from).toBe("schema");
    expect(found?.url).toBe(URL_UNDER_TEST);
    expect(found?.recipe.name).toBe("Anzac biscuits");
    expect(ingredientLines(found!.recipe)).toEqual(["1 cup plain flour", "125 g butter"]);
    expect(found?.recipe.parts[0]!.steps).toEqual(["Mix.", "Bake."]);
    expect(found?.recipe.servings).toBe(24);
    expect(found?.recipe.prepMinutes).toBe(20);
  });

  test("OpenGraph is the fallback", () => {
    const found = extractRecipe(STUB_PAGE, URL_UNDER_TEST);
    expect(found?.from).toBe("stub");
    expect(found?.recipe.name).toBe("Nan's shortbread");
    expect(found?.recipe.description).toBe("A family recipe.");
    expect(found?.recipe.image).toBe("https://example.test/sb.jpg");
    expect(ingredientLines(found!.recipe)).toEqual([]);
  });

  test("an empty Recipe node falls through to the stub rather than importing a shell", () => {
    const found = extractRecipe(EMPTY_SCHEMA_PAGE, URL_UNDER_TEST);
    expect(found?.from).toBe("stub");
    expect(found?.recipe.name).toBe("Shell from OpenGraph");
  });

  test("neither is null", () => {
    expect(extractRecipe(BARE_PAGE, URL_UNDER_TEST)).toBeNull();
    expect(extractRecipe("", URL_UNDER_TEST)).toBeNull();
  });
});

// M36.7: the post-fetch half is its own export so a pasted page can take the
// same road. It answers exactly as the fetch's own half does.
describe("importFromHtml", () => {
  test("a page's HTML gives the same result whether it was fetched or pasted", () => {
    const found = importFromHtml(RECIPE_200, URL_UNDER_TEST);
    expect(found).toEqual(extractRecipe(RECIPE_200, URL_UNDER_TEST));
    expect(found?.from).toBe("schema");
    expect(found?.pageText).not.toBe("");
  });

  test("markup with neither structured data nor OpenGraph tags is null, and the caller decides", () => {
    expect(importFromHtml(BARE_PAGE, URL_UNDER_TEST)).toBeNull();
  });
});

describe("importRecipeFromUrl", () => {
  test("reads a schema page", async () => {
    const found = await importRecipeFromUrl(URL_UNDER_TEST, stubFetch(SCHEMA_PAGE));
    expect(found.from).toBe("schema");
    expect(found.recipe.name).toBe("Anzac biscuits");
  });

  test("sends a full browser header set, because a bare one gets a 403", async () => {
    const fetcher = stubFetch(SCHEMA_PAGE);
    await importRecipeFromUrl(URL_UNDER_TEST, fetcher);
    const headers = fetcher.calls[0]!.init?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(FETCH_PROFILES[0]!.headers["User-Agent"]);
    expect(headers.Accept).toContain("text/html");
    expect(headers["Accept-Language"]).toBeTruthy();
    expect(headers["Sec-Fetch-Mode"]).toBe("navigate");
    expect(fetcher.calls[0]!.init?.redirect).toBe("follow");
  });

  test("falls back to the stub", async () => {
    expect((await importRecipeFromUrl(URL_UNDER_TEST, stubFetch(STUB_PAGE))).from).toBe("stub");
  });

  test("a 403 retries once under a second header profile, and a page behind it comes back", async () => {
    const fetcher = sequenceFetch([
      [BLOCKED_403, 403],
      [RECIPE_200, 200],
    ]);
    const found = await importRecipeFromUrl(URL_UNDER_TEST, fetcher);
    expect(found.from).toBe("schema");
    expect(found.recipe.name).toBe("Golden syrup dumplings");
    expect(fetcher.calls).toHaveLength(2);
    const firstHeaders = fetcher.calls[0]!.init?.headers as Record<string, string>;
    const secondHeaders = fetcher.calls[1]!.init?.headers as Record<string, string>;
    expect(firstHeaders["User-Agent"]).toBe(FETCH_PROFILES[0]!.headers["User-Agent"]);
    expect(secondHeaders["User-Agent"]).toBe(FETCH_PROFILES[1]!.headers["User-Agent"]);
    expect(secondHeaders["User-Agent"]).not.toBe(firstHeaders["User-Agent"]);
  });

  test("still blocked after both profiles, the error names the site and suggests the paste box", async () => {
    const fetcher = sequenceFetch([
      [BLOCKED_403, 403],
      [BLOCKED_403, 403],
    ]);
    await expect(importRecipeFromUrl(URL_UNDER_TEST, fetcher)).rejects.toThrow(
      /example\.test is blocking automated requests.*pasting the recipe text, or the page's HTML \(view source, select all, copy\)/,
    );
    // No third attempt: only as many profiles exist as were tried.
    expect(fetcher.calls).toHaveLength(FETCH_PROFILES.length);
  });

  test("a 500 is reported without retrying under another profile", async () => {
    const fetcher = stubFetch("", 500);
    await expect(importRecipeFromUrl(URL_UNDER_TEST, fetcher)).rejects.toThrow("example.test returned 500");
    expect(fetcher.calls).toHaveLength(1);
  });

  test("a page with neither says so, and suggests the way forward", async () => {
    await expect(importRecipeFromUrl(URL_UNDER_TEST, stubFetch(BARE_PAGE))).rejects.toThrow(/No recipe data on that page/);
  });

  test.each([
    ["", /http or https/],
    ["file:///etc/passwd", /http or https/],
  ])("refuses %j", async (raw, message) => {
    await expect(importRecipeFromUrl(raw, stubFetch(SCHEMA_PAGE))).rejects.toThrow(message);
  });

  test("an error response names the host and the status", async () => {
    await expect(importRecipeFromUrl(URL_UNDER_TEST, stubFetch("", 404))).rejects.toThrow("example.test returned 404");
  });

  test("an unreachable host says so rather than leaking the cause", async () => {
    const failing: Fetcher = async () => {
      throw new Error("ECONNREFUSED 10.0.0.1:443");
    };
    await expect(importRecipeFromUrl(URL_UNDER_TEST, failing)).rejects.toThrow("Could not reach example.test");
  });

  test("an empty page says so", async () => {
    await expect(importRecipeFromUrl(URL_UNDER_TEST, stubFetch(""))).rejects.toThrow("empty page");
  });

  test("an oversized page is refused before it is parsed", async () => {
    const huge = `<html>${"x".repeat(MAX_PAGE_BYTES + 1)}</html>`;
    await expect(importRecipeFromUrl(URL_UNDER_TEST, stubFetch(huge))).rejects.toThrow("too large");
  });
});
