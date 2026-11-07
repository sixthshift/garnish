import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import cooking from "../../db/models/cooking/repo";
import foods from "../../db/models/food/repo";
import recipes from "../../db/models/recipe/repo";
import units from "../../db/models/unit/repo";
import { adjustmentInputSchema, adjustmentSchema, DECISIONS, fitsRecipe, keptRecipe, type Resolve } from "../../domain/recipes/cooking";
import { recipeInputSchema } from "../../domain/recipes/recipe";
import type { Unit } from "../../domain/recipes/reference";
import { NotFound } from "../../server/core/errors";
import { notFoundMiddleware } from "../../server/core/fn";

// The cooking session's calls (decisions.md row 214): begin, take or put back
// an adjustment, note something, finish with the review's choices, or
// discard. The assistant's call is in cookingAssistant.ts.

const recipeId = z.uuid();

/** The recipe, or a 404: a session belongs to a recipe that is there. */
function recipeOr404(id: string) {
  const recipe = recipes.getById(id);
  if (!recipe) throw new NotFound("recipe", id);
  return recipe;
}

/** The recipe's session, or a 404 for one it does not have. */
function sessionOr404<T>(session: T | null, id: string): T {
  if (session === null) throw new NotFound("cooking session", id);
  return session;
}

export const GetCookingInput = z.object({ recipeId });

/** The recipe's session, or null when it is not being cooked. */
export const getCooking = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(GetCookingInput)
  .handler(async ({ data }) => cooking.get(data.recipeId));

export const StartCookingInput = z.object({
  recipeId,
  servings: z.number().positive().finite().nullable().default(null),
  choices: z.record(z.string(), z.string()).nullable().default(null),
});

/** Begin cooking: a fresh session at the page's servings and choices, replacing any the recipe had. */
export const startCooking = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(StartCookingInput)
  .handler(async ({ data }) => {
    recipeOr404(data.recipeId);
    return cooking.start(data.recipeId, { servings: data.servings, choices: data.choices });
  });

export const AdjustCookingInput = z.object({ recipeId, adjustment: adjustmentInputSchema });

/** Take an adjustment for tonight. Refused when it names a row the recipe does not have. */
export const adjustCooking = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(AdjustCookingInput)
  .handler(async ({ data }) => {
    const recipe = recipeOr404(data.recipeId);
    if (!fitsRecipe(recipe, data.adjustment)) throw new Error("That change is to a line or step this recipe does not have");
    return sessionOr404(cooking.adjust(data.recipeId, { ...data.adjustment, id: crypto.randomUUID() }), data.recipeId);
  });

export const UnadjustCookingInput = z.object({ recipeId, adjustmentId: z.uuid() });

/** Put an adjustment back. */
export const unadjustCooking = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(UnadjustCookingInput)
  .handler(async ({ data }) => sessionOr404(cooking.unadjust(data.recipeId, data.adjustmentId), data.recipeId));

export const NoteCookingInput = z.object({ recipeId, text: z.string().trim().min(1).max(500), origin: z.enum(["cook", "timer"]).default("cook") });

/** Keep something said while cooking, or a timer the page saw run long, for the review. */
export const noteCooking = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(NoteCookingInput)
  .handler(async ({ data }) =>
    sessionOr404(cooking.note(data.recipeId, { id: crypto.randomUUID(), text: data.text, origin: data.origin, at: new Date().toISOString() }), data.recipeId)
  );

/** Stop cooking without a review: the session and everything in it go. */
export const discardCooking = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(GetCookingInput)
  .handler(async ({ data }) => ({ discarded: cooking.remove(data.recipeId) }));

/** A unit the household has, by its name, plural or abbreviation in any case; null when there is none. */
export function unitNamed(name: string, all: readonly Unit[]): Unit | null {
  const wanted = name.trim().toLowerCase();
  if (wanted === "") return null;
  return all.find((unit) => [unit.name, unit.pluralName ?? "", unit.abbreviation].some((spelling) => spelling.trim().toLowerCase() === wanted)) ?? null;
}

export const FinishCookingInput = z.object({
  recipeId,
  /** What the review chose for each suggestion; only Keep and Add as an alternative write anything. */
  kept: z.array(z.object({ adjustment: adjustmentSchema, decision: z.enum(DECISIONS) })).default([]),
});

/**
 * The review's Save, after the cook is logged: write the kept suggestions
 * into the recipe in one update, through the same validation as the editor,
 * and end the session. A swap's food is found or made by name; its unit only
 * found. Returns the recipe as stored, or as it was when nothing was kept.
 */
export const finishCooking = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(FinishCookingInput)
  .handler(async ({ data }) => {
    const recipe = recipeOr404(data.recipeId);
    const writing = data.kept.filter((choice) => choice.decision !== "once" && fitsRecipe(recipe, choice.adjustment));
    let stored = recipe;
    if (writing.length > 0) {
      const all = units.list();
      const resolve: Resolve = {
        // The write takes the food by its id; its aisle and conversions stay as stored.
        food: (name) => {
          const row = foods.findOrCreate(name);
          return {
            id: row.id,
            name: row.name,
            pluralName: row.pluralName,
            aliases: row.aliases,
            aisle: null,
            recipeId: row.recipeId,
            skipShopping: row.skipShopping,
            conversions: [],
          };
        },
        unit: (name) => unitNamed(name, all),
      };
      const doc = recipeInputSchema.parse(keptRecipe(recipe, writing, resolve));
      stored = recipes.ref(recipe.id).replace(doc) ?? recipe;
    }
    cooking.remove(data.recipeId);
    return stored;
  });
