// The restyle read (M37.4): the recipe's steps, the ticked statements of the
// house style, and one call to the model that asks for the steps back in the
// household's voice.
//
// It is deliberately not the import. The import's question is "what does this
// page say", and its check (M36.5) rejects any answer whose words differ from
// the page's; the question here is "say this again the way we say it", so the
// words are the one thing that may change. What may not change is the facts,
// and `restyleCheck.ts` (M37.3) is what holds the answer to them: every number
// the original steps carried and every ingredient they named has to survive.
// The prompt opens by asking for exactly that, because a model that is told
// not to convert usually does not, and the check is then the guard rather than
// the whole of the defence.
//
// Two rules hold it in place, the same two the AI import lives under:
//
//   nothing is written    `runRestyle` returns the rewritten parts and the
//                         check over them. M37.5 writes, and only after the
//                         household has looked at the diff (M37.6).
//   nothing is trusted    the answer is parsed through a zod schema, and an
//                         answer whose parts are not the recipe's parts, in
//                         the recipe's order, under the recipe's names, is
//                         `malformed` before the check ever sees it. Pairing
//                         parts by index is what makes the check meaningful,
//                         so the pairing is verified rather than assumed.
//
// The provider, the key and the error kinds are the import's, shared rather
// than copied: one `AiError` means the restyle sheet can show a failure
// with the words the import screen already uses. Only the model is its own.
// `AI_RESTYLE_MODEL` exists because rewriting is a harder task than grouping —
// the import hands the model a list of lines and asks which heading each sat
// under, where this asks for prose that keeps every fact — so a household may
// well want the full Flash here while the import stays on Lite, and one
// variable is the whole of that choice. Unset, it is `AI_MODEL`, so the
// default setup is still a single key.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { recipes } from "../../db/models/recipe/repo";
import { styleRules } from "../../db/models/style/repo";
import { formatIngredient } from "../../domain/ingredient";
import type { Part, Recipe } from "../../domain/recipe";
import { checkRestyle, type RestyleCheck, type RestyledPart } from "../../domain/style";
import { AI_TIMEOUT_MS, AiError, aiSettings, type AiRunner, createFetchRunner, type Fetcher, stripFence } from "./client";
import { getDb } from "../core/db";
import { required } from "../core/errors";
import { notFoundMiddleware } from "../core/fn";

export { AiError } from "./client";

/** Which model rewrites, where, and with what key: the import's settings with `AI_RESTYLE_MODEL` over the model. */
export function restyleSettings(): { apiKey: string; baseUrl: string; model: string } {
  const settings = aiSettings();
  const model = (process.env.AI_RESTYLE_MODEL ?? "").trim();
  return model === "" ? settings : { ...settings, model };
}

/**
 * The answer's shape as a JSON Schema for the request's `response_format`,
 * written out for the same reason `SCRAPED_JSON_SCHEMA` is: structured output
 * wants every property named, every one required, and no extras. Steps only —
 * the ingredients are sent so the model knows what the pan holds, never so it
 * can rewrite them. `test/server/ai/restyle.test.ts` holds it to the zod schema.
 */
