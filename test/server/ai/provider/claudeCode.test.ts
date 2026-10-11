// The Claude Code provider: the configuration, the lockdown every session runs
// under, what is asked, the error mapping and the connection check. Claude
// Code is never started here — no binary, no token, no subscription spent — so
// every case drives `claudeCodeProvider` with a fake ask and a fake inspection.
import { tmpdir } from "node:os";
import { NoObjectGeneratedError } from "ai";
import { createAPICallError, createAuthenticationError, createTimeoutError } from "ai-sdk-provider-claude-code";
import { afterEach, describe, expect, test } from "vitest";
import { AI_TIMEOUT_MS, AiError, type AiRequest } from "../../../../src/server/ai/client";
import {
  CLAUDE_CODE_ENDPOINT,
  type ClaudeCodeAsk,
  type ClaudeCodeInspect,
  claudeCodeFailure,
  claudeCodeProvider,
  claudeCodeSettings,
  DEFAULT_CLAUDE_CODE_MODEL,
  lockedSettings,
} from "../../../../src/server/ai/provider/claudeCode";

const SCHEMA = { type: "object", additionalProperties: false, required: ["a"], properties: { a: { type: "number" } } } as const;

const KEYS = [
  "AI_PROVIDER",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "CLAUDE_CODE_EXECUTABLE",
  "AI_API_KEY",
  "AI_IMPORT_MODEL",
  "AI_RESTYLE_MODEL",
  "AI_PLANNER_MODEL",
] as const;
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

/** An ask that answers with `output` (or throws what `output` returns), recording each question. */
function fakeAsk(output: unknown | (() => never)): ClaudeCodeAsk & { calls: Parameters<ClaudeCodeAsk>[0][] } {
  const calls: Parameters<ClaudeCodeAsk>[0][] = [];
  const ask = (async (question) => {
    calls.push(question);
    return typeof output === "function" ? (output as () => never)() : output;
  }) as ClaudeCodeAsk & { calls: typeof calls };
  ask.calls = calls;
  return ask;
}

const request = (model = "haiku"): AiRequest => ({ prompt: "PROMPT", schema: SCHEMA, schemaName: "test", model, timeoutMs: AI_TIMEOUT_MS });

describe("the configuration", () => {
  test("the token is the whole of it, and the model defaults to haiku", () => {
    configure({ CLAUDE_CODE_OAUTH_TOKEN: " sk-ant-oat-x " });
    expect(claudeCodeSettings()).toEqual({ token: "sk-ant-oat-x", executable: undefined });
    expect(claudeCodeProvider().model("import")).toBe(DEFAULT_CLAUDE_CODE_MODEL);
    expect(claudeCodeProvider().configured()).toBe(true);
    configure({ CLAUDE_CODE_OAUTH_TOKEN: "  " });
    expect(claudeCodeProvider().configured()).toBe(false);
  });

  test("each use's model variable means what it means for the other provider, over haiku", () => {
    configure({ AI_IMPORT_MODEL: "sonnet", AI_PLANNER_MODEL: "opus" });
    const ai = claudeCodeProvider();
    expect([ai.model("import"), ai.model("restyle"), ai.model("planner")]).toEqual(["sonnet", DEFAULT_CLAUDE_CODE_MODEL, "opus"]);
  });

  test("the status names the token's variable and never the token", () => {
    configure({ CLAUDE_CODE_OAUTH_TOKEN: "sk-ant-oat-secret" });
    const status = claudeCodeProvider().status();
    expect(status).toMatchObject({ provider: "claude-code", credential: "CLAUDE_CODE_OAUTH_TOKEN", configured: true, baseUrl: CLAUDE_CODE_ENDPOINT });
    expect(JSON.stringify(status)).not.toContain("secret");
  });
});

