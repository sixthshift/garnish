import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import recipes from "../../db/models/recipe/repo";
import styleRules from "../../db/models/style/repo";
import { formatIngredient } from "../../domain/recipes/ingredient";
import { type Recipe, recipeInputSchema } from "../../domain/recipes/recipe";
import { checkRestyle, type OriginalPart, type RestyleCheck, type RestyledPart, rowsInPlace } from "../../domain/recipes/style";
import diagnostics, { type DiagnosticReport } from "../core/diagnostics";
import { required } from "../core/errors";
import { notFoundMiddleware } from "../core/fn";
import { AI_TIMEOUT_MS, type AiClient, AiError } from "./client";
// This and the diagnostics import above are referenced only inside handlers,
// so Start drops both from the client build: the provider brings Node-only SDKs (claude-agent-sdk) that throw in a
// browser, and diagnostics brings bun:sqlite.
import serverAi from "./provider";
import {
  type AnsweredPart,
  parseRestyleAnswer,
  partsWithSteps,
  placeLines,
  promptParts,
  RESTYLE_JSON_SCHEMA,
  restylePrompt,
  revisePrompt,
  revisionProblems,
  type StylablePart,
} from "./restylePrompt";

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

/**
 * What `runRestyle` hands back: the rewritten parts and the check over them.
 * `revision` is there when the checks found something in the first rewrite
 * and it was sent back: what it was asked to fix, and whether the revised
 * rewrite was better and taken. Nothing is written.
 */
export type RestyleResult = { parts: RestyledPart[]; check: RestyleCheck; revision?: { problems: string[]; taken: boolean } };

/**
 * How bad a check is, for choosing between a rewrite and its revision: each
 * thing lost or invented outweighs everything that only reads wrong, since
 * those change what the cook does. Pure.
 */
export function checkWeight(check: RestyleCheck): number {
  const changed =
    check.missingFacts.length + check.missingFoods.length + check.missingConditions.length + check.addedConditions.length + (check.rowMismatch ? 1 : 0);
  return changed * 100 + check.issues.filter((issue) => issue.kind !== "imperial").length;
}

/**
 * One restyle: one prompt, one answer, the pairing verified, the facts and
 * reading checks over it; and when the checks found something, the rewrite
 * sent back once with the list, the revision kept only if it is better. The rules arrive as their texts rather than as ids so this stays
 * free of the database — `restyleSteps` below does the lookups — and the
 * result is returned whether or not the check passed, because a failed check
 * is something the household is shown, not an error. Every part is sent, so
 * the model reads the whole recipe, ingredients included, whichever part holds
 * them.
 */
