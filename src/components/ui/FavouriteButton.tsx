import { Button } from "@sixthshift/design-system/button";
import { type MouseEvent, useEffect, useState } from "react";
import { useMutate } from "../../lib/mutate";
import { toastError } from "../../lib/toast";
import { setFavourite } from "../../server/fns/recipes";
import { HeartIcon } from "./icons";

export type FavouriteToggleResult = { favourite: boolean; error?: unknown };

/**
 * Flip `current` and run `write` with the new value. On failure `favourite`
 * reverts to `current` and the error comes back for the caller to surface.
 * Pure apart from the injected `write`.
 */
export async function toggleFavourite(
  id: string,
  current: boolean,
  write: (id: string, favourite: boolean) => Promise<unknown>
): Promise<FavouriteToggleResult> {
  const next = !current;
  try {
    await write(id, next);
    return { favourite: next };
  } catch (error) {
    return { favourite: current, error };
  }
}

export type FavouriteButtonProps = {
  id: string;
  favourite: boolean;
  className?: string;
};

/**
 * A heart button that toggles a recipe's favourite flag optimistically:
 * flips immediately, writes through `setFavourite`, and reverts with a
 * `toastError` if the write fails.
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
    const result = await toggleFavourite(id, current, (recipeId, next) => mutate(() => setFavourite({ data: { id: recipeId, favourite: next } })));
    setCurrent(result.favourite);
    if (result.error !== undefined) toastError("Couldn't update favourite", result.error);
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
