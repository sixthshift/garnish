import type { MealieIngredient, MealiePart, MealieRecipe } from "../mealie/types";

/** One of Tandoor's ingredient rows, already parsed by Tandoor. */
export type TandoorIngredient = MealieIngredient & {
  /**
   * The child recipe this row stands for (Tandoor's `step_recipe`), when that
   * recipe is in the same export. Empty on an ordinary row.
   */
  recipeName: string;
};

/**
 * A part as this import builds it: one or more of Tandoor's steps under one
 * name, owning their lines in `ingredients` (a `ScrapedPart`) and the
 * structure Tandoor had already parsed out of them in `rows`. `stepRows` says
 * which rows belong to which step — `stepRows[i]` holds indices into `rows` —
 * so the draft can link them without `suggestLinks` having to guess.
 */
export type TandoorPart = Omit<MealiePart, "rows"> & { rows: TandoorIngredient[]; stepRows: number[][] };

/** A Tandoor recipe as this app's fields, landing on the same review a Mealie one does. */
export type TandoorRecipe = Omit<MealieRecipe, "parts" | "source"> & { source: "tandoor"; parts: TandoorPart[] };
