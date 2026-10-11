// The provider over Claude Code on a Claude subscription: `AI_PROVIDER=claude-code`,
// with the token `claude setup-token` prints in `CLAUDE_CODE_OAUTH_TOKEN`. Each
// question is one Claude Code session, run through the AI SDK's community
// provider (`ai-sdk-provider-claude-code`) over the Agent SDK, which runs the
// Claude Code binary it bundles as a subprocess.
//
// Claude Code is an agent — it reads files and runs commands — and what it is
// asked here carries text from pages nobody here wrote. So every session is
// locked down to a model and nothing else: no tools, no settings, skills or
// CLAUDE.md read from anywhere, no MCP servers, no permission prompts, no
// session written to disk, an empty working directory and a config directory of
// its own. The answer is the session's structured output against the caller's
// JSON Schema, handed back as JSON text, so the features parse it exactly as
// they parse the OpenAI provider's.
//
// Its connection check starts a session and asks it for the account and the
// models it offers without sending a prompt, so it spends no tokens. That
// proves the binary starts, picks the token up and which models it offers —
// not that the token is good: nothing reaches Anthropic until a prompt does,
// so the first question is what proves the token, and the check says so.

import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type AccountInfo, query } from "@anthropic-ai/claude-agent-sdk";
import { generateText, jsonSchema, NoObjectGeneratedError, Output } from "ai";
import { type ClaudeCodeSettings, claudeCode, getErrorMetadata, isAccountStateError, isAuthenticationError, isTimeoutError } from "ai-sdk-provider-claude-code";
import {
  AI_USES,
  type AiClient,
  AiError,
  type AiRequest,
  type AiStatus,
  type AiUse,
  type ConnectionCheck,
  modelFor,
  type OfferedModel,
  offeredNames,
} from "../client";
import { checkModels } from "./api";

/** The cheap fast tier, as Claude Code names it: extraction against a schema needs nothing more (decisions.md row 75). */
export const DEFAULT_CLAUDE_CODE_MODEL = "haiku";

/** What Settings shows where the OpenAI provider shows its base URL. */
export const CLAUDE_CODE_ENDPOINT = "Claude Code, on the subscription";

/** Starting the binary and hearing back from it takes a few seconds; ten is generous and short enough for a button. */
export const CLAUDE_CODE_CHECK_TIMEOUT_MS = 10_000;

const NO_TOKEN = "No model is configured here. Set CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`) to use this.";

/**
 * The token, and where the binary is. Read on every call, as the
 * OpenAI provider's settings are. The binary is found beside the SDK in
 * `node_modules` by default, which is how it runs in dev; the built server has
 * no `node_modules`, so the image copies the binary in and names it with
 * `CLAUDE_CODE_EXECUTABLE` (docker/Dockerfile).
 */
export function claudeCodeSettings(): { token: string; executable: string | undefined } {
  const token = (process.env.CLAUDE_CODE_OAUTH_TOKEN ?? "").trim();
  const executable = (process.env.CLAUDE_CODE_EXECUTABLE ?? "").trim() || undefined;
  return { token, executable };
}

/**
 * Where a session runs and keeps its config: a folder of its own under the
 * system's temp directory, never the project, never `DATA_DIR`, so nothing of
 * it reaches a backup and no CLAUDE.md is found above it.
 */
function sessionDir(): { cwd: string; configDir: string } {
  const root = join(tmpdir(), "garnish-claude-code");
  const cwd = join(root, "work");
  const configDir = join(root, "config");
  mkdirSync(cwd, { recursive: true });
  mkdirSync(configDir, { recursive: true });
  return { cwd, configDir };
}

/**
 * The lockdown, in one place, for every session this provider starts: a model
 * and nothing else. Pure apart from the folders it names.
 */
export function lockedSettings(
  token: string,
  dirs: { cwd: string; configDir: string } = sessionDir(),
  executable = claudeCodeSettings().executable
): ClaudeCodeSettings {
  return {
    tools: [],
    settingSources: [],
    mcpServers: {},
    permissionMode: "dontAsk",
    permissionPrompts: "none",
    persistSession: false,
    thinking: { type: "disabled" },
    cwd: dirs.cwd,
    env: { CLAUDE_CODE_OAUTH_TOKEN: token, CLAUDE_CONFIG_DIR: dirs.configDir },
    logger: false,
    ...(executable === undefined ? {} : { pathToClaudeCodeExecutable: executable }),
  };
}

/** One question to a model, as the provider hands it to Claude Code. The answer is the structured output, unparsed. */
export type ClaudeCodeAsk = (question: {
  model: string;
  settings: ClaudeCodeSettings;
  prompt: string;
  schema: object;
  schemaName: string;
  timeoutMs: number;
}) => Promise<unknown>;

/** What the check learns from a session it never prompts: the account, and the models it offers, each by name and full id. */
export type ClaudeCodeInspect = (settings: ClaudeCodeSettings, timeoutMs: number) => Promise<{ account: AccountInfo; models: OfferedModel[] }>;

/** The real ask: one `generateText` with the caller's schema as the structured output. */
const generate: ClaudeCodeAsk = async ({ model, settings, prompt, schema, schemaName, timeoutMs }) => {
  const { output } = await generateText({
    model: claudeCode(model, settings),
    output: Output.object({ schema: jsonSchema(schema), name: schemaName }),
    prompt,
    abortSignal: AbortSignal.timeout(timeoutMs),
  });
  return output;
};

/** A prompt stream that never sends anything, so a session can be asked about itself without spending a token. */
async function* silence(signal: AbortSignal): AsyncGenerator<never> {
  await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
}

