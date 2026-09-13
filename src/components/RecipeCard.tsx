// One recipe in the list: image (or a placeholder), name, rating stars, a
// total-time chip, up to three tag chips (with a "+N" overflow) and a
// favourite heart that toggles optimistically. The whole card links to the
// recipe page; the heart sits over the image as a sibling so it stays out of
// the anchor (a <button> nested in an <a> is invalid). List owns layout.
//
// `mode` (M12.2) switches the card's shape: "grid" is the plain vertical card
// above; "list" is Mealie's `RecipeCardMobile` row — a small square image on
// the left, text stacked to the right — for the list view mode in prefs.ts.
//
// An `ingredientPreview` (M35.3) wraps the link in a hover `Tooltip` of its
// first six ingredient lines; the popup itself is shown only from `md` (a
// phone has no hover, and a focus-triggered popup would otherwise still
// appear there), so a smaller viewport gets the plain link. The lines
// themselves are also mirrored onto the link's `data-ingredient-preview`
// (JSON), since the tooltip's own body renders only once opened and cannot
// be asserted from a static render.
import { Badge } from "@sixthshift/design-system/badge";
import { Card } from "@sixthshift/design-system/card";
import { TagChip } from "@sixthshift/design-system/tag-chip";
import { Tooltip } from "@sixthshift/design-system/tooltip";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { formatDuration } from "../domain/format";
import type { RecipeSummary, Tag } from "../domain/recipe";
import { recipeImageUrl } from "../lib/images";
import type { ViewMode } from "../lib/prefs";
import { FavouriteButton } from "./ui/FavouriteButton";
import { Rating } from "./ui/Rating";

export type RecipeCardProps = { recipe: RecipeSummary; mode?: ViewMode };

/** How many tags a card shows before folding the rest into "+N". */
export const MAX_CARD_TAGS = 3;

/**
 * The narrowest a grid card stays readable at: below this the image, the stat
 * chips and the tag row start to crowd. The list builds its grid columns from
 * it (`repeat(auto-fill, minmax(CARD_MIN_WIDTH, 1fr))`), so wider screens get
 * more cards rather than fatter ones. The number is the card's own business
 * and lives here; the arrangement stays with the list, which owns layout.
 * It has to travel as a value rather than a class because grid tracks are
 * sized by the container, and Tailwind cannot see a class name built at run
 * time. Keep it under a phone viewport less the page padding, so a phone
 * still gets exactly one column.
 */
export const CARD_MIN_WIDTH = "22rem";

/** The tags to render and how many more are hidden beyond `max`. Pure. */
export function capTags(tags: readonly Tag[], max: number = MAX_CARD_TAGS): { shown: Tag[]; more: number } {
  return { shown: tags.slice(0, max), more: Math.max(0, tags.length - max) };
}

function ImagePlaceholder({ className }: { className: string }) {
  return (
    <div data-placeholder="image" aria-hidden="true" className={`flex items-center justify-center bg-bg-subtle text-fg-subtle ${className}`}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10" r="1.5" />
        <path d="m21 16-4.5-4.5L9 19" />
      </svg>
    </div>
  );
}

/** The recipe's image, or the placeholder, sized by `className` for the card's mode. */
function CardImage({ src, className }: { src: string | null; className: string }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className={`${className} object-cover`} />
  ) : (
    <ImagePlaceholder className={className} />
  );
}

/** Rating stars and the total-time chip, shared by both card modes. */
function CardStats({ rating, totalTime }: { rating: number | null; totalTime: string }) {
  if (rating === null && totalTime === "") return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {rating !== null && <Rating value={rating} />}
      {totalTime !== "" && (
        <Badge variant="soft" intent="neutral">
          {totalTime}
        </Badge>
      )}
    </div>
  );
}

/** Up to `MAX_CARD_TAGS` tag chips plus a "+N" overflow badge, shared by both card modes. */
function CardTags({ tags }: { tags: readonly Tag[] }) {
  if (tags.length === 0) return null;
  const { shown, more } = capTags(tags);
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Tags">
      {shown.map((tag) => (
        <li key={tag.id}>
          <TagChip tag={tag.name} />
        </li>
      ))}
      {more > 0 && (
        <li>
          <Badge variant="soft" intent="muted" aria-label={`${more} more tags`}>
            {`+${more}`}
          </Badge>
        </li>
      )}
    </ul>
  );
}

/** Grid card body: image on top, text below. The original, still the default. */
function GridBody({ recipe, src, totalTime }: { recipe: RecipeSummary; src: string | null; totalTime: string }) {
  return (
    <Card className="flex h-full flex-col overflow-hidden p-0 transition-colors group-hover:border-border-normal-hovered">
      <CardImage src={src} className="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="font-semibold text-fg-strong group-hover:underline">{recipe.name}</span>
        <CardStats rating={recipe.rating} totalTime={totalTime} />
        <CardTags tags={recipe.tags} />
      </div>
    </Card>
  );
}

/** List card body: Mealie's `RecipeCardMobile` row — a small square image on the left, text stacked to the right. */
function ListBody({ recipe, src, totalTime }: { recipe: RecipeSummary; src: string | null; totalTime: string }) {
  return (
    <Card className="flex flex-row items-stretch overflow-hidden p-0 transition-colors group-hover:border-border-normal-hovered">
      <CardImage src={src} className="aspect-square w-24 shrink-0 sm:w-28" />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-3">
        <span className="truncate font-semibold text-fg-strong group-hover:underline">{recipe.name}</span>
        <CardStats rating={recipe.rating} totalTime={totalTime} />
        <CardTags tags={recipe.tags} />
      </div>
    </Card>
  );
}

export function RecipeCard({ recipe, mode = "grid" }: RecipeCardProps) {
  const src = recipeImageUrl(recipe.image);

  const totalTime = formatDuration(recipe.totalTime);
  const body: ReactNode = mode === "list" ? (
    <ListBody recipe={recipe} src={src} totalTime={totalTime} />
  ) : (
    <GridBody recipe={recipe} src={src} totalTime={totalTime} />
  );

  const link = (
    <Link
      to="/recipes/$slug"
      params={{ slug: recipe.slug }}
      className="block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
      data-ingredient-preview={recipe.ingredientPreview.length > 0 ? JSON.stringify(recipe.ingredientPreview) : undefined}
    >
      {body}
    </Link>
  );

  return (
    <div className="group relative h-full" data-card-mode={mode}>
      <FavouriteButton
        id={recipe.id}
        favourite={recipe.favourite}
        className="absolute right-2 top-2 z-10 bg-bg-normal/80 backdrop-blur-sm hover:bg-bg-normal"
      />
      {recipe.ingredientPreview.length > 0 ? (
        <Tooltip>
          <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
          <Tooltip.Body className="hidden max-w-xs text-left md:block">
            <ul>
              {recipe.ingredientPreview.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </Tooltip.Body>
        </Tooltip>
      ) : (
        link
      )}
    </div>
  );
}
