import { cn } from "@sixthshift/design-system/utils";
import { filledStars, nextRating, RATING_MAX, ratingLabel } from "../../lib/ui/rating";

export type RatingProps = {
  /** 0 to 5. */
  value: number;
  /** When given, the stars are buttons and the rating is editable. */
  onChange?: (value: number) => void;
  disabled?: boolean;
  className?: string;
};

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
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed-length run of stars: position is the identity.
          <Star key={i} filled={i < filled} />
        ))}
      </span>
    );
  }
  return (
    <fieldset aria-label={ratingLabel(value)} className={cn("inline-flex items-center gap-0.5", className)}>
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
    </fieldset>
  );
}
