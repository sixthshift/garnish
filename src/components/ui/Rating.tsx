// Read-only star rating, 0 to 5. The design system has no rating primitive, so
// this is built from its tokens: filled stars in the warning (amber) colour,
// empty ones in the subtle foreground. Half a star and up rounds to a full one
// visually; the exact value stays in the accessible label ("Rated 4.5 out of 5").
import { cn } from "@sixthshift/design-system/utils";

export type RatingProps = {
  /** 0 to 5. */
  value: number;
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

export function Rating({ value, className }: RatingProps) {
  const filled = filledStars(value);
  return (
    <span role="img" aria-label={ratingLabel(value)} className={cn("inline-flex items-center gap-0.5", className)}>
      {Array.from({ length: RATING_MAX }, (_, i) => (
        <Star key={i} filled={i < filled} />
      ))}
    </span>
  );
}
