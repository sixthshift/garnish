import type { Database } from "bun:sqlite";
import { eq } from "drizzle-orm";
import { lazy } from "../../../lib/lazy";
import { getDb } from "../../../server/core/db";
import { orm } from "../../connection/client";
import { aiSetting } from "./schema";

/** A use whose model can be chosen in Settings: every one (decisions.md row 217). */
export type ChosenUse = (typeof aiSetting.$inferSelect)["use"];

/** The models chosen in Settings › AI (033_ai_setting.sql, 034_ai_setting_uses.sql), one per use. */
export function aiSettingRepository(db: Database) {
  const dz = orm(db);
  return {
    /** The model chosen for `use`, or null when none is. */
    model(use: ChosenUse): string | null {
      return dz.select({ model: aiSetting.model }).from(aiSetting).where(eq(aiSetting.use, use)).get()?.model ?? null;
    },

    /** Select a model for `use`; null clears it, leaving the use with none. */
    choose(use: ChosenUse, model: string | null): void {
      const name = model?.trim() ?? "";
      if (name === "") {
        dz.delete(aiSetting).where(eq(aiSetting.use, use)).run();
        return;
      }
      const updatedAt = new Date().toISOString();
      dz.insert(aiSetting)
        .values({ use, model: name, updatedAt })
        .onConflictDoUpdate({ target: aiSetting.use, set: { model: name, updatedAt } })
        .run();
    },
  };
}

export type AiSettingRepository = ReturnType<typeof aiSettingRepository>;

/** The repository over the application database. Tests build their own with `aiSettingRepository(db)`. */
export default lazy(getDb, aiSettingRepository);
