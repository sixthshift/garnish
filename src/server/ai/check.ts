// The connection check behind Settings' "Test connection". It asks the
// provider for its model list — `GET ${AI_BASE_URL}/models`, which every
// OpenAI-compatible server answers and none bills as a generation — so the key,
// the address and the model names are all proved without spending a token.
// What it cannot prove is that the model will answer a prompt well; the first
// import does that.

import { AiError, aiSettings, DEFAULT_AI_BASE_URL, type Fetcher, httpFailureMessage } from "./client";
import { plannerSettings } from "./planner";
import { restyleSettings } from "./restyle";

/** A model list answers in a second; ten is generous and still short enough to wait for on a button. */
export const CHECK_TIMEOUT_MS = 10_000;

/** One configured model and whether the provider lists it. */
export type CheckedModel = { use: "import" | "restyle" | "planner"; model: string; listed: boolean };

export type ConnectionCheck = { ok: true; baseUrl: string; models: CheckedModel[] } | { ok: false; baseUrl: string; message: string };

/** What Settings shows of the configuration: never the key itself, only whether there is one. */
export type AiStatus = { configured: boolean; baseUrl: string; isDefaultProvider: boolean; models: { use: CheckedModel["use"]; model: string }[] };

export function aiStatus(): AiStatus {
  const { apiKey, baseUrl, model } = aiSettings();
  return {
    configured: apiKey !== "",
    baseUrl,
    isDefaultProvider: baseUrl === DEFAULT_AI_BASE_URL,
    models: [
      { use: "import", model },
      { use: "restyle", model: restyleSettings().model },
      { use: "planner", model: plannerSettings().model },
    ],
  };
}

/** The list envelope, read defensively. */
type ModelList = { data?: { id?: unknown }[] };

/**
 * A provider's id for a model, as `AI_MODEL` would name it. Gemini's
 * compatible endpoint lists `models/gemini-…` but is asked for `gemini-…`. Pure.
 */
export function modelName(id: string): string {
  return id.replace(/^models\//, "");
}

/** The three configured models, one row per use, each marked by whether the list names it. Pure. */
export function checkModels(listed: readonly string[], configured: { import: string; restyle: string; planner: string }): CheckedModel[] {
  const names = new Set(listed.map(modelName));
  return (["import", "restyle", "planner"] as const).map((use) => ({ use, model: configured[use], listed: names.has(modelName(configured[use])) }));
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

/** Ask the provider for its model list and compare the configured models against it. Never throws. */
export async function checkConnection(fetcher: Fetcher = fetch): Promise<ConnectionCheck> {
  const { apiKey, baseUrl, model } = aiSettings();
  const fail = (message: string): ConnectionCheck => ({ ok: false, baseUrl, message });
  if (apiKey === "") return fail(new AiError("unavailable", "No model is configured here. Set AI_API_KEY to use this.").message);

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
  return { ok: true, baseUrl, models: checkModels(ids, { import: model, restyle: restyleSettings().model, planner: plannerSettings().model }) };
}
