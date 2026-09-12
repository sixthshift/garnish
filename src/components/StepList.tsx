// The method on the recipe view page. Tapping a step marks it done for this
// session (src/lib/ticks.ts, shared with cook mode): the row dims and its text
// collapses to a single line, so a long method shortens as you work through it
// and the step you are on stays the most prominent thing on screen. Tapping
// again brings it back.
//
// Step text is markdown, rendered through the hand-written safe subset
// (src/domain/markdown.ts) — no raw HTML ever reaches the DOM.
import { cn } from "@sixthshift/design-system/utils";
import type { Ingredient, Step } from "../domain/recipe";
import { useStepTick } from "../lib/ticks";
import { Markdown } from "./Markdown";
import { StepIngredientChips } from "./StepIngredientChips";
import { decorateDurations } from "./TimerChip";

// One decorator, reused across every step row: it carries no per-step state,
// only the (absent, until M26.3) onStart callback.
const decorateTimers = decorateDurations();

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
};

export function StepRow({ recipeId, step, position, ingredients = [] }: StepRowProps) {
  const [done, toggle] = useStepTick(recipeId, step.id);

  return (
    <li className="flex gap-3" data-testid="step-row" data-ticked={done ? "true" : undefined}>
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
    </li>
  );
}

export function StepList({
  recipeId,
  steps,
  ingredients = [],
}: {
  recipeId: string;
  steps: Step[];
  /** The owning part's ingredients, matched against each step's text (M26.1). */
  ingredients?: Ingredient[];
}) {
  return (
    <ol className="flex flex-col gap-3" aria-label="Steps">
      {steps.map((step, index) => (
        <StepRow key={step.id} recipeId={recipeId} step={step} position={index + 1} ingredients={ingredients} />
      ))}
    </ol>
  );
}
