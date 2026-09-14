// The arithmetic behind components/ui/Rating.

export const RATING_MAX = 5;

/** How many of the five stars to fill for `value`. Pure. */
export function filledStars(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(RATING_MAX, Math.max(0, Math.round(value)));
}

/** "Rated 4.5 out of 5"; trailing zeros trimmed. Pure. */
export function ratingLabel(value: number): string {
  return `Rated ${Number(value.toFixed(1))} out of ${RATING_MAX}`;
}

/** The rating after pressing star `star` while `current` is the rating: the star, or 0 when it is already the rating. Pure. */
export function nextRating(current: number, star: number): number {
  return filledStars(current) === star ? 0 : star;
}
