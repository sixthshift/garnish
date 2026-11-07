import { FACET_LAYERS, FACET_VALUES, type FacetLayer, type Facets, facetLabel, LAYER_NAMES } from "../../recipe";

// What the library's marking mode marks (decisions.md rows 195 and 209): how
// the household cooks each recipe, Rotation or Weekend, as before; or one
// value of one layer, a toggle under every card, so marking every main in the
// library is one tap a recipe rather than a visit to each. Pure.

export type Marking = { by: "kind" } | { by: "facet"; layer: FacetLayer; value: string };

/** Where marking starts: the kind, as row 195 had it. */
export const START_MARKING: Marking = { by: "kind" };

/** A marking as one string, for a select. */
export function markingValue(marking: Marking): string {
  return marking.by === "kind" ? "kind" : `${marking.layer}:${marking.value}`;
}

/** A select's string as a marking; null when it names nothing on the lists. */
export function markingFromValue(value: string): Marking | null {
  if (value === "kind") return START_MARKING;
  const [layer, facet] = value.split(":");
  const found = FACET_LAYERS.find((each) => each === layer);
  if (!found || !(FACET_VALUES[found] as readonly string[]).includes(facet ?? "")) return null;
  return { by: "facet", layer: found, value: facet! };
}

/** Everything that can be marked, as a select lists it: "Rotation & Weekend", then "Course: Main" and on through every layer. */
export const MARKING_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "kind", label: "Rotation & Weekend" },
  ...FACET_LAYERS.flatMap((layer) =>
    FACET_VALUES[layer].map((value) => ({ value: `${layer}:${value}`, label: `${LAYER_NAMES[layer]}: ${facetLabel(layer, value)}` }))
  ),
];

/** Whether a recipe has the marked value. */
export function hasMark(facets: Facets, layer: FacetLayer, value: string): boolean {
  return (facets[layer] as readonly string[]).includes(value);
}
