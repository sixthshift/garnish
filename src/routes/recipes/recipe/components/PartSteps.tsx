import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import type { Part } from "../../../../domain/recipe";
import { StepList } from "./StepList";

/**
 * One part's steps in the main column, under the part's name (repeated from
 * the aside so the method reads on its own). A part with ingredients but no
 * steps has nothing to show here — its list is in the aside — so it renders
 * nothing; a part that is genuinely blank says so, as before.
 */
export function PartSteps({ part, recipeId }: { part: Part; recipeId: string }) {
  const name = part.name.trim();
  const hasSteps = part.steps.length > 0;
  if (!hasSteps && part.ingredients.length > 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-label={name === "" ? undefined : name}>
      {name !== "" && <SectionTitle as="h2">{name}</SectionTitle>}
      <EmptyBoundary
        isEmpty={!hasSteps}
        fallback={
          <Muted as="p" className="text-sm" data-empty="part">
            No ingredients or steps yet
          </Muted>
        }
      >
        <StepList recipeId={recipeId} steps={part.steps} ingredients={part.ingredients} partId={part.id} />
      </EmptyBoundary>
    </section>
  );
}
