import { Button } from "@sixthshift/design-system/button";
import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { RecipeLink } from "../../../../components/recipe/RecipeLink";
import { recipeImageUrl } from "../../../../lib/images";
import type { RecipeSummary } from "../../../recipes/recipe";
import { sinceMadeLabel } from "../../home";
import { Photo, PLACEHOLDER, Tile } from "./Tile";

/** A recipe as a short row: its thumbnail, its name, and a line under it. Opens in the side panel. */
function MiniRecipe({ recipe, line }: { recipe: RecipeSummary; line?: string }) {
  return (
    <li>
      <RecipeLink slug={recipe.slug} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-bg-normal-hovered">
        <Photo src={recipeImageUrl(recipe.image)} className="size-11 shrink-0 rounded-lg" />
        <span className="flex min-w-0 flex-col">
          <span className="line-clamp-2 font-medium leading-snug">{recipe.name}</span>
          {line !== undefined && <span className="text-xs text-fg-subtle">{line}</span>}
        </span>
      </RecipeLink>
    </li>
  );
}

/**
 * The rotation's regulars gone longest without being cooked, and how long:
 * what to put back on the week. Nothing that qualifies, nothing drawn.
 */
export function HaventMadeTile({ recipes, today }: { recipes: readonly RecipeSummary[]; today: string }) {
  if (recipes.length === 0) return null;
  return (
    <Tile id="a-while" title="Haven't made in a while" className="row-span-3">
      <ul className="flex flex-col">
        {recipes.map((recipe) => (
          <MiniRecipe key={recipe.id} recipe={recipe} line={sinceMadeLabel(recipe.lastMade, today)} />
        ))}
      </ul>
    </Tile>
  );
}

/**
 * Recipes kept but never cooked, as picture cards in a strip that scrolls
 * sideways and snaps card by card. Nothing to show, nothing drawn.
 */
export function ToTryTile({ recipes }: { recipes: readonly RecipeSummary[] }) {
  if (recipes.length === 0) return null;
  return (
    <Tile id="to-try" title="To try" className="col-span-2 row-span-3">
      <ul className="grid min-h-0 flex-1 snap-x snap-mandatory auto-cols-[minmax(10rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-1">
        {recipes.map((recipe) => {
          const image = recipeImageUrl(recipe.image);
          return (
            <li key={recipe.id} className="min-w-0 snap-start">
              <RecipeLink
                slug={recipe.slug}
                className={cn(
                  "group relative flex h-full items-end overflow-hidden rounded-xl",
                  image === null ? `${PLACEHOLDER} text-fg-normal` : "text-white"
                )}
              >
                {image !== null && (
                  <>
                    <Photo src={image} className="absolute inset-0 size-full transition-transform duration-500 group-hover:scale-105" />
                    <span aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-transparent from-45% to-[rgb(20_12_8/.8)]" />
                  </>
                )}
                <span className="relative line-clamp-3 px-3 py-2.5 font-medium leading-snug">{recipe.name}</span>
              </RecipeLink>
            </li>
          );
        })}
      </ul>
    </Tile>
  );
}

/** The newest recipes in the library, and the way to add another. */
export function RecentlyAddedTile({ recipes }: { recipes: readonly RecipeSummary[] }) {
  return (
    <Tile id="recently-added" title="Recently added" className="row-span-3">
      {recipes.length > 0 && (
        <ul className="flex flex-col">
          {recipes.map((recipe) => (
            <MiniRecipe key={recipe.id} recipe={recipe} />
          ))}
        </ul>
      )}
      <Button asChild variant="outline" intent="neutral" size="sm" className="mt-auto self-start">
        <Link to="/recipes/new">Import a recipe</Link>
      </Button>
    </Tile>
  );
}
