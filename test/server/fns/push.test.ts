// The push server functions over a fresh database: a public key that is made
// once, a subscription kept by endpoint, and alarms set and cleared per chip.
import { expect, test } from "vitest";
import pushRepo from "../../../src/db/models/push/repo";
import { clearTimerAlarm, getPushPublicKey, setTimerAlarm, subscribePush, unsubscribePush } from "../../../src/server/fns/push";
import { alarms } from "../../../src/server/push/alarms";
import { callServerFn, useTempDataDir } from "../../helpers/server";

useTempDataDir();

const PHONE = { endpoint: "https://push.example/a", keys: { p256dh: "p", auth: "a" } };

test("the public key is made on first ask and is the same after", async () => {
  const first = await callServerFn(getPushPublicKey);
  expect(first.publicKey.length).toBeGreaterThan(40);
  expect(await callServerFn(getPushPublicKey)).toEqual(first);
});

test("subscribe keeps the device; an alarm is set for it and cleared; unsubscribe forgets both", async () => {
  expect((await callServerFn(setTimerAlarm, { endpoint: PHONE.endpoint, timerId: "t", label: "Boil", url: "/r", endsAt: Date.now() + 60_000 })).set).toBe(
    false
  );
  const { id } = await callServerFn(subscribePush, PHONE);
  expect((await callServerFn(subscribePush, PHONE)).id).toBe(id);
  const endsAt = Date.now() + 60_000;
  expect((await callServerFn(setTimerAlarm, { endpoint: PHONE.endpoint, timerId: "t", label: " Boil ", url: "/recipes/x/cook", endsAt })).set).toBe(true);
  expect(pushRepo.listAlarms(PHONE.endpoint)).toMatchObject([{ timerId: "t", label: "Boil", url: "/recipes/x/cook", endsAt: new Date(endsAt).toISOString() }]);
  expect((await callServerFn(clearTimerAlarm, { endpoint: PHONE.endpoint, timerId: "t" })).cleared).toBe(true);
  expect((await callServerFn(clearTimerAlarm, { endpoint: PHONE.endpoint, timerId: "t" })).cleared).toBe(false);
  expect((await callServerFn(unsubscribePush, { endpoint: PHONE.endpoint })).removed).toBe(true);
  expect(pushRepo.subscription(PHONE.endpoint)).toBeNull();
  alarms.stop();
});

test("an alarm's url must be a same-origin path", async () => {
  await callServerFn(subscribePush, PHONE);
  await expect(
    callServerFn(setTimerAlarm, { endpoint: PHONE.endpoint, timerId: "t", label: "Boil", url: "https://evil.example/", endsAt: Date.now() + 1 })
  ).rejects.toThrow();
  await expect(
    callServerFn(setTimerAlarm, { endpoint: PHONE.endpoint, timerId: "t", label: "Boil", url: "//evil.example/", endsAt: Date.now() + 1 })
  ).rejects.toThrow();
  alarms.stop();
});
