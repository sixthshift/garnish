import { Button } from "@sixthshift/design-system/button";
import { Sheet } from "@sixthshift/design-system/sheet";
import { Toggle } from "@sixthshift/design-system/toggle";
import { useEffect, useState } from "react";
import { type DraftIngredient, foodReference, isTextOnly, matchUnit, textOnlyPatch, unitReference } from "../../../../domain/draft";
import type { FoodRow, Unit } from "../../../../domain/reference";
import { listFoods } from "../../../../server/fns/foods";
import { FOOD_SEARCH_DEBOUNCE_MS, IngredientFields } from "../../components/IngredientFields";

export type QuickEditIngredientBodyProps = {
  ingredient: DraftIngredient;
  /** The units list, loaded when the sheet opened. */
  units: readonly Unit[];
  busy?: boolean;
  /** The error a failed save left, shown above the buttons. */
  error?: string | null;
  onSave: (next: DraftIngredient) => void;
  onCancel: () => void;
};

/**
 * One ingredient's fields in a sheet. The editor's `IngredientFields`
 * unchanged, so a row edits the same way in both places; this owns the
 * mid-edit text and the food suggestions the editor's own row owns, and the
 * edited row itself, which only leaves here on Save.
 */
export function QuickEditIngredientBody({ ingredient, units, busy = false, error = null, onSave, onCancel }: QuickEditIngredientBodyProps) {
  const [row, setRow] = useState<DraftIngredient>(ingredient);
  const [textOnly, setTextOnly] = useState(() => isTextOnly(ingredient));
  const [quantityDraft, setQuantityDraft] = useState<string | null>(null);
  const [unitText, setUnitText] = useState(ingredient.unit?.name ?? "");
  const [foodText, setFoodText] = useState(ingredient.food?.name ?? "");
  const [foodFocused, setFoodFocused] = useState(false);
  const [foodRows, setFoodRows] = useState<FoodRow[]>([]);

  const patch = (next: Partial<DraftIngredient>) => setRow((current) => ({ ...current, ...next }));

  // Suggestions while the food input has focus, a beat after the last
  // keystroke — the editor's rule, and its debounce.
  useEffect(() => {
    const q = foodText.trim();
    if (!foodFocused || q === "") {
      setFoodRows([]);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      listFoods({ data: { q } })
        .then((rows) => {
          if (!stale) setFoodRows(rows);
        })
        .catch(() => {
          if (!stale) setFoodRows([]);
        });
    }, FOOD_SEARCH_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [foodText, foodFocused]);

  /** A typed unit name becomes the matching unit, or a reference the save creates. The editor's `commitUnit`. */
  const commitUnit = () => {
    const text = unitText.trim();
    if (text === "") {
      patch({ unit: null });
      return;
    }
    const match = matchUnit(units, text);
    if (match) {
      patch({ unit: match });
      setUnitText(match.name);
      return;
    }
    if (row.unit && row.unit.name.toLowerCase() === text.toLowerCase()) return;
    patch({ unit: unitReference(text) });
  };

  /** The same for the food: an existing row when the name matches one, a reference the save finds or creates otherwise. */
  const commitFood = () => {
    const text = foodText.trim();
    if (text === "") {
      patch({ food: null });
      return;
    }
    const match = foodRows.find((candidate) => candidate.name.toLowerCase() === text.toLowerCase());
    if (match) {
      patch({ food: foodReference(match) });
      setFoodText(match.name);
      return;
    }
    if (row.food && row.food.name.toLowerCase() === text.toLowerCase()) return;
    patch({ food: foodReference({ name: text }) });
  };

  const modeToggle = (
    <Toggle
      type="button"
      variant="ghost"
      intent="neutral"
      size="sm"
      aria-label="Ingredient text only"
      pressed={textOnly}
      disabled={busy}
      onPressedChange={(pressed) => {
        setTextOnly(pressed);
        if (pressed) {
          setUnitText("");
          setFoodText("");
          setQuantityDraft(null);
        }
        patch(textOnlyPatch(pressed));
      }}
    >
      Text
    </Toggle>
  );

  return (
    <>
      <Sheet.Header>
        <h2 className="text-base font-medium">Edit ingredient</h2>
      </Sheet.Header>
      <Sheet.Body>
        <IngredientFields
          ingredient={row}
          path="ingredient"
          label="Ingredient"
          units={units}
          errors={{}}
          disabled={busy}
          textOnly={textOnly}
          quantityDraft={quantityDraft}
          unitText={unitText}
          foodText={foodText}
          foodRows={foodRows}
          controls={modeToggle}
          showOriginalText
          onPatch={patch}
          onQuantityText={setQuantityDraft}
          onUnitText={setUnitText}
          onUnitBlur={commitUnit}
          onFoodText={setFoodText}
          onFoodFocus={() => setFoodFocused(true)}
          onFoodBlur={() => {
            setFoodFocused(false);
            commitFood();
          }}
        />
        {error !== null && (
          <p className="mt-2 text-sm text-fg-danger" role="alert">
            {error}
          </p>
        )}
      </Sheet.Body>
      <Sheet.Footer>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="solid" intent="brand" disabled={busy} onClick={() => onSave(row)}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </Sheet.Footer>
    </>
  );
}

export type QuickEditIngredientSheetProps = QuickEditIngredientBodyProps & { open: boolean };

export function QuickEditIngredientSheet({ open, ...props }: QuickEditIngredientSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && props.onCancel()} size="sm" closable aria-label="Edit ingredient">
      <QuickEditIngredientBody {...props} />
    </Sheet>
  );
}
