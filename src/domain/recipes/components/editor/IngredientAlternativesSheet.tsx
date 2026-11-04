// A line's alternatives in the editor (decisions.md row 199): what can be used
// instead of its food, and which of them the plan picks among.

import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { Sheet } from "@sixthshift/design-system/sheet";
import { useEffect, useState } from "react";
import { listFoods } from "../../../../api/rpc/foods";
import { type DraftIngredient, foodReference } from "../../draft";
import type { FoodRow, Unit } from "../../reference";
import { AlternativeRows } from "./AlternativeRows";
import { type AlternativeDraft, alternativeDraft, blankAlternative, NO_UNIT, parseAlternatives } from "./alternativeDraft";

export type IngredientAlternativesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredient: DraftIngredient;
  /** "Ingredient 3", naming the sheet. */
  label: string;
  units: readonly Unit[];
  onPatch: (patch: Partial<DraftIngredient>) => void;
};

/** The line's alternatives as the sheet holds them: by food name and unit id. Not pure: it mints keys. */
function draftsOf(alternatives: NonNullable<DraftIngredient["alternatives"]>): AlternativeDraft[] {
  return alternatives.map((alt) =>
    alternativeDraft({
      basisQuantity: alt.basisQuantity ?? null,
      basisUnitId: alt.basisUnit?.id ?? null,
      note: alt.note ?? "",
      planPicks: alt.planPicks ?? false,
      items: alt.items.map((item) => ({ quantity: item.quantity ?? null, unitId: item.unit?.id ?? null, food: item.food.name })),
    })
  );
}

export function IngredientAlternativesSheet({ open, onOpenChange, ingredient, label, units, onPatch }: IngredientAlternativesSheetProps) {
  const food = ingredient.food ?? null;
  const lineUnitId = ingredient.unit?.id ?? NO_UNIT;
  const [drafts, setDrafts] = useState<AlternativeDraft[]>(() => draftsOf(ingredient.alternatives ?? []));
  const [foods, setFoods] = useState<FoodRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Opening starts from the line as it stands; a Cancel leaves it so.
  useEffect(() => {
    if (!open) return;
    setDrafts(draftsOf(ingredient.alternatives ?? []));
    setError(null);
    let stale = false;
    listFoods({ data: {} })
      .then((rows) => !stale && setFoods(rows))
      .catch(() => !stale && setFoods([]));
    return () => {
      stale = true;
    };
  }, [open, ingredient.alternatives]);

  const done = () => {
    const parsed = parseAlternatives(drafts);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    const byName = new Map(foods.map((row) => [row.name.toLowerCase(), row]));
    const unitOf = (id: string | null) => (id === null ? null : (units.find((unit) => unit.id === id) ?? null));
    onPatch({
      alternatives: parsed.alternatives.map((alt) => ({
        basisQuantity: alt.basisQuantity,
        basisUnit: unitOf(alt.basisUnitId),
        note: alt.note,
        planPicks: alt.planPicks,
        // A name nobody has yet is found or created on save, as the line's own food is.
        items: alt.items.map((item) => ({
          quantity: item.quantity,
          unit: unitOf(item.unitId),
          food: foodReference(byName.get(item.food.toLowerCase()) ?? { name: item.food }),
        })),
      })),
    });
    onOpenChange(false);
  };

  const foodName = food?.name ?? "this ingredient";

  return (
    <Sheet open={open} onOpenChange={onOpenChange} size="sm" closable aria-label={`${label} alternatives`}>
      <Sheet.Header>
        <h2 className="text-base font-medium">Instead of {foodName}</h2>
      </Sheet.Header>
      <Sheet.Body>
        <div className="flex flex-col gap-4">
          <Muted as="p" className="text-sm">
            What you can use instead. Leave the amount blank to use the line's, or set “per” to measure against it (1 cup milk and 1 tbsp lemon juice per 1
            cup). Tick “The plan picks it” for the ones the week should rotate through, like a stir-fry's protein.
          </Muted>
          <AlternativeRows
            alternatives={drafts}
            units={units}
            foods={foods.filter((row) => row.id !== food?.id)}
            lineUnitId={lineUnitId}
            onChange={setDrafts}
          />
          <div>
            <Button type="button" variant="ghost" intent="brand" size="sm" onClick={() => setDrafts((rows) => [...rows, blankAlternative(lineUnitId)])}>
              Add alternative
            </Button>
          </div>
          {error !== null && <Message intent="danger">{error}</Message>}
        </div>
      </Sheet.Body>
      <Sheet.Footer>
        <Button type="button" variant="ghost" intent="neutral" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="button" variant="solid" intent="brand" onClick={done}>
          Done
        </Button>
      </Sheet.Footer>
    </Sheet>
  );
}
