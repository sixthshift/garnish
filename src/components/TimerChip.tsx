// A duration named in a step (src/domain/timers.ts), rendered inline as a
// tappable chip. Presentational for now: M26.3 wires it to the running-timer
// store (src/lib/timers.ts) and a strip above the cook footer; this component
// only reports the tap upward.
import { Badge } from "@sixthshift/design-system/badge";
import { cn } from "@sixthshift/design-system/utils";
import { Fragment, type ReactNode } from "react";
import { durationsIn } from "../domain/timers";

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
  /** Starts a timer for this duration. Nothing runs yet — M26.3 gives this a store to write to. */
  onStart?: (seconds: number, label: string) => void;
  className?: string;
};

/** A step's duration, tappable to start a timer. Pure presentation. */
export function TimerChip({ seconds, upperSeconds, label, onStart, className }: TimerChipProps) {
  return (
    <button
      type="button"
      onClick={() => onStart?.(seconds, label)}
      aria-label={`Start a timer for ${label}`}
      data-testid="timer-chip"
      data-seconds={seconds}
      data-upper-seconds={upperSeconds}
      className={cn("inline-flex align-baseline", className)}
    >
      <Badge variant="soft" intent="neutral" className="inline-flex items-center gap-1">
        <ClockIcon />
        {label}
      </Badge>
    </button>
  );
}

/**
 * A `Markdown` `decorate` function that splices a `TimerChip` in for every
 * duration `durationsIn` finds in a text run, leaving the rest as plain text.
 * `onStart` is threaded through to every chip unchanged.
 */
export function decorateDurations(onStart?: (seconds: number, label: string) => void): (text: string) => ReactNode {
  return (text: string) => {
    const durations = durationsIn(text);
    if (durations.length === 0) return text;

    const nodes: ReactNode[] = [];
    let cursor = 0;
    durations.forEach((duration, index) => {
      if (duration.start > cursor) nodes.push(<Fragment key={`text-${index}`}>{text.slice(cursor, duration.start)}</Fragment>);
      nodes.push(
        <TimerChip
          key={`timer-${index}`}
          seconds={duration.seconds}
          upperSeconds={duration.upperSeconds}
          label={duration.text}
          onStart={onStart}
        />,
      );
      cursor = duration.end;
    });
    if (cursor < text.length) nodes.push(<Fragment key="text-tail">{text.slice(cursor)}</Fragment>);
    return nodes;
  };
}
