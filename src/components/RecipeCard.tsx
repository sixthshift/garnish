// One recipe in the list: image (or a placeholder), name, rating stars, a
// total-time chip, up to three tag chips (with a "+N" overflow) and a
// favourite heart that toggles optimistically. The whole card links to the
// recipe page; the heart sits over the image as a sibling so it stays out of
// the anchor (a <button> nested in an <a> is invalid). List owns layout.
import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { TagChip } from "@sixthshift/design-system/tag-chip";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type MouseEvent } from "react";
import { formatDuration } from "../domain/format";
import type { RecipeSummary, Tag } from "../domain/recipe";
import { recipeImageUrl } from "../lib/images";
import { useMutate } from "../lib/mutate";
import { notifyError } from "../lib/notify";
import { setFavourite } from "../server/recipes";
import { Rating } from "./ui/Rating";

export type RecipeCardProps = { recipe: RecipeSummary };

/** How many tags a card shows before folding the rest into "+N". */
export const MAX_CARD_TAGS = 3;

/** The tags to render and how many more are hidden beyond `max`. Pure. */
export function capTags(tags: readonly Tag[], max: number = MAX_CARD_TAGS): { shown: Tag[]; more: number } {
  return { shown: tags.slice(0, max), more: Math.max(0, tags.length - max) };
}

export type FavouriteToggleResult = { favourite: boolean; error?: unknown };

/**
 * Flip `current` and run `write` with the new value. On failure `favourite`
 * reverts to `current` and the error comes back for the caller to surface.
 * Pure apart from the injected `write`.
 */
export async function toggleFavourite(
  id: string,
  current: boolean,
  write: (id: string, favourite: boolean) => Promise<unknown>,
): Promise<FavouriteToggleResult> {
  const next = !current;
  try {
    await write(id, next);
    return { favourite: next };
  } catch (error) {
    return { favourite: current, error };
  }
}

function ImagePlaceholder() {
  return (
    <div
      data-placeholder="image"
      aria-hidden="true"
      className="flex aspect-[4/3] w-full items-center justify-center bg-bg-subtle text-fg-subtle"
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10" r="1.5" />
        <path d="m21 16-4.5-4.5L9 19" />
      </svg>
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-favourite={filled ? "true" : "false"}
    >
      <path d="M12 21s-7.1-4.5-9.6-9A5.4 5.4 0 0 1 12 6.3 5.4 5.4 0 0 1 21.6 12c-2.5 4.5-9.6 9-9.6 9Z" />
    </svg>
  );
}

function FavouriteButton({ favourite, onToggle }: { favourite: boolean; onToggle: (event: MouseEvent) => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      intent={favourite ? "danger" : "neutral"}
      iconOnly
      size="sm"
      aria-label={favourite ? "Remove from favourites" : "Add to favourites"}
      aria-pressed={favourite}
      onClick={onToggle}
      className="absolute right-2 top-2 z-10 bg-bg-normal/80 backdrop-blur-sm hover:bg-bg-normal"
    >
      <HeartIcon filled={favourite} />
    </Button>
  );
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const src = recipeImageUrl(recipe.image);
  const mutate = useMutate();
  const [favourite, setFav] = useState(recipe.favourite);
  useEffect(() => setFav(recipe.favourite), [recipe.favourite]);

  async function handleToggle(event: MouseEvent) {
    // The heart sits over the card's link; keep the click from navigating.
    event.preventDefault();
    event.stopPropagation();
    setFav(!favourite);
    const result = await toggleFavourite(recipe.id, favourite, (id, next) =>
      mutate(() => setFavourite({ data: { id, favourite: next } })),
    );
    setFav(result.favourite);
    if (result.error !== undefined) notifyError("Couldn't update favourite", result.error);
  }

  const totalTime = formatDuration(recipe.totalTime);
  const { shown: tags, more } = capTags(recipe.tags);

  return (
    <div className="group relative h-full">
      <FavouriteButton favourite={favourite} onToggle={handleToggle} />
      <Link
        to="/recipes/$slug"
        params={{ slug: recipe.slug }}
        className="block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
      >
        <Card className="flex h-full flex-col overflow-hidden p-0 transition-colors group-hover:border-border-normal-hovered">
          {src ? (
            <img src={src} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
          ) : (
            <ImagePlaceholder />
          )}
          <div className="flex flex-1 flex-col gap-2 p-4">
            <span className="font-semibold text-fg-strong group-hover:underline">{recipe.name}</span>
            {(recipe.rating !== null || totalTime !== "") && (
              <div className="flex flex-wrap items-center gap-2">
                {recipe.rating !== null && <Rating value={recipe.rating} />}
                {totalTime !== "" && (
                  <Badge variant="soft" intent="neutral">
                    {totalTime}
                  </Badge>
                )}
              </div>
            )}
            {recipe.tags.length > 0 && (
              <ul className="flex flex-wrap gap-1" aria-label="Tags">
                {tags.map((tag) => (
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
            )}
          </div>
        </Card>
      </Link>
    </div>
  );
}
