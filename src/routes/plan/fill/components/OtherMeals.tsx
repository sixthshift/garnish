import { Card } from "@sixthshift/design-system/card";
import { Toggle } from "@sixthshift/design-system/toggle";
import { cn } from "@sixthshift/design-system/utils";
import { dayParts, mealLabel } from "../../../../domain/plan";
import type { RecipeSummary } from "../../../../domain/recipe";
import { type OtherMeal, reasonKey } from "./fill";

/**
 * The breakfasts and lunches the planner proposed, when it was asked for them:
 * one row each with its reason, and Skip to leave that one out. Nothing to
 * show, nothing drawn.
 */
export function OtherMeals({
  others,
  byId,
  reasons,
  onChange,
}: {
  others: readonly OtherMeal[];
  byId: ReadonlyMap<string, RecipeSummary>;
  reasons: Readonly<Record<string, string>>;
  onChange: (others: OtherMeal[]) => void;
}) {
  if (others.length === 0) return null;
  return (
    <section aria-labelledby="other-meals" className="flex flex-col gap-3">
      <h2 id="other-meals" className="text-lg font-semibold">
        Breakfast and lunch
      </h2>
      <Card className="p-0">
        <ul className="divide-y divide-border-subtle">
          {others.map((other, index) => {
            const recipe = byId.get(other.recipeId);
            const { weekday } = dayParts(other.date);
            const label = `${weekday} ${(mealLabel(other.meal) ?? other.meal).toLowerCase()}`;
            return (
              <li key={`${other.date}-${other.meal}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <span className="w-24 shrink-0 text-sm font-semibold">{label}</span>
                <span className="flex min-w-0 flex-[1_1_10rem] flex-col">
                  <span className={cn("font-medium", other.skip && "text-fg-subtle line-through")}>{recipe?.name ?? "A recipe since deleted"}</span>
                  {reasons[reasonKey(other.date, other.recipeId)] && (
                    <span className="text-sm text-fg-subtle">{reasons[reasonKey(other.date, other.recipeId)]}</span>
                  )}
                </span>
                <Toggle
                  variant="outline"
                  size="sm"
                  aria-label={`Skip ${label}`}
                  pressed={other.skip}
                  onPressedChange={(skip) => onChange(others.map((o, i) => (i === index ? { ...o, skip } : o)))}
                >
                  Skip
                </Toggle>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
