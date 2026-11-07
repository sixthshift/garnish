import { Badge } from "@sixthshift/design-system/badge";
import { cn } from "@sixthshift/design-system/utils";
import { ClockIcon } from "../../../../components/ui/icons";

export type TimerChipProps = {
  /** The duration in seconds; a range's lower bound — the chip offers the lower. */
  seconds: number;
  /** A range's upper bound, when the match was one ("10-12 minutes"). */
  upperSeconds?: number;
  /** The matched text, shown on the chip verbatim ("20 minutes", "10-12 minutes"). */
  label: string;
  /** Starts a timer for this duration: from idle, or again once it is done. */
  onStart?: (seconds: number, label: string) => void;
  /** Pauses the running timer. */
  onPause?: () => void;
  /** Resumes the paused timer from the time it held. */
  onResume?: () => void;
  /**
   * This chip's timer, when one is running, paused or finished: the chip then
   * reads the time left ("4:32") or "Done" instead of the matched text.
   */
  timer?: { text: string; done: boolean; paused?: boolean };
  className?: string;
};

/** What a tap on the chip does, given its timer. */
export type TimerChipAction = "start" | "pause" | "resume" | "restart";

/**
 * The tap rule: idle starts, running pauses, paused
 * resumes, and only a timer that is done starts again. A tap never throws
 * away time left on a timer that is still going. Pure.
 */
export function timerChipAction(timer: TimerChipProps["timer"]): TimerChipAction {
  if (timer === undefined) return "start";
  if (timer.done) return "restart";
  return timer.paused ? "resume" : "pause";
}

const ACTION_NAME: Record<Exclude<TimerChipAction, "start">, string> = { pause: "Pause timer", resume: "Resume timer", restart: "Restart timer" };

/** A step's duration, tappable to start a timer, showing its timer's state once there is one. Pure presentation. */
export function TimerChip({ seconds, upperSeconds, label, onStart, onPause, onResume, timer, className }: TimerChipProps) {
  const action = timerChipAction(timer);
  const onClick = () => {
    if (action === "pause") onPause?.();
    else if (action === "resume") onResume?.();
    else onStart?.(seconds, label);
  };
  const intent = timer === undefined ? "neutral" : timer.done ? "success" : "brand";
  // Once there is a timer, the name says the time and what a tap does with it.
  const named = timer === undefined || action === "start" ? undefined : `${label}: ${timer.text}. ${ACTION_NAME[action]}`;
  const data = {
    "data-testid": "timer-chip",
    "data-seconds": seconds,
    "data-upper-seconds": upperSeconds,
    "data-running": action === "pause" ? "true" : undefined,
    "data-paused": action === "resume" ? "true" : undefined,
    "data-done": action === "restart" ? "true" : undefined,
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={named ?? `Start a timer for ${label}`}
      {...data}
      className={cn("inline-flex align-baseline", className)}
    >
      <Badge variant="soft" intent={intent} className="inline-flex items-center gap-1 tabular-nums">
        <ClockIcon />
        {timer === undefined ? label : action === "resume" ? `${timer.text} · paused` : timer.text}
      </Badge>
    </button>
  );
}
