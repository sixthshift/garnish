import { RecipeLink } from "../../../../../components/recipe/RecipeLink";
import { FavouriteButton } from "../../../../../components/ui/FavouriteButton";
import { recipeImageUrl } from "../../../../../lib/images";
import { formatDuration } from "../../../ingredient";
import type { RecipeSummary } from "../../../recipe";
import { KindToggle } from "../../KindToggle";
import { ImagePlaceholder } from "../RecipeCard";

/** Cards whose photo is fetched at once: the first two rows fill a phone's first screen. */
const PRIORITY_CARDS = 4;

/**
 * A phone's library as two columns of photos (decisions.md row 208): each
 * card the photo cut 4:5, the name over a dark fade at its foot, the time in
 * its top-left corner and the heart in its top-right. The grid is the phone's
 * only view: the list view mode is a desktop's now, since the photo is what a
 * hand picks a dinner by and two columns already show six or more at once.
 * From `sm` (an iPad upright, a phone sideways) the columns fill in about
 * 13rem each, three or four, rather than two cards half a screen tall.
 */
export function PhotoGrid({ recipes, marking }: { recipes: readonly RecipeSummary[]; marking: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]" aria-label="Recipes" data-testid="photo-grid">
      {recipes.map((recipe, index) => (
        <li key={recipe.id} className="flex flex-col gap-2">
          <PhotoCard recipe={recipe} priority={index < PRIORITY_CARDS} />
          {marking && <KindToggle id={recipe.id} kind={recipe.kind} label={`How you cook ${recipe.name}`} />}
        </li>
      ))}
    </ul>
  );
}

function PhotoCard({ recipe, priority }: { recipe: RecipeSummary; priority: boolean }) {
  const src = recipeImageUrl(recipe.image);
  const time = formatDuration(recipe.totalTime);
  return (
    <div className="relative" data-testid="photo-card">
      <RecipeLink
        slug={recipe.slug}
        className="relative flex aspect-4/5 items-end overflow-hidden rounded-[1.125rem] bg-bg-subtle-pressed text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
      >
        {src !== null ? (
          <img
            src={src}
            alt=""
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <ImagePlaceholder className="absolute inset-0 bg-bg-subtle-pressed" />
        )}
        {/* The fade the name is read over: clear at the top, dark at the foot. */}
        <span aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-transparent from-45% to-black/80" />
        {/* The name first, so a screen reader hears the dish before its time. */}
        <span className="relative line-clamp-3 px-2.5 py-2.5 text-sm font-semibold leading-snug">{recipe.name}</span>
        {time !== "" && (
          <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-semibold tabular-nums backdrop-blur-sm">{time}</span>
        )}
      </RecipeLink>
      {/* A sibling of the link, not a child: a button inside a link is invalid. 44px to tap. */}
      <FavouriteButton
        id={recipe.id}
        favourite={recipe.favourite}
        className="absolute top-1 right-1 size-11 rounded-full bg-transparent hover:bg-transparent [&>svg]:box-content [&>svg]:rounded-full [&>svg]:bg-bg-normal/85 [&>svg]:p-1.5 [&>svg]:backdrop-blur-sm"
      />
    </div>
  );
}
