// Star rating, 0 to 5. The design system has no rating primitive, so this is
// built from its tokens: filled stars in the warning (amber) colour, empty ones
// in the subtle foreground. Half a star and up rounds to a full one visually;
// the exact value stays in the accessible label ("Rated 4.5 out of 5").
//
// Read-only without `onChange`. With it, each star is a button: pressing star
// N rates N, and pressing the star that is already the rating clears it to 0
// (Mealie's behaviour), so a recipe can be un-rated without a separate control.
import { cn } from "@sixthshift/design-system/utils";

export type RatingProps = {
  /** 0 to 5. */
  value: number;
  /** When given, the stars are buttons and the rating is editable. */
  onChange?: (value: number) => void;
  disabled?: boolean;
  className?: string;
};

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

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
      data-filled={filled ? "true" : "false"}
      className={filled ? "text-fg-warning" : "text-fg-subtle"}
    >
      <path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z" />
    </svg>
  );
}

export function Rating({ value, onChange, disabled, className }: RatingProps) {
  const filled = filledStars(value);
  if (onChange === undefined) {
    return (
      <span role="img" aria-label={ratingLabel(value)} className={cn("inline-flex items-center gap-0.5", className)}>
        {Array.from({ length: RATING_MAX }, (_, i) => (
          <Star key={i} filled={i < filled} />
        ))}
      </span>
    );
  }
  return (
    <div role="group" aria-label={ratingLabel(value)} className={cn("inline-flex items-center gap-0.5", className)}>
      {Array.from({ length: RATING_MAX }, (_, i) => {
        const star = i + 1;
        return (
          <button
            key={star}
            type="button"
            aria-label={`Rate ${star} out of ${RATING_MAX}`}
            aria-pressed={star <= filled}
            disabled={disabled}
            onClick={() => onChange(nextRating(value, star))}
            className="rounded-sm p-0.5 hover:scale-110 focus-visible:outline-2 focus-visible:outline-border-brand disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Star filled={star <= filled} />
          </button>
        );
      })}
    </div>
  );
}
