import { cn } from "@sixthshift/design-system/utils";
import { RecipeLink } from "../../../../../components/recipe/RecipeLink";
import { FavouriteButton } from "../../../../../components/ui/FavouriteButton";
import { recipeImageUrl } from "../../../../../lib/images";
import { formatDuration } from "../../../ingredient";
import type { RecipeSummary } from "../../../recipe";
import { capTags, ImagePlaceholder } from "../RecipeCard";

/**
 * The shapes a wall's photos are cut to, so the columns stagger like a pinned
 * board rather than lining up as a grid. Which one a recipe gets is fixed by
 * its id, not its place, so a card keeps its shape whatever the filter.
 */
const SHAPES = ["4 / 5", "1 / 1", "3 / 4", "4 / 3", "5 / 6", "1 / 1.15"] as const;

/** The shape a recipe's photo is cut to on the wall: a small hash of its id into `SHAPES`. Pure. */
export function wallShape(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return SHAPES[hash % SHAPES.length]!;
}

export type PhotoWallProps = {
  recipes: readonly RecipeSummary[];
  /** The recipe open in the side panel: its card is outlined. */
  selected: string | undefined;
  /** Cards whose image is fetched at once rather than lazily: the first row. */
  priority: number;
};

/**
 * A desktop's library as a wall of photos (decisions.md row 207): columns
 * about 220px wide, as many as the width holds, each card the photo with its
 * time on it and the heart, then the name and its first tags. A card opens the
 * recipe in the side panel (RecipeLink), the third pane, and stays outlined
 * while it is open there. Reading order is down each column, which is also the
 * order the arrow keys flip through.
 */
export function PhotoWall({ recipes, selected, priority }: PhotoWallProps) {
  return (
    <ul className="columns-[13.75rem] gap-4" aria-label="Recipes" data-testid="photo-wall">
      {recipes.map((recipe, index) => (
        <li key={recipe.id} className="mb-5 break-inside-avoid">
          <WallCard recipe={recipe} selected={recipe.slug === selected} priority={index < priority} />
        </li>
      ))}
    </ul>
  );
}

function WallCard({ recipe, selected, priority }: { recipe: RecipeSummary; selected: boolean; priority: boolean }) {
  const src = recipeImageUrl(recipe.image);
  const time = formatDuration(recipe.totalTime);
  const { shown, more } = capTags(recipe.tags);
  const tagLine = [...shown.map((tag) => tag.name), ...(more > 0 ? [`+${more}`] : [])].join(" · ");

  return (
    <div className="group relative" data-wall-slug={recipe.slug} data-selected={selected ? "true" : undefined}>
      <RecipeLink slug={recipe.slug} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-brand">
        <div
          className={cn(
            "relative overflow-hidden rounded-xl bg-bg-subtle-pressed transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md",
            // Selected is the neutral strong edge, not brand (design-language rule 5): brand is the focus ring's.
            selected && "outline-3 outline-offset-3 outline-fg-normal"
          )}
          style={{ aspectRatio: wallShape(recipe.id) }}
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
          {time !== "" && (
            <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm tabular-nums">
              {time}
            </span>
          )}
        </div>
        <span className="mx-0.5 mt-2 block font-medium leading-snug text-fg-strong group-hover:underline">{recipe.name}</span>
        {tagLine !== "" && <span className="mx-0.5 mt-0.5 block text-xs text-fg-subtle">{tagLine}</span>}
      </RecipeLink>
      {/* A sibling of the link, not a child: a button inside a link is invalid. */}
      <FavouriteButton id={recipe.id} favourite={recipe.favourite} className="absolute right-2 top-2 bg-bg-normal/85 backdrop-blur-sm hover:bg-bg-normal" />
    </div>
  );
}
