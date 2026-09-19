import { sql } from "drizzle-orm";
import { check, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { nowUtc } from "../columns";

/** The server's VAPID key pair: one row, made on first use, kept for good (015_push.sql). */
export const pushVapid = sqliteTable(
  "push_vapid",
  {
    id: text("id").primaryKey(),
    publicKey: text("public_key").notNull(),
    privateKey: text("private_key").notNull(),
    createdAt: text("created_at").notNull().default(nowUtc),
  },
  (t) => [check("one_row", sql`${t.id} = 'vapid'`)]
);

/** One browser that turned timer alerts on. The endpoint is its identity. */
export const pushSubscription = sqliteTable("push_subscription", {
  id: text("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: text("created_at").notNull().default(nowUtc),
});

/** A timer the server has been asked to fire: one per device and chip. */
export const timerAlarm = sqliteTable(
  "timer_alarm",
  {
    id: text("id").primaryKey(),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => pushSubscription.id, { onDelete: "cascade" }),
    timerId: text("timer_id").notNull(),
    label: text("label").notNull(),
    url: text("url").notNull().default("/"),
    endsAt: text("ends_at").notNull(),
    createdAt: text("created_at").notNull().default(nowUtc),
  },
  (t) => [unique("timer_alarm_device_timer").on(t.subscriptionId, t.timerId)]
);
