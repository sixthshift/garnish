// The AI client: the one language the app speaks to a model in. An `AiClient`
// knows whether it is configured, which model each use asks, what Settings
// shows of it, how to test it, and how to ask it a question. The features —
// the import, the restyle, the planner — hold an `AiClient` and never learn
// what is behind it. A provider is one implementation of it, one file per way
// of reaching a model under provider/ — api.ts and claudeCode.ts — and the
// folder's index reads `AI_PROVIDER` to say which one this server uses.

/** How long a call is given before the request is aborted. A recipe answers in seconds; a minute is the outer bound. */
export const AI_TIMEOUT_MS = 60_000;

/** Why a call did not produce an answer. The screen shows `message`; the kind is what a test asserts on. */
export type AiFailure = "unavailable" | "timeout" | "failed" | "malformed";

/** A failed call, carrying which of the four ways it failed. Never a partial write: nothing is written here at all. */
export class AiError extends Error {
  readonly kind: AiFailure;
  constructor(kind: AiFailure, message: string) {
    super(message);
    this.name = "AiError";
    this.kind = kind;
  }
}

/** The same shape the URL import injects, so a test can drive the HTTP path with a fake `fetch`. */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** The three things the app asks a model for. Each may name its own model. */
export type AiUse = "import" | "restyle" | "planner";

export const AI_USES: readonly AiUse[] = ["import", "restyle", "planner"];

/**
 * One question: the prompt as a single user turn, the answer's JSON Schema and
 * its name as structured output, the model, and the deadline. The schema is
 * required because a provider has no question of its own.
 */
export type AiRequest = { prompt: string; schema: object; schemaName: string; model: string; timeoutMs: number };

/** One configured model and whether the provider lists it. */
export type CheckedModel = { use: AiUse; model: string; listed: boolean };

/**
 * A model the provider offers, by the name a model variable can use, and the
 * full id that name stands for when the provider says (Claude Code's `sonnet`
 * is `claude-sonnet-5`); a variable may use either.
 */
export type OfferedModel = { name: string; resolvesTo?: string };

/** Every name an offered list answers to: each name, and each full id. Pure. */
export function offeredNames(offered: readonly OfferedModel[]): string[] {
  return offered.flatMap((model) => (model.resolvesTo && model.resolvesTo !== model.name ? [model.name, model.resolvesTo] : [model.name]));
}

/**
 * Settings' "Test connection": the models each use asks, every model the
 * provider offers, or why the provider could not be reached.
 * `credentialProved` says whether the check itself proved the key or token, or
 * only that the provider starts and offers models — in which case the first
 * question is what proves it.
 */
export type ConnectionCheck =
  | { ok: true; baseUrl: string; credentialProved: boolean; models: CheckedModel[]; offered: OfferedModel[] }
  | { ok: false; baseUrl: string; message: string };

/**
 * The providers there are, as `AI_PROVIDER` names them: `api`, any model API
 * reached with a key (`AI_API_KEY`, `AI_BASE_URL`), and `claude-code`, Claude
 * Code on a subscription (`CLAUDE_CODE_OAUTH_TOKEN`).
 */
export type AiProviderName = "api" | "claude-code";

export const AI_PROVIDERS: readonly AiProviderName[] = ["api", "claude-code"];

/**
 * What Settings shows of the configuration: which provider, the variable its
 * credential is read from and whether it is set — never the credential — where
 * it is reached, and the model each use asks. With no provider chosen,
 * `provider` is null and `problem` says why.
 */
export type AiStatus = {
  provider: AiProviderName | null;
  problem: string | null;
  credential: string;
  configured: boolean;
  baseUrl: string;
  isDefaultProvider: boolean;
  models: { use: AiUse; model: string }[];
};

/**
 * What the app asks a model through, whichever provider implements it.
 * Everything is read from the environment at call time, so a key can be added
 * without restarting the app.
 */
export interface AiClient {
  /** Whether a model can be asked at all: the gate for every feature that asks one. */
  configured(): boolean;
  /** The model a use asks: its own variable (`AI_IMPORT_MODEL`, `AI_RESTYLE_MODEL`, `AI_PLANNER_MODEL`) over the provider's default. */
  model(use: AiUse): string;
  /** What Settings shows. */
  status(): AiStatus;
  /** Prove the configuration without spending a token. Never throws. */
  check(): Promise<ConnectionCheck>;
  /** Ask one question; the answer's text, or an `AiError` saying which way it failed. */
  ask(request: AiRequest): Promise<string>;
}

/** The variable that names each use's model. One per use, so no use's model follows another's. */
export const MODEL_VARIABLES: Record<AiUse, string> = { import: "AI_IMPORT_MODEL", restyle: "AI_RESTYLE_MODEL", planner: "AI_PLANNER_MODEL" };

/** A use's model: its own variable, or the provider's default. Shared by every provider, so each variable means one thing. */
export function modelFor(use: AiUse, fallback: string): string {
  return (process.env[MODEL_VARIABLES[use]] ?? "").trim() || fallback;
}

/** Re-exported for the restyle pass and the tests; the function itself is the domain's. */
export { stripFence } from "../../lib/ai";
