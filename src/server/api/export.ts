import { aisles } from "../../db/models/aisle/repo";
import { type Food, foods } from "../../db/models/food/repo";
import { recipes } from "../../db/models/recipe/repo";
import { tags } from "../../db/models/tag/repo";
import { units } from "../../db/models/unit/repo";
import { EXPORT_VERSION, exportedRecipe, exportFileName, type Recipe, toCooklang } from "../../domain/recipe";
import type { Aisle, Tag, Unit } from "../../domain/reference";
import { getDb } from "../core/db";

/**
 * The whole-database export. Recipes carry their documents whole, including
 * the nested food and unit of every ingredient row; the four reference lists
 * are there so a reader can rebuild the tables a recipe only mentions in part
 * — a food's aisle, its conversions, a unit's `standard_*`, an unused tag.
 * Foods carry `aisleId` rather than a nested aisle, which is the repository's
 * shape and the one the `aisles` list beside them resolves.
 */
export type GarnishExport = {
  garnish: { version: number; exportedAt: string };
  recipes: Recipe[];
  foods: Food[];
  units: Unit[];
  aisles: Aisle[];
  tags: Tag[];
};

const notFound = (error: string): Response => Response.json({ error }, { status: 404 });

/** Every recipe's full document, by name, with image URLs. */
async function allRecipes(): Promise<Recipe[]> {
  const repo = recipes(await getDb());
  const documents: Recipe[] = [];
  for (const summary of repo.list({ sort: "name", dir: "asc" })) {
    const doc = repo.get(summary.slug);
    if (doc) documents.push(exportedRecipe(doc));
  }
  return documents;
}

/** The export as an object, so the tests and the route read the same thing. */
export async function buildExport(at: Date = new Date()): Promise<GarnishExport> {
  const db = await getDb();
  return {
    garnish: { version: EXPORT_VERSION, exportedAt: at.toISOString() },
    recipes: await allRecipes(),
    foods: foods(db).list(),
    units: units(db).list(),
    aisles: aisles(db).list(),
    tags: tags(db).list(),
  };
}

/**
 * GET /api/recipes/:slug.json — one recipe's document as the editor saves it,
 * with `image` as a URL. 404 for an unknown slug.
 */
export async function handleRecipeJson(slug: string): Promise<Response> {
  const wanted = slug.trim();
  if (wanted === "") return notFound("recipe  not found");
  const doc = recipes(await getDb()).get(wanted);
  if (!doc) return notFound(`recipe ${wanted} not found`);
  return Response.json(exportedRecipe(doc));
}

/**
 * GET /api/export.json — every recipe plus the foods, units, aisles and tags,
 * offered as a download. Images are referenced, not included.
 */
export async function handleExportJson(at: Date = new Date()): Promise<Response> {
  const body = await buildExport(at);
  return Response.json(body, {
    headers: { "content-disposition": `attachment; filename="${exportFileName(at)}"` },
  });
}

/**
 * GET /api/recipes/:slug.cook — the recipe as a `.cook` file
 * (`src/domain/recipe/cooklang.ts`). 404 for an unknown slug, the same as the JSON
 * twin.
 */
export async function handleRecipeCook(slug: string): Promise<Response> {
  const wanted = slug.trim();
  if (wanted === "") return notFound("recipe  not found");
  const doc = recipes(await getDb()).get(wanted);
  if (!doc) return notFound(`recipe ${wanted} not found`);
  return new Response(toCooklang(doc), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
