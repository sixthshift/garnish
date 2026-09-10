// The method on the recipe view page. Tapping a step marks it done for this
// session (src/lib/ticks.ts, shared with cook mode): the row dims and its text
// collapses to a single line, so a long method shortens as you work through it
// and the step you are on stays the most prominent thing on screen. Tapping
// again brings it back.
//
// Step text is markdown, rendered through the hand-written safe subset
// (src/domain/markdown.ts) — no raw HTML ever reaches the DOM.
import { cn } from "@sixthshift/design-system/utils";
import type { Step } from "../domain/recipe";
import { useStepTick } from "../lib/ticks";
import { Markdown } from "./Markdown";

export type StepRowProps = {
  /** The owning recipe's id: ticks.ts keys session state by it. */
  recipeId: string;
  step: Step;
  /** 1-based position within this list, for the number bubble and the screen-reader label. */
  position: number;
};

export function StepRow({ recipeId, step, position }: StepRowProps) {
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
      <button
        type="button"
        onClick={toggle}
        aria-pressed={done}
        className={cn("flex-1 text-left", done && "text-fg-subtle opacity-60")}
        data-testid="step-toggle"
      >
        <span className="sr-only">{`Step ${position}. ${done ? "Done. " : ""}`}</span>
        <Markdown source={step.text} className={cn(done && "line-clamp-1")} />
      </button>
    </li>
  );
}

export function StepList({ recipeId, steps }: { recipeId: string; steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-3" aria-label="Steps">
      {steps.map((step, index) => (
        <StepRow key={step.id} recipeId={recipeId} step={step} position={index + 1} />
      ))}
    </ol>
  );
}
