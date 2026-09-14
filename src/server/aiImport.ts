// The AI import rung (M34.5, M36.1, decisions.md rows 74 and 75): hand the
// text to a language model and let it do what no rule can — read a recipe out
// of prose.
//
// It sits under the two rules-based rungs in `recipeImport.ts`, not over them.
// A page with `ld+json` is read by `schema`, a page with OpenGraph tags by
// `stub`, and both are free, instant and deterministic. This one costs a
// request and takes seconds, so it is what you reach for when the page had
// nothing structured in it, or when what you have is not a page at all: the
// block of text off a photograph, an email, a book you typed out.
//
// Three rules hold it in place:
//
//   nothing is written    the answer lands on the same M17.5 review the URL
//                         import uses. The model proposes; the household
//                         approves.
//   nothing is trusted    the answer is parsed through `ScrapedRecipeSchema`
//                         like any other untrusted input. A malformed answer
//                         is reported on the import screen, never saved.
//   nothing is assumed    the option only exists when a key is configured. In
//                         a container with no `AI_API_KEY` the option is not
//                         offered at all, and a button that always fails is
//                         worse than no button.
//
// The model is a hosted one behind a single OpenAI-compatible HTTP call rather
// than the `claude` CLI this rung shipped with: reading a recipe out of a page
// does not need frontier capability, the CLI was a bespoke integration on a
// moving target, and a container should not need a login step to be useful.
// Three environment variables say which model, and they are read at call time
// rather than at import so the container can be given a key without a rebuild:
// `AI_API_KEY` alone gets Gemini's free tier, and Mistral, Groq, OpenRouter or
// an Ollama on the LAN are `AI_BASE_URL` and `AI_MODEL` away (Ollama ignores
// the key, but wants one to be there). Plain `fetch`, no SDK: the request is
// twelve lines and every provider worth using speaks this shape.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normaliseScraped, type ScrapedRecipe, ScrapedRecipeSchema } from "../domain/schemaRecipe";
import { notFoundMiddleware } from "./fn";
import type { ImportedRecipe } from "./recipeImport";

/** How long a read is given before the request is aborted. A recipe answers in seconds; a minute is the outer bound. */
export const AI_IMPORT_TIMEOUT_MS = 60_000;

/** The most text worth sending. A recipe is a page; anything past this is a book, and it would only cost tokens. */
export const MAX_AI_TEXT = 40_000;

/** Gemini's OpenAI-compatible endpoint: the free tier, so one variable is the whole of the setup. */
export const DEFAULT_AI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

/** The model asked for when none is named. The cheap, fast one; this is the one line to change when it is superseded. */
export const DEFAULT_AI_MODEL = "gemini-2.5-flash";

/** Why the AI rung did not produce a recipe. The screen shows `message`; the kind is what a test asserts on. */
export type AiFailure = "unavailable" | "timeout" | "failed" | "malformed";

/** A failed read, carrying which of the four ways it failed. Never a partial write: nothing is written here at all. */
export class AiImportError extends Error {
  readonly kind: AiFailure;
  constructor(kind: AiFailure, message: string) {
    super(message);
    this.name = "AiImportError";
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

/**
 * `ScrapedRecipe` as a JSON Schema for the request's `response_format`,
 * written out rather than generated: structured output wants every property
 * named, every one required, and no extras, and a generated schema carries
 * zod's defaults and optionality into a place that does not want them.
 * `test/server/aiImport.test.ts` holds it to the zod schema's shape so the two
 * cannot drift.
 */
export const SCRAPED_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "description", "image", "servings", "yieldText", "prepMinutes", "cookMinutes", "tags", "ingredients", "parts"],
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    image: { type: ["string", "null"] },
    servings: { type: "number" },
    yieldText: { type: "string" },
    prepMinutes: { type: ["number", "null"] },
    cookMinutes: { type: ["number", "null"] },
    tags: { type: "array", items: { type: "string" } },
    ingredients: { type: "array", items: { type: "string" } },
    parts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "steps"],
        properties: { name: { type: "string" }, steps: { type: "array", items: { type: "string" } } },
      },
    },
  },
} as const;

/**
 * What the model is asked. The fields are described in the app's own terms
 * because the schema only gives their types: an empty string is "the text did
 * not say", ingredient lines are copied verbatim for `parseIngredient` to read
 * (row 47), and a named section is a part, as row 59 already has the URL
 * import treat a `HowToSection`. Pure.
 */
export function aiPrompt(text: string): string {
  return [
    "Read the recipe out of the text below and answer with JSON matching the schema. Rules:",
    "- Copy ingredient lines verbatim, one per line, quantity and unit and all. Do not convert, round or reword them.",
    "- `parts`: a named section of the recipe (a sauce, a topping) is a part with that name; everything else goes in the part named \"\" (empty), which is the main body. Steps are that part's method, one entry per step, without numbering.",
    "- `servings` is a number and 0 when the text does not say. `yieldText` is what it makes without the count (\"biscuits\", \"loaf\"), empty when the yield was only a number.",
    "- `prepMinutes` and `cookMinutes` are whole minutes or null. `image` is a URL found in the text or null.",
    "- `tags` are short topic words the text itself gives. Do not invent any.",
    "- Never invent an ingredient, a step, a time or a quantity. What is not in the text is empty, 0 or null.",
    "- Answer with the JSON only.",
    "",
    "TEXT:",
    text,
  ].join("\n");
}

/** How the model is asked. Injectable so a test can answer with a fixture, or with garbage. */
export type AiRunner = (prompt: string, timeoutMs: number) => Promise<string>;

