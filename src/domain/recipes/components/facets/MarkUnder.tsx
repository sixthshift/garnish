import { Select } from "@sixthshift/design-system/select";
import { Toggle } from "@sixthshift/design-system/toggle";
import { useEffect, useState } from "react";
import { setFacets } from "../../../../api/rpc/recipes";
import { useMutate } from "../../../../lib/mutate";
import { toastError } from "../../../../lib/toast";
import { type FacetLayer, type Facets, facetLabel, type RecipeSummary } from "../../recipe";
import { KindToggle } from "../KindToggle";
import { toggleFacet } from "./facetSearch";
import { hasMark, MARKING_OPTIONS, type Marking, markingFromValue, markingValue } from "./marking";

/**
 * One value of one layer as a toggle under a card: pressed when the recipe
 * has it, a press adding or taking it away and writing at once, as the kind
 * toggle beside it does. Named after its recipe, so a list of them reads apart.
 */
function FacetMarkToggle({ recipe, layer, value }: { recipe: RecipeSummary; layer: FacetLayer; value: string }) {
  const mutate = useMutate();
  const [facets, setLocal] = useState<Facets>(recipe.facets);
  useEffect(() => setLocal(recipe.facets), [recipe.facets]);
  const label = facetLabel(layer, value);

  async function press(on: boolean) {
    const before = facets;
    const next = toggleFacet(facets, layer, value as never, on);
    setLocal(next);
    try {
      await mutate(() => setFacets({ data: { id: recipe.id, facets: next } }));
    } catch (error) {
      setLocal(before);
      toastError("Couldn't update the recipe", error);
    }
  }

  return (
    <Toggle
      variant="outline"
      intent="neutral"
      size="sm"
      pressed={hasMark(facets, layer, value)}
      onPressedChange={(on) => void press(on)}
      aria-label={`${label}: ${recipe.name}`}
      className="self-start"
      data-testid="mark-facet"
    >
      {label}
    </Toggle>
  );
}

/** What goes under a card while marking: the kind's two segments, or the one value being marked. */
export function MarkUnder({ recipe, marking }: { recipe: RecipeSummary; marking: Marking }) {
  if (marking.by === "kind") return <KindToggle id={recipe.id} kind={recipe.kind} label={`How you cook ${recipe.name}`} />;
  return <FacetMarkToggle recipe={recipe} layer={marking.layer} value={marking.value} />;
}

/** What is being marked, chosen from every value of every layer; searchable, since there are some seventy. */
export function MarkChooser({ marking, onChange, className }: { marking: Marking; onChange: (marking: Marking) => void; className?: string }) {
  return (
    <Select
      aria-label="What to mark"
      searchable
      options={MARKING_OPTIONS}
      value={markingValue(marking)}
      onValueChange={(value) => {
        const next = markingFromValue(value);
        if (next) onChange(next);
      }}
      className={className}
    />
  );
}
