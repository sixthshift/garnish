import type { ReactNode } from "react";
import type { Recipe } from "../../../recipe";
import { SCROLL_COLUMN } from "../../desktop/scrollColumn";
import { StepLinksProvider } from "../../recipe/StepLinks";

/**
 * A desktop's recipe while it is cooked from (decisions.md row 214): the
 * spread without its left page — the ingredients, the method at its reading
 * measure, and a third column for what is said while cooking — each a screen
 * tall under the cooking header and scrolling on its own.
 */
export function CookingSpread({ recipe, ingredients, method, side }: { recipe: Recipe; ingredients: ReactNode; method: ReactNode; side: ReactNode }) {
  return (
    <article data-testid="cooking-spread">
      <StepLinksProvider recipe={recipe}>
        <div className="grid h-[calc(100dvh-3.5rem)] grid-cols-[minmax(17.5rem,0.75fr)_minmax(25rem,1.3fr)_minmax(20rem,0.8fr)]" data-testid="recipe-columns">
          <aside
            className={`${SCROLL_COLUMN} flex flex-col gap-4 border-r border-border-subtle bg-bg-normal p-6`}
            data-testid="ingredients-column"
            data-print="keep"
          >
            {ingredients}
          </aside>
          <div className={`${SCROLL_COLUMN} p-6 px-8`} data-testid="method-column">
            <div className="flex max-w-[62ch] flex-col gap-6 pb-24">{method}</div>
          </div>
          <aside className={`${SCROLL_COLUMN} flex flex-col border-l border-border-subtle bg-bg-normal`} data-testid="cooking-side" aria-label="While you cook">
            {side}
          </aside>
        </div>
      </StepLinksProvider>
    </article>
  );
}
