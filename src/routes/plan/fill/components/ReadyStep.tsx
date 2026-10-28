import { Card } from "@sixthshift/design-system/card";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { cn } from "@sixthshift/design-system/utils";
import { dayParts, entryLabel, type PlanDay, weekDates } from "../../../../domain/plan";
import type { RecipeSummary } from "../../../../domain/recipe";

/**
 * The week as it will be: each day's existing entries as they stand, and what
 * this session adds to the open ones. One choice left, whether the week goes
 * onto the shopping list too.
 */
export function ReadyStep({
  monday,
  days,
  chosen,
  byId,
  addToList,
  onAddToListChange,
}: {
  monday: string;
  days: readonly PlanDay[];
  chosen: readonly { date: string; id: string | null }[];
  byId: ReadonlyMap<string, RecipeSummary>;
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
            const added = chosen.find((choice) => choice.date === date);
            const recipe = added?.id ? byId.get(added.id) : undefined;
            const label = existing.length > 0 ? existing.map(entryLabel).join(", ") : (recipe?.name ?? (added ? "Night off" : ""));
            return (
              <li key={date} className="flex items-center gap-3 px-4 py-3">
                <span className="w-10 shrink-0 text-sm font-semibold">{dayParts(date).weekday}</span>
                <span className={cn("min-w-0 flex-1", !recipe && "text-fg-subtle")}>{label || "—"}</span>
                {recipe && <span className="text-xs font-medium text-fg-brand">New</span>}
              </li>
            );
          })}
        </ul>
      </Card>
      <Checkbox label="Add the week to the shopping list" checked={addToList} onCheckedChange={(checked) => onAddToListChange(checked === true)} />
    </section>
  );
}
