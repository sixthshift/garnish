// The real importer's wiring: the domain's `Importer` over the server's two
// ports, driven end to end with one fake `fetch` standing in for both the page
// and the model provider. The provider's failures arrive as the importer's own
// `ImportError` kinds, which is what the import screen shows.
import { afterEach, describe, expect, test } from "vitest";
import { ImportError } from "../../../src/domain/recipes/import";
import type { Fetcher } from "../../../src/server/ai/client";
import { apiProvider } from "../../../src/server/ai/provider/api";
import { createImporter } from "../../../src/server/import/importer";
import { fakeAi, useChosenModels } from "../../helpers/ai";

/** The importer with one fake `fetch` behind both its ports: the page and the model. */
const importerOver = (fetcher: Fetcher) => createImporter(fetcher, apiProvider(fetcher));

const KEYS = ["AI_API_KEY", "AI_BASE_URL"] as const;
const chosen = useChosenModels({ import: "test-model" });
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
    const found = await importerOver(fetcher).import({ kind: "url", url: "https://example.test/x" });
    expect(found.from).toBe("schema");
    expect(fetcher.calls).toEqual(["https://example.test/x"]);
  });

  test("a paste goes through the model, over the configured endpoint", async () => {
    process.env.AI_API_KEY = "k";
    process.env.AI_BASE_URL = "https://provider.test/v1";
    const fetcher = fakeFetch(["", 500], [completion(answer), 200]);
    const found = await importerOver(fetcher).import({ kind: "text", text: "Anzac biscuits\n1 cup plain flour" });
    expect(found.from).toBe("ai");
    expect(found.recipe.name).toBe("Anzac biscuits");
    expect(fetcher.calls).toEqual(["https://provider.test/v1/chat/completions"]);
  });

  test("the provider's failures keep their kind as ImportErrors", async () => {
    process.env.AI_API_KEY = "k";
    const caught = await importerOver(fakeFetch(["", 500], ["{}", 429]))
      .import({ kind: "text", text: "text" })
      .catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(ImportError);
    expect((caught as ImportError).kind).toBe("failed");
    expect((caught as Error).message).toMatch(/rate-limited/);
  });

  test("a key but no import model selected is unavailable, says where to choose one, and sends nothing (row 217)", async () => {
    process.env.AI_API_KEY = "k";
    delete chosen.import;
    const fetcher = fakeFetch(["", 500], [completion(answer), 200]);
    const caught = await importerOver(fetcher)
      .import({ kind: "text", text: "Anzac biscuits\n1 cup plain flour" })
      .catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(ImportError);
    expect((caught as ImportError).kind).toBe("unavailable");
    expect((caught as Error).message).toBe("No Recipe import model is selected. Choose one in Settings › AI.");
    expect(fetcher.calls).toEqual([]);
  });

  test("no key configured is unavailable rather than a crash, and nothing is sent", async () => {
    delete process.env.AI_API_KEY;
    const fetcher = fakeFetch(["", 500], [completion(answer), 200]);
    const caught = await importerOver(fetcher)
      .import({ kind: "text", text: "text" })
      .catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(ImportError);
    expect((caught as ImportError).kind).toBe("unavailable");
    expect(fetcher.calls).toHaveLength(0);
  });
});

describe("with no model configured (decisions.md row 203)", () => {
  test("a pasted page is read by the rules, and the absent model is never asked", async () => {
    const ai = { ...fakeAi(answer), configured: () => false };
    const importer = createImporter(async () => new Response("unused"), ai);
    const result = await importer.import({ kind: "text", text: SCHEMA_PAGE });
    expect(result.from).toBe("schema");
    expect(result.recipe.name).toBe("Anzac biscuits");
    expect(ai.calls).toEqual([]);
  });

  test("plain text is an unavailable read, said once, not a call that fails", async () => {
    const ai = { ...fakeAi(answer), configured: () => false };
    const importer = createImporter(async () => new Response("unused"), ai);
    await expect(importer.import({ kind: "text", text: "1 cup plain flour\nMix." })).rejects.toMatchObject({ kind: "unavailable" });
    expect(ai.calls).toEqual([]);
  });
});

test("a pasted page whose recipe card placed everything is not sent to the model (decisions.md row 204)", async () => {
  const ai = fakeAi(answer);
  const importer = createImporter(async () => new Response("unused"), ai);
  const node = {
    "@type": "Recipe",
    name: "Grouped",
    recipeIngredient: ["1 cup plain flour"],
    recipeInstructions: [{ "@type": "HowToSection", name: "Dough", itemListElement: [{ "@type": "HowToStep", text: "Mix." }] }],
  };
  const card = `<div class="wprm-recipe-ingredients-container"><div class="wprm-recipe-ingredient-group"><h4 class="wprm-recipe-group-name">Dough</h4><ul><li class="wprm-recipe-ingredient"><span class="wprm-recipe-ingredient-name">plain flour</span></li></ul></div></div>`;
  const result = await importer.import({
    kind: "text",
    text: `<html><head><script type="application/ld+json">${JSON.stringify(node)}</script></head><body>${card}</body></html>`,
  });
  expect(result.partsFromPage).toBe("complete");
  expect(result.recipe.parts.map((part) => part.name)).toEqual(["Dough"]);
  expect(ai.calls).toEqual([]);
});