export const RESTYLE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["parts"],
  properties: {
    parts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "steps"],
        properties: {
          name: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

/** One part as the model answers it. */
export const RestyledPartSchema = z.object({
  name: z.string().default(""),
  steps: z.array(z.string()).default([]),
});

/** The whole answer. Nothing else is read off it, so nothing else is declared. */
export const RestyleAnswerSchema = z.object({ parts: z.array(RestyledPartSchema).default([]) });
export type RestyleAnswer = z.infer<typeof RestyleAnswerSchema>;

/** A part as the prompt shows it: the name, the ingredient lines as the app renders them, and the steps. */
export type PromptPart = { name: string; ingredients: string[]; steps: string[] };

/** What `runRestyle` hands back: the rewritten parts and the facts check over them. Nothing is written. */
export type RestyleResult = { parts: RestyledPart[]; check: RestyleCheck };

/**
 * The parts as the prompt shows them. Ingredient lines are formatted the way
 * the recipe page formats them (`formatIngredient`) rather than sent as the
 * raw `originalText`, because the list the model is told to name ingredients
 * from (statement 8) should be the list the household reads. A row that
 * formats to nothing falls back to its raw line so no ingredient goes
 * unmentioned. Pure.
 */
export function promptParts(parts: readonly Part[]): PromptPart[] {
  return parts.map((part) => ({
    name: part.name,
    ingredients: part.ingredients.map((row) => {
      const line = formatIngredient(row).trim();
      return line === "" ? row.originalText.trim() : line;
    }),
    steps: part.steps.map((step) => step.text),
  }));
}

/**
 * The line that is not a style statement and never becomes one: the facts are
 * the recipe's, whatever the household's voice. It leads the prompt because a
 * model reads the top of it best, and M37.3 enforces it afterwards regardless.
 */
export const FIXED_RESTYLE_LINE =
  "Temperatures, times and quantities are copied exactly, never converted, rounded or dropped.";

/** How a part is headed in the prompt. The unnamed part is the main body and says so. Pure. */
function partHeading(name: string): string {
  return name.trim() === "" ? 'PART "" (the recipe\'s main body)' : `PART "${name}"`;
}

/**
 * What the model is asked. The fixed line first, then the ticked statements
 * numbered — numbered because that is how the guide is written and because a
 * numbered list is what a small model follows, and because a test can then
 * assert that statement (7) reached the prompt — then the recipe part by part.
 *
 * The rules after the statements are about the shape of the answer rather than
 * its voice: the same parts, in the same order, under the same names, with the
 * steps rewritten and nothing else touched. They are separate from the
 * statements on purpose, because the statements are the household's and change
 * in Settings, while these are the contract the parser and the check depend on.
 * Pure.
 */
export function restylePrompt({ rules, parts }: { rules: readonly string[]; parts: readonly PromptPart[] }): string {
  const lines: string[] = [
    "Rewrite this recipe's method in the house style below, and answer with JSON matching the schema.",
    FIXED_RESTYLE_LINE,
    "",
    "HOUSE STYLE:",
  ];
  if (rules.length === 0) lines.push("(no statements are ticked: leave the steps as they are)");
  else rules.forEach((rule, index) => lines.push(`${index + 1}. ${rule}`));

  lines.push(
    "",
    "Rules for the answer:",
    "- Answer with the same parts, in the same order, with their names copied exactly as given below. Do not add, drop, merge, rename or reorder a part.",
    "- Rewrite `steps` only. The ingredient lines are shown so you know what is used and what it is called; never answer with them, and never change a quantity, a unit or an ingredient.",
    "- A part's steps may be merged or split, so a part may answer with more or fewer steps than it was given, but everything the original steps said must still be said.",
    "- Keep every number, temperature and time exactly as written, including its unit. Do not convert between metric and imperial, do not round, and do not drop one.",
    "- Keep every ingredient the original steps named, called by the name the ingredient list uses.",
    "- Do not invent an ingredient, a step, a time or a quantity, and do not add advice the recipe does not give.",
    "- Steps carry no numbering of their own: one entry per step, plain sentences.",
    "- Answer with the JSON only.",
    "",
    "RECIPE:",
  );

  for (const part of parts) {
    lines.push("", partHeading(part.name), "INGREDIENTS:");
    if (part.ingredients.length === 0) lines.push("(none)");
    else for (const line of part.ingredients) lines.push(`- ${line}`);
    lines.push("STEPS:");
    if (part.steps.length === 0) lines.push("(none)");
    else part.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  }

  return lines.join("\n");
}

/** The runner used in anger here: the client's runner, told to ask for this schema and this model. */
export const restyleRunner: AiRunner = (prompt, timeoutMs) =>
  createFetchRunner(fetch, { schema: RESTYLE_JSON_SCHEMA, schemaName: "restyle", model: restyleSettings().model })(
    prompt,
    timeoutMs,
  );

/** The same runner over an injected `fetch`, so the HTTP path can be driven without a provider. */
export function createRestyleRunner(fetcher: Fetcher = fetch): AiRunner {
  return createFetchRunner(fetcher, {
    schema: RESTYLE_JSON_SCHEMA,
    schemaName: "restyle",
    model: restyleSettings().model,
  });
}

/**
 * The parts out of the message content: JSON, because the request asked for
 * it, with a fence stripped for a model that fences anyway. Throws
 * `AiError("malformed", …)` for anything that is not an answer. Pure.
 */
export function parseRestyleAnswer(content: string): RestyledPart[] {
  const raw = stripFence(content);
  if (raw === "") throw new AiError("malformed", "The model answered with nothing.");

  let answer: unknown;
  try {
    answer = JSON.parse(raw);
  } catch {
    throw new AiError("malformed", "The model answered in prose rather than the restyle format, so nothing was changed.");
  }

  const parsed = RestyleAnswerSchema.safeParse(answer);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first && first.path.length > 0 ? ` (${first.path.join(".")}: ${first.message})` : "";
    throw new AiError("malformed", `The model's answer was not in the expected shape${where}. Nothing was changed.`);
  }
  return parsed.data.parts;
}