/** The same shape `recipeImport.ts` injects, so a test can drive the HTTP path with a fake `fetch`. */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** The request body, in one place: one user turn, the schema as structured output, and no creativity at all. Pure. */
export function chatRequestBody(prompt: string, model: string): Record<string, unknown> {
  return {
    model,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_schema", json_schema: { name: "recipe", schema: SCRAPED_JSON_SCHEMA, strict: true } },
    temperature: 0,
  };
}

/** What a non-2xx means, in the words the import screen shows. Pure. */
export function httpFailureMessage(status: number): string {
  if (status === 401 || status === 403) return "The model provider rejected the API key. Check AI_API_KEY.";
  if (status === 429) return "The model provider is rate-limited right now. Try again in a minute.";
  return `The model provider answered ${status}, so nothing was read.`;
}

/** The chat completion envelope, read defensively: providers differ in everything but this path. */
type ChatCompletion = { choices?: { message?: { content?: unknown } }[] };

/**
 * The default runner: one POST to `${AI_BASE_URL}/chat/completions`, with the
 * deadline enforced by `AbortSignal.timeout` rather than by hope. The fetch is
 * a parameter so the error mapping can be tested without a provider.
 */
export function createFetchRunner(fetcher: Fetcher = fetch): AiRunner {
  return async (prompt, timeoutMs) => {
    const { apiKey, baseUrl, model } = aiSettings();
    if (apiKey === "") throw new AiImportError("unavailable", "No model is configured here. Set AI_API_KEY to use this.");

    let response: Response;
    try {
      response = await fetcher(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(chatRequestBody(prompt, model)),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      const name = cause instanceof Error ? cause.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        throw new AiImportError("timeout", "The model took too long to answer. Try a shorter paste.");
      }
      throw new AiImportError("failed", `The model could not be reached: ${cause instanceof Error ? cause.message : String(cause)}`);
    }

    if (!response.ok) throw new AiImportError("failed", httpFailureMessage(response.status));

    let envelope: ChatCompletion;
    try {
      envelope = (await response.json()) as ChatCompletion;
    } catch {
      throw new AiImportError("malformed", "The model's answer was not JSON, so nothing was imported.");
    }
    const content = envelope.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      throw new AiImportError("malformed", "The model answered with nothing.");
    }
    return content;
  };
}

/** The runner used in anger: the platform's `fetch`. */
export const fetchRunner: AiRunner = (prompt, timeoutMs) => createFetchRunner()(prompt, timeoutMs);

/** A ```json fence off an answer that came back as prose despite the schema. Pure. */
export function stripFence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/.exec(trimmed);
  return fenced === null ? trimmed : fenced[1]!.trim();
}

/**
 * The recipe out of the message content: JSON, because the request asked for
 * it, with the fence stripped for a model that fences anyway. Throws
 * `AiImportError` for anything that is not a recipe. Pure.
 */
export function parseAiAnswer(content: string): ScrapedRecipe {
  const raw = stripFence(content);
  if (raw === "") throw new AiImportError("malformed", "The model answered with nothing.");

  let answer: unknown;
  try {
    answer = JSON.parse(raw);
  } catch {
    throw new AiImportError("malformed", "The model answered in prose rather than the recipe format, so nothing was imported.");
  }

  const parsed = ScrapedRecipeSchema.safeParse(answer);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first && first.path.length > 0 ? ` (${first.path.join(".")}: ${first.message})` : "";
    throw new AiImportError("malformed", `The model's answer was not in the expected shape${where}. Nothing was imported.`);
  }
  const recipe = normaliseScraped(parsed.data);
  if (recipe.name === "" && recipe.ingredients.length === 0) {
    throw new AiImportError("malformed", "The model found no recipe in that text.");
  }
  return recipe;
}

/** What the paste screen sends and gets back: the same `ImportedRecipe` the URL import produces, from the `ai` rung. */
export async function runAiImport(
  text: string,
  options: { run?: AiRunner; fetcher?: Fetcher; sourceUrl?: string } = {},
): Promise<ImportedRecipe> {
  const { run = options.fetcher ? createFetchRunner(options.fetcher) : fetchRunner, sourceUrl = "" } = options;
  const body = text.trim();
  if (body === "") throw new AiImportError("failed", "Paste the recipe first.");
  if (body.length > MAX_AI_TEXT) throw new AiImportError("failed", "That is too much text to read in one go. Paste one recipe at a time.");

  let content: string;
  try {
    content = await run(aiPrompt(body), AI_IMPORT_TIMEOUT_MS);
  } catch (cause) {
    if (cause instanceof AiImportError) throw cause;
    throw new AiImportError("failed", `The model could not be reached: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  return { from: "ai", url: sourceUrl, recipe: parseAiAnswer(content) };
}

// --- Server functions ------------------------------------------------------

/**
 * Whether the AI rung can run at all, for the chooser and the Settings note.
 * Read on the server every time rather than cached: giving the container a key
 * should not need the app restarted.
 */
export const aiImportAvailable = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .handler(() => ({ available: aiConfigured() }));

export const ImportFromTextInput = z.object({
  text: z.string().trim().min(1),
  /** The address the text came from, when it came from one; becomes the recipe's `sourceUrl`. */
  sourceUrl: z.string().trim().default(""),
});

/** Read a recipe out of pasted text with a hosted model. Nothing is written: the caller reviews it first. */
export const importFromText = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(ImportFromTextInput)
  .handler(async ({ data }) => runAiImport(data.text, { sourceUrl: data.sourceUrl }));
