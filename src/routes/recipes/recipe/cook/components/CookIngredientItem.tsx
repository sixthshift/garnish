import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Muted } from "@sixthshift/design-system/muted";
import { cn } from "@sixthshift/design-system/utils";
import { useState } from "react";
import { PencilIcon } from "../../../../../components/ui/icons";
import { formatIngredient } from "../../../../../domain/ingredient";
import type { Ingredient } from "../../../../../domain/recipe";
import { useIngredientTick } from "../../../../../lib/useTicks";
import { COOK_ROW_BUTTON, COOK_TICK } from "../../components/IngredientRow";
import { AmountForm } from "./AmountForm";

/**
 * One ingredient card row: ticks off for this session, shared with the recipe
 * view page (src/lib/ticks.ts). The whole row, at least 48px tall, is the
 * target (`COOK_ROW_BUTTON`).
 *
 * With `onChangeAmount`, a row with an amount carries a pencil that turns it
 * into an amount field: what the cook actually used, held as a change until
 * the finish card asks whether it goes into the recipe (decisions.md row 193).
 * `changed` marks a row already changed this cook.
 */
export function CookIngredientItem({
  recipeId,
  ingredient,
  changed = false,
  onChangeAmount,
}: {
  recipeId: string;
  ingredient: Ingredient;
  changed?: boolean;
  onChangeAmount?: (typed: number) => void;
}) {
  const [done, toggle] = useIngredientTick(recipeId, ingredient.id);
  const [editing, setEditing] = useState(false);
  const line = formatIngredient(ingredient) || "ingredient";
  const canChange = onChangeAmount !== undefined && ingredient.quantity !== null;

  if (editing && canChange) {
    return (
      <li className="py-2" data-testid="cook-ingredient" data-editing="true">
        <AmountForm ingredient={ingredient} onSave={onChangeAmount} onClose={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li
      className="relative flex items-start gap-3"
      data-testid="cook-ingredient"
      data-ticked={done ? "true" : undefined}
      data-fixed={ingredient.fixed ? "true" : undefined}
      data-changed={changed ? "true" : undefined}
    >
      <Checkbox checked={done} onCheckedChange={toggle} className={COOK_TICK} aria-label={`Tick off ${line}`} />
      <button
        type="button"
        onClick={toggle}
        className={cn("flex flex-1 flex-wrap content-center items-baseline gap-x-3 text-left", COOK_ROW_BUTTON, done && "text-fg-subtle")}
      >
        <span className={cn(done && "line-through", changed && "text-fg-brand")}>{formatIngredient(ingredient)}</span>
        {ingredient.fixed && (
          <Muted as="span" className="text-sm" title="Fixed amount, does not scale with servings">
            fixed
          </Muted>
        )}
        {changed && (
          <Muted as="span" className="text-sm">
            changed
          </Muted>
        )}
      </button>
      {canChange && (
        <button
          type="button"
          aria-label={`Change the amount of ${line}`}
          className="relative z-10 mt-1 flex size-12 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-bg-normal-hovered hover:text-fg-normal"
          onClick={() => setEditing(true)}
        >
          <PencilIcon size={18} title="Change amount" />
        </button>
      )}
    </li>
  );
}
