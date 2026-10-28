import { Button } from "@sixthshift/design-system/button";
import { cardVariants } from "@sixthshift/design-system/card";
import { Muted } from "@sixthshift/design-system/muted";
import { cn } from "@sixthshift/design-system/utils";
import { useState } from "react";
import { formatDuration } from "../../../../domain/ingredient";
import { dayName, dayParts } from "../../../../domain/plan";
import type { RecipeSummary } from "../../../../domain/recipe";
import { recipeImageUrl } from "../../../../lib/images";

/**
 * The open weekend days and what to cook on them: pick a day, then a recipe
 * from the shelf (the weekend recipes, then the ones never made). Picking
 * fills the chosen day and moves on to the next empty one; the day's own
 * button picks it again, and Leave empty clears it.
 */
export function WeekendStep({
  dates,
  chosen,
  shelf,
  onChange,
}: {
  dates: readonly string[];
  chosen: readonly (string | null)[];
  shelf: readonly RecipeSummary[];
  onChange: (chosen: (string | null)[]) => void;
}) {
  const [slot, setSlot] = useState(0);
  const byId = new Map(shelf.map((recipe) => [recipe.id, recipe]));

  if (dates.length === 0) {
    return (
      <section aria-labelledby="weekend" className="flex flex-col gap-2">
        <h2 id="weekend" className="text-lg font-semibold">
          The weekend
        </h2>
        <Muted as="p">The weekend already has something on it.</Muted>
      </section>
    );
  }

  const pick = (id: string | null) => {
    const next = chosen.map((current, i) => (i === slot ? id : current));
    onChange(next);
    const empty = next.findIndex((current, i) => i > slot && current === null);
    if (id !== null && empty !== -1) setSlot(empty);
  };

  return (
    <section aria-labelledby="weekend" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="weekend" className="text-lg font-semibold">
          The weekend
        </h2>
        <Muted as="p">More time, so something worth it. Choose a day, then a recipe.</Muted>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {dates.map((date, index) => {
          const recipe = chosen[index] ? byId.get(chosen[index]) : undefined;
          const selected = index === slot;
          return (
            <button
              key={date}
              type="button"
              aria-pressed={selected}
              aria-label={`${dayName(date)}: ${recipe?.name ?? "nothing yet"}`}
              onClick={() => setSlot(index)}
              className={cn(
                cardVariants({ interactive: true }),
                "flex min-h-24 flex-col items-start gap-1 p-4 text-left",
                selected && "ring-2 ring-border-strong"
              )}
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">{dayParts(date).weekday}</span>
              <span className={cn("font-medium", !recipe && "text-fg-subtle")}>{recipe?.name ?? "Choose below"}</span>
            </button>
          );
        })}
      </div>
      {shelf.length === 0 ? (
        <Muted as="p">No recipes are marked Weekend yet, and none are waiting to be tried.</Muted>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {shelf.map((recipe) => {
            const image = recipeImageUrl(recipe.image);
            const taken = chosen.includes(recipe.id);
            return (
              <li key={recipe.id}>
                <button
                  type="button"
                  onClick={() => pick(recipe.id)}
                  aria-pressed={taken}
                  className={cn(
                    cardVariants({ interactive: true }),
                    "flex h-full w-full flex-col overflow-hidden p-0 text-left",
                    taken && "ring-2 ring-border-brand"
                  )}
                >
                  {image ? (
                    <img src={image} alt="" loading="lazy" className="aspect-[3/2] w-full object-cover" />
                  ) : (
                    <span aria-hidden="true" className="aspect-[3/2] w-full bg-bg-subtle" />
                  )}
                  <span className="flex flex-col gap-0.5 p-3">
                    <span className="font-medium leading-snug">{recipe.name}</span>
                    <span className="text-sm text-fg-subtle">
                      {[recipe.totalTime !== null ? formatDuration(recipe.totalTime) : null, recipe.lastMade === null ? "To try" : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Button type="button" variant="outline" intent="neutral" className="self-start" onClick={() => pick(null)}>
        Leave {dayParts(dates[slot] ?? dates[0] ?? "").weekday} empty
      </Button>
    </section>
  );
}
