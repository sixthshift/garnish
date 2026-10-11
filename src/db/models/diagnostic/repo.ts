import type { Database } from "bun:sqlite";
import { desc, eq, notInArray, sql } from "drizzle-orm";
import { lazy } from "../../../lib/lazy";
import { getDb } from "../../../server/core/db";
import { orm } from "../../connection/client";
import { diagnosticEvent } from "./schema";

export type DiagnosticSource = "server" | "browser" | "ai";
export type DiagnosticLevel = "error" | "warning";

/** A value JSON can carry: what `detail` is once it has been through the column. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** One failure, as Settings › Diagnostics reads it. `detail` is the parsed JSON object, or null. */
export type DiagnosticEvent = {
  id: string;
  /** ISO 8601 UTC. */
  occurredAt: string;
  source: DiagnosticSource;
  level: DiagnosticLevel;
  name: string;
  message: string;
  detail: { [key: string]: Json } | null;
  version: string;
};

/** What `record` takes: `detail` is anything JSON.stringify accepts. */
export type DiagnosticInput = Omit<DiagnosticEvent, "id" | "occurredAt" | "detail"> & { occurredAt?: string; detail: Record<string, unknown> | null };

/** How many rows are kept: the newest, so a loop that fails on every request cannot grow the database without end. */
export const DIAGNOSTICS_KEPT = 500;

function parseDetail(text: string | null): { [key: string]: Json } | null {
  if (text === null) return null;
  try {
    const value = JSON.parse(text) as Json;
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : { value };
  } catch {
    return { text };
  }
}

export function diagnosticRepository(db: Database, options: { kept?: number } = {}) {
  const dz = orm(db);
  const kept = options.kept ?? DIAGNOSTICS_KEPT;

  return {
    /** Keep one event, then drop whatever has fallen past the newest `kept`. */
    record(input: DiagnosticInput): DiagnosticEvent {
      const id = crypto.randomUUID();
      const { detail, occurredAt, ...rest } = input;
      dz.insert(diagnosticEvent)
        .values({ id, ...rest, ...(occurredAt ? { occurredAt } : {}), detail: detail === null ? null : JSON.stringify(detail) })
        .run();
      const newest = dz.select({ id: diagnosticEvent.id }).from(diagnosticEvent).orderBy(desc(diagnosticEvent.occurredAt), desc(sql`rowid`)).limit(kept);
      dz.delete(diagnosticEvent).where(notInArray(diagnosticEvent.id, newest)).run();
      const row = dz.select().from(diagnosticEvent).where(eq(diagnosticEvent.id, id)).get();
      return { ...row!, detail: parseDetail(row!.detail) };
    },

    /** The newest first, at most `limit` of them. */
    list(limit = 200): DiagnosticEvent[] {
      return dz
        .select()
        .from(diagnosticEvent)
        .orderBy(desc(diagnosticEvent.occurredAt), desc(sql`rowid`))
        .limit(limit)
        .all()
        .map((row) => ({ ...row, detail: parseDetail(row.detail) }));
    },

    count: (): number => dz.select({ n: sql<number>`count(*)` }).from(diagnosticEvent).get()?.n ?? 0,

    /** Forget every event. */
    clear(): void {
      dz.delete(diagnosticEvent).run();
    },
  };
}

export type DiagnosticRepository = ReturnType<typeof diagnosticRepository>;

export default lazy(getDb, diagnosticRepository);
