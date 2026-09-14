// Running kitchen timers, one set per recipe. A tap on a `TimerChip` (the
// durations M26.2 finds in a step's text) starts one; it shows in a strip
// above the cook footer and above the phone tab bar on the recipe page, and
// says "Done" when it reaches zero.
//
// Same shape as ticks.ts: a pure controller over a storage-like interface with
// try/catch around every access, a module-level subscription so every reader
// re-renders on a write, and thin hooks over both. `sessionStorage` keyed by
// recipe id, holding each timer's label and its absolute end time, so a reload
// or a change of cook card does not lose it — nothing counts down in memory,
// the remaining time is always derived from `endsAt` and the current clock.
//
// Every pure function takes `now` as a parameter, so the store's tests need no
// fake clock; only the hook reads `Date.now()`, and only it owns an interval.
import { useCallback, useEffect, useState } from "react";
import { formatRemaining } from "./dates";
import { notify } from "./notify";

/** The slice of `Storage` the controller uses. */
export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type Timer = {
  /**
   * Stable within a recipe, and derived from where the timer was started (the
   * step id and the duration's offset), so the chip that started it can find
   * it again after a reload and re-tapping it restarts that same timer rather
   * than stacking a second one.
   */
  id: string;
  recipeId: string;
  /** What the strip and the notification say: the step's text, trimmed, or the matched duration text. */
  label: string;
  /** The timer's full length in seconds. */
  seconds: number;
  /** When it finishes, epoch ms. Null while paused. */
  endsAt: number | null;
  /** Seconds left. Meaningful while paused; kept in step on every write. */
  remaining: number;
  done: boolean;
};

/** What starting a timer needs. */
export type TimerInput = { id: string; label: string; seconds: number };

const EMPTY: Timer[] = [];

function storageKey(recipeId: string): string {
  return `garnish.timers.${recipeId}`;
}

function isTimer(value: unknown): value is Timer {
  if (typeof value !== "object" || value === null) return false;
  const timer = value as Record<string, unknown>;
  return (
    typeof timer.id === "string" &&
    typeof timer.recipeId === "string" &&
    typeof timer.label === "string" &&
    typeof timer.seconds === "number" &&
    (timer.endsAt === null || typeof timer.endsAt === "number") &&
    typeof timer.remaining === "number" &&
    typeof timer.done === "boolean"
  );
}

/** The timers stored for `recipeId`. Empty when unset, malformed, or the storage throws. */
export function getTimers(storage: StorageLike, recipeId: string): Timer[] {
  try {
    const raw = storage.getItem(storageKey(recipeId));
    if (raw == null) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const timers = parsed.filter(isTimer);
    return timers.length === 0 ? EMPTY : timers;
  } catch {
    return EMPTY;
  }
}

/**
 * Everything currently reading timers. A recipe's chips, its strip above the
 * cook footer and the same strip on the view page all read one store, so a
 * write from any of them has to reach the rest.
 */
const listeners = new Set<() => void>();

