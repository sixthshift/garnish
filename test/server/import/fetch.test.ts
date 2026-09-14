// The importer's `fetchPage` port (M23.5, M35.4) against an injected `fetch`:
// the browser header set, the retry under a second profile on a 403, and the
// statuses that are handed straight back for the importer to name.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createPageFetcher, type Fetcher } from "../../../src/server/import/fetch";
import { FETCH_PROFILES } from "../../../src/server/import/fetchProfiles";

const URL_UNDER_TEST = new URL("https://example.test/anzac-biscuits");

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

describe("createPageFetcher", () => {
  test("GETs the page with a full browser header set, because a bare one gets a 403", async () => {
    const fetcher = stubFetch(SCHEMA_PAGE);
    const page = await createPageFetcher(fetcher)(URL_UNDER_TEST);
    expect(page.status).toBe(200);
    expect(new TextDecoder().decode(page.bytes)).toBe(SCHEMA_PAGE);
    expect(page.url).toBe(URL_UNDER_TEST.href);
    const headers = fetcher.calls[0]!.init?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(FETCH_PROFILES[0]!.headers["User-Agent"]);
    expect(headers.Accept).toContain("text/html");
    expect(headers["Accept-Language"]).toBeTruthy();
    expect(headers["Sec-Fetch-Mode"]).toBe("navigate");
    expect(fetcher.calls[0]!.init?.redirect).toBe("follow");
  });

  test("a 403 retries once under a second header profile, and the page behind it comes back", async () => {
    const fetcher = sequenceFetch([
      [BLOCKED_403, 403],
      [RECIPE_200, 200],
    ]);
    const page = await createPageFetcher(fetcher)(URL_UNDER_TEST);
    expect(page.status).toBe(200);
    expect(new TextDecoder().decode(page.bytes)).toContain("Golden syrup dumplings");
    expect(fetcher.calls).toHaveLength(2);
    const firstHeaders = fetcher.calls[0]!.init?.headers as Record<string, string>;
    const secondHeaders = fetcher.calls[1]!.init?.headers as Record<string, string>;
    expect(firstHeaders["User-Agent"]).toBe(FETCH_PROFILES[0]!.headers["User-Agent"]);
    expect(secondHeaders["User-Agent"]).toBe(FETCH_PROFILES[1]!.headers["User-Agent"]);
    expect(secondHeaders["User-Agent"]).not.toBe(firstHeaders["User-Agent"]);
  });

  test("still blocked after both profiles, the 403 is handed back and there is no third attempt", async () => {
    const fetcher = sequenceFetch([
      [BLOCKED_403, 403],
      [BLOCKED_403, 403],
    ]);
    expect((await createPageFetcher(fetcher)(URL_UNDER_TEST)).status).toBe(403);
    expect(fetcher.calls).toHaveLength(FETCH_PROFILES.length);
  });

  test("a 500 is handed back without retrying under another profile", async () => {
    const fetcher = stubFetch("", 500);
    expect((await createPageFetcher(fetcher)(URL_UNDER_TEST)).status).toBe(500);
    expect(fetcher.calls).toHaveLength(1);
  });

  test("a network failure is thrown as it came, for the importer to name", async () => {
    const failing: Fetcher = async () => {
      throw new Error("ECONNREFUSED 10.0.0.1:443");
    };
    await expect(createPageFetcher(failing)(URL_UNDER_TEST)).rejects.toThrow("ECONNREFUSED");
  });
});