describe("the lockdown", () => {
  test("a model and nothing else: no tools, settings, MCP, prompts or saved session", () => {
    const settings = lockedSettings("tok", { cwd: "/tmp/w", configDir: "/tmp/c" });
    expect(settings).toMatchObject({
      tools: [],
      settingSources: [],
      mcpServers: {},
      permissionMode: "dontAsk",
      permissionPrompts: "none",
      persistSession: false,
    });
  });

  test("the subprocess gets the token and its own config directory, and none of the app's variables", () => {
    configure({ AI_API_KEY: "openai-key" });
    const settings = lockedSettings("tok", { cwd: "/tmp/w", configDir: "/tmp/c" });
    expect(settings.env).toEqual({ CLAUDE_CODE_OAUTH_TOKEN: "tok", CLAUDE_CONFIG_DIR: "/tmp/c" });
  });

  test("the binary is the SDK's own unless CLAUDE_CODE_EXECUTABLE names one, as the image does", () => {
    configure({});
    expect(lockedSettings("tok", { cwd: "/tmp/w", configDir: "/tmp/c" })).not.toHaveProperty("pathToClaudeCodeExecutable");
    configure({ CLAUDE_CODE_EXECUTABLE: "/usr/local/bin/claude" });
    expect(lockedSettings("tok", { cwd: "/tmp/w", configDir: "/tmp/c" }).pathToClaudeCodeExecutable).toBe("/usr/local/bin/claude");
  });

  test("by default a session runs in an empty folder under the temp directory, not the project", () => {
    const settings = lockedSettings("tok");
    expect(settings.cwd?.startsWith(tmpdir())).toBe(true);
    expect(settings.cwd).not.toContain(process.cwd());
  });
});

describe("ask", () => {
  test("asks the model given, with the schema, the prompt, the deadline and the lockdown, and hands back JSON text", async () => {
    configure({ CLAUDE_CODE_OAUTH_TOKEN: "tok" });
    const ask = fakeAsk({ a: 1 });
    const content = await claudeCodeProvider({ ask }).ask(request("sonnet"));
    expect(content).toBe('{"a":1}');
    expect(ask.calls).toHaveLength(1);
    const question = ask.calls[0]!;
    expect(question).toMatchObject({ model: "sonnet", prompt: "PROMPT", schema: SCHEMA, schemaName: "test", timeoutMs: AI_TIMEOUT_MS });
    expect(question.settings).toMatchObject({ tools: [], settingSources: [], persistSession: false });
    expect(question.settings.env?.CLAUDE_CODE_OAUTH_TOKEN).toBe("tok");
  });

  test("no token is unavailable, and nothing is started", async () => {
    configure({});
    const ask = fakeAsk({ a: 1 });
    const caught = await claudeCodeProvider({ ask })
      .ask(request())
      .catch((cause: unknown) => cause);
    expect((caught as AiError).kind).toBe("unavailable");
    expect((caught as Error).message).toContain("claude setup-token");
    expect(ask.calls).toHaveLength(0);
  });

  test("no structured output is malformed", async () => {
    configure({ CLAUDE_CODE_OAUTH_TOKEN: "tok" });
    for (const output of [undefined, null]) {
      const caught = await claudeCodeProvider({ ask: fakeAsk(output) })
        .ask(request())
        .catch((cause: unknown) => cause);
      expect((caught as AiError).kind, String(output)).toBe("malformed");
    }
  });

  test("a failure comes back as an AiError", async () => {
    configure({ CLAUDE_CODE_OAUTH_TOKEN: "tok" });
    const ask = fakeAsk(() => {
      throw createAuthenticationError({ message: "Invalid bearer token" });
    });
    const caught = await claudeCodeProvider({ ask })
      .ask(request())
      .catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(AiError);
    expect((caught as AiError).kind).toBe("failed");
  });
});

