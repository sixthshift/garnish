// The model client (decisions.md row 75): the configuration, the request
// shape, the fetch runner's error mapping and the fence stripper. No provider
// is ever called here — a test that spends a request is not a test — so every
// case drives `createFetchRunner` with a fake `fetch`. What is asked of the
// model is the import's and the restyle's business, tested beside them.
import { afterEach, describe, expect, test } from "vitest";
import {
  AI_TIMEOUT_MS,
  AiError,
  aiConfigured,
  aiSettings,
  chatRequestBody,
  createFetchRunner,
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  type Fetcher,
  httpFailureMessage,
  stripFence,
} from "../../../src/server/ai/client";

/** A stand-in for a caller's answer shape: the client does not care what it is. */
const SCHEMA = { type: "object", additionalProperties: false, required: ["a"], properties: { a: { type: "number" } } } as const;
const ask = { schema: SCHEMA, schemaName: "test" };

const answer = JSON.stringify({ a: 1 });

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
    const body = chatRequestBody("PROMPT", "gemini-x", SCHEMA, "test");
    expect(body.model).toBe("gemini-x");
    expect(body.messages).toEqual([{ role: "user", content: "PROMPT" }]);
    expect(body.response_format).toEqual({ type: "json_schema", json_schema: { name: "test", schema: SCHEMA, strict: true } });
    expect(body.temperature).toBe(0);
  });

  test("the deadline is a minute", () => {
    expect(AI_TIMEOUT_MS).toBe(60_000);
  });
});

describe("createFetchRunner", () => {
  test("POSTs to the configured endpoint with the key, and returns the message content", async () => {
    process.env.AI_API_KEY = "secret";
    process.env.AI_BASE_URL = "https://provider.test/v1";
    process.env.AI_MODEL = "some-model";
    const fetcher = fakeFetch(200, completion(answer));
    const content = await createFetchRunner(fetcher, ask)("PROMPT", AI_TIMEOUT_MS);
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
    const caught = await createFetchRunner(fetcher, ask)("PROMPT", 1000).catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(AiError);
    expect((caught as AiError).kind).toBe("unavailable");
    expect(fetcher.calls).toHaveLength(0);
  });

  test("401, 403, 429 and any other non-2xx are failures that say which", async () => {
    process.env.AI_API_KEY = "k";
    for (const [status, pattern] of [
      [401, /rejected the API key/i],
      [403, /rejected the API key/i],
      [404, /does not know that model/i],
      [503, /overloaded/i],
      [429, /rate-limited.*try again in a minute/i],
      [500, /answered 500/],
    ] as const) {
      const caught = await createFetchRunner(fakeFetch(status, { error: "nope" }), ask)("PROMPT", 1000).catch((cause: unknown) => cause);
      expect(caught, String(status)).toBeInstanceOf(AiError);
      expect((caught as AiError).kind, String(status)).toBe("failed");
      expect((caught as Error).message, String(status)).toMatch(pattern);
    }
    expect(httpFailureMessage(402)).toContain("402");
  });

  test("an aborted request is the deadline", async () => {
    process.env.AI_API_KEY = "k";
    const fetcher: Fetcher = () => Promise.reject(new DOMException("The operation timed out.", "TimeoutError"));
    const caught = await createFetchRunner(fetcher, ask)("PROMPT", 1).catch((cause: unknown) => cause);
    expect((caught as AiError).kind).toBe("timeout");
    expect((caught as Error).message).toMatch(/too long/i);
  });

  test("a network error is a failure naming what happened", async () => {
    process.env.AI_API_KEY = "k";
    const fetcher: Fetcher = () => Promise.reject(new TypeError("connection refused"));
    const caught = await createFetchRunner(fetcher, ask)("PROMPT", 1000).catch((cause: unknown) => cause);
    expect((caught as AiError).kind).toBe("failed");
    expect((caught as Error).message).toMatch(/connection refused/);
  });

  test("an envelope with no message content is malformed", async () => {
    process.env.AI_API_KEY = "k";
    for (const body of [{ choices: [] }, { choices: [{ message: {} }] }, { choices: [{ message: { content: "" } }] }, "not json"]) {
      const caught = await createFetchRunner(fakeFetch(200, body), ask)("PROMPT", 1000).catch((cause: unknown) => cause);
      expect(caught, JSON.stringify(body)).toBeInstanceOf(AiError);
      expect((caught as AiError).kind, JSON.stringify(body)).toBe("malformed");
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
