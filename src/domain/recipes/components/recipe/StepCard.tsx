import { cardVariants } from "@sixthshift/design-system/card";
import { cn } from "@sixthshift/design-system/utils";
import { useMemo } from "react";
import { Markdown } from "../../../../components/ui/Markdown";
import { stepImageUrl } from "../../../../lib/images";
import { chipTimerId } from "../../../../lib/timers";
import { useStepTick } from "../../../../lib/useTicks";
import { useTimers } from "../../../../lib/useTimers";
import { durationsIn, type Ingredient, type Step } from "../../recipe";
import { timerAgainNote, useCooking } from "../cooking/CookingContext";
import { TonightMark } from "../cooking/TonightMark";
import { IngredientRow } from "./IngredientRow";
import { LIT, useStepLink } from "./StepLinks";
import { TimerChip } from "./TimerChip";
import { useQuickEditStep } from "./useQuickEdit";

export type StepCardProps = {
  /** The owning recipe's id: ticks.ts and timers.ts key session state by it. */
  recipeId: string;
  step: Step;
  /** 1-based position within its part, for the number bubble and the screen-reader label. */
  position: number;
  /** The owning part's ingredients — the only rows a link may name. */
  ingredients?: Ingredient[];
  /** The owning part's id. Quick edit needs it to find the stored step; without it the card renders no pencil. */
  partId?: string;
};

export function StepCard({ recipeId, step, position, ingredients = [], partId }: StepCardProps) {
  const [done, toggle] = useStepTick(recipeId, step.id);
  // While the page is cooked from (decisions.md row 214): the first step not
  // ticked is the one being cooked, and a step tonight has changed says so.
  const cooking = useCooking();
  const now = cooking !== null && cooking.nowStepId === step.id;
  const mark = cooking?.marks.get(step.id);
  // The corner "…" menu and its sheet, or nothing outside the recipe page.
  const quickEdit = useQuickEditStep(partId, step.id);
  // Lit or dimmed by the ingredient pointed at, on a desktop's recipe (StepLinks.tsx).
  const link = useStepLink(step.id);
  // `find` closes over the current timers, so it changes on every second's
  // tick; that is exactly when a running chip has to repaint.
  const { start, pause, resume, find } = useTimers(recipeId);
  const rows = useMemo(() => linkedIngredients(step, ingredients), [step, ingredients]);
  const durations = useMemo(() => stepDurations(step.text), [step.text]);
  // The step's photo, above its text. A ticked step
  // collapses to one line, so its photo goes with the rest of the detail.
  const photo = stepImageUrl(step.image);
  const label = step.title.trim();
  const support = step.summary.trim();
  // A ticked step collapses to one line, so its rows go with the rest of the detail.
  const showRows = rows.length > 0 && !done;
  // The rows sit above the text at every width, so every step's text starts
  // at the same x and runs the card's width; a gutter beside it either went
  // empty on the steps that link nothing or squeezed the text to a few words a
  // line at `md` (critique #13).

  return (
    <li
      // `cardVariants` rather than the primitive: decision 66 keeps a step in a
      // card, but Card renders a `<div>` and a step is an `<li>` in its part's
      // list. Borrowing the recipe keeps the surface identical to every other
      // card — including the `bg-bg-normal` that now lifts it off the base page
      // — without restating the treatment here, where it would drift.
      className={cn(
        cardVariants({ size: "md" }),
        "group/quick-edit",
        done && "opacity-60",
        now && "border-border-brand shadow-[inset_4px_0_0_var(--bg-brand)]",
        link.linking && "transition-[background-color,opacity]",
        link.state === "lit" && LIT,
        link.state === "dim" && "opacity-35"
      )}
      {...link.props}
      data-lit={link.state ?? undefined}
      data-testid="step-card"
      data-ticked={done ? "true" : undefined}
      data-now={now ? "true" : undefined}
      aria-current={now ? "step" : undefined}
    >
      <div className="flex gap-3">
        {
          <span
            className={cn(
              "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              // Neutral: a step number is not an action, so it takes no brand (rule 5).
              done ? "bg-bg-subtle text-fg-subtle" : "bg-bg-subtle-pressed text-fg-normal"
            )}
            aria-hidden="true"
          >
            {position}
          </span>
        }
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-3">
            {showRows && (
              <ul className="flex flex-col gap-2 text-sm" aria-label="Ingredients for this step" data-testid="step-ingredients">
                {rows.map((ingredient) => (
                  <IngredientRow key={ingredient.id} recipeId={recipeId} ingredient={ingredient} />
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2">
              {photo !== null && !done && (
                <img src={photo} alt={`Step ${position}`} loading="lazy" className="max-h-48 w-full rounded-lg object-cover" data-testid="step-image" />
              )}
              <button type="button" onClick={toggle} aria-pressed={done} className={cn("text-left", done && "text-fg-subtle")} data-testid="step-toggle">
                <span className="sr-only">{`Step ${position}. ${done ? "Done. " : ""}`}</span>
                {now && (
                  <span className="block text-xs font-semibold tracking-wide text-fg-brand uppercase" data-testid="step-now">
                    Now
                  </span>
                )}
                {/* The label reads as the step's heading, so it sits inside the
                    toggle rather than above it: tapping the words that name the
                    step is the same gesture as tapping the step. */}
                {label !== "" && !done && (
                  <span className="block text-sm font-semibold text-fg-strong" data-testid="step-title">
                    {label}
                  </span>
                )}
                <Markdown source={step.text} className={cn(done && "line-clamp-1")} />
                {mark !== undefined && !done && <TonightMark mark={mark} />}
              </button>
              {/* The supporting line is not an instruction — recovery, reassurance,
                  why a time is a range — so it reads quieter and outside the toggle,
                  and a ticked step gives it back with the rest of the detail. */}
              {support !== "" && !done && (
                <div className="text-sm text-fg-subtle" data-testid="step-summary">
                  <Markdown source={support} />
                </div>
              )}
            </div>
          </div>
          {/* The footer stays on a ticked step: a running timer has to be reachable after its step is done. */}
          {durations.length > 0 && (
            <div className="flex flex-wrap gap-2" data-testid="step-timers">
              {durations.map((duration) => {
                const id = chipTimerId(step.id, duration.start, duration.text);
                const timer = find(id);
                return (
                  <TimerChip
                    key={id}
                    seconds={duration.seconds}
                    upperSeconds={duration.upperSeconds}
                    label={duration.text}
                    timer={timer && { text: timer.text, done: timer.done, paused: !timer.done && timer.endsAt === null }}
                    // The strip and the notification at zero name the step, not the duration.
                    onStart={(seconds, matched) => {
                      // Run again once done, while cooking: evidence the step's time is short, kept for the review (row 214).
                      if (timer?.done) cooking?.noteTimer?.(timerAgainNote(position, duration.text, step.text));
                      start({ id, label: step.text.trim() || matched, seconds });
                    }}
                    onPause={() => pause(id)}
                    onResume={() => resume(id)}
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
