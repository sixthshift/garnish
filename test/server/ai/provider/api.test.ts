// The OpenAI-compatible provider (decisions.md row 75): the configuration, the
// request shape, the error mapping, the connection check and the fence
// stripper. No provider is ever called here — a test that spends a request is
// not a test — so every case drives `apiProvider` with a fake `fetch`. What
// is asked of the model is the import's and the restyle's business, tested
// beside them.
import { afterEach, describe, expect, test } from "vitest";
import { AI_TIMEOUT_MS, AiError, type Fetcher, stripFence } from "../../../../src/server/ai/client";
import {
  apiProvider,
  apiSettings,
  chatRequestBody,
  checkModels,
  DEFAULT_AI_BASE_URL,
  DEFAULT_API_MODEL,
  httpFailureMessage,
  modelName,
  providerReason,
} from "../../../../src/server/ai/provider/api";

/** A stand-in for a caller's answer shape: the client does not care what it is. */
const SCHEMA = { type: "object", additionalProperties: false, required: ["a"], properties: { a: { type: "number" } } } as const;

/** One question of the import's model, as the importer asks it. */
function ask(fetcher: Fetcher, timeoutMs: number): Promise<string> {
  const ai = apiProvider(fetcher);
  return ai.ask({ prompt: "PROMPT", schema: SCHEMA, schemaName: "test", model: ai.model("import"), timeoutMs });
}

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

