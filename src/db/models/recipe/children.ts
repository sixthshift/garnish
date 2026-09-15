import { asc, eq } from "drizzle-orm";
import { type ParsedRecipeInput, suggestLinks } from "../../../domain/recipe";
import type { Food, Tag, Unit } from "../../../domain/reference";
import type { Executor } from "../../connection/client";
import type { RecipeContext } from "./context";
import { ingredient, part, recipeNote, recipeTag, step, stepIngredient } from "./schema";

/** The reference resolution the child rows need: an id for a unit, a food or a tag. */
export type ChildRefs = {
  resolveUnit: (ref: Unit | null) => string | null;
  resolveFood: (ref: Food | null) => string | null;
  resolveTag: (ref: Tag) => string;
};

export function childWriters({ dz, foods }: RecipeContext, { resolveUnit, resolveFood, resolveTag }: ChildRefs) {
  /** Delete every child row and re-insert them from the document. */
  function writeChildren(tx: Executor, recipeId: string, doc: ParsedRecipeInput): void {
    // A part's kept original steps are not in the document, and a save
    // rewrites every part row, so they are carried across by part id: the
    // editor sends back the ids of the parts it loaded, and a part that keeps
    // its id keeps the author's words with it. A part the save invented has no
    // id to match and starts with none, which is right — it has no original.
    const keptSourceSteps = new Map(
      tx
        .select({ id: part.id, sourceSteps: part.sourceSteps })
        .from(part)
        .where(eq(part.recipeId, recipeId))
        .all()
        .filter((row): row is { id: string; sourceSteps: string[] } => row.sourceSteps !== null)
        .map((row) => [row.id, row.sourceSteps] as const)
    );

    // Steps and ingredients cascade from the part, and step links cascade from both.
    tx.delete(recipeTag).where(eq(recipeTag.recipeId, recipeId)).run();
    tx.delete(recipeNote).where(eq(recipeNote.recipeId, recipeId)).run();
    tx.delete(part).where(eq(part.recipeId, recipeId)).run(); // steps, ingredients and their links cascade

    for (const t of doc.tags) {
      tx.insert(recipeTag)
        .values({ recipeId, tagId: resolveTag(t) })
        .onConflictDoNothing()
        .run();
    }

    doc.notes.forEach((note, position) => {
      tx.insert(recipeNote)
        .values({ id: note.id ?? crypto.randomUUID(), recipeId, position, title: note.title, text: note.text })
        .run();
    });

    doc.parts.forEach((p, position) => {
      const partId = p.id ?? crypto.randomUUID();
      tx.insert(part)
        .values({ id: partId, recipeId, position, name: p.name, sourceSteps: keptSourceSteps.get(partId) ?? null })
        .run();
      // Ingredients first: their ids are what the part's steps may link to.
      // A line the document gave no id gets a fresh one, which nothing can name.
      const linkable = new Set<string>();
      p.ingredients.forEach((line, i) => {
        const ingredientId = line.id ?? crypto.randomUUID();
        linkable.add(ingredientId);
        tx.insert(ingredient)
          .values({
            id: ingredientId,
            partId,
            position: i,
            quantity: line.quantity,
            unitId: resolveUnit(line.unit),
            foodId: resolveFood(line.food),
            note: line.note,
            originalText: line.originalText,
            fixed: line.fixed,
          })
          .run();
      });
      // Then the steps, then their links: a link is dropped, not raised, when it
      // names an ingredient outside this part or names one twice. A saved recipe is never rejected over a stale link.
      p.steps.forEach((s, i) => {
        const stepId = s.id ?? crypto.randomUUID();
        tx.insert(step).values({ id: stepId, partId, position: i, text: s.text, image: s.image }).run();
        const seen = new Set<string>();
        for (const ingredientId of s.ingredientIds) {
          if (!linkable.has(ingredientId) || seen.has(ingredientId)) continue;
          seen.add(ingredientId);
          tx.insert(stepIngredient)
            .values({ stepId, ingredientId, position: seen.size - 1 })
            .run();
        }
      });
    });
  }

  // --- Restyle -------------------------------------------------------------
  // Replacing a part's steps with rewritten ones. Not a document
  // write: the restyle touches steps and nothing else, so it goes through
  // these rather than through `update`, which would want a whole recipe and
  // would rewrite ingredients, notes and tags on the way past.

  /** A recipe's parts in position order, with whatever original steps they kept. */
  const partRows = (recipeId: string) =>
    dz.select({ id: part.id, name: part.name, sourceSteps: part.sourceSteps }).from(part).where(eq(part.recipeId, recipeId)).orderBy(asc(part.position)).all();

  /** One part's step texts in position order: what `source_steps` is made of. */
  const stepTexts = (partId: string): string[] =>
    dz
      .select({ text: step.text })
      .from(step)
      .where(eq(step.partId, partId))
      .orderBy(asc(step.position))
      .all()
      .map((row) => row.text);

  /**
   * Swap a part's steps for `texts`, in order, with fresh ids.
   *
   * The links go with them: a step row is deleted, so its `step_ingredient`
   * rows cascade away, and a new row has nothing pointing at it. The step card
   * would lose its ingredient rows if nothing put them back, so `suggestLinks`
   * runs over the part's ingredients and the new texts — the same matcher the
   * editor and the importer use, which is the best available answer for a
   * sentence nobody has linked by hand.
   *
   * A step photo belongs to the step row it was attached to, and a
   * rewrite may merge two steps or split one, so there is no honest way to
   * carry a photo across: photos on replaced steps are lost. That is accepted
   * — the restyle is shown as a diff and approved before it runs.
   */
  function replaceSteps(tx: Executor, partId: string, texts: readonly string[]): void {
    tx.delete(step).where(eq(step.partId, partId)).run(); // links cascade from the step

    const ingredients = dz
      .select({ id: ingredient.id, foodId: ingredient.foodId })
      .from(ingredient)
      .where(eq(ingredient.partId, partId))
      .orderBy(asc(ingredient.position))
      .all()
      .map((row) => ({ id: row.id, food: row.foodId === null ? null : (foods.get(row.foodId) ?? null) }));

    const linked = suggestLinks({
      ingredients,
      steps: texts.map((text) => ({ id: crypto.randomUUID(), text, ingredientIds: [] as string[] })),
    });

    linked.forEach((s, position) => {
      tx.insert(step).values({ id: s.id, partId, position, text: s.text, image: null }).run();
      s.ingredientIds.forEach((ingredientId, i) => {
        tx.insert(stepIngredient).values({ stepId: s.id, ingredientId, position: i }).run();
      });
    });
  }

  return { writeChildren, partRows, stepTexts, replaceSteps };
}
