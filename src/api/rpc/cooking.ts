import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import cooking from "../../db/models/cooking/repo";
import recipes from "../../db/models/recipe/repo";
import { adjustmentInputSchema, fitsRecipe } from "../../domain/recipes/cooking";
import { NotFound } from "../../server/core/errors";
import { notFoundMiddleware } from "../../server/core/fn";

// The cooking session's calls (decisions.md row 214): begin, take or put back
// an adjustment, note something, and end. The assistant's and the review's
// calls are in cookingAssistant.ts and cookingReview.ts.

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
