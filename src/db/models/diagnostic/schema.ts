import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nowUtc } from "../columns";

/** One failure the app noticed: a server function, an /api route, a browser or a model call (020_diagnostics.sql). */
export const diagnosticEvent = sqliteTable(
  "diagnostic_event",
  {
    id: text("id").primaryKey(),
    occurredAt: text("occurred_at").notNull().default(nowUtc),
    source: text("source", { enum: ["server", "browser", "ai"] }).notNull(),
    level: text("level", { enum: ["error", "warning"] }).notNull(),
    name: text("name").notNull(),
    message: text("message").notNull(),
    detail: text("detail"),
    version: text("version").notNull(),
  },
  (t) => [index("diagnostic_event_occurred_at").on(t.occurredAt)]
);
