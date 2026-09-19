// The push repository (015_push.sql): the server's one key pair, a browser's
// subscription keyed by its endpoint, and the alarms the server has been asked
// to fire, one per device and chip.
import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../src/db/connection/open";
import { migrate } from "../../src/db/migrations/migrate";
import { type PushRepository, pushRepository } from "../../src/db/models/push/repo";

let db: Database;
let repo: PushRepository;
beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  repo = pushRepository(db);
});

const PHONE = { endpoint: "https://push.example/a", p256dh: "p1", auth: "a1" };
const TABLET = { endpoint: "https://push.example/b", p256dh: "p2", auth: "a2" };
const T0 = "2026-09-19T10:00:00.000Z";
const alarm = (over: Partial<Parameters<PushRepository["setAlarm"]>[0]> = {}) => ({
  endpoint: PHONE.endpoint,
  timerId: "step#0#20 minutes",
  label: "Simmer",
  url: "/recipes/ragu",
  endsAt: "2026-09-19T10:20:00.000Z",
  ...over,
});

test("the key pair is null until set, then read back; a second set is refused by the one-row check", () => {
  expect(repo.vapid()).toBeNull();
  expect(repo.setVapid({ publicKey: "pub", privateKey: "priv" })).toEqual({ publicKey: "pub", privateKey: "priv" });
  expect(repo.vapid()).toEqual({ publicKey: "pub", privateKey: "priv" });
  expect(() => repo.setVapid({ publicKey: "pub2", privateKey: "priv2" })).toThrow();
});

test("subscribe keeps a device once per endpoint, refreshing its keys on a repeat", () => {
  const first = repo.subscribe(PHONE);
  expect(first).toMatchObject(PHONE);
  const again = repo.subscribe({ ...PHONE, auth: "a1-rotated" });
  expect(again.id).toBe(first.id);
  expect(again.auth).toBe("a1-rotated");
  repo.subscribe(TABLET);
  expect(repo.listSubscriptions().map((s) => s.endpoint)).toEqual([PHONE.endpoint, TABLET.endpoint]);
  expect(repo.subscription(PHONE.endpoint)?.id).toBe(first.id);
  expect(repo.subscription("https://push.example/none")).toBeNull();
});

test("an alarm needs a known device, replaces itself per chip, and clears", () => {
  expect(repo.setAlarm(alarm())).toBeNull();
  repo.subscribe(PHONE);
  const set = repo.setAlarm(alarm())!;
  expect(set).toMatchObject({ timerId: "step#0#20 minutes", label: "Simmer", url: "/recipes/ragu", endsAt: "2026-09-19T10:20:00.000Z" });
  const restarted = repo.setAlarm(alarm({ endsAt: "2026-09-19T10:25:00.000Z" }))!;
  expect(restarted.id).toBe(set.id);
  expect(repo.listAlarms(PHONE.endpoint)).toHaveLength(1);
  repo.setAlarm(alarm({ timerId: "step#0#5 minutes", endsAt: "2026-09-19T10:05:00.000Z" }));
  expect(repo.listAlarms(PHONE.endpoint).map((a) => a.timerId)).toEqual(["step#0#5 minutes", "step#0#20 minutes"]);
  expect(repo.clearAlarm(PHONE.endpoint, "step#0#20 minutes")).toBe(true);
  expect(repo.clearAlarm(PHONE.endpoint, "step#0#20 minutes")).toBe(false);
  expect(repo.clearAlarm("https://push.example/none", "x")).toBe(false);
  expect(repo.listAlarms(PHONE.endpoint).map((a) => a.timerId)).toEqual(["step#0#5 minutes"]);
});

test("due lists what has passed with its device, soonest first, and nextEndsAt is the soonest of all", () => {
  repo.subscribe(PHONE);
  repo.subscribe(TABLET);
  expect(repo.nextEndsAt()).toBeNull();
  expect(repo.due(T0)).toEqual([]);
  repo.setAlarm(alarm({ endsAt: "2026-09-19T10:20:00.000Z" }));
  repo.setAlarm(alarm({ endpoint: TABLET.endpoint, timerId: "t", endsAt: "2026-09-19T10:05:00.000Z" }));
  repo.setAlarm(alarm({ timerId: "later", endsAt: "2026-09-19T11:00:00.000Z" }));
  expect(repo.nextEndsAt()).toBe("2026-09-19T10:05:00.000Z");
  const due = repo.due("2026-09-19T10:20:00.000Z");
  expect(due.map((a) => [a.timerId, a.subscription.endpoint])).toEqual([
    ["t", TABLET.endpoint],
    ["step#0#20 minutes", PHONE.endpoint],
  ]);
  expect(repo.removeAlarm(due[0]!.id)).toBe(true);
  expect(repo.removeAlarm(due[0]!.id)).toBe(false);
  expect(repo.nextEndsAt()).toBe("2026-09-19T10:20:00.000Z");
});

test("unsubscribing or removing a device takes its alarms with it", () => {
  const phone = repo.subscribe(PHONE);
  repo.subscribe(TABLET);
  repo.setAlarm(alarm());
  repo.setAlarm(alarm({ endpoint: TABLET.endpoint }));
  expect(repo.unsubscribe(PHONE.endpoint)).toBe(true);
  expect(repo.unsubscribe(PHONE.endpoint)).toBe(false);
  expect(repo.listAlarms(PHONE.endpoint)).toEqual([]);
  expect(repo.due("2026-09-19T12:00:00.000Z")).toHaveLength(1);
  expect(repo.removeSubscription(phone.id)).toBe(false);
  expect(repo.removeSubscription(repo.subscription(TABLET.endpoint)!.id)).toBe(true);
  expect(repo.due("2026-09-19T12:00:00.000Z")).toEqual([]);
});
