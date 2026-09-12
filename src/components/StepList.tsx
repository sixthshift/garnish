// The method on the recipe view page: one `StepCard` per step, in order. The
// card is the whole of a step's presentation (src/components/StepCard.tsx) and
// cook mode deals the same one in bigger type, so this list is only the
// ordering and the part's rows the cards resolve their links against.
import type { Ingredient, Step } from "../domain/recipe";
import { StepCard } from "./StepCard";

export function StepList({
  recipeId,
  steps,
  ingredients = [],
  partId,
}: {
  recipeId: string;
  steps: Step[];
  /** The owning part's ingredients: each card shows the ones its step links (M28.1). */
  ingredients?: Ingredient[];
  /** The owning part's id, passed to each card for quick edit (M27.5). */
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
