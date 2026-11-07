import type { Database } from "bun:sqlite";
import { eq } from "drizzle-orm";
import { lazy } from "../../../lib/lazy";
import { getDb } from "../../../server/core/db";
import { orm } from "../../connection/client";
import { aiSetting } from "./schema";

/** A use whose model can be chosen in Settings (decisions.md row 215). */
export type ChosenUse = (typeof aiSetting.$inferSelect)["use"];

/** The models chosen in Settings › AI (033_ai_setting.sql), one per use. */
export function aiSettingRepository(db: Database) {
  const dz = orm(db);
  return {
    /** The model chosen for `use`, or null when it asks the environment. */
    model(use: string): string | null {
      if (use !== "cook") return null;
      return dz.select({ model: aiSetting.model }).from(aiSetting).where(eq(aiSetting.use, use)).get()?.model ?? null;
    },

    /** Choose a model for `use`; null goes back to the environment's. */
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
