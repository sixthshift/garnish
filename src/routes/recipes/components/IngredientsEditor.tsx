import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { useEffect, useState } from "react";
import { BulkAddSheet } from "../../../components/ui/bulk/BulkAddSheet";
import { BulkInlineAdd } from "../../../components/ui/bulk/BulkInlineAdd";
import { ReorderList } from "../../../components/ui/ReorderList";
import {
  addIngredient,
  type FieldErrors,
  type IngredientReview,
  isTextOnly,
  moveIngredient,
  moveIngredientTo,
  needsParseAll,
  type RecipeDraft,
  removeIngredient,
  updateIngredient,
  withIngredients,
} from "../../../domain/draft";
import type { FoodRow, Unit } from "../../../domain/reference";
import { focusNamed, rowEnter, rowFieldName } from "../../../lib/rowKeys";
import { listFoods } from "../../../server/fns/foods";
import { IngredientEditRow } from "./IngredientEditRow";
import { confirmReviewedIngredients, ingredientReview } from "./ingredientReview";
import { ParseAllSheet } from "./ParseAllSheet";
import { partLabel } from "./PartsEditor";

/** Every part's ingredient list shares this drag group, so a row can be dragged from one to another. */
export const INGREDIENT_DRAG_GROUP = "recipe-ingredients";

export type IngredientsEditorProps = {
  draft: RecipeDraft;
  /** Index of the part whose rows these are. */
  pi: number;
  units: readonly Unit[];
  onChange: (draft: RecipeDraft) => void;
  errors?: FieldErrors;
  disabled?: boolean;
};

export function IngredientsEditor({ draft, pi, units, onChange, errors = {}, disabled }: IngredientsEditorProps) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [parseAllOpen, setParseAllOpen] = useState(false);
  // The whole food vocabulary, loaded once the bulk sheet opens or the list is
  // empty and showing its inline entry: parsing a pasted block needs every
  // food, not the query-by-query slice a row's combobox asks for.
  const [vocabularyFoods, setVocabularyFoods] = useState<FoodRow[]>([]);
  const part = draft.parts[pi];
  const isEmpty = (part?.ingredients.length ?? 0) === 0;

  useEffect(() => {
    if (!bulkOpen && !isEmpty) return;
    let stale = false;
    listFoods({ data: {} })
      .then((rows) => {
        if (!stale) setVocabularyFoods(rows);
      })
      .catch(() => {
        if (!stale) setVocabularyFoods([]);
      });
    return () => {
      stale = true;
    };
  }, [bulkOpen, isEmpty]);

  /** Create only what the reviewer approved, then append the rows. */
  const confirmBulk = async (rows: IngredientReview[]) => {
    onChange(await confirmReviewedIngredients(rows, draft, pi));
  };

  const review = ingredientReview({ units, foods: vocabularyFoods, disabled, confirm: confirmBulk });

  if (!part) return null;
  const { ingredients } = part;
  const path = `parts.${pi}.ingredients`;

  /**
   * Enter on row `ii`'s last field: append and focus from the last row, move
   * to the next row's first field from any earlier one.
   * The new row's first field is `quantity` on a structured row and `text` on
   * a text-only one; a blank row is always structured.
   */
  const enterOnRow = (ii: number) => {
    const action = rowEnter(ii, ingredients.length);
    if (action === "ignore") return;
    if (action === "append") {
      onChange(addIngredient(draft, pi));
      focusNamed(rowFieldName(path, ingredients.length, "quantity"));
      return;
    }
    const next = ingredients[ii + 1]!;
    focusNamed(rowFieldName(path, ii + 1, isTextOnly(next) ? "originalText" : "quantity"));
  };

  return (
    <div className="flex flex-col gap-2" data-ingredients={pi}>
      <div className="flex items-center justify-between gap-3">
        <Muted as="span" className="text-xs font-medium uppercase tracking-wide">
          Ingredients
        </Muted>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={disabled} onClick={() => setBulkOpen(true)}>
            Bulk add
          </Button>
          <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={disabled} onClick={() => onChange(addIngredient(draft, pi))}>
            Add ingredient
          </Button>
        </div>
      </div>
      {needsParseAll(part) && (
        <Message intent="info" title="Nothing here is parsed" data-testid="parse-all-banner">
          <div className="flex flex-col gap-2">
            <span>These rows are plain text, so they will not scale, merge or match a food filter.</span>
            <div>
              <Button type="button" variant="outline" intent="brand" size="sm" disabled={disabled} onClick={() => setParseAllOpen(true)}>
                Parse all
              </Button>
            </div>
          </div>
        </Message>
      )}
      <ParseAllSheet open={parseAllOpen} onOpenChange={setParseAllOpen} draft={draft} pi={pi} units={units} disabled={disabled} onChange={onChange} />
      <BulkAddSheet<IngredientReview> open={bulkOpen} onOpenChange={setBulkOpen} itemName="ingredient" disabled={disabled} review={review} />
      <EmptyBoundary
        isEmpty={ingredients.length === 0}
        fallback={<BulkInlineAdd<IngredientReview> itemName="ingredient" review={review} disabled={disabled} />}
      >
        <ReorderList
          items={ingredients}
          keyOf={(row) => row.id ?? "unsaved"}
          itemName="ingredient"
          group={INGREDIENT_DRAG_GROUP}
          listKey={String(pi)}
          onMoveOut={(_, ii, toPi, toIndex) => onChange(moveIngredientTo(draft, pi, ii, Number(toPi), toIndex))}
          onReorder={(next) => onChange(withIngredients(draft, pi, next))}
          onRemove={(_, ii) => onChange(removeIngredient(draft, pi, ii))}
          renderItem={(row, ii) => (
            <IngredientEditRow
              key={row.id ?? ii}
              ingredient={row}
              pi={pi}
              ii={ii}
              units={units}
              onEnter={() => enterOnRow(ii)}
              parts={draft.parts.map((c, i) => ({ value: String(i), label: partLabel(c, i) })).filter((_, i) => i !== pi)}
              errors={errors}
              disabled={disabled}
              onPatch={(patch) => onChange(updateIngredient(draft, pi, ii, patch))}
              onMove={(toPi) => onChange(moveIngredient(draft, pi, ii, toPi))}
            />
          )}
        />
      </EmptyBoundary>
    </div>
  );
}
