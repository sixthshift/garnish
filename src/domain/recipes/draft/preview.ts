import type { Alternative, Ingredient, Recipe } from "../recipe";
import type { DraftIngredient, RecipeDraft } from "./types";

/** The id a preview gives a recipe that has none yet. Never sent anywhere: a preview writes nothing. */
export const PREVIEW_ID = "preview";

/**
 * A line as the stored row it will be. Its unit, food and alternatives are the
 * library's own rows (or a placeholder made whole, `placeholderFood`,
 * `unitReference`), typed loosely only because the draft is the write shape,
 * where the schema would fill their defaults; they are taken as they are. Pure.
 */
function rowOf(row: DraftIngredient, id: string): Ingredient {
  return {
    id,
    quantity: row.quantity ?? null,
    unit: (row.unit ?? null) as Ingredient["unit"],
    food: (row.food ?? null) as Ingredient["food"],
    note: row.note ?? "",
    originalText: row.originalText ?? "",
    fixed: row.fixed ?? false,
    alternatives: (row.alternatives ?? []) as Alternative[],
  };
}

/**
 * The draft as the recipe it will be saved as, for the editor's live preview
 * (decisions.md row 207): every field the save would default filled in, and a
 * row with no id yet given one by its place, so the view can key on it. Unlike
 * `validateDraft` it never refuses: a recipe with no name yet is still worth
 * looking at while it is typed. The server's slug and timestamps are blank. Pure.
 */
export function previewRecipe(draft: RecipeDraft): Recipe {
  return {
    ...draft,
    yieldUnit: draft.yieldUnit as Recipe["yieldUnit"],
    tags: draft.tags as Recipe["tags"],
    id: draft.id ?? PREVIEW_ID,
    slug: "",
    restyledAt: null,
    createdAt: "",
    updatedAt: "",
    notes: draft.notes.map((note, index) => ({ id: note.id ?? `note-${index}`, title: note.title ?? "", text: note.text ?? "" })),
    parts: draft.parts.map((part, pi) => ({
      id: part.id ?? `part-${pi}`,
      name: part.name ?? "",
      ingredients: part.ingredients.map((row, ii) => rowOf(row, row.id ?? `ingredient-${pi}-${ii}`)),
      steps: part.steps.map((step, si) => ({
        id: step.id ?? `step-${pi}-${si}`,
        title: step.title ?? "",
        text: step.text ?? "",
        summary: step.summary ?? "",
        ingredientIds: step.ingredientIds ?? [],
        image: step.image ?? null,
      })),
    })),
  };
}
