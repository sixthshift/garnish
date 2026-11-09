import { Button } from "@sixthshift/design-system/button";
import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { setFacets } from "../../../../api/rpc/recipes";
import { PencilIcon } from "../../../../components/ui/icons";
import { useMutate } from "../../../../lib/mutate";
import { toastError } from "../../../../lib/toast";
import { FACET_LAYERS, type Facets, facetLabel, facetsEmpty, LAYER_NAMES } from "../../recipe";
import { FacetSheet } from "./FacetSheet";
import { sameFacets } from "./facetSearch";

const CHIP =
  "inline-flex items-center rounded-full border border-border-subtle bg-bg-normal px-2.5 py-0.5 text-xs font-medium text-fg-normal hover:border-border-strong focus-visible:outline-2 focus-visible:outline-border-brand pointer-coarse:py-1.5";

/**
 * What has been said of a recipe, layer by layer, as a row of quiet chips,
 * each a link to the library narrowed to that value ("Thai" → every Thai
 * recipe). Read only; `FacetDetails` adds the way to change them.
 */
export function FacetChips({ facets, className, linked = true }: { facets: Facets; className?: string; linked?: boolean }) {
  const said = FACET_LAYERS.flatMap((layer) => facets[layer].map((value) => ({ layer, value: value as string })));
  if (said.length === 0) return null;
  return (
    <dl className={cn("flex flex-wrap gap-1.5", className)} aria-label="What it is" data-testid="facet-chips">
      {said.map(({ layer, value }) => (
        <div key={`${layer}:${value}`} className="contents">
          <dt className="sr-only">{LAYER_NAMES[layer]}</dt>
          <dd>
            {linked ? (
              <Link to="/recipes" search={{ [layer]: [value] }} title={LAYER_NAMES[layer]} className={CHIP}>
                {facetLabel(layer, value)}
              </Link>
            ) : (
              <span title={LAYER_NAMES[layer]} className={CHIP}>
                {facetLabel(layer, value)}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The chips of what has been said and a button that opens every layer in
 * `FacetSheet`, controlled: `onChange` gets every layer when the sheet closes
 * changed. The recipe page writes it at once (`FacetDetails`); the editor
 * keeps it in its draft until Save, so its chips are not links that would
 * leave the form. A recipe nothing has been said of shows only the button,
 * which says what it is for.
 */
export function FacetField({
  name,
  facets,
  onChange,
  linked = true,
  disabled,
}: {
  name: string;
  facets: Facets;
  onChange: (facets: Facets) => void;
  linked?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const empty = facetsEmpty(facets);
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="facet-details">
      {/* The chips flow in this row (`contents`), so the pencil follows the last of them rather than wrapping to a line of its own. */}
      <FacetChips facets={facets} linked={linked} className="contents" />
      <Button
        type="button"
        variant="ghost"
        intent="neutral"
        size="sm"
        iconOnly={!empty}
        disabled={disabled}
        className={cn(!empty && "pointer-coarse:size-11", empty && "gap-1.5 -ml-2")}
        aria-label={empty ? undefined : "Change course, cuisine and more"}
        data-print="hide"
        onClick={() => setOpen(true)}
      >
        <PencilIcon size={14} />
        {empty && "Add course, cuisine and more"}
      </Button>
      {open && (
        <FacetSheet
          name={name}
          facets={facets}
          onClose={(next) => {
            setOpen(false);
            if (!sameFacets(next, facets)) onChange(next);
          }}
        />
      )}
    </div>
  );
}

/**
 * The recipe page's facets (decisions.md row 209): `FacetField`, written when
 * the sheet closes, with every layer at once, shown at once and put back with
 * a toast if the write fails, as the kind is.
 */
export function FacetDetails({ id, name, facets }: { id: string; name: string; facets: Facets }) {
  const mutate = useMutate();
  const [current, setCurrent] = useState(facets);
  useEffect(() => setCurrent(facets), [facets]);

  async function save(next: Facets) {
    const before = current;
    setCurrent(next);
    try {
      await mutate(() => setFacets({ data: { id, facets: next } }));
    } catch (error) {
      setCurrent(before);
      toastError("Couldn't update the recipe", error);
    }
  }

  return <FacetField name={name} facets={current} onChange={(next) => void save(next)} />;
}