export async function runRestyle(
  recipe: { parts: readonly StylablePart[] },
  rules: readonly string[],
  options: { ai: AiClient; model?: string }
): Promise<RestyleResult> {
  const { ai, model = ai.model("restyle") } = options;
  if (partsWithSteps(recipe.parts).length === 0) {
    // A recipe with no steps at all has nothing to rewrite: the answer is the recipe, and the model is not called.
    const inPlace = rowsInPlace(recipe.parts);
    const parts = recipe.parts.map((part, p) => ({ name: part.name, rows: inPlace[p]!, notes: part.ingredients.map((row) => row.note), steps: [] }));
    return { parts, check: checkRestyle(checkedParts(recipe.parts), parts) };
  }
  const shown = promptParts(recipe.parts);
  const ask = async (prompt: string, schemaName: string) => {
    try {
      return await ai.ask({ prompt, schema: RESTYLE_JSON_SCHEMA, schemaName, model, timeoutMs: AI_TIMEOUT_MS });
    } catch (cause) {
      if (cause instanceof AiError) throw cause;
      throw new AiError("failed", `The model could not be reached: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  };
  const original = checkedParts(recipe.parts);
  const read = (answered: AnsweredPart[]) => {
    const parts = placeLines(recipe.parts, answered);
    return { parts, check: checkRestyle(original, parts) };
  };

  const answered = parseRestyleAnswer(await ask(restylePrompt({ rules, parts: shown }), "restyle"));
  const first = read(answered);
  const problems = revisionProblems(first.check, original);
  if (problems.length === 0) return first;

  // The checks found something: one more look, with the list. A revision that fails, or is no better, leaves the first rewrite standing.
  try {
    const revised = read(parseRestyleAnswer(await ask(revisePrompt({ rules, parts: shown, rewrite: answered, problems }), "restyle-revise")));
    if (checkWeight(revised.check) < checkWeight(first.check)) return { ...revised, revision: { problems, taken: true } };
  } catch {
    // The first rewrite is still an answer: the household sees it with what the checks found.
  }
  return { ...first, revision: { problems, taken: false } };
}

/**
 * A restyle whose facts check failed, as a warning for Settings › Diagnostics:
 * not an error — the household is shown the result and chooses — but the
 * report is what explains "the restyle failed" afterwards. Null when the check
 * passed. Pure.
 */
export function refusedCheckReport(recipeName: string, model: string, result: RestyleResult): DiagnosticReport | null {
  if (result.check.ok) return null;
  return {
    source: "ai",
    level: "warning",
    name: "restyle",
    message: `The facts check flagged the rewrite of "${recipeName}"`,
    detail: { recipe: recipeName, model, check: { ...result.check, parts: result.check.parts.filter((part) => !part.ok) } },
  };
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
    const result = await runRestyle(recipe, ruleTexts(data.ruleIds), { ai: serverAi });
    // Inside the handler, as every use of serverAi and diagnostics here is, so the client build drops both.
    const flagged = refusedCheckReport(recipe.name, serverAi.model("restyle"), result);
    if (flagged) diagnostics.record(flagged);
    return result;
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
  .handler(async ({ data }): Promise<RestyleResult> => {
    const result = await runRestyle(data.doc, ruleTexts(data.ruleIds), { ai: serverAi });
    const flagged = refusedCheckReport(data.doc.name, serverAi.model("restyle"), result);
    if (flagged) diagnostics.record(flagged);
    return result;
  });

export const ApplyRestyleInput = z.object({
  /** The recipe's id, as `restyleSteps` takes it. */
  id: z.string().min(1),
  /**
   * The parts as the household accepted them, in the order they are to have:
   * the answer of `restyleSteps`, possibly with steps retyped on the Style
   * page, or the author's own layout. They replace the recipe's parts.
   */
  parts: z
    .array(
      z.object({
        name: z.string().default(""),
        /**
         * The rows this part holds, each by its place in the recipe's rows read
         * part by part from 0. Together the parts must hold every row once, or
         * the save is refused.
         */
        rows: z.array(z.number().int().min(0)).default([]),
        /** One note per entry of `rows`. */
        notes: z.array(z.string()).default([]),
        steps: z.array(z.object({ title: z.string().default(""), text: z.string().default(""), summary: z.string().default("") })).default([]),
      })
    )
    .default([]),
});

/**
 * Write an accepted restyle. The first restyle keeps the recipe's parts as the
 * author left them in `source_parts` before replacing them, so the author's
 * layout and words are kept whatever happens afterwards; the new steps are
 * linked to their parts' ingredients again, and the recipe is stamped as
 * restyled.
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
  /** The parts as the household accepted them, their rows numbered through `doc.parts`, as `applyRestyle` takes them. */
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
 * Undo a restyle: the recipe gets the author's parts back, their rows, notes
 * and steps, the kept copy is dropped, and the stamp is cleared. A recipe that
 * was never restyled comes back unchanged.
 */
export const restoreSteps = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(RestoreStepsInput)
  .handler(async ({ data }): Promise<Recipe> => {
    return required(recipes.ref(data.id).restore(), "recipe", data.id);
  });
