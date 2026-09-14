// The recipe editor's state: a recipe as it is being edited, before it is a document.
import { type RecipeInput, type Tag, type Unit } from "../recipe";

export type PartInput = RecipeInput["parts"][number];

export type DraftIngredient = NonNullable<PartInput["ingredients"]>[number];

export type DraftStep = NonNullable<PartInput["steps"]>[number];

export type DraftNote = NonNullable<RecipeInput["notes"]>[number];

/** A part input with both lists present, so the editor never has to default them. */
export type DraftPart = Omit<PartInput, "ingredients" | "steps"> & { ingredients: DraftIngredient[]; steps: DraftStep[] };

/** A `RecipeInput` with every field present, so each input has a value to control. */
export type RecipeDraft = {
  id?: string;
  name: string;
  description: string;
  image: string | null;
  rating: number | null;
  lastMade: string | null;
  recipeServings: number;
  recipeYieldQuantity: number;
  yieldUnit: Unit | null;
  recipeYield: string;
  prepTime: number | null;
  performTime: number | null;
  sourceUrl: string | null;
  favourite: boolean;
  notes: DraftNote[];
  tags: Tag[];
  parts: DraftPart[];
};
