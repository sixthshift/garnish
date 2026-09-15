import { useCallback, useEffect, useState } from "react";
import { notify } from "./notify";
import {
  dismissTimer,
  getTimers,
  pauseTimer,
  resumeTimer,
  startTimer,
  type StorageLike,
  subscribeTimers,
  tickTimers,
  type Timer,
  type TimerInput,
  timerDisplay,
} from "./timers";

const EMPTY: Timer[] = [];

/** `window.sessionStorage`, or undefined on the server and where it is unavailable. */
function browserStorage(): StorageLike | undefined {
  return typeof window === "undefined" ? undefined : window.sessionStorage;
}

/** The timers in the browser's own storage. Empty on the server. */
export function timersSnapshot(recipeId: string): Timer[] {
  const storage = browserStorage();
  return storage ? getTimers(storage, recipeId) : EMPTY;
}

/**
 * Say a timer is up: a toast with the step's text, and a buzz where the device
 * has one. The notice store has no "info" intent (src/lib/notify.ts), so a
 * timer reads as neutral — it is not a success or a failure, just the clock.
 */
function announce(timer: Timer): void {
  notify({ intent: "neutral", title: "Timer done", message: timer.label });
  if (typeof navigator !== "undefined") navigator.vibrate?.([200, 100, 200]);
}

/**
 * Move `recipeId`'s timers on to `now` in the browser's storage, announcing
 * whatever just expired. Idempotent within a second: the first caller writes
 * the expiry, so a second hook ticking the same recipe finds nothing new and
 * nobody is told twice.
 */
export function tickTimersNow(recipeId: string, now: number = Date.now()): void {
  const storage = browserStorage();
  if (!storage) return;
  const { expired } = tickTimers(storage, recipeId, now);
  for (const timer of expired) announce(timer);
}

/** One timer as a reader sees it: the record, plus the seconds left and the m:ss at this moment. */
export type RunningTimer = Timer & { remainingSeconds: number; text: string };

export type TimersApi = {
  /** Every timer for the recipe, oldest first, each with the time left at the last tick. */
  timers: RunningTimer[];
  start: (input: TimerInput) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
  dismiss: (id: string) => void;
  /** The timer with `id`, if there is one — what a chip asks for. */
  find: (id: string) => RunningTimer | undefined;
};

/**
 * A recipe's running timers, re-rendering the caller as they change and once a
 * second while any of them runs. The interval is the only clock in the module:
 * everything else derives from `endsAt`, so a tab that was asleep catches up
 * on its first tick rather than drifting.
 */
export function useTimers(recipeId: string): TimersApi {
  const [stored, setStored] = useState<Timer[]>(() => timersSnapshot(recipeId));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeTimers(() => setStored(timersSnapshot(recipeId))), [recipeId]);

  const running = stored.some((timer) => timer.endsAt !== null);
  useEffect(() => {
    // Catch up first: a timer that ran out while the page was closed, or on
    // another card, is done the moment anything reads it again.
    tickTimersNow(recipeId, Date.now());
    setNow(Date.now());
    if (!running) return;
    const handle = setInterval(() => {
      tickTimersNow(recipeId, Date.now());
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(handle);
  }, [recipeId, running]);

  const write = useCallback((change: (storage: StorageLike, at: number) => void) => {
    const storage = browserStorage();
    if (!storage) return;
    change(storage, Date.now());
    setNow(Date.now());
  }, []);

  const start = useCallback((input: TimerInput) => write((storage, at) => startTimer(storage, recipeId, input, at)), [recipeId, write]);
  const pause = useCallback((id: string) => write((storage, at) => pauseTimer(storage, recipeId, id, at)), [recipeId, write]);
  const resume = useCallback((id: string) => write((storage, at) => resumeTimer(storage, recipeId, id, at)), [recipeId, write]);
  const dismiss = useCallback((id: string) => write((storage) => dismissTimer(storage, recipeId, id)), [recipeId, write]);

  const timers: RunningTimer[] = stored.map((timer) => ({ ...timer, ...timerDisplay(timer, now) }));
  const find = (id: string) => timers.find((timer) => timer.id === id);

  return { timers, start, pause, resume, dismiss, find };
}
