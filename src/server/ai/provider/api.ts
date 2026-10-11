// `AI_PROVIDER=api`: any model API reached with a key, over the
// OpenAI-compatible request format every such API speaks (decisions.md row 75):
// one `chat/completions` POST per question, configured by `AI_API_KEY`,
// `AI_BASE_URL` and a model per use (`AI_IMPORT_MODEL`, `AI_RESTYLE_MODEL`,
// `AI_PLANNER_MODEL`). Gemini's free tier by default; one base URL and
// one model name move it to Mistral, Groq, OpenRouter or an Ollama on the LAN.
//
// Its connection check asks for the model list — `GET ${AI_BASE_URL}/models`,
// which every OpenAI-compatible server answers and none bills as a generation —
// so the key, the address and the model names are all proved without spending
// a token. What it cannot prove is that the model will answer a prompt well;
// the first import does that.

import {
  AI_USES,
  type AiClient,
  AiError,
  type AiRequest,
  type AiStatus,
  type AiUse,
  type CheckedModel,
  type ConnectionCheck,
  type Fetcher,
  modelFor,
} from "../client";

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
 * the default. Each use's model variable overrides all of this.
 */
export const DEFAULT_API_MODEL = "gemini-flash-lite-latest";

/** A model list answers in a second; ten is generous and still short enough to wait for on a button. */
export const CHECK_TIMEOUT_MS = 10_000;

/** Where, and with what key. Read on every call so a key can be added without restarting the app. */
export function apiSettings(): { apiKey: string; baseUrl: string } {
  const apiKey = (process.env.AI_API_KEY ?? "").trim();
  const baseUrl = (process.env.AI_BASE_URL ?? "").trim().replace(/\/+$/, "") || DEFAULT_AI_BASE_URL;
  return { apiKey, baseUrl };
}

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
  if (status === 404) return "The model provider does not know that model. Settings › AI shows each feature's model and the variable that sets it.";
  if (status === 429) return "The model provider is rate-limited right now. Try again in a minute.";
  if (status === 503) return "The model provider is overloaded right now. Try again in a minute.";
  return `The model provider answered ${status}, so nothing was read.`;
}

/**
 * A provider's id for a model, as a model variable would name it. Gemini's
 * compatible endpoint lists `models/gemini-…` but is asked for `gemini-…`. Pure.
 */
export function modelName(id: string): string {
  return id.replace(/^models\//, "");
}

/** The configured models, one row per use, each marked by whether the list names it. Pure. */
export function checkModels(listed: readonly string[], configured: Record<AiUse, string>): CheckedModel[] {
  const names = new Set(listed.map(modelName));
  return AI_USES.map((use) => ({ use, model: configured[use], listed: names.has(modelName(configured[use])) }));
}

/**
 * The provider's own words for a refusal, when it gives any: OpenAI-shaped
 * `{error: {message}}`, or Gemini's same object wrapped in an array. Pure.
 */
export function providerReason(body: unknown): string | null {
  const envelope = Array.isArray(body) ? body[0] : body;
  const message = (envelope as { error?: { message?: unknown } } | null)?.error?.message;
  return typeof message === "string" && message.trim() !== "" ? message.trim() : null;
}

/** What a non-2xx list answer means. Gemini refuses a bad key with 400, not 401, so its own reason is the useful part. */
async function failureWithReason(response: Response): Promise<string> {
  const reason = providerReason(await response.json().catch(() => null));
  if (response.status === 401 || response.status === 403 || reason === null) return httpFailureMessage(response.status);
  return `The model provider answered ${response.status}: ${reason}`;
}

/** The chat completion envelope, read defensively: providers differ in everything but this path. */
type ChatCompletion = { choices?: { message?: { content?: unknown } }[] };

/** The list envelope, read defensively. */
type ModelList = { data?: { id?: unknown }[] };

const NO_KEY = "No model is configured here. Set AI_API_KEY to use this.";

/**
 * The provider: an `AiClient` over a model API's OpenAI-compatible endpoint. The fetch is a parameter so the request, the error mapping and
 * the check can all be tested without a provider; by default the global one,
 * looked up per call rather than captured, as the server's provider outlives
 * any stub of it.
 */
export function apiProvider(fetcher: Fetcher = (url, init) => fetch(url, init)): AiClient {
  const model = (use: AiUse) => modelFor(use, DEFAULT_API_MODEL);
  const models = (): Record<AiUse, string> => ({ import: model("import"), restyle: model("restyle"), planner: model("planner") });

  return {
    configured: () => apiSettings().apiKey !== "",

    model,

    status(): AiStatus {
      const { apiKey, baseUrl } = apiSettings();
      return {
        provider: "api",
        problem: null,
        credential: "AI_API_KEY",
        configured: apiKey !== "",
        baseUrl,
        isDefaultProvider: baseUrl === DEFAULT_AI_BASE_URL,
        models: AI_USES.map((use) => ({ use, model: model(use) })),
      };
    },

    async check(): Promise<ConnectionCheck> {
      const { apiKey, baseUrl } = apiSettings();
      const fail = (message: string): ConnectionCheck => ({ ok: false, baseUrl, message });
      if (apiKey === "") return fail(NO_KEY);

      let response: Response;
      try {
        response = await fetcher(`${baseUrl}/models`, {
          headers: { authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
        });
      } catch (cause) {
        const name = cause instanceof Error ? cause.name : "";
        if (name === "TimeoutError" || name === "AbortError") return fail("The model provider did not answer within ten seconds.");
        return fail(`The model provider could not be reached: ${cause instanceof Error ? cause.message : String(cause)}`);
      }
      // A 404 here is the address, not the model: nothing named a model yet.
      if (response.status === 404) return fail("The model provider has no model list at that address. Check AI_BASE_URL.");
      if (!response.ok) return fail(await failureWithReason(response));

      let list: ModelList;
      try {
        list = (await response.json()) as ModelList;
      } catch {
        return fail("The model provider answered, but not with JSON. Check AI_BASE_URL.");
      }
      const ids = (list.data ?? []).flatMap((entry) => (typeof entry.id === "string" ? [entry.id] : []));
      // Named as a model variable would name them, once each, in order.
      const offered = [...new Set(ids.map(modelName))].sort().map((name) => ({ name }));
      // The list is behind the key, so an answer proves it.
      return { ok: true, baseUrl, credentialProved: true, models: checkModels(ids, models()), offered };
    },

    // One POST to `${AI_BASE_URL}/chat/completions`, with the deadline enforced by `AbortSignal.timeout` rather than by hope.
    async ask({ prompt, schema, schemaName, model, timeoutMs }: AiRequest): Promise<string> {
      const { apiKey, baseUrl } = apiSettings();
      if (apiKey === "") throw new AiError("unavailable", NO_KEY);

      let response: Response;
      try {
        response = await fetcher(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(chatRequestBody(prompt, model, schema, schemaName)),
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
    },
  };
}
