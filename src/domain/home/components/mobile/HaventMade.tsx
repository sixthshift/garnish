import { Card } from "@sixthshift/design-system/card";
import { RecipeLink } from "../../../../components/recipe/RecipeLink";
import { recipeImageUrl } from "../../../../lib/images";
import type { RecipeSummary } from "../../../recipes/recipe";
import { sinceMadeLabel } from "../../home";
import { Photo } from "../Photo";
import { HomeSectionHead } from "./HomeSectionHead";

/**
 * The rotation's regulars gone longest without being cooked (`longestSinceMade`),
 * each with how long ago: what to put back on the week. One card, a row a
 * recipe, each opening the recipe's page. Nothing that qualifies, nothing drawn.
 */
export function HaventMade({ recipes, today }: { recipes: readonly RecipeSummary[]; today: string }) {
  if (recipes.length === 0) return null;
  return (
    <section aria-labelledby="a-while" className="flex flex-col gap-2.5">
      <HomeSectionHead id="a-while" title="Haven't made in a while" />
      <Card size="xs" className="rounded-xl px-3.5 py-0.5">
        <ul className="flex flex-col divide-y divide-border-subtle">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <RecipeLink slug={recipe.slug} className="flex min-h-11 items-center gap-3 py-2.5">
                <Photo src={recipeImageUrl(recipe.image)} className="size-11.5 shrink-0 rounded-xl" />
                <span className="flex min-w-0 flex-col">
                  <span className="line-clamp-2 font-medium leading-snug">{recipe.name}</span>
                  <span className="text-xs text-fg-subtle">{sinceMadeLabel(recipe.lastMade, today)}</span>
                </span>
              </RecipeLink>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
