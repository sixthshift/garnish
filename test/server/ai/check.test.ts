// The connection check behind Settings' "Test connection": one GET of the
// provider's model list, never a completion. Driven with a fake `fetch`.
import { afterEach, describe, expect, test } from "vitest";
import { checkConnection, checkModels, modelName, providerReason } from "../../../src/server/ai/check";
import type { Fetcher } from "../../../src/server/ai/client";

function fakeFetch(status: number, body: unknown): Fetcher & { calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = ((url, init) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
  }) as Fetcher & { calls: typeof calls };
  fetcher.calls = calls;
  return fetcher;
}

const KEYS = ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL", "AI_RESTYLE_MODEL", "AI_PLANNER_MODEL"] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function configure(env: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, env);
}

describe("the model names", () => {
  test("Gemini's models/ prefix is not part of the name AI_MODEL uses", () => {
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

describe("checkConnection", () => {
  test("without a key nothing is fetched", async () => {
    configure({});
    const fetcher = fakeFetch(200, { data: [] });
    const result = await checkConnection(fetcher);
    expect(result.ok).toBe(false);
    expect(fetcher.calls).toHaveLength(0);
  });

  test("a GET of the model list with the key, never a completion", async () => {
    configure({ AI_API_KEY: "k", AI_BASE_URL: "http://llm.lan/v1/", AI_MODEL: "m", AI_PLANNER_MODEL: "p" });
    const fetcher = fakeFetch(200, { data: [{ id: "m" }, { id: "p" }] });
    const result = await checkConnection(fetcher);
    expect(fetcher.calls).toHaveLength(1);
    expect(fetcher.calls[0]?.url).toBe("http://llm.lan/v1/models");
    expect(fetcher.calls[0]?.init?.method).toBeUndefined();
    expect(fetcher.calls[0]?.init?.body).toBeUndefined();
    expect(new Headers(fetcher.calls[0]?.init?.headers).get("authorization")).toBe("Bearer k");
    expect(result).toEqual({
      ok: true,
      baseUrl: "http://llm.lan/v1",
      models: [
        { use: "import", model: "m", listed: true },
        { use: "restyle", model: "m", listed: true },
        { use: "planner", model: "p", listed: true },
      ],
    });
  });

  test("a rejected key says so", async () => {
    configure({ AI_API_KEY: "bad" });
    const result = await checkConnection(fakeFetch(401, {}));
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("AI_API_KEY") });
  });

  test("a refusal carries the provider's own reason, since Gemini answers a bad key with 400", async () => {
    configure({ AI_API_KEY: "bad" });
    const gemini = [{ error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } }];
    expect(await checkConnection(fakeFetch(400, gemini))).toMatchObject({
      ok: false,
      message: "The model provider answered 400: API key not valid. Please pass a valid API key.",
    });
    expect(providerReason({ error: { message: "Incorrect API key provided" } })).toBe("Incorrect API key provided");
    expect(providerReason("<html>")).toBeNull();
  });

  test("a 404 is the address, not the model", async () => {
    configure({ AI_API_KEY: "k" });
    const result = await checkConnection(fakeFetch(404, {}));
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("AI_BASE_URL") });
  });

  test("an unreachable host and a non-JSON answer both fail without throwing", async () => {
    configure({ AI_API_KEY: "k" });
    const refused: Fetcher = () => Promise.reject(new TypeError("connection refused"));
    expect(await checkConnection(refused)).toMatchObject({ ok: false, message: expect.stringContaining("connection refused") });
    expect(await checkConnection(fakeFetch(200, "<html>"))).toMatchObject({ ok: false, message: expect.stringContaining("not with JSON") });
  });
});
