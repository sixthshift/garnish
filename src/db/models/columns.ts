import { sql } from "drizzle-orm";

/** `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`, the default every timestamp column carries. */
export const nowUtc = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