/** Listen for any timer write. Returns the unsubscribe. */
export function subscribeTimers(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Write `timers` for `recipeId`. A throwing storage just means timers do not survive a reload. */
function putTimers(storage: StorageLike, recipeId: string, timers: Timer[]): Timer[] {
  try {
    storage.setItem(storageKey(recipeId), JSON.stringify(timers));
  } catch {
    // ignored: see above
  }
  for (const listener of [...listeners]) listener();
  return timers;
}

/** Seconds left on `timer` at `now`: zero once done, the frozen remainder while paused. Pure. */
export function remainingSeconds(timer: Timer, now: number): number {
  if (timer.done) return 0;
  if (timer.endsAt === null) return Math.max(0, Math.ceil(timer.remaining));
  return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
}

/** `timer` as the chip and the strip read it: the seconds left, and the m:ss they print. Pure. */
export function timerDisplay(timer: Timer, now: number): { remainingSeconds: number; text: string; done: boolean } {
  const left = remainingSeconds(timer, now);
  return { remainingSeconds: left, text: timer.done ? "Done" : formatRemaining(left), done: timer.done };
}

/** `timers` with `input` started (or restarted) at `now`. Pure. */
export function withStarted(timers: readonly Timer[], recipeId: string, input: TimerInput, now: number): Timer[] {
  const seconds = Math.max(1, Math.round(input.seconds));
  const started: Timer = {
    id: input.id,
    recipeId,
    label: input.label.trim() === "" ? `${seconds} seconds` : input.label.trim(),
    seconds,
    endsAt: now + seconds * 1000,
    remaining: seconds,
    done: false,
  };
  const others = timers.filter((timer) => timer.id !== input.id);
  return [...others, started];
}

/**
 * `timers` moved on to `now`: any running one whose end has passed is done,
 * and the rest keep their remainder in step so a paused-and-reloaded timer
 * reads correctly. Returns the new list and the ones that just expired — the
 * caller notifies for those. Pure.
 */
export function withTick(timers: readonly Timer[], now: number): { timers: Timer[]; expired: Timer[] } {
  const expired: Timer[] = [];
  const next = timers.map((timer) => {
    if (timer.done || timer.endsAt === null) return timer;
    const left = remainingSeconds(timer, now);
    if (left > 0) return timer.remaining === left ? timer : { ...timer, remaining: left };
    const finished: Timer = { ...timer, endsAt: null, remaining: 0, done: true };
    expired.push(finished);
    return finished;
  });
  return { timers: next, expired };
}

/** `timers` with `id` paused at `now`: its remainder frozen, its end time dropped. Pure. */
export function withPaused(timers: readonly Timer[], id: string, now: number): Timer[] {
  return timers.map((timer) =>
    timer.id !== id || timer.done || timer.endsAt === null ? timer : { ...timer, endsAt: null, remaining: remainingSeconds(timer, now) },
  );
}

/** `timers` with `id` running again from `now`, for whatever it had left. Pure. */
export function withResumed(timers: readonly Timer[], id: string, now: number): Timer[] {
  return timers.map((timer) =>
    timer.id !== id || timer.done || timer.endsAt !== null ? timer : { ...timer, endsAt: now + Math.max(0, timer.remaining) * 1000 },
  );
}

/** `timers` without `id`. Pure. */
export function withDismissed(timers: readonly Timer[], id: string): Timer[] {
  return timers.filter((timer) => timer.id !== id);
}

/** Start (or restart) a timer for `recipeId`. Returns the new list. */
export function startTimer(storage: StorageLike, recipeId: string, input: TimerInput, now: number): Timer[] {
  return putTimers(storage, recipeId, withStarted(getTimers(storage, recipeId), recipeId, input, now));
}

/** Move `recipeId`'s timers on to `now`, writing only when something changed. Returns the list and what just expired. */
export function tickTimers(storage: StorageLike, recipeId: string, now: number): { timers: Timer[]; expired: Timer[] } {
  const current = getTimers(storage, recipeId);
  const { timers, expired } = withTick(current, now);
  const changed = timers.some((timer, index) => timer !== current[index]);
  if (changed) putTimers(storage, recipeId, timers);
  return { timers, expired };
}

export function pauseTimer(storage: StorageLike, recipeId: string, id: string, now: number): Timer[] {
  return putTimers(storage, recipeId, withPaused(getTimers(storage, recipeId), id, now));
}

export function resumeTimer(storage: StorageLike, recipeId: string, id: string, now: number): Timer[] {
  return putTimers(storage, recipeId, withResumed(getTimers(storage, recipeId), id, now));
}

export function dismissTimer(storage: StorageLike, recipeId: string, id: string): Timer[] {
  return putTimers(storage, recipeId, withDismissed(getTimers(storage, recipeId), id));
}

/** Drop every timer for `recipeId`. */
export function clearTimers(storage: StorageLike, recipeId: string): Timer[] {
  return putTimers(storage, recipeId, EMPTY);
}

/** The id of the timer a duration chip starts: stable per step and per offset within its text. Pure. */
export function chipTimerId(stepId: string, offset: number, text: string): string {
  return `${stepId}#${offset}#${text}`;
}

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

  const write = useCallback(
    (change: (storage: StorageLike, at: number) => void) => {
      const storage = browserStorage();
      if (!storage) return;
      change(storage, Date.now());
      setNow(Date.now());
    },
    [],
  );

  const start = useCallback((input: TimerInput) => write((storage, at) => startTimer(storage, recipeId, input, at)), [recipeId, write]);
  const pause = useCallback((id: string) => write((storage, at) => pauseTimer(storage, recipeId, id, at)), [recipeId, write]);
  const resume = useCallback((id: string) => write((storage, at) => resumeTimer(storage, recipeId, id, at)), [recipeId, write]);
  const dismiss = useCallback((id: string) => write((storage) => dismissTimer(storage, recipeId, id)), [recipeId, write]);

  const timers: RunningTimer[] = stored.map((timer) => ({ ...timer, ...timerDisplay(timer, now) }));
  const find = (id: string) => timers.find((timer) => timer.id === id);

  return { timers, start, pause, resume, dismiss, find };
}
