import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import pushRepo from "../../db/models/push/repo";
import { notFoundMiddleware } from "../core/fn";
import { alarms } from "../push/alarms";
import { vapidKeys } from "../push/vapid";

const Endpoint = z.url();

/** What `PushSubscription.toJSON()` gives the page: the endpoint and the two keys the payload is encrypted to. */
export const PushSubscriptionInput = z.object({
  endpoint: Endpoint,
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});
export type PushSubscriptionInput = z.infer<typeof PushSubscriptionInput>;

export const PushEndpoint = z.object({ endpoint: Endpoint });

/** A timer to fire: which device, which chip, what to say, where a tap goes, and when (epoch ms). */
export const TimerAlarmInput = z.object({
  endpoint: Endpoint,
  timerId: z.string().min(1),
  label: z.string().trim().min(1).max(500),
  // Same-origin only: the worker opens it, and a push must not open anywhere else.
  url: z.string().regex(/^\/(?!\/)/, "a same-origin path"),
  endsAt: z.number().int().positive(),
});
export type TimerAlarmInput = z.infer<typeof TimerAlarmInput>;

export const TimerAlarmKey = z.object({ endpoint: Endpoint, timerId: z.string().min(1) });

/** The server's public key, for `pushManager.subscribe`. Made on the first call and kept. */
export const getPushPublicKey = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .handler(async () => ({ publicKey: vapidKeys().publicKey }));

/** Keep a browser's subscription. The same endpoint again refreshes its keys. */
export const subscribePush = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(PushSubscriptionInput)
  .handler(async ({ data }) => {
    const row = pushRepo.subscribe({ endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth });
    return { id: row.id };
  });

/** Forget a browser and its alarms. */
export const unsubscribePush = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(PushEndpoint)
  .handler(async ({ data }) => {
    const removed = pushRepo.unsubscribe(data.endpoint);
    alarms.arm();
    return { removed };
  });

/** Fire `timerId` on this device at `endsAt`. False when the device has no subscription. */
export const setTimerAlarm = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(TimerAlarmInput)
  .handler(async ({ data }) => {
    const row = pushRepo.setAlarm({ ...data, endsAt: new Date(data.endsAt).toISOString() });
    alarms.arm();
    return { set: row !== null };
  });

/** Drop `timerId`'s alarm on this device: a pause or a dismiss. */
export const clearTimerAlarm = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(TimerAlarmKey)
  .handler(async ({ data }) => {
    const cleared = pushRepo.clearAlarm(data.endpoint, data.timerId);
    alarms.arm();
    return { cleared };
  });
