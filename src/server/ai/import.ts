// The AI import rung (M34.5, M36.1, decisions.md rows 74 and 75): hand the
// text to a language model and let it do what no rule can — read a recipe out
// of prose.
//
// Since M36.6 the model is the default reader of a page rather than a rung
// under the rules: the rules in `../import/fromUrl.ts` say what the lines are and
// the model says which part each sits under, because schema.org has nowhere to
// record that. What is left for the model alone is text that is not a page at
// all — the block off a photograph, an email, a book you typed out — where
// there is nothing structured to anchor it to.
//
// A paste that is a page's own source takes the same road as a fetched page
// (M36.7): `runAiImport` hands it to `importFromHtml` first, and the model
// then reads the readable text with the JSON-LD as its anchor. Someone who
// worked around a bot wall by copying view-source should not get a worse
// result than the fetch would have given them.
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
// The model itself — provider, key, request shape, deadline and error kinds —
// is `./client.ts`, shared with the restyle pass. This file is the question:
// the recipe's JSON Schema, the prompt, the parser, and the read that puts
// them together.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkAgainstAnchor } from "../../domain/import/importCheck";
import { looksLikeHtml, MAX_PAGE_TEXT, readableText } from "../../domain/import/pageText";
import { ingredientLines, normaliseScraped, type ScrapedRecipe, ScrapedRecipeSchema } from "../../domain/import/schemaRecipe";
import { notFoundMiddleware } from "../core/fn";
import { importFromHtml, type ImportedRecipe } from "../import/fromUrl";
import { AI_TIMEOUT_MS, aiConfigured, AiError, type AiRunner, createFetchRunner, type Fetcher, stripFence } from "./client";

/** The most text worth sending: `readableText`'s own cap (`pageText.ts`), so there is one number for it rather than two that can drift. */
export const MAX_AI_TEXT = MAX_PAGE_TEXT;

/**
 * `ScrapedRecipe` as a JSON Schema for the request's `response_format`,
 * written out rather than generated: structured output wants every property
 * named, every one required, and no extras, and a generated schema carries
 * zod's defaults and optionality into a place that does not want them.
 * `test/server/ai/import.test.ts` holds it to the zod schema's shape so the two
 * cannot drift.
 */
