// Choosing the provider: `AI_PROVIDER` routes, with no default, and each
// provider reads only its own credential. Nothing is asked of a model here.
import { afterEach, describe, expect, test } from "vitest";
import { AiError } from "../../../../src/server/ai/client";
import serverAi, { noProvider, providerChoice } from "../../../../src/server/ai/provider";
import { DEFAULT_CLAUDE_CODE_MODEL } from "../../../../src/server/ai/provider/claudeCode";

const KEYS = ["AI_PROVIDER", "AI_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN", "AI_IMPORT_MODEL"] as const;
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

describe("providerChoice", () => {
  test("names a provider only by its exact name", () => {
    expect(providerChoice("api")).toEqual({ name: "api" });
    expect(providerChoice(" claude-code ")).toEqual({ name: "claude-code" });
  });

  test("unset is no provider, and says which to set", () => {
    // Unset in the environment (a `.env` loaded into the test run may set it), and set but blank.
    configure({});
    for (const value of [undefined, "", "  "]) {
      const choice = providerChoice(value);
      expect(choice, String(value)).toHaveProperty("problem");
      expect((choice as { problem: string }).problem).toMatch(/AI_PROVIDER to api .* or claude-code/);
    }
  });

  test("anything else is no provider either, naming what was set", () => {
    for (const value of ["openai", "claude_code", "API"]) {
      expect((providerChoice(value) as { problem: string }).problem, value).toContain(`AI_PROVIDER is "${value}"`);
    }
  });
});

describe("noProvider", () => {
  test("is never configured; its check fails and its questions are unavailable, each saying why", async () => {
    const ai = noProvider("Because.");
    expect(ai.configured()).toBe(false);
    expect(ai.status()).toMatchObject({ provider: null, problem: "Because.", configured: false, models: [] });
    expect(await ai.check()).toEqual({ ok: false, baseUrl: "", message: "Because." });
    const caught = await ai.ask({ prompt: "P", schema: {}, schemaName: "s", model: "m", timeoutMs: 1 }).catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(AiError);
    expect(caught).toMatchObject({ kind: "unavailable", message: "Because." });
  });
});

describe("the server's client", () => {
  test("a key without AI_PROVIDER is not configured: the key does not choose", () => {
    configure({ AI_API_KEY: "k" });
    expect(serverAi.configured()).toBe(false);
    expect(serverAi.status()).toMatchObject({ provider: null, problem: expect.stringContaining("No AI provider is set") });
  });

  test("with both credentials set, AI_PROVIDER alone decides which is read", () => {
    configure({ AI_PROVIDER: "api", AI_API_KEY: "k", CLAUDE_CODE_OAUTH_TOKEN: "tok" });
    expect(serverAi.status()).toMatchObject({ provider: "api", credential: "AI_API_KEY", configured: true });

    configure({ AI_PROVIDER: "claude-code", AI_API_KEY: "k" });
    expect(serverAi.status()).toMatchObject({ provider: "claude-code", credential: "CLAUDE_CODE_OAUTH_TOKEN", configured: false });
    expect(serverAi.model("import")).toBe(DEFAULT_CLAUDE_CODE_MODEL);
  });

  test("AI_PROVIDER is read on every call", () => {
    configure({ AI_PROVIDER: "api", AI_API_KEY: "k" });
    expect(serverAi.configured()).toBe(true);
    process.env.AI_PROVIDER = "nonsense";
    expect(serverAi.configured()).toBe(false);
    expect(serverAi.status().problem).toContain('"nonsense"');
  });
});
