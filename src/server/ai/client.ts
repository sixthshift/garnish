/** How long a call is given before the request is aborted. A recipe answers in seconds; a minute is the outer bound. */
export const AI_TIMEOUT_MS = 60_000;

/** Gemini's OpenAI-compatible endpoint: the free tier, so one variable is the whole of the setup. */
export const DEFAULT_AI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

/**
 * The model asked for when none is named: Google's rolling alias for its
 * current Flash-Lite, not a pinned version. A pinned name rots — the first
 * live call here got a 404 because `gemini-2.5-flash` had been retired for new
 * accounts — and the alias follows each release without a code change. Lite,
 * because the anchored read is an easy task (the lines are given; only the
 * grouping is asked for), and on the same page Lite answered identically in
 * 3 s where the full Flash took 22 s. The full `gemini-flash-latest` alias
 * answered 503 "high demand" on every try from a free-tier key, so it is not
 * the default. `AI_MODEL` overrides all of this.
 */
export const DEFAULT_AI_MODEL = "gemini-flash-lite-latest";

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

/** Which model, where, and with what key. Read on every call so a key can be added without restarting the app. */
export function aiSettings(): { apiKey: string; baseUrl: string; model: string } {
  const apiKey = (process.env.AI_API_KEY ?? "").trim();
  const baseUrl = (process.env.AI_BASE_URL ?? "").trim().replace(/\/+$/, "") || DEFAULT_AI_BASE_URL;
  const model = (process.env.AI_MODEL ?? "").trim() || DEFAULT_AI_MODEL;
  return { apiKey, baseUrl, model };
}

/** Whether a model is configured at all. A key is the whole of it: the base URL and the model both have defaults. */
export function aiConfigured(): boolean {
  return aiSettings().apiKey !== "";
}

/** How the model is asked. Injectable so a test can answer with a fixture, or with garbage. */
export type AiRunner = (prompt: string, timeoutMs: number) => Promise<string>;

/** The same shape the URL import injects, so a test can drive the HTTP path with a fake `fetch`. */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * What a runner asks for beyond the prompt: the answer's JSON Schema and its
 * name, as structured output, and optionally a model other than `AI_MODEL`.
 * The schema is required because the client has no question of its own.
 */
export type RunnerOptions = { schema: object; schemaName: string; model?: string };

/**
 * The request body, in one place: one user turn, the schema as structured
 * output, and no creativity at all. Pure.
 */
export function chatRequestBody(prompt: string, model: string, schema: object, schemaName: string): Record<string, unknown> {
  return {
    model,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_schema", json_schema: { name: schemaName, schema, strict: true } },
    temperature: 0,
  };
}

/** What a non-2xx means, in the words the screen shows. Pure. */
export function httpFailureMessage(status: number): string {
  if (status === 401 || status === 403) return "The model provider rejected the API key. Check AI_API_KEY.";
  if (status === 404) return "The model provider does not know that model. Check AI_MODEL, or unset it for the default.";
  if (status === 429) return "The model provider is rate-limited right now. Try again in a minute.";
  if (status === 503) return "The model provider is overloaded right now. Try again in a minute.";
  return `The model provider answered ${status}, so nothing was read.`;
}

/** The chat completion envelope, read defensively: providers differ in everything but this path. */
type ChatCompletion = { choices?: { message?: { content?: unknown } }[] };

/**
 * The runner: one POST to `${AI_BASE_URL}/chat/completions`, with the
 * deadline enforced by `AbortSignal.timeout` rather than by hope. The fetch is
 * a parameter so the error mapping can be tested without a provider.
 */
export function createFetchRunner(fetcher: Fetcher = fetch, options: RunnerOptions): AiRunner {
  return async (prompt, timeoutMs) => {
    const { apiKey, baseUrl, model: defaultModel } = aiSettings();
    const model = options.model ?? defaultModel;
    if (apiKey === "") throw new AiError("unavailable", "No model is configured here. Set AI_API_KEY to use this.");

    let response: Response;
    try {
      response = await fetcher(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(chatRequestBody(prompt, model, options.schema, options.schemaName)),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      const name = cause instanceof Error ? cause.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        throw new AiError("timeout", "The model took too long to answer. Try a shorter paste.");
      }
      throw new AiError("failed", `The model could not be reached: ${cause instanceof Error ? cause.message : String(cause)}`);
    }

    if (!response.ok) throw new AiError("failed", httpFailureMessage(response.status));

    let envelope: ChatCompletion;
    try {
      envelope = (await response.json()) as ChatCompletion;
    } catch {
      throw new AiError("malformed", "The model's answer was not JSON, so nothing was imported.");
    }
    const content = envelope.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      throw new AiError("malformed", "The model answered with nothing.");
    }
    return content;
  };
}

/** Re-exported for the restyle pass and the tests; the function itself is the domain's. */
export { stripFence } from "../../lib/ai";
