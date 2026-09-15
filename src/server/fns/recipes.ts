import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { recipes } from "../../db/models/recipe/repo";
import { duplicateInput, recipeInputSchema, scaleRecipe } from "../../domain/recipe";
import { getDb } from "../core/db";
import { NotFound, required } from "../core/errors";
import { notFoundMiddleware } from "../core/fn";

const recipeId = z.uuid();

export const ListRecipesInput = z.object({
  /** Case-insensitive substring of the recipe name. */
  q: z.string().optional(),
  /** Tag slug; only recipes carrying that tag. Folded into `tags`. */
  tag: z.string().optional(),
  /** Tag slugs; combined with `tag`, de-duplicated. */
  tags: z.array(z.string()).optional(),
  /** How `tags` combine: any of them (default) or all of them. */
  match: z.enum(["any", "all"]).optional(),
  /** Food ids; only recipes with an ingredient using one of these foods. */
  foods: z.array(z.uuid()).optional(),
  /** Only favourited recipes when true. */
  favourite: z.boolean().optional(),
  /** Sort key. Unset keeps the original newest-first order. */
  sort: z.enum(["name", "created", "updated", "lastMade", "rating", "random"]).optional(),
  /** Sort direction. Unset defaults per key; ignored for `sort: "random"`. */
  dir: z.enum(["asc", "desc"]).optional(),
  /** Shuffle seed for `sort: "random"`, so paging stays stable across requests using the same seed. */
  seed: z.string().optional(),
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

export const DuplicateRecipeInput = z.object({ id: recipeId });

/** The recipe ids an ingredient row's food points at. */
export const SubRecipesInput = z.object({ ids: z.array(recipeId) });

export const SetFavouriteInput = z.object({ id: recipeId, favourite: z.boolean() });

/** `rating` is 0 to 5; 0 means "no rating" and clears the column to null, as pressing the current star does. */
export const SetRatingInput = z.object({ id: recipeId, rating: z.number().min(0).max(5) });

/** Card summaries, newest first by default, optionally filtered by name substring and tag slug, and sorted or shuffled per `sort`/`dir`/`seed`. */
export const listRecipes = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(ListRecipesInput)
  .handler(async ({ data }) => recipes(await getDb()).list(data));

export const RecipeBySourceInput = z.object({ sourceUrl: z.string().trim().min(1) });

/** A recipe already imported from this address, for the import's duplicate warning. Null when there is none. */
export const recipeBySource = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(RecipeBySourceInput)
  .handler(async ({ data }) => recipes(await getDb()).bySourceUrl(data.sourceUrl));

export const RecipeByNameInput = z.object({ name: z.string().trim().min(1) });

/** A recipe already here under this name, for the Mealie import's duplicate warning. Null when there is none. */
export const recipeByName = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(RecipeByNameInput)
  .handler(async ({ data }) => recipes(await getDb()).byName(data.name));

/**
 * One recipe by slug. With `servings`, the document is scaled to that many
 * (Cooklang rules, see src/domain/recipe/scale.ts). A recipe whose stored servings is
 * 0 has no factor to scale by and is returned as stored.
 */
/**
 * The link-and-scale facts the view page needs about the recipes its
 * ingredient foods point at. One call for the whole page, so a
 * sub-recipe row costs no fetch of its own; unknown ids come back absent
 * rather than not-found.
 */
export const listSubRecipes = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .validator(SubRecipesInput)
  .handler(async ({ data }) => recipes(await getDb()).subRecipes(data.ids));

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

/**
 * Set the rating alone, 0 to 5. Zero clears it: the stars have no separate
 * "un-rate" control, so pressing the star that is already the rating comes
 * through as 0 and the column goes back to null (Mealie's behaviour).
 * Returns the rating as stored. Not-found for an unknown id.
 */
export const setRating = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(SetRatingInput)
  .handler(async ({ data }) => {
    const rating = data.rating === 0 ? null : data.rating;
    if (!recipes(await getDb()).setRating(data.id, rating)) throw new NotFound("recipe", data.id);
    return { id: data.id, rating };
  });

/**
 * Copy the recipe `id` into a new one: the same document under a new name
 * ("... (copy)") with a fresh slug and fresh child ids, no last-made date and
 * not favourited (see src/domain/recipe/duplicate.ts). Returns the stored copy.
 */
export const duplicateRecipe = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(DuplicateRecipeInput)
  .handler(async ({ data }) => {
    const repo = recipes(await getDb());
    const source = required(repo.getById(data.id), "recipe", data.id);
    return repo.create(recipeInputSchema.parse(duplicateInput(source)));
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
