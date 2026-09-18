import type { Ingredient, Step } from "../../../../domain/recipe";
import { linkedIngredients, StepCard } from "./StepCard";

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
  // One answer for the whole list: if any step links a row, every card reserves
  // the gutter, so the method has one left edge instead of stepping in and out
  // by a third of the column as steps happen to have links or not.
  const gutter = steps.some((step) => linkedIngredients(step, ingredients).length > 0);

  return (
    <ol className="flex flex-col gap-3" aria-label="Steps">
      {steps.map((step, index) => (
        <StepCard key={step.id} recipeId={recipeId} step={step} position={index + 1} ingredients={ingredients} partId={partId} gutter={gutter} />
      ))}
    </ol>
  );
}
