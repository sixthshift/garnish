import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { cn } from "@sixthshift/design-system/utils";
import { ClockIcon, PlayIcon } from "../../../../components/ui/icons";

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
  /**
   * `page`, the default, is a compact chip inside a list of steps; `cook` is a
   * full button, 48px tall, that says what it does ("Start 20 minute timer"):
   * at arm's length starting a timer is the deck's most important tap.
   */
  size?: "page" | "cook";
  className?: string;
};

/** A step's duration, tappable to start a timer, showing its timer's state once there is one. Pure presentation. */
export function TimerChip({ seconds, upperSeconds, label, onStart, timer, size = "page", className }: TimerChipProps) {
  const running = timer !== undefined && !timer.done;
  if (size === "cook") {
    return (
      <Button
        type="button"
        variant="outline"
        // Neutral until it runs: brand is Next's alone. A running or finished
        // timer keeps the chip's own state colours.
        intent={timer === undefined ? "neutral" : timer.done ? "success" : "brand"}
        size="xl"
        onClick={() => onStart?.(seconds, label)}
        // Idle, the visible words are the name; once running they are only the time left.
        aria-label={timer === undefined ? undefined : `${label}: ${timer.text}. Restart this timer`}
        data-testid="timer-chip"
        data-size="cook"
        data-seconds={seconds}
        data-upper-seconds={upperSeconds}
        data-running={running ? "true" : undefined}
        data-done={timer?.done ? "true" : undefined}
        className={cn("gap-2 px-5 text-lg tabular-nums", className)}
      >
        {timer === undefined ? <PlayIcon /> : <ClockIcon size={20} />}
        {timer === undefined ? `Start ${timerPhrase(label)} timer` : timer.text}
      </Button>
    );
  }
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

/**
 * The matched duration as it reads before "timer": its last word loses a
 * plural "s" ("20 minutes" → "20 minute", "1½ hrs" → "1½ hr"), as English
 * does for a measure used as a modifier. Pure.
 */
export function timerPhrase(label: string): string {
  return label.trim().replace(/(\p{L}{2,})s$/u, "$1");
}
