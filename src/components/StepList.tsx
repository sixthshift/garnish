// The method on the recipe view page. Tapping a step marks it done for this
// session (src/lib/ticks.ts, shared with cook mode): the row dims and its text
// collapses to a single line, so a long method shortens as you work through it
// and the step you are on stays the most prominent thing on screen. Tapping
// again brings it back.
//
// Step text is markdown, rendered through the hand-written safe subset
// (src/domain/markdown.ts) — no raw HTML ever reaches the DOM.
import { cn } from "@sixthshift/design-system/utils";
import { useMemo } from "react";
import type { Ingredient, Step } from "../domain/recipe";
import { useStepTick } from "../lib/ticks";
import { useTimers } from "../lib/timers";
import { Markdown } from "./Markdown";
import { useQuickEditStep } from "./QuickEdit";
import { StepIngredientChips } from "./StepIngredientChips";
import { decorateDurations } from "./TimerChip";

export type StepRowProps = {
  /** The owning recipe's id: ticks.ts keys session state by it. */
  recipeId: string;
  step: Step;
  /** 1-based position within this list, for the number bubble and the screen-reader label. */
  position: number;
  /**
   * The owning part's ingredients. The ones this step names show as chips
   * under it below `md` only (M26.1): from `md` the list is in the aside
   * beside the method, so repeating it under every step is noise.
   */
  ingredients?: Ingredient[];
  /** The owning part's id. Quick edit (M27.5) needs it to find the stored step; without it the row renders no pencil. */
  partId?: string;
};

export function StepRow({ recipeId, step, position, ingredients = [], partId }: StepRowProps) {
  const [done, toggle] = useStepTick(recipeId, step.id);
  // The pencil and its sheet, or nothing outside the recipe page (M27.5).
  const quickEdit = useQuickEditStep(partId, step.id);
  // A decorator per step: it binds this step's id (so each chip's timer has a
  // stable identity) and its text (so the notification at zero says what the
  // timer was for). `find` is read at render, so a running chip repaints with
  // the store's once-a-second tick.
  const { start, find } = useTimers(recipeId);
  const decorateTimers = useMemo(
    () => decorateDurations({ keyPrefix: step.id, label: step.text, onStart: start, timerFor: find }),
    // `find` closes over the current timers, so it changes every tick; that is
    // exactly when the chips have to be rebuilt.
    [step.id, step.text, start, find],
  );

  return (
    <li className="group flex gap-3" data-testid="step-row" data-ticked={done ? "true" : undefined} {...quickEdit.press}>
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          done ? "bg-bg-subtle text-fg-subtle" : "bg-bg-brand-subtle text-fg-brand",
        )}
        aria-hidden="true"
      >
        {position}
      </span>
      <div className="flex flex-1 flex-col gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={done}
          className={cn("text-left", done && "text-fg-subtle opacity-60")}
          data-testid="step-toggle"
        >
          <span className="sr-only">{`Step ${position}. ${done ? "Done. " : ""}`}</span>
          <Markdown source={step.text} className={cn(done && "line-clamp-1")} decorate={decorateTimers} />
        </button>
        {/* A done step collapses to one line; its chips go with it. */}
        {!done && <StepIngredientChips recipeId={recipeId} text={step.text} ingredients={ingredients} className="md:hidden" />}
      </div>
      {quickEdit.node}
    </li>
  );
}

export function StepList({
  recipeId,
  steps,
  ingredients = [],
  partId,
}: {
  recipeId: string;
  steps: Step[];
  /** The owning part's ingredients, matched against each step's text (M26.1). */
  ingredients?: Ingredient[];
  /** The owning part's id, passed to each row for quick edit (M27.5). */
  partId?: string;
}) {
  return (
    <ol className="flex flex-col gap-3" aria-label="Steps">
      {steps.map((step, index) => (
        <StepRow key={step.id} recipeId={recipeId} step={step} position={index + 1} ingredients={ingredients} partId={partId} />
      ))}
    </ol>
  );
}
