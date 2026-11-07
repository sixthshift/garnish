import { Button } from "@sixthshift/design-system/button";
import { cn } from "@sixthshift/design-system/utils";
import { type Ref, useEffect, useRef } from "react";
import { TIMER_STRIP_VAR } from "../../../../lib/toast";
import { type RunningTimer, useTimers } from "../../../../lib/useTimers";

export type TimerStripRowsProps = {
  timers: RunningTimer[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDismiss: (id: string) => void;
  className?: string;
  ref?: Ref<HTMLUListElement>;
};

/** The rows themselves. Renders nothing when no timer is going. */
export function TimerStripRows({ timers, onPause, onResume, onDismiss, className, ref }: TimerStripRowsProps) {
  if (timers.length === 0) return null;
  return (
    <ul ref={ref} className={cn("flex flex-col gap-2", className)} aria-label="Timers" data-testid="timer-strip" data-print="hide">
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
              <Button variant="outline" intent="neutral" size="sm" onClick={() => (paused ? onResume(timer.id) : onPause(timer.id))} data-timer-toggle>
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
   * Pin it just above the phone tab bar (the recipe view page): `--app-bar`
   * is the shell's measure of the bar, and the strip shares its layer, over
   * content and under sheets and popovers.
   */
  fixed?: boolean;
  className?: string;
};

/** The recipe's timers, read from the store and ticking once a second while any of them runs. */
export function TimerStrip({ recipeId, fixed, className }: TimerStripProps) {
  const { timers, pause, resume, dismiss } = useTimers(recipeId);
  const strip = useRef<HTMLUListElement | null>(null);
  const showing = timers.length > 0;

  // A fixed strip tells the document how tall it is, so the toast stack (which
  // portals to the body, outside anything the strip could wrap) stands on it
  // rather than over it (critique #15c: "Timer done" covered the strip's rows).
  // Measured, not assumed: the strip grows a row per timer.
  useEffect(() => {
    const node = strip.current;
    if (!fixed || !showing || node === null) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty(TIMER_STRIP_VAR, `${node.offsetHeight}px`);
    publish();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(publish);
    observer?.observe(node);
    return () => {
      observer?.disconnect();
      root.style.removeProperty(TIMER_STRIP_VAR);
    };
  }, [fixed, showing]);

  if (!showing) return null;
  return (
    <TimerStripRows
      ref={strip}
      timers={timers}
      onPause={pause}
      onResume={resume}
      onDismiss={dismiss}
      className={cn(fixed && "fixed inset-x-0 bottom-[calc(var(--app-bar)+0.5rem)] z-app-bar px-4 desktop:bottom-4", className)}
    />
  );
}
