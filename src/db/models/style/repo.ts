import type { Database } from "bun:sqlite";
import { asc, eq, max } from "drizzle-orm";
import { orm } from "../../connection/client";
import { nowUtc } from "../columns";
import { styleRule } from "./schema";

export type StyleRule = {
  id: string;
  position: number;
  text: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StyleRuleInput = { text: string; enabled?: boolean; position?: number };

// Ties fall back to created_at so a list seeded in one transaction reads in the order it was written.
const order = [asc(styleRule.position), asc(styleRule.createdAt)];

export function styleRules(db: Database) {
  const dz = orm(db);

  function get(id: string): StyleRule | null {
    return dz.select().from(styleRule).where(eq(styleRule.id, id)).get() ?? null;
  }

  function nextPosition(): number {
    const row = dz
      .select({ n: max(styleRule.position) })
      .from(styleRule)
      .get();
    return row?.n === null || row?.n === undefined ? 0 : row.n + 1;
  }

  return {
    /** The whole guide in reading order. */
    list: (): StyleRule[] =>
      dz
        .select()
        .from(styleRule)
        .orderBy(...order)
        .all(),
    get,

    /** New statements go to the foot of the list unless a position is given, and are on unless told otherwise. */
    create(input: StyleRuleInput): StyleRule {
      const id = crypto.randomUUID();
      dz.insert(styleRule)
        .values({
          id,
          position: input.position ?? nextPosition(),
          text: input.text.trim(),
          enabled: input.enabled ?? true,
        })
        .run();
      return get(id)!;
    },

    /** Merge `patch` into the statement and stamp `updated_at`. Null when `id` is unknown. */
    update(id: string, patch: Partial<StyleRuleInput>): StyleRule | null {
      const current = get(id);
      if (!current) return null;
      dz.update(styleRule)
        .set({
          position: patch.position ?? current.position,
          text: patch.text === undefined ? current.text : patch.text.trim(),
          enabled: patch.enabled ?? current.enabled,
          updatedAt: nowUtc,
        })
        .where(eq(styleRule.id, id))
        .run();
      return get(id);
    },

    /** True when a row was deleted. Nothing references a statement, so it goes alone. */
    remove: (id: string): boolean => dz.delete(styleRule).where(eq(styleRule.id, id)).returning({ id: styleRule.id }).all().length > 0,

    /**
     * Set every statement's position to its index in `ids`, in one transaction —
     * the reorder control always sends the full order. An id that is not a real
     * statement is a no-op UPDATE for that one. Returns the guide afterwards, in
     * the new order. `updated_at` does not move: a reorder changes the guide, not
     * the statement.
     */
    reorder(ids: readonly string[]): StyleRule[] {
      dz.transaction((tx) => {
        ids.forEach((id, index) => {
          tx.update(styleRule).set({ position: index }).where(eq(styleRule.id, id)).run();
        });
      });
      return dz
        .select()
        .from(styleRule)
        .orderBy(...order)
        .all();
    },
  };
}

export type StyleRuleRepository = ReturnType<typeof styleRules>;
