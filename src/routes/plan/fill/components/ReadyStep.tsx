import { Card } from "@sixthshift/design-system/card";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { cn } from "@sixthshift/design-system/utils";
import { NumberStepper } from "../../../../components/ui/NumberStepper";
import { dayParts, entryLabel, type Meal, mealLabel, type PlanDay, weekDates } from "../../../../domain/plan";
import type { RecipeSummary } from "../../../../domain/recipe";

/**
 * The week as it will be: each day's existing entries as they stand, and what
 * this session adds to the open ones. Two choices left: how many are eating,
 * written onto every entry added and remembered on the device, and whether
 * the week goes onto the shopping list too.
 */
export function ReadyStep({
  monday,
  days,
  entries,
  byId,
  servings,
  onServingsChange,
  addToList,
  onAddToListChange,
}: {
  monday: string;
  days: readonly PlanDay[];
  entries: readonly { date: string; meal: Meal; recipeId: string }[];
  byId: ReadonlyMap<string, RecipeSummary>;
  servings: number;
  onServingsChange: (servings: number) => void;
  addToList: boolean;
  onAddToListChange: (add: boolean) => void;
}) {
  return (
    <section aria-labelledby="ready" className="flex flex-col gap-3">
      <h2 id="ready" className="text-lg font-semibold">
        Your week
      </h2>
      <Card className="p-0">
        <ul className="divide-y divide-border-subtle">
          {weekDates(monday).map((date) => {
            const existing = days.find((day) => day.date === date)?.entries ?? [];
            const added = entries.filter((entry) => entry.date === date);
            return (
              <li key={date} className="flex items-start gap-3 px-4 py-3">
                <span className="w-10 shrink-0 text-sm font-semibold">{dayParts(date).weekday}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  {existing.length > 0 && <span className="text-fg-subtle">{existing.map(entryLabel).join(", ")}</span>}
                  {added.map((entry) => (
                    <span key={entry.meal} className="flex items-baseline gap-2">
                      <span className="min-w-0">{byId.get(entry.recipeId)?.name ?? "A recipe since deleted"}</span>
                      {entry.meal !== "dinner" && <span className="text-xs text-fg-subtle">{mealLabel(entry.meal)}</span>}
                      <span className="ml-auto text-xs font-medium text-fg-brand">New</span>
                    </span>
                  ))}
                  {existing.length === 0 && added.length === 0 && <span className={cn("text-fg-subtle")}>—</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
      <NumberStepper label="How many are eating" value={servings} min={1} onChange={onServingsChange} className="max-w-48" />
      <Checkbox label="Add the week to the shopping list" checked={addToList} onCheckedChange={(checked) => onAddToListChange(checked === true)} />
    </section>
  );
}
