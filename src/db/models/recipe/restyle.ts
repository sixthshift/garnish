import { eq } from "drizzle-orm";
import type { Recipe } from "../../../domain/recipe";
import type { RecipeContext } from "./context";
import type { Readers } from "./read";
import { part, recipe } from "./schema";
import { nowUtc, type Writers } from "./write";

export function restylers(
  { dz }: RecipeContext,
  { rowById, getById }: Pick<Readers, "rowById" | "getById">,
  { partRows, stepTexts, replaceSteps }: Pick<Writers, "partRows" | "stepTexts" | "replaceSteps">
) {
  /**
   * Replace every part's steps with the accepted restyle, keeping
   * the author's words. `parts` pairs with the recipe's parts by position,
   * which is how the restyle read verified them (`matchParts`), so a count
   * that does not match is a broken answer and throws rather than guessing
   * which part was meant. Null when `id` is unknown.
   *
   * A part that has never been restyled has its current step texts copied
   * into `source_steps` first; one that already has them keeps what is
   * there, so "the original" stays the author's rather than becoming the
   * last rewrite. Then the steps themselves are replaced.
   */
  function restyleParts(id: string, parts: readonly { name: string; steps: readonly string[] }[]): Recipe | null {
    const current = rowById(id);
    if (!current) return null;
    const rows = partRows(id);
    if (rows.length !== parts.length) {
      throw new Error(`Restyle answered with ${parts.length} part${parts.length === 1 ? "" : "s"} where the recipe has ${rows.length}`);
    }
    dz.transaction((tx) => {
      rows.forEach((row, index) => {
        if (row.sourceSteps === null) {
          tx.update(part)
            .set({ sourceSteps: stepTexts(row.id) })
            .where(eq(part.id, row.id))
            .run();
        }
        replaceSteps(tx, row.id, parts[index]!.steps);
      });
      tx.update(recipe).set({ restyledAt: nowUtc, updatedAt: nowUtc }).where(eq(recipe.id, id)).run();
    });
    return getById(id);
  }

  /**
   * Put the author's words back: every part that kept
   * `source_steps` has them re-inserted as its steps, the column goes back
   * to NULL, and the recipe's stamp is cleared, so the page stops saying
   * "Restyled" and a later restyle starts from the original again. A part
   * that was never restyled is left exactly as it is. Null when `id` is
   * unknown; harmless when nothing was restyled.
   */
  function restoreParts(id: string): Recipe | null {
    const current = rowById(id);
    if (!current) return null;
    dz.transaction((tx) => {
      for (const row of partRows(id)) {
        if (row.sourceSteps === null) continue;
        replaceSteps(tx, row.id, row.sourceSteps);
        tx.update(part).set({ sourceSteps: null }).where(eq(part.id, row.id)).run();
      }
      tx.update(recipe).set({ restyledAt: null, updatedAt: nowUtc }).where(eq(recipe.id, id)).run();
    });
    return getById(id);
  }

  return { restyleParts, restoreParts };
}
