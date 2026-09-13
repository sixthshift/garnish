// The sub-recipes the page knows about, for the ingredient rows to look their
// food's child up in (M32.3, decisions.md row 70).
//
// A context rather than a prop drilled through `IngredientList`, `StepCard`
// and the phone's ingredients sheet: a row that happens to be a sub-recipe is
// the same row everywhere, and the view route is the one place that has the
// children — its loader fetches them all in one call. Outside the provider
// (cook mode, the editor's preview) `useSubRecipe` answers null and a row is
// exactly what it was before, which is how the rest of the page's optional
// behaviour is wired (see `QuickEditProvider`).
import { createContext, type ReactNode, useContext, useMemo } from "react";
import type { Food } from "../domain/recipe";
import { type SubRecipe, subRecipeMap } from "../domain/subRecipe";

const SubRecipesContext = createContext<ReadonlyMap<string, SubRecipe> | null>(null);

export type SubRecipesProviderProps = { children: ReactNode; subRecipes: readonly SubRecipe[] };

export function SubRecipesProvider({ children, subRecipes }: SubRecipesProviderProps) {
  const map = useMemo(() => subRecipeMap(subRecipes), [subRecipes]);
  return <SubRecipesContext.Provider value={map}>{children}</SubRecipesContext.Provider>;
}

/** The recipe this food is made by, when the page fetched it. Null outside the provider, or for a plain food. */
export function useSubRecipe(food: Food | null): SubRecipe | null {
  const map = useContext(SubRecipesContext);
  if (map === null || food === null || food.recipeId === null) return null;
  return map.get(food.recipeId) ?? null;
}
