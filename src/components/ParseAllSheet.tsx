// Parse every unparsed row of a part at once (M21.3, decisions.md row 54).
//
// M17.6 gave a text-only row a Parse action in its own menu, which is the
// right place for one row and the wrong place for twelve — a recipe imported
// before the parser existed, or a paste whose foods were all declined, is a
// whole list of them and there was no way to say so. Mealie's answer is a
// standing alert at the top of the ingredient list when nothing in it has a
// food or a unit, with one button; this is that button.
//
// It changes nothing about the rules. Each row goes through the same
// `parseIngredient` over the same vocabulary, the results are the same review
// rows with every proposal declined by default, and Apply creates only what
// was approved and patches only the parsed fields — `originalText` is never
// touched, so the raw line a row started with survives whatever the parse
// decided.
import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { Sheet } from "@sixthshift/design-system/sheet";
import { useEffect, useRef, useState } from "react";
import type { Food as FoodRow } from "../db/models/food/repo";
import { pendingCreations } from "../domain/bulkIngredients";
import type { Unit } from "../domain/recipe";
import { messageFrom } from "../lib/notify";
import { findOrCreateFood, listFoods } from "../server/fns/foods";
import { findOrCreateUnit } from "../server/fns/units";
import { IngredientReviewRow, type IngredientReview } from "./IngredientReviewRow";
import { filterUnits, isTextOnly, parsedRowPatch, parseRowFor, updateIngredient } from "./IngredientsEditor";
import type { DraftIngredient, DraftPart, RecipeDraft } from "./RecipeForm";

/** The positions of the rows Parse all would read: text-only rows that have a raw line. Pure. */
export function unparsedIndices(ingredients: readonly DraftIngredient[]): number[] {
  return ingredients.flatMap((row, index) => (isTextOnly(row) && (row.originalText ?? "").trim() !== "" ? [index] : []));
}

/**
 * Should the part offer Parse all? Only when it has rows, none of them has
 * resolved to a food, and at least one has a raw line to read — the same
 * "nothing here is parsed" test Mealie's alert uses, narrowed to a part. A
 * part with one matched row has been looked at, so the banner goes away. Pure.
 */
export function needsParseAll(part: DraftPart): boolean {
  if (part.ingredients.length === 0) return false;
  if (part.ingredients.some((row) => row.food)) return false;
  return unparsedIndices(part.ingredients).length > 0;
}

/**
 * Every unparsed row of `ingredients` read against the vocabulary, as review
 * rows keyed by the row's position — which is what `applyParsedRows` patches
 * by, so the key has to stay the index and not the row's id. Pure.
 */
export function parseAllRows(ingredients: readonly DraftIngredient[], vocabulary: { units: readonly Unit[]; foods: readonly FoodRow[] }): IngredientReview[] {
  return unparsedIndices(ingredients).map((index) => parseRowFor(ingredients[index]!.originalText ?? "", vocabulary, String(index)));
}

/**
 * The draft with each reviewed row applied to the row it came from in part
 * `pi`. A row whose food is still undecided has nothing to apply and is left
 * exactly as it was, text-only and all. Pure.
 */
export function applyParsedRows(
  draft: RecipeDraft,
  pi: number,
  rows: readonly IngredientReview[],
  createdFoods: ReadonlyMap<string, FoodRow>,
  createdUnits: ReadonlyMap<string, Unit>,
): RecipeDraft {
  let next = draft;
  for (const row of rows) {
    const index = Number(row.key);
    const patch = parsedRowPatch(row, createdFoods, createdUnits);
    if (!Number.isInteger(index) || patch === null) continue;
    next = updateIngredient(next, pi, index, patch);
  }
  return next;
}

/** "3 lines read", "1 line read". Pure. */
export function parsedSummary(count: number): string {
  return `${count} line${count === 1 ? "" : "s"} read. Nothing is created unless you ask for it below.`;
}

export type ParseAllSheetContentProps = {
  rows: readonly IngredientReview[];
  units: readonly Unit[];
  searchFoods: (q: string) => Promise<FoodRow[]>;
  busy?: boolean;
  error?: string | null;
  onRowsChange: (rows: IngredientReview[]) => void;
  onApply: () => void;
  onCancel: () => void;
};

