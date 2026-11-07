import type { Database } from "bun:sqlite";
import { eq } from "drizzle-orm";
import { type Adjustment, type CookMessage, type CookNote, type CookSession, cookSessionSchema, withAdjustment } from "../../../domain/recipes/cooking";
import { lazy } from "../../../lib/lazy";
import { getDb } from "../../../server/core/db";
import { orm } from "../../connection/client";
import { cookSession } from "./schema";

type Row = typeof cookSession.$inferSelect;

/** A row as the domain's document, its lists checked; a list that no longer reads is empty rather than a crash. */
function toSession(row: Row): CookSession {
  const read = cookSessionSchema.safeParse(row);
  if (read.success) return read.data;
  return cookSessionSchema.parse({ ...row, adjustments: [], notes: [], messages: [] });
}

const now = () => new Date().toISOString();

/**
 * The cooking sessions (032_cook_session.sql), one per recipe. Every write
 * reads the session, changes it as the domain says and writes it back whole,
 * stamping `updated_at`; each returns the session as it now is, or null when
 * the recipe has none.
 */
export function cookingRepository(db: Database) {
  const dz = orm(db);

  const get = (recipeId: string): CookSession | null => {
    const row = dz.select().from(cookSession).where(eq(cookSession.recipeId, recipeId)).get();
    return row ? toSession(row) : null;
  };

  const change = (recipeId: string, next: (session: CookSession) => Partial<Pick<CookSession, "adjustments" | "notes" | "messages">>): CookSession | null => {
    const session = get(recipeId);
    if (session === null) return null;
    dz.update(cookSession)
      .set({ ...next(session), updatedAt: now() })
      .where(eq(cookSession.recipeId, recipeId))
      .run();
    return get(recipeId);
  };

  return {
    get,

    /** Begin cooking: a fresh session, replacing any the recipe had. */
    start(recipeId: string, input: { servings: number | null; choices: Record<string, string> | null }): CookSession {
      const stamp = now();
      dz.delete(cookSession).where(eq(cookSession.recipeId, recipeId)).run();
      dz.insert(cookSession)
        .values({ id: crypto.randomUUID(), recipeId, servings: input.servings, choices: input.choices, startedAt: stamp, updatedAt: stamp })
        .run();
      return get(recipeId)!;
    },

    /** Take an adjustment, replacing an earlier one to the same row. */
    adjust: (recipeId: string, adjustment: Adjustment) => change(recipeId, (session) => ({ adjustments: withAdjustment(session.adjustments, adjustment) })),

    /** Put an adjustment back: the row as the recipe has it. */
    unadjust: (recipeId: string, adjustmentId: string) =>
      change(recipeId, (session) => ({ adjustments: session.adjustments.filter((adjustment) => adjustment.id !== adjustmentId) })),

    note: (recipeId: string, note: CookNote) => change(recipeId, (session) => ({ notes: [...session.notes, note] })),

    /** Add turns of the conversation, in order. */
    say: (recipeId: string, messages: CookMessage[]) => change(recipeId, (session) => ({ messages: [...session.messages, ...messages] })),

    /** End the session: the review saved, or the cook discarded it. True when there was one. */
    remove(recipeId: string): boolean {
      if (get(recipeId) === null) return false;
      dz.delete(cookSession).where(eq(cookSession.recipeId, recipeId)).run();
      return true;
    },
  };
}

export type CookingRepository = ReturnType<typeof cookingRepository>;

/** The repository over the application database. Tests build their own with `cookingRepository(db)`. */
export default lazy(getDb, cookingRepository);
