import { desc, sql } from "drizzle-orm";
import { check, index, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nowUtc } from "../columns";
import { recipe } from "../recipe/schema";

export const timelineEvent = sqliteTable(
  "timeline_event",
  {
    id: text("id").primaryKey(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    /** Calendar date, `YYYY-MM-DD` — the cook happened on a day, not at an instant. */
    occurredOn: text("occurred_on").notNull(),
    message: text("message").notNull().default(""),
    /** File name under `DATA_DIR/images/timeline/`. */
    image: text("image"),
    createdAt: text("created_at").notNull().default(nowUtc),
    /** Servings the cook was made at, or NULL when not recorded. Added by `009_cook_servings.sql`, after `created_at` because `ALTER TABLE` appends. */
    servings: real("servings"),
  },
  (t) => [
    index("timeline_event_recipe_id").on(t.recipeId, desc(t.occurredOn)),
    check("occurred_on_is_a_date", sql`${t.occurredOn} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`),
  ]
);