describe("claudeCodeFailure", () => {
  test("the deadline, from the abort or from the provider, is a timeout", () => {
    expect(claudeCodeFailure(new DOMException("The operation timed out.", "TimeoutError")).kind).toBe("timeout");
    expect(claudeCodeFailure(createTimeoutError({ message: "Request timed out" })).kind).toBe("timeout");
  });

  test("an answer that is not the shape asked for is malformed", () => {
    const noObject = new NoObjectGeneratedError({ message: "no object", response: {} as never, usage: {} as never, finishReason: "stop" });
    expect(claudeCodeFailure(noObject).kind).toBe("malformed");
  });

  test("a rejected token says to run claude setup-token; an account problem says signing in will not help", () => {
    expect(claudeCodeFailure(createAuthenticationError({ message: "Invalid bearer token" })).message).toMatch(/claude setup-token/);
    const hold = claudeCodeFailure(createAPICallError({ message: "Account on hold", errorKind: "account_on_hold", exitCode: 401 }));
    expect(hold.kind).toBe("failed");
    expect(hold.message).toMatch(/Signing in again will not fix it/);
  });

  test("the usage limit, overload and an unknown model each say which", () => {
    expect(claudeCodeFailure(createAPICallError({ message: "x", errorKind: "rate_limit" })).message).toMatch(/usage limit/);
    expect(claudeCodeFailure(createAPICallError({ message: "x", errorKind: "overloaded" })).message).toMatch(/overloaded/);
    expect(claudeCodeFailure(createAPICallError({ message: "x", errorKind: "model_not_found" })).message).toMatch(/Settings › AI/);
  });

  test("anything else is a failure carrying its own words, and an AiError passes through", () => {
    expect(claudeCodeFailure(new Error("spawn ENOENT"))).toMatchObject({ kind: "failed", message: expect.stringContaining("spawn ENOENT") });
    const own = new AiError("unavailable", "no");
    expect(claudeCodeFailure(own)).toBe(own);
  });
});

describe("check", () => {
  test("without a token nothing is started", async () => {
    configure({});
    let started = false;
    const inspect: ClaudeCodeInspect = async () => {
      started = true;
      return { account: { tokenSource: "CLAUDE_CODE_OAUTH_TOKEN" }, models: [] };
    };
    const result = await claudeCodeProvider({ inspect }).check();
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("CLAUDE_CODE_OAUTH_TOKEN") });
    expect(started).toBe(false);
  });

  test("marks each use by whether Claude Code offers its model, by name or full id, lists every model, and does not claim the token is proved", async () => {
    configure({ CLAUDE_CODE_OAUTH_TOKEN: "tok", AI_RESTYLE_MODEL: "claude-opus-5-5", AI_PLANNER_MODEL: "claude-mystery" });
    let seen: unknown;
    const offered = [
      { name: "default", resolvesTo: "claude-sonnet-5" },
      { name: "haiku", resolvesTo: "claude-haiku-4-5-20251001" },
      { name: "opus", resolvesTo: "claude-opus-5-5" },
    ];
    const inspect: ClaudeCodeInspect = async (settings) => {
      seen = settings;
      return { account: { tokenSource: "CLAUDE_CODE_OAUTH_TOKEN" }, models: offered };
    };
    expect(await claudeCodeProvider({ inspect }).check()).toEqual({
      ok: true,
      baseUrl: CLAUDE_CODE_ENDPOINT,
      credentialProved: false,
      models: [
        { use: "import", model: "haiku", listed: true },
        { use: "restyle", model: "claude-opus-5-5", listed: true },
        { use: "planner", model: "claude-mystery", listed: false },
      ],
      offered,
    });
    expect(seen).toMatchObject({ tools: [], settingSources: [], persistSession: false });
  });

  test("a session that did not pick the token up fails the check", async () => {
    configure({ CLAUDE_CODE_OAUTH_TOKEN: "tok" });
    const inspect: ClaudeCodeInspect = async () => ({ account: { tokenSource: "none" }, models: [{ name: "haiku" }] });
    expect(await claudeCodeProvider({ inspect }).check()).toMatchObject({ ok: false, message: expect.stringContaining("did not pick up") });
  });

  test("a failure to start, or no answer in time, is reported and never thrown", async () => {
    configure({ CLAUDE_CODE_OAUTH_TOKEN: "tok" });
    const refused: ClaudeCodeInspect = async () => {
      throw createAuthenticationError({ message: "Invalid bearer token" });
    };
    expect(await claudeCodeProvider({ inspect: refused }).check()).toMatchObject({ ok: false, message: expect.stringMatching(/claude setup-token/) });
    const slow: ClaudeCodeInspect = async () => {
      throw new DOMException("The check timed out.", "TimeoutError");
    };
    expect(await claudeCodeProvider({ inspect: slow }).check()).toMatchObject({ ok: false, message: expect.stringMatching(/ten seconds/) });
  });
});
