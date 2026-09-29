import type { Database } from "bun:sqlite";
import { eq } from "drizzle-orm";
import { lazy } from "../../../lib/lazy";
import { getDb } from "../../../server/core/db";
import { orm } from "../../connection/client";
import { seedBatch } from "./schema";

export function seedBatchRepository(db: Database) {
  const dz = orm(db);
  return {
    /** Whether the batch of this name has been applied to this database. */
    applied: (name: string): boolean => dz.select().from(seedBatch).where(eq(seedBatch.name, name)).get() !== undefined,
    /** Record the batch as applied. A second record of the same name is a no-op. */
    record: (name: string): void => {
      dz.insert(seedBatch).values({ name }).onConflictDoNothing().run();
    },
  };
}

export type SeedBatchRepository = ReturnType<typeof seedBatchRepository>;

/** The repository over the application database. Tests build their own with `seedBatchRepository(db)`. */
export default lazy(getDb, seedBatchRepository);
