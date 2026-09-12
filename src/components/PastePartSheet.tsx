// Paste a whole recipe into a part that already exists (M19.3). The same two
// stages `RecipeImport` runs on `/recipes/new` — paste, then review — inside a
// `sheet`, appending to a part rather than building a draft.
//
// Bulk add (M13.4, M17.5) takes one list at a time and one item per line. This
// takes the shape a recipe actually arrives in: a block with its ingredients
// and its method both in it, split by `splitRecipe` (M19.1) and reviewed the
// same way. Only the commit differs, which is why the review stage is
// `RecipeImportReview` unchanged, with its name field left off — the recipe
// already has a name.
//
// Rows are appended, never replaced: pasting a second half of a recipe into a
// part that already holds the first is the point.
import { Button } from "@sixthshift/design-system/button";
import { Sheet } from "@sixthshift/design-system/sheet";
import { useState } from "react";
import type { Food as FoodRow } from "../db/models/food/repo";
import { pendingCreations, reviewRows, type RowCommit, rowCommit } from "../domain/bulkIngredients";
import type { Unit } from "../domain/recipe";
import { splitRecipe } from "../domain/splitRecipe";
import { messageFrom } from "../lib/notify";
import { findOrCreateFood, listFoods } from "../server/foods";
import { findOrCreateUnit } from "../server/units";
import type { IngredientReview } from "./IngredientReviewRow";
import { addReviewedIngredients } from "./IngredientsEditor";
import { RecipeImportPaste, RecipeImportReview } from "./RecipeImport";
import type { RecipeDraft } from "./RecipeForm";
import { addBulkSteps } from "./StepsEditor";

/**
 * The draft with a reviewed paste appended to part `pi`: the ingredient rows
 * onto its ingredient list, the step lines onto its step list, both in order
 * and both after what was already there. An out-of-range `pi` returns a copy
 * unchanged, as the two helpers it composes do. Pure apart from the new rows'
 * ids.
 */
export function addPastedToPart(
  draft: RecipeDraft,
  pi: number,
  commits: readonly RowCommit<Unit, FoodRow>[],
  steps: readonly string[],
  createdFoods: ReadonlyMap<string, FoodRow>,
  createdUnits: ReadonlyMap<string, Unit>,
): RecipeDraft {
  return addBulkSteps(addReviewedIngredients(draft, pi, commits, createdFoods, createdUnits), pi, steps);
}

export type PastePartSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: RecipeDraft;
  /** Index of the part the paste lands in. */
  pi: number;
  /** The units the editor loaded: the parser's unit vocabulary and the picker's options. */
  units: readonly Unit[];
  disabled?: boolean;
  onChange: (draft: RecipeDraft) => void;
  /** Override the food vocabulary (tests); otherwise `listFoods` supplies it. */
  loadFoods?: () => Promise<FoodRow[]>;
};

export function PastePartSheet({ open, onOpenChange, draft, pi, units, disabled, onChange, loadFoods }: PastePartSheetProps) {
  const [text, setText] = useState("");
  // Null until Continue has been pressed: the sheet is still on the textarea.
  const [rows, setRows] = useState<IngredientReview[] | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFoods = loadFoods ?? (() => listFoods({ data: {} }));

  const close = () => {
    setText("");
    setRows(null);
    setSteps([]);
    setBusy(false);
    setError(null);
    onOpenChange(false);
  };

  const proceed = async () => {
    setBusy(true);
    setError(null);
    try {
      const foods = await fetchFoods();
      const split = splitRecipe(text);
      setRows(reviewRows(split.ingredients, { units, foods }));
      setSteps(split.steps);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  };

  /** Create only what the reviewer approved, then append the rows. */
  const add = async (reviewed: IngredientReview[]) => {
    setBusy(true);
    setError(null);
    try {
      const pending = pendingCreations(reviewed);
      const createdFoods = new Map<string, FoodRow>();
      for (const name of pending.foods) createdFoods.set(name.toLowerCase(), await findOrCreateFood({ data: { name } }));
      const createdUnits = new Map<string, Unit>();
      for (const name of pending.units) createdUnits.set(name.toLowerCase(), await findOrCreateUnit({ data: { name } }));
      onChange(addPastedToPart(draft, pi, reviewed.map(rowCommit), steps, createdFoods, createdUnits));
      close();
    } catch (cause) {
      setBusy(false);
      setError(messageFrom(cause));
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())} size="md" closable aria-label="Paste a recipe">
      <Sheet.Header>
        <h2 className="text-base font-medium">Paste a recipe</h2>
      </Sheet.Header>
      <Sheet.Body>
        <PastePartSheetContent
          text={text}
          rows={rows}
          steps={steps}
          units={units}
          busy={disabled || busy}
          error={error}
          onTextChange={setText}
          onContinue={() => void proceed()}
          onRowsChange={setRows}
          onBack={() => {
            setRows(null);
            setError(null);
          }}
          onAdd={() => rows !== null && void add(rows)}
        />
      </Sheet.Body>
      <Sheet.Footer>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={close}>
          Cancel
        </Button>
      </Sheet.Footer>
    </Sheet>
  );
}

export type PastePartSheetContentProps = {
  text: string;
  /** Null while the sheet is still on the textarea; the reviewed rows once Continue has run. */
  rows: readonly IngredientReview[] | null;
  steps: readonly string[];
  units: readonly Unit[];
  busy?: boolean;
  error?: string | null;
  onTextChange: (text: string) => void;
  onContinue: () => void;
  onRowsChange: (rows: IngredientReview[]) => void;
  onBack: () => void;
  onAdd: () => void;
};

/**
 * The sheet's body: the paste box, or the review once there are rows. A plain
 * function of its props, because the design system's `Sheet` mounts through a
 * portal and renders nothing to a string — the same split `FoodEditSheet` uses
 * so a test has something to render.
 */
export function PastePartSheetContent(props: PastePartSheetContentProps) {
  const { text, rows, steps, units, busy, error, onTextChange, onContinue, onRowsChange, onBack, onAdd } = props;
  if (rows === null) {
    return (
      <>
        <RecipeImportPaste
          text={text}
          disabled={busy}
          blankLabel={null}
          hint="Paste a block of recipe text. Its ingredients and its steps both land in this part, after what is already there."
          onTextChange={onTextChange}
          onContinue={onContinue}
          onBlank={onBack}
        />
        {error != null && (
          <p className="mt-3 text-sm text-fg-danger" role="alert">
            {error}
          </p>
        )}
      </>
    );
  }
  return (
    <RecipeImportReview
      rows={rows}
      steps={steps}
      units={units}
      searchFoods={(q) => listFoods({ data: { q } })}
      busy={busy}
      error={error}
      createLabel="Add"
      onRowsChange={onRowsChange}
      onBack={onBack}
      onCreate={onAdd}
    />
  );
}
