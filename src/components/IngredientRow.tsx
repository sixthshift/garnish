// One ingredient line on the recipe view page. Mealie's order: quantity, unit,
// bold food, with the note dimmed on its own line underneath; a `fixed`
// ingredient (Cooklang `=`) keeps its "fixed" marker regardless of servings.
// A leading checkbox ticks the row off for this session (src/lib/ticks.ts),
// which also strikes the text through. When the page is showing a servings
// count other than the recipe's own, the amount gets a class so it reads as
// "this number changed".
//
// "Scale to..." (M11.5) is a single action, not a menu — M11.6's local `Menu`
// primitive does not exist yet, so this is a plain button that opens a
// `popover` with one number input, rather than a dropdown with one item. It
// only appears when the caller wires both `currentServings` (the servings the
// page is currently showing, for `servingsForTarget`'s basis) and `onScaleTo`,
// and only for an ingredient that can actually be scaled to a target: not
// `fixed`, and a positive quantity to derive a factor from.
import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { Popover } from "@sixthshift/design-system/popover";
import { cn } from "@sixthshift/design-system/utils";
import { type FormEvent, useId, useState } from "react";
import { formatAmount, formatFood, formatIngredient } from "../domain/format";
import type { Ingredient } from "../domain/recipe";
import { servingsForTarget } from "../domain/scale";
import { useIngredientTick } from "../lib/ticks";

export type IngredientRowProps = {
  /** The owning recipe's id: ticks.ts keys session state by it. */
  recipeId: string;
  ingredient: Ingredient;
  /** True when the page is showing servings other than the recipe's own. */
  scaled?: boolean;
  /** The servings the page is currently showing; the basis "Scale to..." scales from. Omit to hide the control. */
  currentServings?: number;
  /** Called with the servings that reach a typed target amount for this ingredient. Omit to hide the control. */
  onScaleTo?: (servings: number) => void;
};

/** The line's visible parts: the amount, the food (bold unless `raw`), and whether `food` is really the untouched original text. Pure. */
export type IngredientLineParts = { amount: string; food: string; raw: boolean };

/**
 * Splits an ingredient into what `IngredientRow` renders with its own markup:
 * the amount (quantity + unit) and the food, kept separate so the food can be
 * bold and the amount can carry the "scaled" class. Mirrors formatIngredient's
 * fallback: a null food with an originalText renders that text verbatim
 * (`raw: true`), unstyled. Pure.
 */
export function ingredientLineParts(ingredient: Pick<Ingredient, "quantity" | "unit" | "food" | "originalText">): IngredientLineParts {
  const { quantity, unit, food, originalText } = ingredient;
  if (food === null && originalText.trim() !== "") return { amount: "", food: originalText.trim(), raw: true };

  const hasQuantity = quantity !== null && quantity !== 0;
  return { amount: hasQuantity ? formatAmount(quantity, unit) : "", food: formatFood(quantity, food), raw: false };
}

export function IngredientRow({ recipeId, ingredient, scaled = false, currentServings, onScaleTo }: IngredientRowProps) {
  const [done, toggle] = useIngredientTick(recipeId, ingredient.id);
  const { amount, food, raw } = ingredientLineParts(ingredient);
  const note = ingredient.note.trim();
  const canScaleTo =
    currentServings !== undefined && currentServings > 0 && onScaleTo !== undefined && !ingredient.fixed && ingredient.quantity !== null && ingredient.quantity > 0;

  return (
    <li
      className="flex items-start gap-2.5"
      data-testid="ingredient-row"
      data-ticked={done ? "true" : undefined}
      data-fixed={ingredient.fixed ? "true" : undefined}
      data-scaled={scaled ? "true" : undefined}
    >
      <Checkbox checked={done} onCheckedChange={toggle} className="mt-0.5" aria-label={`Tick off ${formatIngredient(ingredient) || "ingredient"}`} />
      <button type="button" onClick={toggle} className={cn("flex flex-1 flex-col gap-0.5 text-left", done && "text-fg-subtle")}>
        <span className={cn(done && "line-through")}>
          {amount !== "" && (
            <span className={cn("tabular-nums", scaled && "font-semibold text-fg-brand")} data-testid="ingredient-amount">
              {amount}{" "}
            </span>
          )}
          {raw ? food : <strong className="font-semibold">{food}</strong>}
          {ingredient.fixed && (
            <Muted as="span" className="ml-1.5 text-xs" title="Fixed amount, does not scale with servings">
              fixed
            </Muted>
          )}
        </span>
        {note !== "" && <Muted as="p" className={cn("text-sm", done && "line-through")}>{note}</Muted>}
      </button>
      {canScaleTo && (
        <ScaleToControl ingredient={ingredient} currentServings={currentServings} onScaleTo={onScaleTo} label={formatFood(ingredient.quantity, ingredient.food) || "this ingredient"} />
      )}
    </li>
  );
}

/**
 * "Scale to...": a button that opens a popover holding one number input for a
 * target amount of this ingredient. Submitting computes the servings that
 * reach it (`servingsForTarget`) and hands that to `onScaleTo`, which the view
 * route turns into a navigation. Pure input handling only; no IO here.
 */
function ScaleToControl({
  ingredient,
  currentServings,
  onScaleTo,
  label,
}: {
  ingredient: Pick<Ingredient, "quantity" | "fixed">;
  currentServings: number;
  onScaleTo: (servings: number) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputId = useId();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = Number(draft);
    if (Number.isFinite(target) && target > 0) {
      onScaleTo(servingsForTarget(ingredient, target, currentServings));
    }
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft("");
        setOpen(next);
      }}
      placement="bottom-end"
    >
      <Popover.Trigger asChild>
        <button type="button" data-testid="scale-to-trigger" aria-label={`Scale to a set amount of ${label}`} className="shrink-0 self-start text-xs text-fg-subtle underline underline-offset-2 hover:text-fg-normal">
          Scale to…
        </button>
      </Popover.Trigger>
      <Popover.Body className="flex flex-col gap-2 p-3" aria-label={`Scale to a set amount of ${label}`}>
        <form className="flex items-center gap-2" onSubmit={submit}>
          <label htmlFor={inputId} className="text-sm text-fg-subtle">
            Scale to
          </label>
          <Input
            id={inputId}
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Target amount"
            className="w-20"
          />
          <Button type="submit" variant="solid" intent="brand" size="sm">
            Set
          </Button>
        </form>
      </Popover.Body>
    </Popover>
  );
}
