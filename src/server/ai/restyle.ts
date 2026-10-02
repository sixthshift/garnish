import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import recipes from "../../db/models/recipe/repo";
import styleRules from "../../db/models/style/repo";
import { formatIngredient } from "../../domain/ingredient";
import { type Recipe, recipeInputSchema } from "../../domain/recipe";
import { checkRestyle, type OriginalPart, type RestyleCheck, type RestyledPart } from "../../domain/style";
import { required } from "../core/errors";
import { notFoundMiddleware } from "../core/fn";
import { AI_TIMEOUT_MS, AiError, type AiRunner, aiSettings, createFetchRunner, type Fetcher } from "./client";
import {
  matchParts,
  parseRestyleAnswer,
  partsWithSteps,
  promptParts,
  RESTYLE_JSON_SCHEMA,
  restylePrompt,
  type StylablePart,
  withEmptyParts,
} from "./restylePrompt";

export { AiError } from "./client";

/** Which model rewrites, where, and with what key: the import's settings with `AI_RESTYLE_MODEL` over the model. */
export function restyleSettings(): { apiKey: string; baseUrl: string; model: string } {
  const settings = aiSettings();
  const model = (process.env.AI_RESTYLE_MODEL ?? "").trim();
  return model === "" ? settings : { ...settings, model };
}

/**
 * The recipe's parts as the check reads them: each ingredient row carrying the
 * line the page renders, so a quantity the rewrite moved out of a step's text
 * is still found in the document it moved into. Pure.
 */
function checkedParts(parts: readonly StylablePart[]): OriginalPart[] {
  return parts.map((part) => ({
    ...part,
    ingredients: part.ingredients.map((row) => ({ ...row, line: formatIngredient(row).trim() || row.originalText })),
  }));
}

/** What `runRestyle` hands back: the rewritten parts and the facts check over them. Nothing is written. */
export type RestyleResult = { parts: RestyledPart[]; check: RestyleCheck };

/** The runner used in anger here: the client's runner, told to ask for this schema and this model. */
export const restyleRunner: AiRunner = (prompt, timeoutMs) =>
  createFetchRunner(fetch, { schema: RESTYLE_JSON_SCHEMA, schemaName: "restyle", model: restyleSettings().model })(prompt, timeoutMs);

/** The same runner over an injected `fetch`, so the HTTP path can be driven without a provider. */
export function createRestyleRunner(fetcher: Fetcher = fetch): AiRunner {
  return createFetchRunner(fetcher, {
    schema: RESTYLE_JSON_SCHEMA,
    schemaName: "restyle",
    model: restyleSettings().model,
  });
}

/**
 * One restyle: one prompt, one answer, the pairing verified, the facts check
 * over it. The rules arrive as their texts rather than as ids so this stays
 * free of the database — `restyleSteps` below does the lookups — and the
 * result is returned whether or not the check passed, because a failed check
 * is something the household is shown, not an error. Every part is sent, so
 * the model reads the whole recipe, ingredients included, whichever part holds
 * them.
 */
