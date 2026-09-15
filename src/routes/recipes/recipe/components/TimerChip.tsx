// A duration named in a step (src/domain/recipe/durations.ts), rendered in the step
// card's footer as a tappable chip. Still presentational: it reports the tap upward and shows
// whatever the caller says its timer is doing. The running-timer store
// (src/lib/timers.ts) and the strip that lists them (TimerStrip.tsx) are
// wired to it by `StepCard`, which builds one chip per duration in the step's
// footer with an id derived from the step so a chip finds its own timer again.
import { Badge } from "@sixthshift/design-system/badge";
import { cn } from "@sixthshift/design-system/utils";

function ClockIcon() {
  // Same face as RecipeHeader's "total time" stat, at chip scale.
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export type TimerChipProps = {
  /** The duration in seconds; a range's lower bound — the chip offers the lower. */
  seconds: number;
  /** A range's upper bound, when the match was one ("10-12 minutes"). */
  upperSeconds?: number;
  /** The matched text, shown on the chip verbatim ("20 minutes", "10-12 minutes"). */
  label: string;
  /** Starts (or restarts) a timer for this duration. */
  onStart?: (seconds: number, label: string) => void;
  /**
   * This chip's timer, when one is running or has finished: the chip then
   * reads the time left ("4:32") or "Done" instead of the matched text.
   */
  timer?: { text: string; done: boolean };
  className?: string;
};

/** A step's duration, tappable to start a timer, showing its timer's state once there is one. Pure presentation. */
export function TimerChip({ seconds, upperSeconds, label, onStart, timer, className }: TimerChipProps) {
  const running = timer !== undefined && !timer.done;
  return (
    <button
      type="button"
      onClick={() => onStart?.(seconds, label)}
      aria-label={timer === undefined ? `Start a timer for ${label}` : `${label}: ${timer.text}. Restart this timer`}
      data-testid="timer-chip"
      data-seconds={seconds}
      data-upper-seconds={upperSeconds}
      data-running={running ? "true" : undefined}
      data-done={timer?.done ? "true" : undefined}
      className={cn("inline-flex align-baseline", className)}
    >
      <Badge variant="soft" intent={timer === undefined ? "neutral" : timer.done ? "success" : "brand"} className="inline-flex items-center gap-1 tabular-nums">
        <ClockIcon />
        {timer?.text ?? label}
      </Badge>
    </button>
  );
}
