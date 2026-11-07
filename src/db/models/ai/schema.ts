import { sql } from "drizzle-orm";
import { check, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nowUtc } from "../columns";

/** A model chosen in Settings for a use (033_ai_setting.sql): the cooking assistant's alone. */
export const aiSetting = sqliteTable(
  "ai_setting",
  {
    use: text("use", { enum: ["cook"] }).primaryKey(),
    model: text("model").notNull(),
    updatedAt: text("updated_at").notNull().default(nowUtc),
  },
  (t) => [check("ai_setting_use", sql`${t.use} IN ('cook')`)]
);
