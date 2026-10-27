import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Muted } from "@sixthshift/design-system/muted";
import { Select } from "@sixthshift/design-system/select";
import { dayParts } from "../../../domain/plan";
import type { Aisle } from "../../../domain/reference";
import { type ShoppingItem, type ShoppingMeal, shoppingItemLabel, sourceLabel } from "../../../domain/shopping";

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
  aisles: readonly Aisle[];
  onTick: (id: string, ticked: boolean) => void;
  onRemove: (id: string) => void;
  onSetAisle: (foodId: string, aisleId: string) => void;
  busy: boolean;
}) {
  const food = item.food;
  const needsAisle = food !== null && food.aisle === null;
  return (
    <li className="flex items-start gap-3" data-testid="shopping-row" data-ticked={item.ticked ? "true" : "false"}>
      <Checkbox checked={item.ticked} disabled={busy} className="mt-3.5" aria-label={label} onCheckedChange={(next) => onTick(item.id, next)} />
      <details className="group min-w-0 flex-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 marker:hidden">
          <span className="flex min-w-0 flex-col">
            <span className={item.ticked ? "text-fg-subtle line-through" : undefined}>{label}</span>
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
        <div className="flex flex-col items-start gap-2 pb-3" data-testid="shopping-sources">
          {whole !== null && (
            <Muted as="p" data-testid="shopping-whole">
              {`${whole} on the list in all`}
            </Muted>
          )}
          {item.sources.length === 0 ? (
            <Muted as="p">Added by hand</Muted>
          ) : (
            <ul className="flex flex-col gap-1">
              {item.sources.map((source) => (
                <li key={source.id} className="text-sm text-fg-subtle">
                  {sourceLabel(source)}
                </li>
              ))}
            </ul>
          )}
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
          {/* Neutral: row removal is (design-language rule 5), and a line is one type away from coming back. */}
          <Button type="button" inline intent="neutral" size="sm" disabled={busy} onClick={() => onRemove(item.id)}>
            Remove
          </Button>
        </div>
      </details>
    </li>
  );
}
