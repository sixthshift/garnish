import { cn } from "@sixthshift/design-system/utils";
import type { ReactNode } from "react";
import { recipeImageUrl } from "../../../../lib/images";
import type { Recipe } from "../../recipe";
import { StepLinksProvider } from "../recipe/StepLinks";

export type RecipeSpreadProps = {
  recipe: Recipe;
  /** The name, the facts, the actions and the tags: the left page under the photo. */
  header: ReactNode;
  /** The ingredients heading, its servings and the lists. */
  ingredients: ReactNode;
  /** The steps, part by part, and what follows them (Made this). */
  method: ReactNode;
  /** The recipe's notes, or nothing when it has none. */
  notes: ReactNode;
  /** The logged cooks and the source, added and updated line. */
  history: ReactNode;
};

/** A column that scrolls on its own once the spread is a screen tall; under that the page scrolls them together. */
const OWN_SCROLL = "desktop:@min-[1250px]/spread:min-h-0 desktop:@min-[1250px]/spread:overflow-y-auto";

/**
 * A desktop's recipe page as a cookbook spread (decisions.md row 207): the
 * photo and the story on the left page, then the ingredients, then the method
 * at a reading measure, each a screen tall and scrolling on its own, so the
 * list stays beside whichever step is being read. From about 1800px the notes
 * and the history take a fourth column; under that they follow the method.
 * Under about 1250px the left page goes across the top, the photo beside its
 * words, and the ingredients and method sit side by side below it. The page's
 * own width decides (a container, not the screen), so the side panel opening
 * beside it moves it down a size. A step lights up its ingredients and an
 * ingredient its steps (StepLinks.tsx).
 *
 * Every layout class is the `desktop:` variant's, which a printout does not
 * take: on paper the spread is one column, as the phone's page prints.
 */
export function RecipeSpread({ recipe, header, ingredients, method, notes, history }: RecipeSpreadProps) {
  const src = recipeImageUrl(recipe.image);
  return (
    <article className="@container/spread" data-testid="recipe-spread">
      <StepLinksProvider recipe={recipe}>
        <div
          className={cn(
            "flex flex-col",
            "desktop:grid desktop:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]",
            "desktop:@min-[1250px]/spread:h-[calc(100dvh-var(--top-bar))] desktop:@min-[1250px]/spread:grid-cols-[minmax(21rem,0.95fr)_minmax(17.5rem,0.75fr)_minmax(25rem,1.3fr)]",
            "desktop:@min-[1800px]/spread:grid-cols-[minmax(23rem,0.9fr)_minmax(19rem,0.7fr)_minmax(29rem,1.2fr)_minmax(20rem,0.6fr)]"
          )}
          data-testid="recipe-columns"
        >
          {/* The left page. Across the top under 1250px, the photo beside the words; a column of its own above. */}
          <div
            data-split=""
            className={cn(
              "flex flex-col bg-bg-normal",
              "desktop:col-span-full desktop:flex-row desktop:border-b desktop:border-border-subtle",
              "desktop:@min-[1250px]/spread:col-span-1 desktop:@min-[1250px]/spread:flex-col desktop:@min-[1250px]/spread:border-r desktop:@min-[1250px]/spread:border-b-0",
              OWN_SCROLL
            )}
            data-testid="left-page"
          >
            {src !== null && (
              <img
                src={src}
                alt=""
                className={cn(
                  "w-full object-cover",
                  "desktop:min-h-80 desktop:w-[42%] desktop:shrink-0",
                  "desktop:@min-[1250px]/spread:min-h-64 desktop:@min-[1250px]/spread:w-full desktop:@min-[1250px]/spread:flex-[1_1_45%]"
                )}
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-4 p-6 desktop:@min-[1250px]/spread:flex-none">{header}</div>
          </div>

          <aside
            data-testid="ingredients-column"
            data-print="keep"
            className={cn("flex flex-col gap-4 p-6 desktop:border-r desktop:border-border-subtle", OWN_SCROLL)}
          >
            {ingredients}
          </aside>

          {/* Under 1800px the notes and the history follow the method in its
              column; from there this wrapper steps aside (`contents`) and they
              are a fourth column of their own, without being drawn twice. */}
          <div className={cn("flex flex-col", OWN_SCROLL, "desktop:@min-[1800px]/spread:contents")} data-testid="method-and-notes">
            <div
              className={cn(
                "flex flex-col gap-6 p-6 desktop:@min-[1250px]/spread:px-8",
                "desktop:@min-[1800px]/spread:min-h-0 desktop:@min-[1800px]/spread:overflow-y-auto"
              )}
              data-testid="method-column"
            >
              {/* A reading measure, however wide the column (row 207). */}
              <div className="flex max-w-[62ch] flex-col gap-6">{method}</div>
            </div>
            <div
              className={cn(
                "flex flex-col gap-6 p-6",
                "desktop:@min-[1250px]/spread:px-8",
                "desktop:@min-[1800px]/spread:min-h-0 desktop:@min-[1800px]/spread:overflow-y-auto desktop:@min-[1800px]/spread:border-l desktop:@min-[1800px]/spread:border-border-subtle desktop:@min-[1800px]/spread:bg-bg-normal desktop:@min-[1800px]/spread:px-6"
              )}
              data-testid="notes-column"
            >
              <div className="flex max-w-[62ch] flex-col gap-6">
                {notes}
                {history}
              </div>
            </div>
          </div>
        </div>
      </StepLinksProvider>
    </article>
  );
}