/**
 * The answer's parts against the recipe's. `checkRestyle` pairs by index and
 * throws rather than failing on a mismatch, because a mismatch is not a bad
 * rewrite but a broken answer — so it is caught here first and reported as
 * `malformed`, in words the sheet can show. Names are compared trimmed and
 * case-insensitively: a model that title-cases a heading has still answered
 * about the right part. Pure.
 */
export function matchParts(original: readonly Part[], restyled: readonly RestyledPart[]): void {
  if (original.length !== restyled.length) {
    throw new AiError(
      "malformed",
      `The model answered with ${restyled.length} part${restyled.length === 1 ? "" : "s"} where the recipe has ${original.length}, so nothing was changed.`,
    );
  }
  const fold = (name: string) => name.trim().toLowerCase();
  for (const [index, part] of original.entries()) {
    const answered = restyled[index]!;
    if (fold(part.name) !== fold(answered.name)) {
      throw new AiError(
        "malformed",
        `The model renamed a part ("${part.name}" came back as "${answered.name}"), so nothing was changed.`,
      );
    }
  }
}

/**
 * One restyle: one prompt, one answer, the pairing verified, the facts check
 * over it. The rules arrive as their texts rather than as ids so this stays
 * free of the database — `restyleSteps` below does the lookups — and the
 * result is returned whether or not the check passed, because a failed check
 * is something the household is shown (M37.6), not an error.
 */
export async function runRestyle(
  recipe: Recipe,
  rules: readonly string[],
  options: { run?: AiRunner } = {},
): Promise<RestyleResult> {
  const { run = restyleRunner } = options;
  const prompt = restylePrompt({ rules, parts: promptParts(recipe.parts) });

  let content: string;
  try {
    content = await run(prompt, AI_TIMEOUT_MS);
  } catch (cause) {
    if (cause instanceof AiError) throw cause;
    throw new AiError("failed", `The model could not be reached: ${cause instanceof Error ? cause.message : String(cause)}`);
  }

  const parts = parseRestyleAnswer(content);
  matchParts(recipe.parts, parts);
  return { parts, check: checkRestyle(recipe.parts, parts) };
}

// --- Server functions ------------------------------------------------------

export const RestyleStepsInput = z.object({
  /** The recipe's id, not its slug: the sheet already holds the loaded recipe. */
  id: z.string().min(1),
  /** The statements ticked for this run. Unknown ids are ignored; the order is the guide's, not the caller's. */
  ruleIds: z.array(z.string().min(1)).default([]),
});

/**
 * Rewrite a recipe's steps with the ticked statements. Nothing is written: the
 * caller gets the parts and the check and decides what to keep (M37.5, M37.6).
 */
export const restyleSteps = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(RestyleStepsInput)
  .handler(async ({ data }): Promise<RestyleResult> => {
    const db = await getDb();
    const recipe = required(recipes(db).getById(data.id), "recipe", data.id);
    const wanted = new Set(data.ruleIds);
    const rules = styleRules(db)
      .list()
      .filter((rule) => wanted.has(rule.id))
      .map((rule) => rule.text);
    return runRestyle(recipe, rules);
  });

export const ApplyRestyleInput = z.object({
  /** The recipe's id, as `restyleSteps` takes it. */
  id: z.string().min(1),
  /**
   * The parts as the household accepted them, in the recipe's own order: the
   * answer of `restyleSteps`, possibly with steps edited in the diff (M37.6).
   * Names ride along so a caller reads as the answer does; the pairing is by
   * position, and a count that does not match the recipe's parts is refused.
   */
  parts: z.array(z.object({ name: z.string().default(""), steps: z.array(z.string()).default([]) })).default([]),
});

/**
 * Write an accepted restyle (M37.5). The first restyle of a part copies its
 * steps into `source_steps` before replacing them, so the author's words are
 * kept whatever happens afterwards; the new steps are linked to the part's
 * ingredients again, and the recipe is stamped as restyled.
 */
export const applyRestyle = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(ApplyRestyleInput)
  .handler(async ({ data }): Promise<Recipe> => {
    const db = await getDb();
    return required(recipes(db).restyleParts(data.id, data.parts), "recipe", data.id);
  });

export const RestoreStepsInput = z.object({ id: z.string().min(1) });

/**
 * Undo a restyle (M37.5): every part that kept its original steps gets them
 * back, the kept copy is dropped, and the stamp is cleared. A recipe that was
 * never restyled comes back unchanged.
 */
export const restoreSteps = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(RestoreStepsInput)
  .handler(async ({ data }): Promise<Recipe> => {
    const db = await getDb();
    return required(recipes(db).restoreParts(data.id), "recipe", data.id);
  });
