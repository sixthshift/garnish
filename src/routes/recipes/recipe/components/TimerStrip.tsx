// The recipe's running timers, one row each: what it was started for, the time
// left, a pause and a dismiss. It shows in two places, both above whatever
// already owns the bottom of the screen — inside cook mode's footer, over the
// progress bar, and fixed above the phone tab bar on the recipe page.
//
// The store is src/lib/timers.ts; the rows here are presentational, so they
// render on their own in a test.
import { Button } from "@sixthshift/design-system/button";
import { cn } from "@sixthshift/design-system/utils";
import { useTimers, type RunningTimer } from "../../../../lib/timers";

export type TimerStripRowsProps = {
  timers: RunningTimer[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDismiss: (id: string) => void;
  className?: string;
};

/** The rows themselves. Renders nothing when no timer is going. */
export function TimerStripRows({ timers, onPause, onResume, onDismiss, className }: TimerStripRowsProps) {
  if (timers.length === 0) return null;
  return (
    <ul className={cn("flex flex-col gap-2", className)} aria-label="Timers" data-testid="timer-strip" data-print="hide">
      {timers.map((timer) => {
        const paused = !timer.done && timer.endsAt === null;
        return (
          <li
            key={timer.id}
            className="flex items-center gap-3 rounded-lg border border-border-normal bg-bg-normal px-3 py-2 shadow-sm"
            data-testid="timer-row"
            data-timer-id={timer.id}
            data-done={timer.done ? "true" : undefined}
            data-paused={paused ? "true" : undefined}
          >
            <span className={cn("shrink-0 font-semibold tabular-nums", timer.done ? "text-fg-success" : "text-fg-strong")} data-timer-remaining>
              {timer.text}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-fg-subtle" data-timer-label>
              {timer.label}
            </span>
            {!timer.done && (
              <Button
                variant="outline"
                intent="neutral"
                size="sm"
                onClick={() => (paused ? onResume(timer.id) : onPause(timer.id))}
                data-timer-toggle
              >
                {paused ? "Resume" : "Pause"}
              </Button>
            )}
            <Button
              variant="ghost"
              intent="neutral"
              size="sm"
              onClick={() => onDismiss(timer.id)}
              aria-label={`Dismiss the timer for ${timer.label}`}
              data-timer-dismiss
            >
              ×
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

export type TimerStripProps = {
  recipeId: string;
  /**
   * Pin it above the phone tab bar (the recipe view page). In cook mode it
   * sits in the footer's own flow instead, so this stays off there.
   */
  fixed?: boolean;
  className?: string;
};

/** The recipe's timers, read from the store and ticking once a second while any of them runs. */
export function TimerStrip({ recipeId, fixed, className }: TimerStripProps) {
  const { timers, pause, resume, dismiss } = useTimers(recipeId);
  if (timers.length === 0) return null;
  return (
    <TimerStripRows
      timers={timers}
      onPause={pause}
      onResume={resume}
      onDismiss={dismiss}
      className={cn(fixed && "fixed inset-x-0 bottom-20 z-30 px-4 md:bottom-4", className)}
    />
  );
}
