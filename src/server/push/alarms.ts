// The alarm clock: one timer armed for the soonest alarm, re-armed after every
// write and every firing. Nothing polls; with no alarm set nothing runs.

import pushRepo, { type DueAlarm, type PushRepository, type VapidKeys } from "../../db/models/push/repo";
import { timerPush } from "../../sw/push";
import { type PushOutcome, sendPush } from "./send";
import { vapidKeys, vapidSubject } from "./vapid";

/**
 * An alarm this far past its end is dropped unsent. It is what a server that
 * was down over dinner finds on restart, and a "Timer done" for last night's
 * pasta is noise, not news.
 */
export const STALE_MS = 60 * 60 * 1000;

/** `setTimeout`'s ceiling; a longer wait is re-armed when it lands. */
const MAX_DELAY_MS = 2_147_483_647;

export type AlarmClockDeps = {
  repo: PushRepository;
  /** Deliver one alarm. Defaults to a real push. */
  send: (alarm: DueAlarm, keys: VapidKeys) => Promise<PushOutcome>;
  keys: () => VapidKeys;
  now: () => number;
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
};

/** How long to wait for an alarm at `endsAt`, never negative, never past the platform ceiling. Pure. */
export function delayUntil(endsAt: string, now: number): number {
  return Math.min(MAX_DELAY_MS, Math.max(0, Date.parse(endsAt) - now));
}

/** Whether an alarm at `endsAt` is too old to ring at `now`. Pure. */
export function isStale(endsAt: string, now: number): boolean {
  return now - Date.parse(endsAt) > STALE_MS;
}

export function createAlarmClock(deps: AlarmClockDeps) {
  let handle: unknown = null;
  let firing: Promise<void> | null = null;

  /** Send everything due, forget what was sent or is stale, and forget a device the push service says is gone. */
  async function fire(): Promise<void> {
    const now = deps.now();
    const due = deps.repo.due(new Date(now).toISOString());
    let keys: VapidKeys | null = null;
    for (const alarm of due) {
      deps.repo.removeAlarm(alarm.id);
      if (isStale(alarm.endsAt, now)) continue;
      keys ??= deps.keys();
      const outcome = await deps.send(alarm, keys);
      if (!outcome.ok && outcome.gone) deps.repo.removeSubscription(alarm.subscriptionId);
    }
  }

  /** (Re)arm for the soonest alarm. Called after every write and every firing. Safe to call at any time. */
  function arm(): void {
    if (handle !== null) {
      deps.clearTimer(handle);
      handle = null;
    }
    const next = deps.repo.nextEndsAt();
    if (next === null) return;
    handle = deps.setTimer(
      () => {
        handle = null;
        // One firing at a time: a second timer landing mid-send waits for the first.
        firing = (firing ?? Promise.resolve()).then(fire).finally(arm);
      },
      delayUntil(next, deps.now())
    );
  }

  return {
    arm,
    fire,
    /** Whatever firing is under way, for a test to await. */
    settled: () => firing ?? Promise.resolve(),
    stop() {
      if (handle !== null) deps.clearTimer(handle);
      handle = null;
    },
  };
}

export type AlarmClock = ReturnType<typeof createAlarmClock>;

/** The one clock over the application database, sending real pushes. */
export const alarms: AlarmClock = createAlarmClock({
  repo: pushRepo,
  send: (alarm, keys) => sendPush(alarm.subscription, timerPush(alarm), keys, vapidSubject()),
  keys: () => vapidKeys(),
  now: Date.now,
  setTimer: (callback, ms) => setTimeout(callback, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});
