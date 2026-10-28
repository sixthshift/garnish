import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Muted } from "@sixthshift/design-system/muted";
import { Toggle } from "@sixthshift/design-system/toggle";
import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { dayParts } from "../../../../domain/plan";
import type { RecipeSummary } from "../../../../domain/recipe";
import { nightReason, reasonKey, reasonLabel, swapNight } from "./fill";

/**
 * The open weeknights, each with the recipe the rotation offers and why:
 * Swap for the next one, or Night off to leave the day empty. A night that
 * ran out of rotation starts as a night off.
 */
export function WeeknightsStep({
  dates,
  nights,
  byId,
  pool,
  carried,
  today,
  reasons = {},
  source = "rotation",
  rotationEmpty = false,
  choosing = false,
  onChange,
}: {
  dates: readonly string[];
  nights: readonly (string | null)[];
  byId: ReadonlyMap<string, RecipeSummary>;
  pool: readonly RecipeSummary[];
  carried: readonly RecipeSummary[];
  today: string;
  /** The planner's reason for a recipe on a date, when it chose it: shown instead of the rotation's. */
  reasons?: Readonly<Record<string, string>>;
  /** Who made the first offer: the planner, or the rotation's own order. */
  source?: "planner" | "rotation";
  /** Nothing is marked Rotation, so the rotation offered nothing and Swap offers any recipe. */
  rotationEmpty?: boolean;
  /** The planner is still choosing: the days are drawn, waiting, with nothing to press. */
  choosing?: boolean;
  onChange: (nights: (string | null)[]) => void;
}) {
  const carriedIds = new Set(carried.map((recipe) => recipe.id));
  // What a night off goes back to: the night's own offer when it was turned off.
  const offerFor = (index: number) => swapNight(nights, index, pool)[index] ?? null;

  if (dates.length === 0) {
    return (
      <section aria-labelledby="weeknights" className="flex flex-col gap-2">
        <h2 id="weeknights" className="text-lg font-semibold">
          Weeknights
        </h2>
        <Muted as="p">Every weeknight already has something on it.</Muted>
      </section>
    );
  }
  return (
    <section aria-labelledby="weeknights" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="weeknights" className="text-lg font-semibold">
          Weeknights
        </h2>
        {!choosing && (
          <Muted as="p">
            {source === "planner"
              ? "Swap any you don't fancy, or take a night off."
              : "From your rotation, the ones you haven't had for longest first. Swap any you don't fancy."}
          </Muted>
        )}
      </div>
      {!choosing && source === "rotation" && rotationEmpty && carried.length === 0 && (
        <p className="rounded-lg bg-bg-subtle-hovered p-3 text-sm">
          No recipes are marked Rotation yet, so Swap offers any recipe. Mark your regulars on their pages, or{" "}
          <Link to="/recipes" className="font-medium text-fg-brand underline underline-offset-2">
            find them in Recipes
          </Link>
          .
        </p>
      )}
      <Card className="p-0">
        <ul className="divide-y divide-border-subtle">
          {dates.map((date, index) => {
            const id = nights[index] ?? null;
            const recipe = id === null ? undefined : byId.get(id);
            const off = recipe === undefined;
            const { weekday, day } = dayParts(date);
            return (
              <li key={date} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <span className="w-16 shrink-0">
                  <span className="block text-sm font-semibold">{weekday}</span>
                  <span className="block text-xs text-fg-subtle">{day}</span>
                </span>
                <span className="flex min-w-0 flex-[1_1_10rem] flex-col">
                  <span className={cn("font-medium", (off || choosing) && "text-fg-subtle")}>{choosing ? "Choosing…" : (recipe?.name ?? "Night off")}</span>
                  {recipe && !choosing && (
                    <span className="text-sm text-fg-subtle">{reasons[reasonKey(date, recipe.id)] ?? reasonLabel(nightReason(recipe, carriedIds, today))}</span>
                  )}
                </span>
                <span className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    intent="neutral"
                    size="sm"
                    aria-label={`Swap ${weekday}`}
                    disabled={choosing || pool.length === 0}
                    onClick={() => onChange(swapNight(nights, index, pool))}
                  >
                    Swap
                  </Button>
                  <Toggle
                    variant="outline"
                    size="sm"
                    aria-label={`${weekday} night off`}
                    pressed={off && !choosing}
                    disabled={choosing}
                    onPressedChange={(pressed) => onChange(nights.map((night, i) => (i === index ? (pressed ? null : offerFor(index)) : night)))}
                  >
                    Night off
                  </Toggle>
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
