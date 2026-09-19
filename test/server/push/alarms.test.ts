// The alarm clock over an in-memory repository, with the timer and the sender
// faked: it arms for the soonest alarm, fires what is due, drops what is
// stale, forgets a device the push service says is gone, and re-arms.
import type { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { openDatabase } from "../../../src/db/connection/open";
import { migrate } from "../../../src/db/migrations/migrate";
import { type DueAlarm, type PushRepository, pushRepository } from "../../../src/db/models/push/repo";
import { type AlarmClock, createAlarmClock, delayUntil, isStale, STALE_MS } from "../../../src/server/push/alarms";
import type { PushOutcome } from "../../../src/server/push/send";

const T0 = Date.parse("2026-09-19T10:00:00.000Z");
const at = (ms: number) => new Date(T0 + ms).toISOString();
const PHONE = { endpoint: "https://push.example/a", p256dh: "p", auth: "a" };
const KEYS = { publicKey: "pub", privateKey: "priv" };

let db: Database;
let repo: PushRepository;
let now: number;
let timers: { callback: () => void; ms: number; id: number }[];
let send: ReturnType<typeof vi.fn<(alarm: DueAlarm, keys: typeof KEYS) => Promise<PushOutcome>>>;
let clock: AlarmClock;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  repo = pushRepository(db);
  now = T0;
  timers = [];
  send = vi.fn(async () => ({ ok: true }) as PushOutcome);
  let nextId = 1;
  clock = createAlarmClock({
    repo,
    send,
    keys: () => KEYS,
    now: () => now,
    setTimer: (callback, ms) => {
      const id = nextId++;
      timers.push({ callback, ms, id });
      return id;
    },
    clearTimer: (handle) => {
      timers = timers.filter((timer) => timer.id !== handle);
    },
  });
  repo.subscribe(PHONE);
});

/** Move the clock to `ms` past T0 and run whatever timer is armed, then let the firing finish. */
async function tick(ms: number) {
  now = T0 + ms;
  const armed = timers.splice(0);
  for (const timer of armed) timer.callback();
  await clock.settled();
}

describe("pure bits", () => {
  test("delayUntil is never negative and never past the platform ceiling", () => {
    expect(delayUntil(at(60_000), T0)).toBe(60_000);
    expect(delayUntil(at(-5), T0)).toBe(0);
    expect(delayUntil(at(1e12), T0)).toBe(2_147_483_647);
  });

  test("isStale is an hour past the end", () => {
    expect(isStale(at(0), T0 + STALE_MS)).toBe(false);
    expect(isStale(at(0), T0 + STALE_MS + 1)).toBe(true);
  });
});

test("arm sets one timer for the soonest alarm and none when there is nothing", () => {
  clock.arm();
  expect(timers).toEqual([]);
  repo.setAlarm({ endpoint: PHONE.endpoint, timerId: "long", label: "Rest", url: "/r", endsAt: at(1_200_000) });
  repo.setAlarm({ endpoint: PHONE.endpoint, timerId: "short", label: "Boil", url: "/r", endsAt: at(300_000) });
  clock.arm();
  expect(timers.map((timer) => timer.ms)).toEqual([300_000]);
  clock.arm();
  expect(timers).toHaveLength(1);
  clock.stop();
  expect(timers).toEqual([]);
});

test("firing sends what is due with the device and the keys, drops it, and re-arms for the next", async () => {
  repo.setAlarm({ endpoint: PHONE.endpoint, timerId: "short", label: "Boil", url: "/recipes/pasta/cook", endsAt: at(300_000) });
  repo.setAlarm({ endpoint: PHONE.endpoint, timerId: "long", label: "Rest", url: "/recipes/pasta", endsAt: at(1_200_000) });
  clock.arm();
  await tick(300_000);
  expect(send).toHaveBeenCalledTimes(1);
  const [alarm, keys] = send.mock.calls[0]!;
  expect(alarm).toMatchObject({ timerId: "short", label: "Boil", url: "/recipes/pasta/cook", subscription: { endpoint: PHONE.endpoint } });
  expect(keys).toEqual(KEYS);
  expect(repo.listAlarms(PHONE.endpoint).map((a) => a.timerId)).toEqual(["long"]);
  expect(timers.map((timer) => timer.ms)).toEqual([900_000]);
  await tick(1_200_000);
  expect(send).toHaveBeenCalledTimes(2);
  expect(timers).toEqual([]);
});

test("a stale alarm is dropped unsent, as after a restart over dinner", async () => {
  repo.setAlarm({ endpoint: PHONE.endpoint, timerId: "old", label: "Yesterday", url: "/", endsAt: at(-STALE_MS - 1) });
  repo.setAlarm({ endpoint: PHONE.endpoint, timerId: "late", label: "Just now", url: "/", endsAt: at(-1000) });
  clock.arm();
  expect(timers.map((timer) => timer.ms)).toEqual([0]);
  await tick(0);
  expect(send.mock.calls.map(([alarm]) => alarm.timerId)).toEqual(["late"]);
  expect(repo.listAlarms(PHONE.endpoint)).toEqual([]);
});

test("a device the push service says is gone is forgotten, with its other alarms", async () => {
  send.mockResolvedValueOnce({ ok: false, status: 410, gone: true });
  repo.setAlarm({ endpoint: PHONE.endpoint, timerId: "a", label: "A", url: "/", endsAt: at(1000) });
  repo.setAlarm({ endpoint: PHONE.endpoint, timerId: "b", label: "B", url: "/", endsAt: at(5000) });
  clock.arm();
  await tick(1000);
  expect(repo.subscription(PHONE.endpoint)).toBeNull();
  expect(repo.nextEndsAt()).toBeNull();
  expect(timers).toEqual([]);
});

test("a refusal that is not gone keeps the device", async () => {
  send.mockResolvedValueOnce({ ok: false, status: 500, gone: false });
  repo.setAlarm({ endpoint: PHONE.endpoint, timerId: "a", label: "A", url: "/", endsAt: at(1000) });
  clock.arm();
  await tick(1000);
  expect(repo.subscription(PHONE.endpoint)).not.toBeNull();
  expect(repo.listAlarms(PHONE.endpoint)).toEqual([]);
});
