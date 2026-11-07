import { arrayParam } from "../../../../lib/lists";
import { FACET_LAYERS, FACET_VALUES, type FacetLayer, type Facets, facetsSchema, noFacets } from "../../recipe";

// The library's facet filters in the address (decisions.md row 209): one
// search param a layer, named as the layer is, each a list of its values.
// Pure.

/** What the address may hold for each layer: any strings, so a stale link narrows by what still parses rather than failing the page. */
export type FacetSearch = { [L in FacetLayer]?: string[] };

/** The layers asked for in the address, keeping only values the lists hold. */
export function facetsFromSearch(search: FacetSearch): Facets {
  const known = Object.fromEntries(
    FACET_LAYERS.map((layer) => [layer, (search[layer] ?? []).filter((value) => facetsSchema.shape[layer].safeParse([value]).success)])
  );
  return facetsSchema.parse(known);
}

/** The search params that ask for `facets`: an empty layer is no param at all. */
export function facetSearch(facets: Facets): FacetSearch {
  return Object.fromEntries(FACET_LAYERS.map((layer) => [layer, arrayParam(facets[layer])])) as FacetSearch;
}

/** Every layer's param cleared, for Clear filters. */
export function noFacetSearch(): FacetSearch {
  return facetSearch(noFacets());
}

/** How many values are asked for across the layers: each is one filter, as a tag is. */
export function facetFilterCount(facets: Facets): number {
  return FACET_LAYERS.reduce((count, layer) => count + facets[layer].length, 0);
}

/** `facets` with one value of one layer turned on or off, the layer kept in its list's order. */
export function toggleFacet<L extends FacetLayer>(facets: Facets, layer: L, value: Facets[L][number], on: boolean): Facets {
  const current: readonly string[] = facets[layer];
  const next = on ? [...current, value] : current.filter((each) => each !== value);
  return facetsSchema.parse({ ...facets, [layer]: next });
}

/** One value a recipe or the collection has, and how many recipes carry it. */
export type FacetCount = { layer: FacetLayer; value: string; count: number };

/** How many recipes carry one value; 0 when none does. */
export function countOf(counts: readonly FacetCount[], layer: FacetLayer, value: string): number {
  return counts.find((each) => each.layer === layer && each.value === value)?.count ?? 0;
}

/** Whether two sets of facets say the same thing on every layer. */
export function sameFacets(a: Facets, b: Facets): boolean {
  return FACET_LAYERS.every((layer) => a[layer].length === b[layer].length && a[layer].every((value, i) => b[layer][i] === value));
}

/**
 * The values a filter offers for one layer: those some recipe has, and any
 * asked for that none has now (so it can be turned off), in the list's order.
 */
export function offeredValues(counts: readonly FacetCount[], asked: Facets, layer: FacetLayer): string[] {
  const chosen: readonly string[] = asked[layer];
  return FACET_VALUES[layer].filter((value) => chosen.includes(value) || countOf(counts, layer, value) > 0);
}
