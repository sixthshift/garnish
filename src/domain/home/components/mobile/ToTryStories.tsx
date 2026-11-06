import { RecipeLink } from "../../../../components/recipe/RecipeLink";
import { recipeImageUrl } from "../../../../lib/images";
import type { RecipeSummary } from "../../../recipes/recipe";
import { Photo } from "../Photo";
import { HomeSectionHead } from "./HomeSectionHead";

/**
 * Recipes kept but never cooked, as a row of circles to flick sideways, each
 * a round photo in a ring with its name under it, the way a phone shows
 * stories: what an import or a share left waiting until someone makes it.
 * Nothing to show, nothing drawn.
 */
export function ToTryStories({ recipes }: { recipes: readonly RecipeSummary[] }) {
  if (recipes.length === 0) return null;
  return (
    <section aria-labelledby="to-try" className="flex flex-col gap-2.5">
      <HomeSectionHead id="to-try" title="To try" />
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {recipes.map((recipe) => (
          <li key={recipe.id} className="w-19 shrink-0 snap-start">
            <RecipeLink slug={recipe.slug} className="flex flex-col items-center gap-1.5 text-center text-xs leading-tight">
              {/* The ring is the brand's teal into the amber accent, as the mockup draws it. */}
              <span aria-hidden="true" className="block size-18 rounded-full bg-[conic-gradient(from_200deg,#2c666c,#4ba5a9,#e3ac35,#2c666c)] p-[3px]">
                <Photo src={recipeImageUrl(recipe.image)} className="size-full rounded-full border-3 border-bg-subtle" />
              </span>
              <span className="line-clamp-2">{recipe.name}</span>
            </RecipeLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
