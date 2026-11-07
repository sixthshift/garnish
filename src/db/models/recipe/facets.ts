import { and, eq, exists, inArray, type SQL, sql } from "drizzle-orm";
import { FACET_LAYERS, type FacetLayer, type Facets, facetsSchema } from "../../../domain/recipes/recipe";
import type { Db, Executor } from "../../connection/client";
import { type FACET_LAYER_COLUMN, recipe, recipeFacet } from "./schema";

// A recipe's facets (decisions.md row 209) in `recipe_facet`: read into the
// document's shape, written over whatever was there, and asked of in a filter.

/** A layer as `recipe_facet.layer` spells it. */
export function layerColumn(layer: FacetLayer): (typeof FACET_LAYER_COLUMN)[number] {
  return layer === "mainIngredient" ? "main_ingredient" : layer;
}

/**
 * A recipe's facets, layer by layer. A stored value the app's lists no longer
 * hold is dropped on the way out rather than failing the read: the lists are
 * checked in the app, not the table (031_recipe_facet.sql).
 */
export function selectFacets(dz: Db, recipeId: string): Facets {
  const rows = dz.select({ layer: recipeFacet.layer, value: recipeFacet.value }).from(recipeFacet).where(eq(recipeFacet.recipeId, recipeId)).all();
  const known = Object.fromEntries(
    FACET_LAYERS.map((layer) => [
      layer,
      rows.filter((row) => row.layer === layerColumn(layer) && facetsSchema.shape[layer].safeParse([row.value]).success).map((row) => row.value),
    ])
  );
  return facetsSchema.parse(known);
}

/** Replace a recipe's facets with `facets`, every layer: a layer left empty is cleared. */
export function writeFacets(tx: Executor, recipeId: string, facets: Facets): void {
  tx.delete(recipeFacet).where(eq(recipeFacet.recipeId, recipeId)).run();
  const rows = FACET_LAYERS.flatMap((layer) => facets[layer].map((value) => ({ recipeId, layer: layerColumn(layer), value })));
  if (rows.length > 0) tx.insert(recipeFacet).values(rows).onConflictDoNothing().run();
}

/**
 * The filter's clauses for asked-for facets: within a layer any of the values
 * ("Thai or Vietnamese"), across layers all of them ("a vegetarian main").
 */
export function facetClauses(dz: Db, asked: Partial<Facets> | undefined): SQL[] {
  if (!asked) return [];
  return FACET_LAYERS.flatMap((layer) => {
    const values = asked[layer] ?? [];
    if (values.length === 0) return [];
    return [
      exists(
        dz
          .select({ one: sql`1` })
          .from(recipeFacet)
          .where(and(eq(recipeFacet.recipeId, recipe.id), eq(recipeFacet.layer, layerColumn(layer)), inArray(recipeFacet.value, [...values])))
      ),
    ];
  });
}

/** How many recipes carry each value of each layer, over the whole collection: a value no recipe has is absent. */
export function facetCounts(dz: Db): { layer: FacetLayer; value: string; count: number }[] {
  return dz
    .select({ layer: recipeFacet.layer, value: recipeFacet.value, count: sql<number>`count(*)` })
    .from(recipeFacet)
    .groupBy(recipeFacet.layer, recipeFacet.value)
    .all()
    .map((row) => ({ layer: row.layer === "main_ingredient" ? "mainIngredient" : row.layer, value: row.value, count: row.count }));
}
