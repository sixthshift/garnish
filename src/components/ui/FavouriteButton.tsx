// The favourite heart: a self-contained control that owns its optimistic
// state and writes through `setFavourite`, so any page can drop it in without
// wiring a handler. `RecipeCard` positions it absolutely over the image with
// `className`; `RecipeHeader` renders it inline beside the actions. Marked
// `data-print="hide"`: a control, not content.
import { Button } from "@sixthshift/design-system/button";
import { useEffect, useState, type MouseEvent } from "react";
import { useMutate } from "../../lib/mutate";
import { notifyError } from "../../lib/notify";
import { setFavourite } from "../../server/recipes";

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

export type FavouriteButtonProps = {
  id: string;
  favourite: boolean;
  className?: string;
};

/**
 * A heart button that toggles a recipe's favourite flag optimistically:
 * flips immediately, writes through `setFavourite`, and reverts with a
 * `notifyError` if the write fails.
 */
export function FavouriteButton({ id, favourite, className }: FavouriteButtonProps) {
  const mutate = useMutate();
  const [current, setCurrent] = useState(favourite);
  useEffect(() => setCurrent(favourite), [favourite]);

  async function handleToggle(event: MouseEvent) {
    // The heart can sit over a link (the card's image); keep the click from navigating.
    event.preventDefault();
    event.stopPropagation();
    setCurrent(!current);
    const result = await toggleFavourite(id, current, (recipeId, next) =>
      mutate(() => setFavourite({ data: { id: recipeId, favourite: next } })),
    );
    setCurrent(result.favourite);
    if (result.error !== undefined) notifyError("Couldn't update favourite", result.error);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      intent={current ? "danger" : "neutral"}
      iconOnly
      size="sm"
      aria-label={current ? "Remove from favourites" : "Add to favourites"}
      aria-pressed={current}
      onClick={handleToggle}
      data-print="hide"
      className={className}
    >
      <HeartIcon filled={current} />
    </Button>
  );
}