/**
 * The sheet's body. A plain function of its props, because the design system's
 * `Sheet` mounts through a portal and renders nothing to a string.
 */
export function ParseAllSheetContent(props: ParseAllSheetContentProps) {
  const { rows, units, searchFoods, busy, error, onRowsChange, onApply, onCancel } = props;
  return (
    <div className="flex flex-col gap-4" data-parse-all="">
      <Muted as="p" className="text-sm">
        {parsedSummary(rows.length)}
      </Muted>
      <ul className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <li key={row.key} className="rounded-lg border border-border-normal p-3">
            <IngredientReviewRow
              row={row}
              label={`Line ${index + 1}`}
              disabled={busy}
              unitMatches={(text) => filterUnits(units, text)}
              searchFoods={searchFoods}
              onChange={(next) => onRowsChange(rows.map((current, i) => (i === index ? next : current)))}
            />
          </li>
        ))}
      </ul>
      {error != null && (
        <p className="text-sm text-fg-danger" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="solid" intent="brand" disabled={busy || rows.length === 0} onClick={onApply}>
          {busy ? "Working…" : "Apply"}
        </Button>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export type ParseAllSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: RecipeDraft;
  /** Index of the part whose rows are being read. */
  pi: number;
  units: readonly Unit[];
  disabled?: boolean;
  onChange: (draft: RecipeDraft) => void;
  /** Override the food vocabulary (tests); otherwise `listFoods` supplies it. */
  loadFoods?: () => Promise<FoodRow[]>;
};

export function ParseAllSheet({ open, onOpenChange, draft, pi, units, disabled, onChange, loadFoods }: ParseAllSheetProps) {
  const [rows, setRows] = useState<IngredientReview[]>([]);
  // The rows as they were when the sheet opened, so the read below does not
  // depend on the live draft and re-run as it changes.
  const ingredientsRef = useRef<readonly DraftIngredient[]>(draft.parts[pi]?.ingredients ?? []);
  ingredientsRef.current = draft.parts[pi]?.ingredients ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setRows([]);
    setBusy(false);
    setError(null);
    onOpenChange(false);
  };

  // Reading the part needs every food, not the query-by-query slice a row's
  // combobox asks for — the same load bulk add does when it opens. Read once,
  // when the sheet opens: re-reading on every keystroke would throw away the
  // decisions already made in it.
  useEffect(() => {
    if (!open) return;
    let stale = false;
    setBusy(true);
    setError(null);
    (loadFoods ?? (() => listFoods({ data: {} })))()
      .then((foods) => {
        if (stale) return;
        setRows(parseAllRows(ingredientsRef.current, { units, foods }));
        setBusy(false);
      })
      .catch((cause: unknown) => {
        if (stale) return;
        setError(messageFrom(cause));
        setBusy(false);
      });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      const pending = pendingCreations(rows);
      const createdFoods = new Map<string, FoodRow>();
      for (const name of pending.foods) createdFoods.set(name.toLowerCase(), await findOrCreateFood({ data: { name } }));
      const createdUnits = new Map<string, Unit>();
      for (const name of pending.units) createdUnits.set(name.toLowerCase(), await findOrCreateUnit({ data: { name } }));
      onChange(applyParsedRows(draft, pi, rows, createdFoods, createdUnits));
      close();
    } catch (cause) {
      setBusy(false);
      setError(messageFrom(cause));
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())} size="md" closable aria-label="Parse all ingredients">
      <Sheet.Header>
        <h2 className="text-base font-medium">Parse all ingredients</h2>
      </Sheet.Header>
      <Sheet.Body>
        <ParseAllSheetContent
          rows={rows}
          units={units}
          searchFoods={(q) => listFoods({ data: { q } })}
          busy={disabled || busy}
          error={error}
          onRowsChange={setRows}
          onApply={() => void apply()}
          onCancel={close}
        />
      </Sheet.Body>
    </Sheet>
  );
}