export async function runRestyle(
  recipe: { parts: readonly StylablePart[] },
  rules: readonly string[],
  options: { run?: AiRunner } = {}
): Promise<RestyleResult> {
  const { run = restyleRunner } = options;
  if (partsWithSteps(recipe.parts).length === 0) {
    // A recipe with no steps at all has nothing to rewrite: the answer is the recipe, and the model is not called.
    const parts = recipe.parts.map((part) => ({ name: part.name, notes: part.ingredients.map((row) => row.note), steps: [] }));
    return { parts, check: checkRestyle(checkedParts(recipe.parts), parts) };
  }
  const prompt = restylePrompt({ rules, parts: promptParts(recipe.parts) });

  let content: string;
  try {
    content = await run(prompt, AI_TIMEOUT_MS);
  } catch (cause) {
    if (cause instanceof AiError) throw cause;
    throw new AiError("failed", `The model could not be reached: ${cause instanceof Error ? cause.message : String(cause)}`);
  }

  const parts = withEmptyParts(recipe.parts, parseRestyleAnswer(content));
  matchParts(recipe.parts, parts);
  return { parts, check: checkRestyle(checkedParts(recipe.parts), parts) };
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
 * caller gets the parts and the check and decides what to keep.
 */
export const restyleSteps = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(RestyleStepsInput)
  .handler(async ({ data }): Promise<RestyleResult> => {
    const recipe = required(recipes.getById(data.id), "recipe", data.id);
    return runRestyle(recipe, ruleTexts(data.ruleIds));
  });

/** The ticked statements' texts, in the guide's order. Unknown ids are ignored. */
function ruleTexts(ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  return styleRules
    .list()
    .filter((rule) => wanted.has(rule.id))
    .map((rule) => rule.text);
}

export const RestyleDraftInput = z.object({
  /** The recipe as the import would create it: nothing is stored yet, so there is no id to name. */
  doc: recipeInputSchema,
  ruleIds: z.array(z.string().min(1)).default([]),
});

/**
 * The same rewrite over an import that is not saved yet, so the Style stage
 * comes before Save and a recipe lands in the library already in the house
 * style. Nothing is written.
 */
export const restyleDraft = createServerFn({ method: "POST" })
  .validator(RestyleDraftInput)
  .handler(async ({ data }): Promise<RestyleResult> => runRestyle(data.doc, ruleTexts(data.ruleIds)));

export const ApplyRestyleInput = z.object({
  /** The recipe's id, as `restyleSteps` takes it. */
  id: z.string().min(1),
  /**
   * The parts as the household accepted them, in the recipe's own order: the
   * answer of `restyleSteps`, possibly with steps edited in the diff.
   * Names ride along so a caller reads as the answer does; the pairing is by
   * position, and a count that does not match the recipe's parts is refused.
   */
  parts: z
    .array(
      z.object({
        name: z.string().default(""),
        /** One note per ingredient row of that part, in the part's order. A count that does not match the part's rows is refused. */
        notes: z.array(z.string()).default([]),
        steps: z.array(z.object({ title: z.string().default(""), text: z.string().default(""), summary: z.string().default("") })).default([]),
      })
    )
    .default([]),
});

/**
 * Write an accepted restyle. The first restyle of a part copies its
 * steps into `source_steps` before replacing them, so the author's words are
 * kept whatever happens afterwards; the new steps are linked to the part's
 * ingredients again, and the recipe is stamped as restyled.
 */
export const applyRestyle = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(ApplyRestyleInput)
  .handler(async ({ data }): Promise<Recipe> => {
    return required(recipes.ref(data.id).restyle(data.parts), "recipe", data.id);
  });

export const CreateRestyledRecipeInput = z.object({
  /** The recipe as the author wrote it: what is created, and so what Restore brings back. */
  doc: recipeInputSchema,
  /** The parts as the household accepted them, paired with `doc.parts` by position, as `applyRestyle` takes them. */
  parts: ApplyRestyleInput.shape.parts,
});

/**
 * Save an import in the house style: the author's recipe is created, then the
 * accepted parts are applied over it, so the original is kept exactly as a
 * restyle of a saved recipe keeps it. A restyle that is refused takes the new
 * recipe with it, so a failed save leaves nothing half-written behind.
 */
export const createRestyledRecipe = createServerFn({ method: "POST" })
  .validator(CreateRestyledRecipeInput)
  .handler(async ({ data }): Promise<Recipe> => {
    const created = recipes.create(data.doc);
    try {
      return required(recipes.ref(created.id).restyle(data.parts), "recipe", created.id);
    } catch (cause) {
      recipes.remove(created.id);
      throw cause;
    }
  });

export const RestoreStepsInput = z.object({ id: z.string().min(1) });

/**
 * Undo a restyle: every part that kept its original steps gets them
 * back, the kept copy is dropped, and the stamp is cleared. A recipe that was
 * never restyled comes back unchanged.
 */
export const restoreSteps = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(RestoreStepsInput)
  .handler(async ({ data }): Promise<Recipe> => {
    return required(recipes.ref(data.id).restore(), "recipe", data.id);
  });
