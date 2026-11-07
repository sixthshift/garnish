import { Button } from "@sixthshift/design-system/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@sixthshift/design-system/modal";
import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { useState } from "react";
import { BUILDING_BLOCKS, type Course, FACET_LAYERS, FACET_VALUES, type FacetLayer, type Facets, facetLabel, facetsSchema, LAYER_NAMES } from "../../recipe";

/** Course's values in three groups, so a list of fourteen reads as what a dish is for. */
export const COURSE_GROUPS: readonly { label: string; values: readonly Course[] }[] = [
  { label: "A meal on its own", values: ["main", "soup", "salad"] },
  { label: "With a meal, or between them", values: ["side", "starter", "dessert", "baking", "snack", "drink"] },
  { label: "Goes into another dish", values: BUILDING_BLOCKS },
];

function Choices({
  label,
  layer,
  values,
  chosen,
  onChange,
}: {
  label: string;
  layer: FacetLayer;
  values: readonly string[];
  chosen: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const own = new Set(values);
  return (
    <ToggleGroup
      type="multiple"
      appearance="separate"
      variant="outline"
      intent="neutral"
      size="sm"
      aria-label={label}
      className="flex-wrap"
      options={values.map((value) => ({ value, label: facetLabel(layer, value) }))}
      value={chosen.filter((value) => own.has(value))}
      // A group shows some of its layer's values; a change in it keeps the rest of the layer's.
      onValueChange={(next) => onChange([...chosen.filter((value) => !own.has(value)), ...next])}
    />
  );
}

/**
 * Every layer of what a recipe is, to set in one go (decisions.md row 209): a
 * section a layer, each value a toggle, any number pressed. A sheet from the
 * bottom on a phone and a dialog on a desktop, as `Modal` is. Nothing is
 * written until it closes, by Done or otherwise, and then once, with every
 * layer: pressing through a dozen values is one write, not a dozen racing.
 */
export function FacetSheet({ name, facets, onClose }: { name: string; facets: Facets; onClose: (next: Facets) => void }) {
  const [draft, setDraft] = useState(facets);
  const change = (layer: FacetLayer) => (next: string[]) => setDraft(facetsSchema.parse({ ...draft, [layer]: next }));
  const close = () => onClose(draft);

  return (
    <Modal size="md" closable aria-label={`What ${name} is`} onOpenChange={(open) => !open && close()}>
      <ModalHeader>What it is</ModalHeader>
      <ModalBody className="flex flex-col gap-5" data-testid="facet-sheet">
        {FACET_LAYERS.map((layer) => (
          <section key={layer} className="flex flex-col gap-2" aria-labelledby={`facet-sheet-${layer}`}>
            <h3 id={`facet-sheet-${layer}`} className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
              {LAYER_NAMES[layer]}
            </h3>
            {layer === "course" ? (
              COURSE_GROUPS.map((group) => (
                <div key={group.label} className="flex flex-col gap-1">
                  <p className="text-xs text-fg-subtle">{group.label}</p>
                  <Choices label={`Course: ${group.label}`} layer="course" values={group.values} chosen={draft.course} onChange={change("course")} />
                </div>
              ))
            ) : (
              <Choices label={LAYER_NAMES[layer]} layer={layer} values={FACET_VALUES[layer]} chosen={draft[layer]} onChange={change(layer)} />
            )}
          </section>
        ))}
      </ModalBody>
      {/* Clear of the home indicator, as the filters sheet is. */}
      <ModalFooter className="max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Button type="button" variant="solid" intent="brand" className="w-full sm:w-auto" onClick={close}>
          Done
        </Button>
      </ModalFooter>
    </Modal>
  );
}
