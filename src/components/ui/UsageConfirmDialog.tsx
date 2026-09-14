// The delete confirm for a reference row: the ConfirmDialog, plus the list of
// recipes that use the row. Deleting a food, unit or tag never fails — every
// reference is ON DELETE SET NULL or CASCADE — so the question is not whether
// it can go but what it takes with it, and the only honest answer is the list.
// The recipes come from `recipes.usingFood`/`usingUnit`/`usingTag`.
//
// Long lists are capped so the dialog cannot outgrow a phone; the count in the
// sentence is always the true one.
import { Modal } from "@sixthshift/design-system/modal";
import { Muted } from "@sixthshift/design-system/muted";
import { type RecipeSummary } from "../../domain/recipe/recipe";
import { ConfirmDialogContent } from "./ConfirmDialog";

export type UsageConfirmDialogProps = {
  /** What is being deleted, e.g. "butter". */
  name: string;
  /** Singular kind, e.g. "food", "unit", "tag". */
  itemName: string;
  /** What deleting does to those recipes, e.g. "they will keep the ingredient without a food." */
  effect: string;
  /** The affected recipes, from the repository's `usingFood`/`usingUnit`/`usingTag`. */
  recipes: readonly RecipeSummary[];
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function UsageConfirmDialogContent({ name, itemName, effect, recipes, busy = false, onCancel, onConfirm }: UsageConfirmDialogProps) {
  const { names, rest } = usageNames(recipes);
  return (
    <ConfirmDialogContent title={`Delete ${name}?`} confirmLabel="Delete" busy={busy} busyLabel="Deleting…" onCancel={onCancel} onConfirm={onConfirm}>
      <div className="flex flex-col gap-2">
        <p>{usageSummary(recipes.length, itemName, effect)}</p>
        {names.length > 0 && (
          <ul className="list-disc pl-5" data-usage-list>
            {names.map((recipeName) => (
              <li key={recipeName}>{recipeName}</li>
            ))}
          </ul>
        )}
        {rest > 0 && (
          <Muted as="p" className="text-sm">
            and {rest} more.
          </Muted>
        )}
      </div>
    </ConfirmDialogContent>
  );
}

export function UsageConfirmDialog(props: UsageConfirmDialogProps) {
  return (
    <Modal size="sm" aria-label={`Delete ${props.name}`} dismissable={props.busy !== true} onOpenChange={(open) => !open && props.onCancel()}>
      <UsageConfirmDialogContent {...props} />
    </Modal>
  );
}

/** How many recipes the list shows before it summarises the rest. */
export const usageListLimit = 10;

/** The sentence above the list: how many recipes lose this row, and what happens to them. Pure. */
export function usageSummary(count: number, itemName: string, effect: string): string {
  if (count === 0) return `No recipes use this ${itemName}.`;
  return `${count} ${count === 1 ? "recipe uses" : "recipes use"} this ${itemName}; ${effect}`;
}

/** The names to show, and how many are left over. Pure. */
export function usageNames(recipes: readonly RecipeSummary[], limit = usageListLimit): { names: string[]; rest: number } {
  return { names: recipes.slice(0, limit).map((recipe) => recipe.name), rest: Math.max(recipes.length - limit, 0) };
}