export const SCRAPED_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "description", "image", "servings", "yieldText", "prepMinutes", "cookMinutes", "tags", "parts"],
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    image: { type: ["string", "null"] },
    servings: { type: "number" },
    yieldText: { type: "string" },
    prepMinutes: { type: ["number", "null"] },
    cookMinutes: { type: ["number", "null"] },
    tags: { type: "array", items: { type: "string" } },
    parts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "ingredients", "steps"],
        properties: {
          name: { type: "string" },
          ingredients: { type: "array", items: { type: "string" } },
          steps: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

/**
 * The anchor as the model sees it: the fields it is being asked to copy, and
 * nothing else. `image` and `description` ride along so an accepted answer
 * keeps them — the model is told to hand them back untouched — but everything
 * the JSON-LD carried that has no bearing on the question is left out, because
 * the anchor is sent on every structured page and every byte of it is text the
 * model has to read past. Pure.
 */
export function anchorJson(anchor: ScrapedRecipe): string {
  return JSON.stringify({
    name: anchor.name,
    description: anchor.description,
    image: anchor.image,
    servings: anchor.servings,
    yieldText: anchor.yieldText,
    prepMinutes: anchor.prepMinutes,
    cookMinutes: anchor.cookMinutes,
    tags: anchor.tags,
    parts: anchor.parts.map((part) => ({ name: part.name, ingredients: part.ingredients, steps: part.steps })),
  });
}

/** The rules for a page with no structured data: the text is all there is, so the model reads the recipe out of it. */
const UNANCHORED_RULES = [
  "Read the recipe out of the text below and answer with JSON matching the schema. Rules:",
  "- `parts`: a named section of the recipe (a sauce, a topping) is a part with that name, holding the ingredient lines written under that heading and the steps written under it. Anything under no heading at all — ingredients and steps both — goes in the part named \"\" (empty), which is the main body.",
  "- Copy ingredient lines verbatim into their part's `ingredients`, one entry per line, quantity and unit and all. Do not convert, round or reword them, and do not repeat a line on a second part.",
  "- `steps` are that part's method, one entry per step, without numbering.",
  "- `servings` is a number and 0 when the text does not say. `yieldText` is what it makes without the count (\"biscuits\", \"loaf\"), empty when the yield was only a number.",
  "- `prepMinutes` and `cookMinutes` are whole minutes or null. `image` is a URL found in the text or null.",
  "- `tags` are short topic words the text itself gives. Do not invent any.",
  "- Never invent an ingredient, a step, a time or a quantity. What is not in the text is empty, 0 or null.",
  "- Answer with the JSON only.",
];

/**
 * The rules for a page that came with structured data, which since M36.6 is
 * most pages. The question being asked is a narrow one and the prompt says so
 * in as many ways as it can: the anchor's lines and steps *are* the recipe,
 * and the only thing missing from them is which heading each one sat under,
 * because schema.org has nowhere to put that. So the model is not reading a
 * recipe here, it is sorting known lines into parts — and `checkAgainstAnchor`
 * (M36.5) throws the answer away if it did anything else, which is the real
 * reason these rules can be this blunt.
 *
 * The ingredient headings had to be spelled out separately (M37.1). On the
 * ragu page the anchor already carried three parts off the page's
 * `HowToSection`s, and the model read that as the question already answered:
 * all eighteen ingredient lines stayed on the unnamed part although the page
 * groups them under "Ragu" and "To Serve". So the rules now say that the
 * ingredient list has headings of its own, that they decide where a line goes
 * whatever the step sections say, and that a part is allowed to hold lines
 * with no steps — the three things the model had to be told before it would
 * move a line. `checkAgainstAnchor` does not compare part names, so a part
 * named from a heading the anchor never saw passes the check as long as the
 * lines themselves are untouched.
 */
const ANCHORED_RULES = [
  "The JSON under ANCHOR below is the recipe, taken from the page's own structured data. Your job is only to sort its lines and steps into parts, using the text to see which heading each one sat under. Rules:",
  "- Every ingredient line and every step in your answer must be copied from the anchor, byte for byte, exactly once between them all. The anchor's lines and steps are the recipe.",
  "- Never add, drop, merge, split or reword a line or a step. Do not renumber, retitle, translate, correct spelling or punctuation, convert units, or tidy whitespace.",
  "- The text is evidence for one thing only: which heading each of the anchor's lines and steps sits under, and what that part should be named. It is not a source of content.",
  "- The text's *ingredient* headings decide which part an ingredient line belongs to, and they decide it on their own, independently of the headings the steps sit under. Read the ingredient list's own headings and put each line under the one above it.",
  "- A line's part may be one the anchor already names, or a new part named after an ingredient heading the anchor never mentions. A part may hold lines and no steps, or steps and no lines; both are fine.",
  "- When an ingredient heading and a step section clearly refer to the same thing, they are one part: give them the same name and let it hold both the lines and the steps.",
  "- A heading that is the recipe's own name, or a heading of the list itself such as \"Ingredients\", \"Instructions\" or \"Method\", is not a part.",
  "- Name a part from its heading as written, but leave out a trailing colon and a note marker such as \"(Note 4)\".",
  "- A line or a step that sits under no heading stays on the part named \"\" (empty), which is the main body. If the text shows no headings at all, answer with the anchor's parts unchanged.",
  "- `name`, `description`, `image`, `servings`, `yieldText`, `prepMinutes`, `cookMinutes` and `tags`: copy them from the anchor exactly as given. Do not improve them.",
  "- Answer with the JSON only.",
];

/**
 * What the model is asked. Unanchored, the fields are described in the app's
 * own terms because the schema only gives their types: an empty string is "the
 * text did not say", ingredient lines are copied verbatim for `parseIngredient`
 * to read (row 47), and a named section is a part, as row 59 already has the
 * URL import treat a `HowToSection`. Anchored, the task is a different one
 * altogether and the rules say so. Pure.
 */
export function aiPrompt({ text, anchor = null }: { text: string; anchor?: ScrapedRecipe | null }): string {
  if (anchor === null) return [...UNANCHORED_RULES, "", "TEXT:", text].join("\n");
  return [...ANCHORED_RULES, "", "TEXT:", text, "", "ANCHOR:", anchorJson(anchor)].join("\n");
}

/** The client's runner, told to ask for a recipe. The fetch is injectable so the HTTP path can be driven without a provider. */
export function createImportRunner(fetcher: Fetcher = fetch): AiRunner {
  return createFetchRunner(fetcher, { schema: SCRAPED_JSON_SCHEMA, schemaName: "recipe" });
}

/**
 * The recipe out of the message content: JSON, because the request asked for
 * it, with the fence stripped for a model that fences anyway. Throws
 * `AiError` for anything that is not a recipe. Pure.
 */
export function parseAiAnswer(content: string): ScrapedRecipe {
  const raw = stripFence(content);
  if (raw === "") throw new AiError("malformed", "The model answered with nothing.");

  let answer: unknown;
  try {
    answer = JSON.parse(raw);
  } catch {
    throw new AiError("malformed", "The model answered in prose rather than the recipe format, so nothing was imported.");
  }

  const parsed = ScrapedRecipeSchema.safeParse(answer);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first && first.path.length > 0 ? ` (${first.path.join(".")}: ${first.message})` : "";
    throw new AiError("malformed", `The model's answer was not in the expected shape${where}. Nothing was imported.`);
  }
  const recipe = normaliseScraped(parsed.data);
  if (recipe.name === "" && ingredientLines(recipe).length === 0) {
    throw new AiError("malformed", "The model found no recipe in that text.");
  }
  return recipe;
}