/** The real inspection: start a session, ask for the account and the models, close it. */
const inspect: ClaudeCodeInspect = async (settings, timeoutMs) => {
  const done = new AbortController();
  const session = query({
    prompt: silence(done.signal),
    options: {
      tools: settings.tools,
      settingSources: settings.settingSources,
      mcpServers: settings.mcpServers,
      permissionMode: settings.permissionMode,
      persistSession: settings.persistSession,
      cwd: settings.cwd,
      pathToClaudeCodeExecutable: settings.pathToClaudeCodeExecutable,
      // The SDK replaces the subprocess environment rather than merging into it: the binary gets what it needs and none of the app's.
      env: { PATH: process.env.PATH, HOME: process.env.HOME, ...settings.env },
    },
  });
  const deadline = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => reject(new DOMException("The check timed out.", "TimeoutError")), timeoutMs);
    done.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  });
  try {
    const [account, models] = await Promise.race([Promise.all([session.accountInfo(), session.supportedModels()]), deadline]);
    // Each row is a name (`sonnet`) and the id it resolves to (`claude-sonnet-5`); a model variable may use either.
    return { account, models: models.map((row) => (row.resolvedModel ? { name: row.value, resolvesTo: row.resolvedModel } : { name: row.value })) };
  } finally {
    done.abort();
    session.close();
  }
};

/** What went wrong, as one of the four kinds and in the words the screen shows. Pure. */
export function claudeCodeFailure(cause: unknown): AiError {
  if (cause instanceof AiError) return cause;
  const name = cause instanceof Error ? cause.name : "";
  if (name === "TimeoutError" || name === "AbortError" || isTimeoutError(cause)) {
    return new AiError("timeout", "The model took too long to answer. Try a shorter paste.");
  }
  if (NoObjectGeneratedError.isInstance(cause)) {
    return new AiError("malformed", "The model's answer was not the shape asked for, so nothing was read.");
  }
  // An account on hold or a billing problem is not a bad token: signing in again does not fix it.
  if (isAccountStateError(cause)) {
    return new AiError(
      "failed",
      "The Anthropic account behind the token cannot take requests right now (a hold or a billing problem). Signing in again will not fix it."
    );
  }
  if (isAuthenticationError(cause)) {
    return new AiError("failed", "Claude Code rejected the token. Run `claude setup-token` again and update CLAUDE_CODE_OAUTH_TOKEN.");
  }
  const kind = (getErrorMetadata(cause) as { errorKind?: string } | undefined)?.errorKind;
  if (kind === "rate_limit") return new AiError("failed", "The subscription's usage limit has been reached. Try again once it resets.");
  if (kind === "overloaded") return new AiError("failed", "Claude is overloaded right now. Try again in a minute.");
  if (kind === "model_not_found")
    return new AiError("failed", "Claude Code does not know that model. Settings › AI shows each feature's model and the variable that sets it.");
  return new AiError("failed", `Claude Code could not answer: ${cause instanceof Error ? cause.message : String(cause)}`);
}

/**
 * The provider: an `AiClient` over Claude Code. The ask and the inspection are
 * parameters so the error mapping and the check can be tested without the
 * binary, a token or a subscription.
 */
export function claudeCodeProvider(ports: { ask?: ClaudeCodeAsk; inspect?: ClaudeCodeInspect } = {}): AiClient {
  const { ask = generate, inspect: look = inspect } = ports;
  const model = (use: AiUse) => modelFor(use, DEFAULT_CLAUDE_CODE_MODEL);
  const models = (): Record<AiUse, string> => ({ import: model("import"), restyle: model("restyle"), planner: model("planner") });

  return {
    configured: () => claudeCodeSettings().token !== "",

    model,

    status(): AiStatus {
      return {
        provider: "claude-code",
        problem: null,
        credential: "CLAUDE_CODE_OAUTH_TOKEN",
        configured: claudeCodeSettings().token !== "",
        baseUrl: CLAUDE_CODE_ENDPOINT,
        isDefaultProvider: false,
        models: AI_USES.map((use) => ({ use, model: model(use) })),
      };
    },

    async check(): Promise<ConnectionCheck> {
      const { token } = claudeCodeSettings();
      const fail = (message: string): ConnectionCheck => ({ ok: false, baseUrl: CLAUDE_CODE_ENDPOINT, message });
      if (token === "") return fail(NO_TOKEN);
      try {
        const { account, models: offered } = await look(lockedSettings(token), CLAUDE_CODE_CHECK_TIMEOUT_MS);
        if (account.tokenSource !== "CLAUDE_CODE_OAUTH_TOKEN") {
          return fail("Claude Code started but did not pick up CLAUDE_CODE_OAUTH_TOKEN.");
        }
        return { ok: true, baseUrl: CLAUDE_CODE_ENDPOINT, credentialProved: false, models: checkModels(offeredNames(offered), models()), offered };
      } catch (cause) {
        const failure = claudeCodeFailure(cause);
        return fail(failure.kind === "timeout" ? "Claude Code did not answer within ten seconds." : failure.message);
      }
    },

    async ask({ prompt, schema, schemaName, model, timeoutMs }: AiRequest): Promise<string> {
      const { token } = claudeCodeSettings();
      if (token === "") throw new AiError("unavailable", NO_TOKEN);
      let output: unknown;
      try {
        output = await ask({ model, settings: lockedSettings(token), prompt, schema, schemaName, timeoutMs });
      } catch (cause) {
        throw claudeCodeFailure(cause);
      }
      if (output === undefined || output === null) throw new AiError("malformed", "The model answered with nothing.");
      return JSON.stringify(output);
    },
  };
}
