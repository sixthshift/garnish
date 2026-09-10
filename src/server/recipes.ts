// Recipe server functions: the app's own calls for the recipe resource.
// Each one is the full `createServerFn` chain (see ./fn.ts for why), reads the
// database through getDb(), and hands back the document from src/domain/recipe.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { NotFound, required } from "../db/errors";
import { recipes } from "../db/recipes";
import { recipeInputSchema } from "../domain/recipe";
import { scaleRecipe } from "../domain/scale";
import { getDb } from "./db";
import { notFoundMiddleware } from "./fn";

const recipeId = z.uuid();

export const ListRecipesInput = z.object({
  /** Case-insensitive substring of the recipe name. */
  q: z.string().optional(),
  /** Tag slug; only recipes carrying that tag. */
  tag: z.string().optional(),
});

export const GetRecipeInput = z.object({
  slug: z.string().trim().min(1),
  /** Target servings. When given, the document comes back scaled to it. */
  servings: z.number().positive().finite().optional(),
});

export const CreateRecipeInput = recipeInputSchema;

export const UpdateRecipeInput = z.object({
  id: recipeId,
  doc: recipeInputSchema,
});

export const DeleteRecipeInput = z.object({ id: recipeId });

export const SetFavouriteInput = z.object({ id: recipeId, favourite: z.boolean() });

/** Card summaries, newest first, optionally filtered by name substring and tag slug. */
export const listRecipes = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(ListRecipesInput)
  .handler(async ({ data }) => recipes(await getDb()).list(data));

/**
 * One recipe by slug. With `servings`, the document is scaled to that many
 * (Cooklang rules, see src/domain/scale.ts). A recipe whose stored servings is
 * 0 has no factor to scale by and is returned as stored.
 */
export const getRecipe = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(GetRecipeInput)
  .handler(async ({ data }) => {
    const doc = required(recipes(await getDb()).get(data.slug), "recipe", data.slug);
    if (data.servings === undefined || doc.recipeServings <= 0) return doc;
    return scaleRecipe(doc, data.servings);
  });

/** Insert a recipe; the slug is derived from the name. Returns the stored document. */
export const createRecipe = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(CreateRecipeInput)
  .handler(async ({ data }) => recipes(await getDb()).create(data));

/** Replace the recipe `id` with `doc`, keeping id and created_at. Returns the stored document. */
export const updateRecipe = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(UpdateRecipeInput)
  .handler(async ({ data }) => required(recipes(await getDb()).update(data.id, data.doc), "recipe", data.id));

/** Flip the favourite flag alone. Returns the flag as stored. Not-found for an unknown id. */
export const setFavourite = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(SetFavouriteInput)
  .handler(async ({ data }) => {
    if (!recipes(await getDb()).setFavourite(data.id, data.favourite)) throw new NotFound("recipe", data.id);
    return { id: data.id, favourite: data.favourite };
  });

/** Delete the recipe `id`. Returns the document as it was, the way Mealie does. */
export const deleteRecipe = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(DeleteRecipeInput)
  .handler(async ({ data }) => {
    const repo = recipes(await getDb());
    const doc = required(repo.getById(data.id), "recipe", data.id);
    if (!repo.remove(data.id)) throw new NotFound("recipe", data.id);
    return doc;
  });