/**
 * The model's own half: one prompt, one answer, and — when the read was
 * anchored — the check over it. `runAiImport` below decides what to hand this;
 * everything from here down is the same whether the text came from a paste, a
 * page's readable text, or the client handing back the `pageText` it already
 * had.
 */
async function modelRead(
  text: string,
  options: { run: AiRunner; sourceUrl: string; anchor: ScrapedRecipe | null; pageText: string },
): Promise<ImportedRecipe> {
  const { run, sourceUrl, anchor, pageText } = options;
  // The cap is on what the request carries, not on the paste alone: an
  // anchored read sends the page's text and the page's JSON-LD together, and
  // it is the pair of them the model has to fit in.
  if (text.length + (anchor === null ? 0 : anchorJson(anchor).length) > MAX_AI_TEXT) {
    throw new AiError("failed", "That is too much text to read in one go. Paste one recipe at a time.");
  }

  let content: string;
  try {
    content = await run(aiPrompt({ text, anchor }), AI_TIMEOUT_MS);
  } catch (cause) {
    if (cause instanceof AiError) throw cause;
    throw new AiError("failed", `The model could not be reached: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  const answer = parseAiAnswer(content);
  if (anchor === null) return { from: "ai", url: sourceUrl, recipe: answer, pageText };

  // The anchored read is the model sorting known lines into parts (M36.5), so
  // the only question left is whether it did anything else. It did: the
  // structure goes and the page's own content stays, as `from: "schema"`, with
  // the answer kept under `rejected` so the review can still offer it.
  const check = checkAgainstAnchor(answer, anchor);
  if (check.ok) return { from: "ai", url: sourceUrl, recipe: answer, pageText, check };
  return { from: "schema", url: sourceUrl, recipe: anchor, pageText, check, rejected: answer };
}

/**
 * What the paste screen sends and gets back: the same `ImportedRecipe` the URL
 * import produces.
 *
 * Prose goes straight to the model, as it always has. A paste that is a page's
 * source (M36.7) takes the rules first instead, through the very same
 * `importFromHtml` a fetched page goes through, so someone who got past a bot
 * wall by copying view-source lands on exactly the result the fetch would have
 * given: the JSON-LD as the anchor, the readable text as what the model sorts
 * into parts, the check over the answer. A model failure on that path is not
 * fatal — the rules already produced a usable recipe, so it is returned as it
 * stands rather than thrown away with the error. That is also what happens
 * when no model is configured at all, which is the same bargain the URL import
 * strikes.
 */
export async function runAiImport(
  text: string,
  options: { run?: AiRunner; fetcher?: Fetcher; sourceUrl?: string; anchor?: ScrapedRecipe | null; pageText?: string } = {},
): Promise<ImportedRecipe> {
  const {
    run = createImportRunner(options.fetcher),
    sourceUrl = "",
    anchor = null,
    pageText = "",
  } = options;
  const body = text.trim();
  if (body === "") throw new AiError("failed", "Paste the recipe first.");

  // An anchor means the client has already run the rules over this page and is
  // handing back its `pageText` (M36.6); only a bare paste can be markup.
  if (anchor === null && looksLikeHtml(body)) {
    const found = importFromHtml(body, sourceUrl);
    if (found !== null) {
      try {
        return await modelRead(found.pageText, {
          run,
          sourceUrl,
          anchor: found.from === "schema" ? found.recipe : null,
          pageText: found.pageText,
        });
      } catch (cause) {
        if (cause instanceof AiError) return found;
        throw cause;
      }
    }
    // Markup the rules could make nothing of: the model still gets a fair go
    // at it, over the readable text rather than the tags.
    return await modelRead(readableText(body), { run, sourceUrl, anchor: null, pageText: "" });
  }

  return await modelRead(body, { run, sourceUrl, anchor, pageText });
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
  /**
   * The rules rung's own reading of the same page, when it had one. The client
   * already holds it, so sending it back costs nothing and saves the server a
   * second fetch of a page it has no address for.
   */
  anchor: ScrapedRecipeSchema.optional(),
});

/** Read a recipe out of pasted text with a hosted model. Nothing is written: the caller reviews it first. */
export const importFromText = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(ImportFromTextInput)
  .handler(async ({ data }) =>
    runAiImport(data.text, {
      sourceUrl: data.sourceUrl,
      anchor: data.anchor === undefined ? null : normaliseScraped(data.anchor),
    }),
  );
