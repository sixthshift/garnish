import { cn } from "@sixthshift/design-system/utils";
import { useMemo } from "react";
import { Markdown } from "../../../../components/ui/Markdown";
import { durationsIn, type Ingredient, type Step } from "../../../../domain/recipe";
import { stepImageUrl } from "../../../../lib/images";
import { useStepTick } from "../../../../lib/useTicks";
import { chipTimerId } from "../../../../lib/timers";
import { useTimers } from "../../../../lib/useTimers";
import { IngredientRow } from "./IngredientRow";
import { TimerChip } from "./TimerChip";
import { useQuickEditStep } from "./useQuickEdit";

/** How big the card reads: `page` on the recipe page, `cook` on the cook deck. */
export type StepCardSize = "page" | "cook";

const SCALE: Record<StepCardSize, { bubble: string; text: string; ingredients: string; image: string }> = {
  page: { bubble: "size-6 text-xs", text: "", ingredients: "text-sm", image: "max-h-48" },
  cook: { bubble: "size-8 text-sm", text: "text-3xl leading-snug", ingredients: "text-lg", image: "max-h-80" },
};

export type StepCardProps = {
  /** The owning recipe's id: ticks.ts and timers.ts key session state by it. */
  recipeId: string;
  step: Step;
  /** 1-based position within its part, for the number bubble and the screen-reader label. */
  position: number;
  /** The owning part's ingredients — the only rows a link may name. */
  ingredients?: Ingredient[];
  /** The type scale. Defaults to the page's. */
  size?: StepCardSize;
  /** The owning part's id. Quick edit needs it to find the stored step; without it the card renders no pencil. */
  partId?: string;
  /**
   * The parent recipe's slug, cook mode only: forwarded to each linked
   * row so a sub-recipe ingredient offers a link into the child's own cook
   * mode instead of the plain "Make N servings" hint. Absent on the recipe page.
   */
  cookFrom?: string;
};

export function StepCard({ recipeId, step, position, ingredients = [], size = "page", partId, cookFrom }: StepCardProps) {
  const [done, toggle] = useStepTick(recipeId, step.id);
  // The corner "…" menu and its sheet, or nothing outside the recipe page.
  const quickEdit = useQuickEditStep(partId, step.id);
  // `find` closes over the current timers, so it changes on every second's
  // tick; that is exactly when a running chip has to repaint.
  const { start, find } = useTimers(recipeId);
  const rows = useMemo(() => linkedIngredients(step, ingredients), [step, ingredients]);
  const durations = useMemo(() => stepDurations(step.text), [step.text]);
  // The step's photo, above its text at both sizes. A ticked step
  // collapses to one line, so its photo goes with the rest of the detail.
  const photo = stepImageUrl(step.image);
  const scale = SCALE[size];
  // Two columns from `md` only when there is a list to put in the first one.
  const columns = rows.length > 0 && !done;

  return (
    <li
      className={cn("group rounded-xl border border-border-normal p-4", done && "opacity-60")}
      data-testid="step-card"
      data-size={size}
      data-ticked={done ? "true" : undefined}
    >
      <div className="flex gap-3">
        <span
          className={cn(
            "mt-0.5 flex shrink-0 items-center justify-center rounded-full font-semibold",
            scale.bubble,
            done ? "bg-bg-subtle text-fg-subtle" : "bg-bg-brand-subtle text-fg-brand"
          )}
          aria-hidden="true"
        >
          {position}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className={cn("flex flex-col gap-3", columns && "md:grid md:grid-cols-3 md:items-start md:gap-4")}>
            {columns && (
              <ul className={cn("flex flex-col gap-2 md:col-span-1", scale.ingredients)} aria-label="Ingredients for this step" data-testid="step-ingredients">
                {rows.map((ingredient) => (
                  <IngredientRow key={ingredient.id} recipeId={recipeId} ingredient={ingredient} cookFrom={cookFrom} />
                ))}
              </ul>
            )}
            <div className={cn("flex flex-col gap-2", columns && "md:col-span-2")}>
              {photo !== null && !done && (
                <img
                  src={photo}
                  alt={`Step ${position}`}
                  loading="lazy"
                  className={cn("w-full rounded-lg object-cover", scale.image)}
                  data-testid="step-image"
                />
              )}
              <button type="button" onClick={toggle} aria-pressed={done} className={cn("text-left", done && "text-fg-subtle")} data-testid="step-toggle">
                <span className="sr-only">{`Step ${position}. ${done ? "Done. " : ""}`}</span>
                <Markdown source={step.text} className={cn(scale.text, done && "line-clamp-1")} />
              </button>
            </div>
          </div>
          {/* The footer stays on a ticked step: a running timer has to be reachable after its step is done. */}
          {durations.length > 0 && (
            <div className="flex flex-wrap gap-2" data-testid="step-timers">
              {durations.map((duration) => {
                const id = chipTimerId(step.id, duration.start, duration.text);
                return (
                  <TimerChip
                    key={id}
                    seconds={duration.seconds}
                    upperSeconds={duration.upperSeconds}
                    label={duration.text}
                    timer={find(id)}
                    // The strip and the notification at zero name the step, not the duration.
                    onStart={(seconds, matched) => start({ id, label: step.text.trim() || matched, seconds })}
                  />
                );
              })}
            </div>
          )}
        </div>
        {quickEdit}
      </div>
    </li>
  );
}

/**
 * The rows a step links, in link order, resolved against the part it belongs
 * to. An id with no row in the part — a stale link, or a part passed without
 * its rows — is skipped rather than rendered as a hole. Pure.
 */
export function linkedIngredients(step: Pick<Step, "ingredientIds">, ingredients: Ingredient[]): Ingredient[] {
  if (step.ingredientIds.length === 0 || ingredients.length === 0) return [];
  const byId = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  return step.ingredientIds.flatMap((id) => {
    const row = byId.get(id);
    return row === undefined ? [] : [row];
  });
}

/** What the footer shows: every duration in `text`, first occurrence only per length. Pure. */
export function stepDurations(text: string): ReturnType<typeof durationsIn> {
  const seen = new Set<number>();
  return durationsIn(text).filter((duration) => {
    if (seen.has(duration.seconds)) return false;
    seen.add(duration.seconds);
    return true;
  });
}
