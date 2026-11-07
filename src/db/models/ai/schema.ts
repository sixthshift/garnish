import { sql } from "drizzle-orm";
import { check, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nowUtc } from "../columns";

/** A model chosen in Settings for a use (033_ai_setting.sql, widened to every use by 034_ai_setting_uses.sql). */
export const aiSetting = sqliteTable(
  "ai_setting",
  {
    use: text("use", { enum: ["import", "restyle", "planner", "cook"] }).primaryKey(),
    model: text("model").notNull(),
    updatedAt: text("updated_at").notNull().default(nowUtc),
  },
  (t) => [check("ai_setting_use", sql`${t.use} IN ('import', 'restyle', 'planner', 'cook')`)]
);
