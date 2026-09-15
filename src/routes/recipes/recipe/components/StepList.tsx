import type { Ingredient, Step } from "../../../../domain/recipe";
import { StepCard } from "./StepCard";

export function StepList({
  recipeId,
  steps,
  ingredients = [],
  partId,
}: {
  recipeId: string;
  steps: Step[];
  /** The owning part's ingredients: each card shows the ones its step links. */
  ingredients?: Ingredient[];
  /** The owning part's id, passed to each card for quick edit. */
  partId?: string;
}) {
  return (
    <ol className="flex flex-col gap-3" aria-label="Steps">
      {steps.map((step, index) => (
        <StepCard key={step.id} recipeId={recipeId} step={step} position={index + 1} ingredients={ingredients} partId={partId} />
      ))}
    </ol>
  );
}
