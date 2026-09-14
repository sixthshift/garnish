// The real importer's wiring: the domain's `Importer` over the server's two
// ports, driven end to end with one fake `fetch` standing in for both the page
// and the model provider. The provider's failures arrive as the importer's own
// `ImportError` kinds, which is what the import screen shows.
import { afterEach, describe, expect, test } from "vitest";
import { ImportError } from "../../../src/domain/import";
import type { Fetcher } from "../../../src/server/ai/client";
import { createImporter } from "../../../src/server/import/importer";

const KEYS = ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL"] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const answer = JSON.stringify({ name: "Anzac biscuits", parts: [{ name: "", ingredients: ["1 cup plain flour"], steps: ["Mix."] }] });

/** The chat completion envelope a provider sends back. */
const completion = (content: string): string => JSON.stringify({ choices: [{ message: { role: "assistant", content } }] });

/** A page carrying a schema.org Recipe. */
const SCHEMA_PAGE = `<html><head><script type="application/ld+json">{"@type":"Recipe","name":"Anzac biscuits","recipeIngredient":["1 cup plain flour"],"recipeInstructions":[{"@type":"HowToStep","text":"Mix."}]}</script></head><body></body></html>`;

/** One `fetch` for both ports: the provider's endpoint answers `model`, anything else answers `page`. */
function fakeFetch(page: [body: string, status: number], model: [body: string, status: number]): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  const fetcher = (async (url: string) => {
    calls.push(url);
    const [body, status] = url.includes("/chat/completions") ? model : page;
    return new Response(body, { status, headers: { "content-type": "application/json" } });
  }) as Fetcher & { calls: string[] };
  fetcher.calls = calls;
  return fetcher;
}

describe("createImporter", () => {
  test("a URL goes through the page fetch and the rules, and never the model", async () => {
    const fetcher = fakeFetch([SCHEMA_PAGE, 200], [completion(answer), 200]);
    const found = await createImporter(fetcher).import({ kind: "url", url: "https://example.test/x" });
    expect(found.from).toBe("schema");
    expect(fetcher.calls).toEqual(["https://example.test/x"]);
  });

  test("a paste goes through the model, over the configured endpoint", async () => {
    process.env.AI_API_KEY = "k";
    process.env.AI_BASE_URL = "https://provider.test/v1";
    const fetcher = fakeFetch(["", 500], [completion(answer), 200]);
    const found = await createImporter(fetcher).import({ kind: "text", text: "Anzac biscuits\n1 cup plain flour" });
    expect(found.from).toBe("ai");
    expect(found.recipe.name).toBe("Anzac biscuits");
    expect(fetcher.calls).toEqual(["https://provider.test/v1/chat/completions"]);
  });

  test("the provider's failures keep their kind as ImportErrors", async () => {
    process.env.AI_API_KEY = "k";
    const caught = await createImporter(fakeFetch(["", 500], ["{}", 429])).import({ kind: "text", text: "text" }).catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(ImportError);
    expect((caught as ImportError).kind).toBe("failed");
    expect((caught as Error).message).toMatch(/rate-limited/);
  });

  test("no key configured is unavailable rather than a crash, and nothing is sent", async () => {
    delete process.env.AI_API_KEY;
    const fetcher = fakeFetch(["", 500], [completion(answer), 200]);
    const caught = await createImporter(fetcher).import({ kind: "text", text: "text" }).catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(ImportError);
    expect((caught as ImportError).kind).toBe("unavailable");
    expect(fetcher.calls).toHaveLength(0);
  });
});
