// The AI import rung (M34.5, M36.1, decisions.md rows 74 and 75): the request
// shape, the answer parser, and the whole read against an injected runner. No
// provider is ever called here — a test that spends a request is not a test —
// so every case drives `runAiImport` with a fake runner, or `createFetchRunner`
// with a fake `fetch`.
import { afterEach, describe, expect, test } from "vitest";
import {
  AI_IMPORT_TIMEOUT_MS,
  aiConfigured,
  aiPrompt,
  aiSettings,
  AiImportError,
  type AiRunner,
  chatRequestBody,
  createFetchRunner,
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  type Fetcher,
  httpFailureMessage,
  ImportFromTextInput,
  MAX_AI_TEXT,
  parseAiAnswer,
  runAiImport,
  SCRAPED_JSON_SCHEMA,
  stripFence,
} from "../../src/server/aiImport";
import { aiImportAvailable, importFromText } from "../../src/server/aiImport";
import { ScrapedRecipeSchema } from "../../src/domain/schemaRecipe";
import { callServerFn, useTempDataDir } from "../helpers/server";

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
  ingredients: ["1 cup plain flour", "125 g butter"],
  parts: [
    { name: "", steps: ["Mix the dry ingredients.", "Bake for 15 minutes."] },
    { name: "Golden syrup mixture", steps: ["Melt the butter and syrup."] },
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

describe("the configuration", () => {
  test("a key is the whole of it; the base URL and model default to Gemini's free tier", () => {
    delete process.env.AI_BASE_URL;
    delete process.env.AI_MODEL;
    process.env.AI_API_KEY = "k";
    expect(aiConfigured()).toBe(true);
    expect(aiSettings()).toEqual({ apiKey: "k", baseUrl: DEFAULT_AI_BASE_URL, model: DEFAULT_AI_MODEL });
    expect(DEFAULT_AI_BASE_URL).toBe("https://generativelanguage.googleapis.com/v1beta/openai");
  });

  test("an unset or blank key is not configured, and a trailing slash on the base URL is dropped", () => {
    delete process.env.AI_API_KEY;
    expect(aiConfigured()).toBe(false);
    process.env.AI_API_KEY = "   ";
    expect(aiConfigured()).toBe(false);
    process.env.AI_API_KEY = "k";
    process.env.AI_BASE_URL = "http://ollama.lan:11434/v1/";
    process.env.AI_MODEL = "llama3.2";
    expect(aiSettings()).toEqual({ apiKey: "k", baseUrl: "http://ollama.lan:11434/v1", model: "llama3.2" });
  });
});

describe("the request", () => {
  test("is one user turn, the schema as structured output, and no creativity", () => {
    const body = chatRequestBody(aiPrompt("Anzac biscuits\n1 cup flour"), "gemini-x");
    expect(body.model).toBe("gemini-x");
    expect(body.messages).toEqual([{ role: "user", content: expect.stringContaining("Anzac biscuits") }]);
    expect(body.response_format).toEqual({ type: "json_schema", json_schema: { name: "recipe", schema: SCRAPED_JSON_SCHEMA, strict: true } });
    expect(body.temperature).toBe(0);
  });

  test("the prompt carries the text and the rules that keep the answer honest", () => {
    const prompt = aiPrompt("some prose");
    expect(prompt).toContain("some prose");
    expect(prompt).toMatch(/verbatim/);
    expect(prompt).toMatch(/Never invent/);
  });

  test("the JSON Schema names exactly the fields the zod schema does, and requires all of them", () => {
    const zodKeys = Object.keys(ScrapedRecipeSchema.shape).sort();
    expect(Object.keys(SCRAPED_JSON_SCHEMA.properties).sort()).toEqual(zodKeys);
    expect([...SCRAPED_JSON_SCHEMA.required].sort()).toEqual(zodKeys);
    expect(SCRAPED_JSON_SCHEMA.additionalProperties).toBe(false);
  });

  test("the deadline is a minute", () => {
    expect(AI_IMPORT_TIMEOUT_MS).toBe(60_000);
  });
});

describe("createFetchRunner", () => {
  test("POSTs to the configured endpoint with the key, and returns the message content", async () => {
    process.env.AI_API_KEY = "secret";
    process.env.AI_BASE_URL = "https://provider.test/v1";
    process.env.AI_MODEL = "some-model";
    const fetcher = fakeFetch(200, completion(answer));
    const content = await createFetchRunner(fetcher)("PROMPT", AI_IMPORT_TIMEOUT_MS);
    expect(content).toBe(answer);
    expect(fetcher.calls).toHaveLength(1);
    const call = fetcher.calls[0]!;
    expect(call.url).toBe("https://provider.test/v1/chat/completions");
    expect(call.init?.method).toBe("POST");
    expect((call.init?.headers as Record<string, string>).authorization).toBe("Bearer secret");
    expect(JSON.parse(String(call.init?.body)).model).toBe("some-model");
    expect(call.init?.signal).toBeInstanceOf(AbortSignal);
  });

  test("no key is unavailable, and nothing is sent", async () => {
    delete process.env.AI_API_KEY;
    const fetcher = fakeFetch(200, completion(answer));
    const caught = await createFetchRunner(fetcher)("PROMPT", 1000).catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(AiImportError);
    expect((caught as AiImportError).kind).toBe("unavailable");
    expect(fetcher.calls).toHaveLength(0);
  });

  test("401, 403, 429 and any other non-2xx are failures that say which", async () => {
    process.env.AI_API_KEY = "k";
    for (const [status, pattern] of [
      [401, /rejected the API key/i],
      [403, /rejected the API key/i],
      [429, /rate-limited.*try again in a minute/i],
      [500, /answered 500/],
    ] as const) {
      const caught = await createFetchRunner(fakeFetch(status, { error: "nope" }))("PROMPT", 1000).catch((cause: unknown) => cause);
      expect(caught, String(status)).toBeInstanceOf(AiImportError);
      expect((caught as AiImportError).kind, String(status)).toBe("failed");
      expect((caught as Error).message, String(status)).toMatch(pattern);
    }
    expect(httpFailureMessage(402)).toContain("402");
  });

  test("an aborted request is the deadline", async () => {
    process.env.AI_API_KEY = "k";
    const fetcher: Fetcher = () => Promise.reject(new DOMException("The operation timed out.", "TimeoutError"));
    const caught = await createFetchRunner(fetcher)("PROMPT", 1).catch((cause: unknown) => cause);
    expect((caught as AiImportError).kind).toBe("timeout");
    expect((caught as Error).message).toMatch(/too long/i);
  });

  test("a network error is a failure naming what happened", async () => {
    process.env.AI_API_KEY = "k";
    const fetcher: Fetcher = () => Promise.reject(new TypeError("connection refused"));
    const caught = await createFetchRunner(fetcher)("PROMPT", 1000).catch((cause: unknown) => cause);
    expect((caught as AiImportError).kind).toBe("failed");
    expect((caught as Error).message).toMatch(/connection refused/);
  });

  test("an envelope with no message content is malformed", async () => {
    process.env.AI_API_KEY = "k";
    for (const body of [{ choices: [] }, { choices: [{ message: {} }] }, { choices: [{ message: { content: "" } }] }, "not json"]) {
      const caught = await createFetchRunner(fakeFetch(200, body))("PROMPT", 1000).catch((cause: unknown) => cause);
      expect(caught, JSON.stringify(body)).toBeInstanceOf(AiImportError);
      expect((caught as AiImportError).kind, JSON.stringify(body)).toBe("malformed");
    }
  });
});

describe("stripFence", () => {
  test("takes a fenced answer down to its JSON and leaves a bare one alone", () => {
    expect(stripFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFence('```\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFence('  {"a":1} ')).toBe('{"a":1}');
  });
});

describe("parseAiAnswer", () => {
  test("reads the recipe out of the message content", () => {
    const recipe = parseAiAnswer(answer);
    expect(recipe.name).toBe("Anzac biscuits");
    expect(recipe.ingredients).toEqual(["1 cup plain flour", "125 g butter"]);
    expect(recipe.parts.map((part) => part.name)).toEqual(["", "Golden syrup mixture"]);
  });

  test("reads a fenced answer from a model that fences anyway", () => {
    expect(parseAiAnswer("```json\n" + answer + "\n```").name).toBe("Anzac biscuits");
  });

  test("fills what the answer left out, and always has a main body", () => {
    const recipe = parseAiAnswer(JSON.stringify({ name: "Toast", ingredients: ["bread"] }));
    expect(recipe).toEqual({
      name: "Toast",
      description: "",
      image: null,
      servings: 0,
      yieldText: "",
      prepMinutes: null,
      cookMinutes: null,
      tags: [],
      ingredients: ["bread"],
      parts: [{ name: "", steps: [] }],
    });
  });

  test("garbage, prose and the wrong shape are all malformed", () => {
    for (const content of [
      "not json at all",
      "",
      "Sorry, I could not find a recipe.",
      JSON.stringify({ name: 42, ingredients: "flour" }),
      JSON.stringify({ description: "no name" }),
    ]) {
      const caught = (() => {
        try {
          parseAiAnswer(content);
        } catch (cause) {
          return cause;
        }
      })();
      expect(caught, content).toBeInstanceOf(AiImportError);
      expect((caught as AiImportError).kind, content).toBe("malformed");
    }
  });

  test("an answer with nothing in it is a miss rather than an empty recipe", () => {
    expect(() => parseAiAnswer(JSON.stringify({ name: "", ingredients: [], parts: [] }))).toThrow(/no recipe/i);
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
    expect(run.calls[0]!.timeoutMs).toBe(AI_IMPORT_TIMEOUT_MS);
    expect(run.calls[0]!.prompt).toContain("Anzac biscuits");
  });

  test("a fenced answer is read the same way", async () => {
    const imported = await runAiImport("text", { run: fakeRunner("```json\n" + answer + "\n```") });
    expect(imported.recipe.name).toBe("Anzac biscuits");
  });

  test("garbage is malformed, and nothing about it looks like a recipe", async () => {
    const caught = await runAiImport("text", { run: fakeRunner("here is your recipe!") }).catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(AiImportError);
    expect((caught as AiImportError).kind).toBe("malformed");
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
    expect((caught as AiImportError).kind).toBe("failed");
    expect((caught as Error).message).toMatch(/rate-limited/);
  });

  test("no key configured is an unavailable error rather than a crash", async () => {
    delete process.env.AI_API_KEY;
    const caught = await runAiImport("text", { fetcher: fakeFetch(200, completion(answer)) }).catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(AiImportError);
    expect((caught as AiImportError).kind).toBe("unavailable");
  });

  test("a runner that throws something else is a plain failure", async () => {
    const run: AiRunner = () => Promise.reject(new Error("boom"));
    const caught = await runAiImport("text", { run }).catch((cause: unknown) => cause);
    expect((caught as AiImportError).kind).toBe("failed");
    expect((caught as Error).message).toMatch(/boom/);
  });

  test("empty and oversized pastes never reach the runner", async () => {
    const run = fakeRunner(answer);
    await expect(runAiImport("   ", { run })).rejects.toThrow(/Paste the recipe/);
    await expect(runAiImport("x".repeat(MAX_AI_TEXT + 1), { run })).rejects.toThrow(/too much text/);
    expect(run.calls).toHaveLength(0);
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
});