const KEYS = ["AI_API_KEY", "AI_BASE_URL", "AI_IMPORT_MODEL", "AI_RESTYLE_MODEL", "AI_PLANNER_MODEL"] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("the configuration", () => {
  test("a key is the whole of it; the base URL and every model default to Gemini's free tier", () => {
    delete process.env.AI_BASE_URL;
    for (const name of ["AI_IMPORT_MODEL", "AI_RESTYLE_MODEL", "AI_PLANNER_MODEL"]) delete process.env[name];
    process.env.AI_API_KEY = "k";
    const ai = apiProvider();
    expect(ai.configured()).toBe(true);
    expect(apiSettings()).toEqual({ apiKey: "k", baseUrl: DEFAULT_AI_BASE_URL });
    expect([ai.model("import"), ai.model("restyle"), ai.model("planner")]).toEqual([DEFAULT_API_MODEL, DEFAULT_API_MODEL, DEFAULT_API_MODEL]);
    expect(DEFAULT_AI_BASE_URL).toBe("https://generativelanguage.googleapis.com/v1beta/openai");
  });

  test("each use's model is its own variable, and none follows another's", () => {
    process.env.AI_IMPORT_MODEL = "import-model";
    process.env.AI_PLANNER_MODEL = "planner-model";
    delete process.env.AI_RESTYLE_MODEL;
    const ai = apiProvider();
    expect([ai.model("import"), ai.model("restyle"), ai.model("planner")]).toEqual(["import-model", DEFAULT_API_MODEL, "planner-model"]);
  });

  test("an unset or blank key is not configured, and a trailing slash on the base URL is dropped", () => {
    delete process.env.AI_API_KEY;
    expect(apiProvider().configured()).toBe(false);
    process.env.AI_API_KEY = "   ";
    expect(apiProvider().configured()).toBe(false);
    process.env.AI_API_KEY = "k";
    process.env.AI_BASE_URL = "http://ollama.lan:11434/v1/";
    expect(apiSettings()).toEqual({ apiKey: "k", baseUrl: "http://ollama.lan:11434/v1" });
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

describe("ask", () => {
  test("POSTs to the configured endpoint with the key, and returns the message content", async () => {
    process.env.AI_API_KEY = "secret";
    process.env.AI_BASE_URL = "https://provider.test/v1";
    process.env.AI_IMPORT_MODEL = "some-model";
    const fetcher = fakeFetch(200, completion(answer));
    const content = await ask(fetcher, AI_TIMEOUT_MS);
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
    const caught = await ask(fetcher, 1000).catch((cause: unknown) => cause);
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
      const caught = await ask(fakeFetch(status, { error: "nope" }), 1000).catch((cause: unknown) => cause);
      expect(caught, String(status)).toBeInstanceOf(AiError);
      expect((caught as AiError).kind, String(status)).toBe("failed");
      expect((caught as Error).message, String(status)).toMatch(pattern);
    }
    expect(httpFailureMessage(402)).toContain("402");
  });

  test("an aborted request is the deadline", async () => {
    process.env.AI_API_KEY = "k";
    const fetcher: Fetcher = () => Promise.reject(new DOMException("The operation timed out.", "TimeoutError"));
    const caught = await ask(fetcher, 1).catch((cause: unknown) => cause);
    expect((caught as AiError).kind).toBe("timeout");
    expect((caught as Error).message).toMatch(/too long/i);
  });

  test("a network error is a failure naming what happened", async () => {
    process.env.AI_API_KEY = "k";
    const fetcher: Fetcher = () => Promise.reject(new TypeError("connection refused"));
    const caught = await ask(fetcher, 1000).catch((cause: unknown) => cause);
    expect((caught as AiError).kind).toBe("failed");
    expect((caught as Error).message).toMatch(/connection refused/);
  });

  test("an envelope with no message content is malformed", async () => {
    process.env.AI_API_KEY = "k";
    for (const body of [{ choices: [] }, { choices: [{ message: {} }] }, { choices: [{ message: { content: "" } }] }, "not json"]) {
      const caught = await ask(fakeFetch(200, body), 1000).catch((cause: unknown) => cause);
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

function configure(env: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, env);
}

describe("the model names", () => {
  test("Gemini's models/ prefix is not part of the name a model variable uses", () => {
    expect(modelName("models/gemini-flash-lite-latest")).toBe("gemini-flash-lite-latest");
    expect(modelName("gpt-4o-mini")).toBe("gpt-4o-mini");
  });

  test("each use is marked by whether the list names its model", () => {
    expect(checkModels(["models/a", "b"], { import: "a", restyle: "b", planner: "c" })).toEqual([
      { use: "import", model: "a", listed: true },
      { use: "restyle", model: "b", listed: true },
      { use: "planner", model: "c", listed: false },
    ]);
  });
});

describe("check", () => {
  test("without a key nothing is fetched", async () => {
    configure({});
    const fetcher = fakeFetch(200, { data: [] });
    const result = await apiProvider(fetcher).check();
    expect(result.ok).toBe(false);
    expect(fetcher.calls).toHaveLength(0);
  });

  test("a GET of the model list with the key, never a completion", async () => {
    configure({ AI_API_KEY: "k", AI_BASE_URL: "http://llm.lan/v1/", AI_IMPORT_MODEL: "m", AI_RESTYLE_MODEL: "m", AI_PLANNER_MODEL: "p" });
    const fetcher = fakeFetch(200, { data: [{ id: "m" }, { id: "p" }] });
    const result = await apiProvider(fetcher).check();
    expect(fetcher.calls).toHaveLength(1);
    expect(fetcher.calls[0]?.url).toBe("http://llm.lan/v1/models");
    expect(fetcher.calls[0]?.init?.method).toBeUndefined();
    expect(fetcher.calls[0]?.init?.body).toBeUndefined();
    expect(new Headers(fetcher.calls[0]?.init?.headers).get("authorization")).toBe("Bearer k");
    expect(result).toEqual({
      ok: true,
      baseUrl: "http://llm.lan/v1",
      credentialProved: true,
      models: [
        { use: "import", model: "m", listed: true },
        { use: "restyle", model: "m", listed: true },
        { use: "planner", model: "p", listed: true },
      ],
      offered: [{ name: "m" }, { name: "p" }],
    });
  });

  test("lists what the provider offers by the name a model variable uses, once each, sorted", async () => {
    configure({ AI_API_KEY: "k" });
    const gemini = { data: [{ id: "models/gemini-pro-latest" }, { id: "models/gemini-flash-lite-latest" }, { id: "gemini-flash-lite-latest" }] };
    const result = await apiProvider(fakeFetch(200, gemini)).check();
    expect(result).toMatchObject({ ok: true, offered: [{ name: "gemini-flash-lite-latest" }, { name: "gemini-pro-latest" }] });
  });

  test("a rejected key says so", async () => {
    configure({ AI_API_KEY: "bad" });
    const result = await apiProvider(fakeFetch(401, {})).check();
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("AI_API_KEY") });
  });

  test("a refusal carries the provider's own reason, since Gemini answers a bad key with 400", async () => {
    configure({ AI_API_KEY: "bad" });
    const gemini = [{ error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } }];
    expect(await apiProvider(fakeFetch(400, gemini)).check()).toMatchObject({
      ok: false,
      message: "The model provider answered 400: API key not valid. Please pass a valid API key.",
    });
    expect(providerReason({ error: { message: "Incorrect API key provided" } })).toBe("Incorrect API key provided");
    expect(providerReason("<html>")).toBeNull();
  });

  test("a 404 is the address, not the model", async () => {
    configure({ AI_API_KEY: "k" });
    const result = await apiProvider(fakeFetch(404, {})).check();
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("AI_BASE_URL") });
  });

  test("an unreachable host and a non-JSON answer both fail without throwing", async () => {
    configure({ AI_API_KEY: "k" });
    const refused: Fetcher = () => Promise.reject(new TypeError("connection refused"));
    expect(await apiProvider(refused).check()).toMatchObject({ ok: false, message: expect.stringContaining("connection refused") });
    expect(await apiProvider(fakeFetch(200, "<html>")).check()).toMatchObject({ ok: false, message: expect.stringContaining("not with JSON") });
  });
});
