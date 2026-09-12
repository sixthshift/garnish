// A duration named in a step (src/domain/timers.ts), rendered inline as a
// tappable chip. Still presentational: it reports the tap upward and shows
// whatever the caller says its timer is doing. The running-timer store
// (src/lib/timers.ts) and the strip that lists them (TimerStrip.tsx) are
// wired to it by `decorateDurations` below, which the step rows and the cook
// card build with a step's id so a chip can find its own timer again.
import { Badge } from "@sixthshift/design-system/badge";
import { cn } from "@sixthshift/design-system/utils";
import { Fragment, type ReactNode } from "react";
import { durationsIn } from "../domain/timers";
import { chipTimerId } from "../lib/timers";

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
      <Badge
        variant="soft"
        intent={timer === undefined ? "neutral" : timer.done ? "success" : "brand"}
        className="inline-flex items-center gap-1 tabular-nums"
      >
        <ClockIcon />
        {timer?.text ?? label}
      </Badge>
    </button>
  );
}

/** What a decorated chip needs to reach the running-timer store. All optional: with none of it the chips are inert. */
export type DurationTimers = {
  /**
   * Prefix for the ids of the timers these chips start — the step's id. Two
   * chips in one step get different ids from their offsets in the text, so
   * each finds its own timer again after a reload.
   */
  keyPrefix?: string;
  /** What the timer is called on the strip and in its notification. Defaults to the matched text. */
  label?: string;
  onStart?: (input: { id: string; label: string; seconds: number }) => void;
  /** This chip's timer, if the store has one under `id`. */
  timerFor?: (id: string) => { text: string; done: boolean } | undefined;
};

/**
 * A `Markdown` `decorate` function that splices a `TimerChip` in for every
 * duration `durationsIn` finds in a text run, leaving the rest as plain text.
 * Each chip gets a stable timer id (`keyPrefix` plus its offset and text), so
 * it can show its own timer's remaining time and restart it on a second tap.
 */
export function decorateDurations(timers: DurationTimers = {}): (text: string) => ReactNode {
  return (text: string) => {
    const durations = durationsIn(text);
    if (durations.length === 0) return text;

    const nodes: ReactNode[] = [];
    let cursor = 0;
    durations.forEach((duration, index) => {
      if (duration.start > cursor) nodes.push(<Fragment key={`text-${index}`}>{text.slice(cursor, duration.start)}</Fragment>);
      const id = chipTimerId(timers.keyPrefix ?? "", duration.start, duration.text);
      nodes.push(
        <TimerChip
          key={`timer-${index}`}
          seconds={duration.seconds}
          upperSeconds={duration.upperSeconds}
          label={duration.text}
          timer={timers.timerFor?.(id)}
          onStart={
            timers.onStart === undefined
              ? undefined
              : (seconds, matched) => timers.onStart?.({ id, label: timers.label?.trim() || matched, seconds })
          }
        />,
      );
      cursor = duration.end;
    });
    if (cursor < text.length) nodes.push(<Fragment key="text-tail">{text.slice(cursor)}</Fragment>);
    return nodes;
  };
}
