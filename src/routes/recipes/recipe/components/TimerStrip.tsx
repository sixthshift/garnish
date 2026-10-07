import { Button } from "@sixthshift/design-system/button";
import { cn } from "@sixthshift/design-system/utils";
import { isStepTimer } from "../../../../lib/timers";
import { type RunningTimer, useTimers } from "../../../../lib/useTimers";

export type TimerStripRowsProps = {
  timers: RunningTimer[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDismiss: (id: string) => void;
  /** `cook` gives Pause and dismiss cook mode's 48px targets and the time left a size to read at arm's length. */
  size?: "page" | "cook";
  className?: string;
};

/** The rows themselves. Renders nothing when no timer is going. */
export function TimerStripRows({ timers, onPause, onResume, onDismiss, size = "page", className }: TimerStripRowsProps) {
  if (timers.length === 0) return null;
  const button = size === "cook" ? "xl" : "sm";
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
            <span
              className={cn("shrink-0 font-semibold tabular-nums", size === "cook" && "text-xl", timer.done ? "text-fg-success" : "text-fg-strong")}
              data-timer-remaining
            >
              {timer.text}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-fg-subtle" data-timer-label>
              {timer.label}
            </span>
            {!timer.done && (
              <Button
                variant="outline"
                intent="neutral"
                size={button}
                className={cn(size === "cook" && "px-4")}
                onClick={() => (paused ? onResume(timer.id) : onPause(timer.id))}
                data-timer-toggle
              >
                {paused ? "Resume" : "Pause"}
              </Button>
            )}
            <Button
              variant="ghost"
              intent="neutral"
              size={button}
              iconOnly={size === "cook"}
              className={cn(size === "cook" && "text-2xl")}
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
   * Pin it just above the phone tab bar (the recipe view page): `--app-bar`
   * is the shell's measure of the bar, and the strip shares its layer, over
   * content and under sheets and popovers. In cook mode it
   * sits in the footer's own flow instead, so this stays off there.
   */
  fixed?: boolean;
  /**
   * A step whose timers to leave out: cook mode's current card, whose own
   * timer buttons already count down, so the strip holds only the timers
   * started on other cards (critique #15b). The recipe page passes none: its
   * strip is fixed and the step that started a timer may be scrolled away.
   */
  hideStep?: string;
  size?: "page" | "cook";
  className?: string;
};

/** The recipe's timers, read from the store and ticking once a second while any of them runs. */
export function TimerStrip({ recipeId, fixed, hideStep, size, className }: TimerStripProps) {
  const { timers: all, pause, resume, dismiss } = useTimers(recipeId);
  const timers = hideStep === undefined ? all : all.filter((timer) => !isStepTimer(timer.id, hideStep));
  if (timers.length === 0) return null;
  return (
    <TimerStripRows
      timers={timers}
      onPause={pause}
      onResume={resume}
      onDismiss={dismiss}
      size={size}
      // From md the shell's side nav (AppShell's `w-56`) holds the left edge, so the strip starts after it.
      className={cn(fixed && "fixed inset-x-0 bottom-[calc(var(--app-bar)+0.5rem)] z-app-bar px-4 md:bottom-4 md:left-56", className)}
    />
  );
}
