// Export is one recipe at a time, as a document or a Cooklang file; the whole
// household is a backup (`src/server/backup/`, decisions.md row 131).
import recipes from "../../db/models/recipe/repo";
import { exportedRecipe, toCooklang } from "../../domain/recipe";

const notFound = (error: string): Response => Response.json({ error }, { status: 404 });

/**
 * GET /api/recipes/:slug.json — one recipe's document as the editor saves it,
 * with `image` as a URL. 404 for an unknown slug.
 */
export async function handleRecipeJson(slug: string): Promise<Response> {
  const wanted = slug.trim();
  if (wanted === "") return notFound("recipe  not found");
  const doc = recipes.get(wanted);
  if (!doc) return notFound(`recipe ${wanted} not found`);
  return Response.json(exportedRecipe(doc));
}

/**
 * GET /api/recipes/:slug.cook — the recipe as a `.cook` file
 * (`src/domain/recipe/cooklang.ts`). 404 for an unknown slug, the same as the JSON
 * twin.
 */
export async function handleRecipeCook(slug: string): Promise<Response> {
  const wanted = slug.trim();
  if (wanted === "") return notFound("recipe  not found");
  const doc = recipes.get(wanted);
  if (!doc) return notFound(`recipe ${wanted} not found`);
  return new Response(toCooklang(doc), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
