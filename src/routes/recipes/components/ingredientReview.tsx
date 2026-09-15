import { Button } from "@sixthshift/design-system/button";
import type { ReactNode } from "react";
import type { BulkReview } from "../../../components/ui/bulk/useBulkStage";
import { Menu } from "../../../components/ui/Menu";
import { addReviewedIngredients, filterUnits, type IngredientReview, type RecipeDraft } from "../../../domain/draft";
import { pendingCreations, reviewRows, rowCommit } from "../../../domain/ingredient";
import type { FoodRow, Unit } from "../../../domain/reference";
import { findOrCreateFood, listFoods } from "../../../server/fns/foods";
import { findOrCreateUnit } from "../../../server/fns/units";
import { IngredientReviewRow } from "./IngredientReviewRow";

/**
 * Confirm a set of reviewed lines: create only the foods and units the
 * reviewer approved, then return the draft with one row appended per line.
 * The one path that creates vocabulary up front, shared by the bulk-add sheet
 * and the empty list's inline entry, so both land rows identically —
 * a line whose food was declined lands text-only either way.
 */
export async function confirmReviewedIngredients(rows: readonly IngredientReview[], draft: RecipeDraft, pi: number): Promise<RecipeDraft> {
  const pending = pendingCreations(rows);
  const createdFoods = new Map<string, FoodRow>();
  for (const name of pending.foods) createdFoods.set(name.toLowerCase(), await findOrCreateFood({ data: { name } }));
  const createdUnits = new Map<string, Unit>();
  for (const name of pending.units) createdUnits.set(name.toLowerCase(), await findOrCreateUnit({ data: { name } }));
  return addReviewedIngredients(draft, pi, rows.map(rowCommit), createdFoods, createdUnits);
}

/**
 * The review stage for a pasted block of ingredient lines: how a line becomes
 * a review row, how that row renders, and what Confirm does with it. One
 * definition, handed to both the bulk-add sheet and the inline entry panel, so
 * the two cannot drift.
 */
export function ingredientReview(args: {
  units: readonly Unit[];
  foods: readonly FoodRow[];
  disabled?: boolean;
  confirm: (rows: IngredientReview[]) => void | Promise<void>;
}): BulkReview<IngredientReview> {
  const { units, foods, disabled, confirm } = args;
  return {
    rows: (lines) => reviewRows(lines, { units, foods }),
    keyOf: (row) => row.key,
    confirm,
    renderRow: (row, index, onRowChange) => (
      <IngredientReviewRow
        row={row}
        label={`Line ${index + 1}`}
        unitMatches={(text) => filterUnits(units, text)}
        searchFoods={(q) => listFoods({ data: { q } })}
        disabled={disabled}
        onChange={onRowChange}
      />
    ),
  };
}

/**
 * The "Parse" action for a text-only row, present only when the
 * row has something to parse. `review` is the row mid-decision — chips to
 * confirm or decline, same as bulk add — or null before Parse is pressed
 * and after it is applied or cancelled.
 */
export type ParseAction = {
  review: IngredientReview | null;
  busy: boolean;
  error: string | null;
  onStart: () => void;
  onChange: (row: IngredientReview) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * The "Parse" action itself: a trigger — a menu item inline, a plain
 * button in the phone sheet, the two placements the task asks for — that
 * becomes the same review chips bulk add shows once pressed, with Cancel
 * (nothing changes) and Apply (commits the decision) alongside. No state of
 * its own; `parse` carries it all, so this stays a plain function like
 * `IngredientFields` itself.
 */
export function parseAction(parse: ParseAction, label: string, units: readonly Unit[], disabled: boolean | undefined, variant: "menu" | "button"): ReactNode {
  const busy = parse.busy || disabled === true;

  if (parse.review !== null) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border-normal p-3" data-parse-review="">
        <IngredientReviewRow
          row={parse.review}
          label={`${label} parse`}
          unitMatches={(text) => filterUnits(units, text)}
          searchFoods={(q) => listFoods({ data: { q } })}
          disabled={busy}
          onChange={parse.onChange}
        />
        {parse.error !== null && (
          <p className="text-sm text-fg-danger" role="alert">
            {parse.error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" intent="neutral" size="sm" aria-label={`${label} parse cancel`} disabled={busy} onClick={parse.onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="solid" intent="brand" size="sm" aria-label={`${label} parse apply`} disabled={busy} onClick={parse.onConfirm}>
            Apply parse
          </Button>
        </div>
      </div>
    );
  }

  if (variant === "button") {
    return (
      <Button type="button" variant="outline" intent="neutral" size="sm" aria-label={`${label} parse`} disabled={busy} onClick={parse.onStart}>
        Parse
      </Button>
    );
  }

  return (
    <Menu label={`${label} actions`} iconOnly>
      <Menu.Item onSelect={parse.onStart} disabled={busy}>
        Parse
      </Menu.Item>
    </Menu>
  );
}
