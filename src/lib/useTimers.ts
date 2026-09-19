import { toast } from "@sixthshift/design-system/overlay";
import { useCallback, useEffect, useState } from "react";
import { clearTimerAlarm, setTimerAlarm } from "../server/fns/push";
import { currentEndpoint } from "./push";
import {
  dismissTimer,
  getTimers,
  pauseTimer,
  resumeTimer,
  type StorageLike,
  startTimer,
  subscribeTimers,
  type Timer,
  type TimerInput,
  tickTimers,
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
 * has one. `Toast` has no "info" intent, so a timer reads as neutral — it is
 * not a success or a failure, just the clock.
 */
function announce(timer: Timer): void {
  toast({ intent: "neutral", title: "Timer done", children: timer.label });
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

/**
 * Tell the server about a timer, when this device has alerts on: a running
 * one is an alarm to fire at its end, a paused or dismissed one is an alarm
 * to drop. Fire and forget — the page's own tick still rings the toast, and
 * a device without a subscription (alerts off, dev, no push) sends nothing.
 * Never rejects.
 */
export async function syncAlarm(recipeId: string, id: string, navigatorLike: Parameters<typeof currentEndpoint>[0], url: string): Promise<void> {
  try {
    const endpoint = await currentEndpoint(navigatorLike);
    if (endpoint === null) return;
    const storage = browserStorage();
    const timer = storage ? getTimers(storage, recipeId).find((candidate) => candidate.id === id) : undefined;
    if (timer && !timer.done && timer.endsAt !== null) {
      await setTimerAlarm({ data: { endpoint, timerId: id, label: timer.label, url, endsAt: timer.endsAt } });
    } else {
      await clearTimerAlarm({ data: { endpoint, timerId: id } });
    }
  } catch {
    // The page's own clock is the one that must not fail; the push is a courtesy.
  }
}

/** The page to open from a notification: this one. Server-safe. */
function currentPath(): string {
  return typeof location === "undefined" ? "/" : location.pathname + location.search;
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

  // Every write also tells the server, so a phone with alerts on is woken at zero.
  const write = useCallback(
    (id: string, change: (storage: StorageLike, at: number) => void) => {
      const storage = browserStorage();
      if (!storage) return;
      change(storage, Date.now());
      setNow(Date.now());
      void syncAlarm(recipeId, id, typeof navigator === "undefined" ? undefined : navigator, currentPath());
    },
    [recipeId]
  );

  const start = useCallback((input: TimerInput) => write(input.id, (storage, at) => startTimer(storage, recipeId, input, at)), [recipeId, write]);
  const pause = useCallback((id: string) => write(id, (storage, at) => pauseTimer(storage, recipeId, id, at)), [recipeId, write]);
  const resume = useCallback((id: string) => write(id, (storage, at) => resumeTimer(storage, recipeId, id, at)), [recipeId, write]);
  const dismiss = useCallback((id: string) => write(id, (storage) => dismissTimer(storage, recipeId, id)), [recipeId, write]);

  const timers: RunningTimer[] = stored.map((timer) => ({ ...timer, ...timerDisplay(timer, now) }));
  const find = (id: string) => timers.find((timer) => timer.id === id);

  return { timers, start, pause, resume, dismiss, find };
}
