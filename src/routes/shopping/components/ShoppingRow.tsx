import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Muted } from "@sixthshift/design-system/muted";
import { Select } from "@sixthshift/design-system/select";
import { formatQuantity } from "../../../domain/ingredient";
import { dayParts } from "../../../domain/plan";
import type { Aisle, Food } from "../../../domain/reference";
import {
  breakdownOf,
  overLabel,
  type PackSize,
  packsFor,
  packsLabel,
  type ShoppingBreakdownRow,
  type ShoppingItem,
  type ShoppingMeal,
  shoppingItemLabel,
} from "../../../domain/shopping";

/** "Lemon tart · Mon": the dish and its weekday, a breakdown row's middle. */
function dishText(row: ShoppingBreakdownRow): string {
  return row.date === null ? row.name : `${row.name} · ${dayParts(row.date).weekday}`;
}

/** "Lemon tart, Mon · Roast chicken, Wed": the weekday alone, since a list spans a week or so. */
function mealsText(meals: readonly ShoppingMeal[]): string {
  return meals.map((meal) => (meal.date === null ? meal.name : `${meal.name}, ${dayParts(meal.date).weekday}`)).join(" · ");
}

/**
 * One line: the tick box, the amount and food (or the text), and a chevron
 * that expands where it came from. The whole summary is the chevron's target,
 * so the tap area is the row rather than the glyph.
 */
export function ShoppingRow({
  item,
  label = shoppingItemLabel(item),
  whole = null,
  meals = [],
  sizes,
  onEditFood,
  aisles,
  onTick,
  onRemove,
  onSetAisle,
  busy,
}: {
  item: ShoppingItem;
  /** What the row reads: the line, or in the meal view one dish's share of it. */
  label?: string;
  /** The whole line when `label` is only a share of it, said in the expansion. */
  whole?: string | null;
  /** The dishes the line is for, said under it in the aisle view. Empty says nothing. */
  meals?: readonly ShoppingMeal[];
  /**
   * The sizes the line's food is sold in, in the aisle view only: the line is
   * rounded up to whole packs ("→ 2 × 250 g"). Undefined (the meal view,
   * whose rows are shares) rounds nothing.
   */
  sizes?: readonly PackSize[];
  /** "Edit food": opens the food's sheet, sizes and all (decisions.md row 186). Absent hides it. */
  onEditFood?: (food: Food) => void;
  aisles: readonly Aisle[];
  onTick: (id: string, ticked: boolean) => void;
  onRemove: (id: string) => void;
  onSetAisle: (foodId: string, aisleId: string) => void;
  busy: boolean;
}) {
  const food = item.food;
  const needsAisle = food !== null && food.aisle === null;
  // On hand is ticked and not bought, so there is nothing to round.
  const plan = sizes === undefined || food?.skipShopping ? null : packsFor(item, sizes);
  const breakdown = breakdownOf(item);
  // A total only when it says something the breakdown does not: the packs to
  // take, or (in the meal view, whose row is one dish's share) the whole line.
  const total =
    plan !== null
      ? [`${label} needed`, packsLabel(plan), overLabel(plan, item.unit)].filter((part) => part !== "").join(" · ")
      : whole !== null
        ? `${whole} in all`
        : "";
  return (
    <li className="flex items-start gap-3" data-testid="shopping-row" data-ticked={item.ticked ? "true" : "false"}>
      <Checkbox checked={item.ticked} disabled={busy} className="mt-3.5" aria-label={label} onCheckedChange={(next) => onTick(item.id, next)} />
      <details className="group min-w-0 flex-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 marker:hidden">
          <span className="flex min-w-0 flex-col">
            <span className={item.ticked ? "text-fg-subtle line-through" : undefined}>
              {label}
              {plan !== null && <span className="text-fg-subtle" data-testid="shopping-packs">{` → ${packsLabel(plan)}`}</span>}
            </span>
            {meals.length > 0 && (
              <span className="text-sm text-fg-subtle" data-testid="shopping-meals">
                {mealsText(meals)}
              </span>
            )}
          </span>
          <span aria-hidden="true" className="shrink-0 text-fg-subtle transition-transform group-open:rotate-90">
            ›
          </span>
        </summary>
        <div className="flex flex-col gap-2 pb-3" data-testid="shopping-sources">
          {breakdown.length === 0 ? (
            <Muted as="p">Added by hand</Muted>
          ) : (
            <ul className="flex flex-col gap-1" data-testid="shopping-breakdown">
              {breakdown.map((row) => (
                <li key={row.key} className="flex gap-3 text-sm">
                  {/* Amount first: it is what the shelf is checked against. */}
                  <span className="w-16 shrink-0 tabular-nums">{row.amount}</span>
                  <span className="min-w-0">
                    {dishText(row)}
                    {row.servings !== null && <span className="text-fg-subtle">{` · serves ${formatQuantity(row.servings)}`}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {total !== "" && (
            <p className="border-t border-border-subtle pt-2 text-sm" data-testid="shopping-total">
              {total}
            </p>
          )}
          <div className="flex flex-col items-start gap-2 border-t border-border-subtle pt-2" data-testid="shopping-actions">
            {needsAisle && (
              <div className="flex items-center gap-2" data-testid="shopping-set-aisle">
                <Muted as="span">Set aisle</Muted>
                <Select
                  aria-label={`Aisle for ${food.name}`}
                  placeholder="Choose an aisle"
                  options={aisles.map((aisle) => ({ value: aisle.id, label: aisle.name }))}
                  disabled={busy}
                  onValueChange={(aisleId) => onSetAisle(food.id, aisleId)}
                />
              </div>
            )}
            {food !== null && onEditFood !== undefined && (
              <Button type="button" inline intent="brand" size="sm" disabled={busy} onClick={() => onEditFood(food)}>
                Edit food
              </Button>
            )}
            {/* Neutral: row removal is (design-language rule 5), and a line is one type away from coming back. */}
            <Button type="button" inline intent="neutral" size="sm" disabled={busy} onClick={() => onRemove(item.id)}>
              Remove
            </Button>
          </div>
        </div>
      </details>
    </li>
  );
}
