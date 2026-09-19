import type { Database } from "bun:sqlite";
import { and, asc, eq, lte, min } from "drizzle-orm";
import { lazy } from "../../../lib/lazy";
import { getDb } from "../../../server/core/db";
import { orm } from "../../connection/client";
import { pushSubscription, pushVapid, timerAlarm } from "./schema";

export type VapidKeys = { publicKey: string; privateKey: string };

export type PushSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
};

/** What a browser hands over when it subscribes: the endpoint and the two keys the payload is encrypted to. */
export type SubscriptionInput = { endpoint: string; p256dh: string; auth: string };

export type TimerAlarm = {
  id: string;
  subscriptionId: string;
  timerId: string;
  label: string;
  url: string;
  /** ISO 8601 UTC. */
  endsAt: string;
  createdAt: string;
};

/** An alarm the server can fire: the row and the device it goes to. */
export type DueAlarm = TimerAlarm & { subscription: PushSubscription };

export type AlarmInput = { endpoint: string; timerId: string; label: string; url: string; endsAt: string };

const VAPID_ROW = "vapid";

export function pushRepository(db: Database) {
  const dz = orm(db);

  function subscription(endpoint: string): PushSubscription | null {
    return dz.select().from(pushSubscription).where(eq(pushSubscription.endpoint, endpoint)).get() ?? null;
  }

  function alarm(id: string): TimerAlarm | null {
    return dz.select().from(timerAlarm).where(eq(timerAlarm.id, id)).get() ?? null;
  }

  return {
    /** The server's key pair, or null before the first `setVapid`. */
    vapid: (): VapidKeys | null => {
      const row = dz.select().from(pushVapid).where(eq(pushVapid.id, VAPID_ROW)).get();
      return row ? { publicKey: row.publicKey, privateKey: row.privateKey } : null;
    },

    /** Keep `keys` as the server's pair. Only ever called once: a second pair would orphan every phone. */
    setVapid(keys: VapidKeys): VapidKeys {
      dz.insert(pushVapid)
        .values({ id: VAPID_ROW, ...keys })
        .run();
      return keys;
    },

    subscription,
    listSubscriptions: (): PushSubscription[] => dz.select().from(pushSubscription).orderBy(asc(pushSubscription.createdAt)).all(),

    /** Keep a browser's subscription. The endpoint is the identity, so the same one again just refreshes its keys. */
    subscribe(input: SubscriptionInput): PushSubscription {
      const existing = subscription(input.endpoint);
      if (existing) {
        dz.update(pushSubscription).set({ p256dh: input.p256dh, auth: input.auth }).where(eq(pushSubscription.id, existing.id)).run();
        return subscription(input.endpoint)!;
      }
      const id = crypto.randomUUID();
      dz.insert(pushSubscription)
        .values({ id, ...input })
        .run();
      return subscription(input.endpoint)!;
    },

    /** Forget a browser and every alarm it had. True when there was one. */
    unsubscribe: (endpoint: string): boolean =>
      dz.delete(pushSubscription).where(eq(pushSubscription.endpoint, endpoint)).returning({ id: pushSubscription.id }).all().length > 0,

    /** Forget a subscription the push service says is gone (404 or 410). */
    removeSubscription: (id: string): boolean =>
      dz.delete(pushSubscription).where(eq(pushSubscription.id, id)).returning({ id: pushSubscription.id }).all().length > 0,

    /**
     * Ask for `timerId` to fire at `endsAt` on the device with `endpoint`. The
     * same chip again (a restart, a resume) replaces its alarm. Null when the
     * device is unknown, which is a browser whose alerts were turned off.
     */
    setAlarm(input: AlarmInput): TimerAlarm | null {
      const device = subscription(input.endpoint);
      if (!device) return null;
      const current = dz
        .select()
        .from(timerAlarm)
        .where(and(eq(timerAlarm.subscriptionId, device.id), eq(timerAlarm.timerId, input.timerId)))
        .get();
      const values = { label: input.label, url: input.url, endsAt: input.endsAt };
      if (current) {
        dz.update(timerAlarm).set(values).where(eq(timerAlarm.id, current.id)).run();
        return alarm(current.id);
      }
      const id = crypto.randomUUID();
      dz.insert(timerAlarm)
        .values({ id, subscriptionId: device.id, timerId: input.timerId, ...values })
        .run();
      return alarm(id);
    },

    /** Drop `timerId`'s alarm on the device with `endpoint` (a pause or a dismiss). True when there was one. */
    clearAlarm(endpoint: string, timerId: string): boolean {
      const device = subscription(endpoint);
      if (!device) return false;
      return (
        dz
          .delete(timerAlarm)
          .where(and(eq(timerAlarm.subscriptionId, device.id), eq(timerAlarm.timerId, timerId)))
          .returning({ id: timerAlarm.id })
          .all().length > 0
      );
    },

    /** Drop one alarm by id, once it is sent. */
    removeAlarm: (id: string): boolean => dz.delete(timerAlarm).where(eq(timerAlarm.id, id)).returning({ id: timerAlarm.id }).all().length > 0,

    /** Every alarm for `endpoint`, soonest first. */
    listAlarms(endpoint: string): TimerAlarm[] {
      const device = subscription(endpoint);
      if (!device) return [];
      return dz.select().from(timerAlarm).where(eq(timerAlarm.subscriptionId, device.id)).orderBy(asc(timerAlarm.endsAt)).all();
    },

    /** The alarms whose end has passed at `now` (ISO), each with its device, soonest first. */
    due(now: string): DueAlarm[] {
      return dz
        .select({ alarm: timerAlarm, subscription: pushSubscription })
        .from(timerAlarm)
        .innerJoin(pushSubscription, eq(pushSubscription.id, timerAlarm.subscriptionId))
        .where(lte(timerAlarm.endsAt, now))
        .orderBy(asc(timerAlarm.endsAt))
        .all()
        .map((row) => ({ ...row.alarm, subscription: row.subscription }));
    },

    /** The soonest end time of any alarm (ISO), or null when there are none. */
    nextEndsAt(): string | null {
      const row = dz
        .select({ at: min(timerAlarm.endsAt) })
        .from(timerAlarm)
        .get();
      return row?.at ?? null;
    },
  };
}

export type PushRepository = ReturnType<typeof pushRepository>;

/** The repository over the application database. Tests build their own with `pushRepository(db)`. */
export default lazy(getDb, pushRepository);
