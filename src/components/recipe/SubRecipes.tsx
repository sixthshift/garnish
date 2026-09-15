import { createContext, type ReactNode, useContext, useMemo } from "react";
import { type SubRecipe, subRecipeMap } from "../../domain/recipe";
import type { Food } from "../../domain/reference";

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

/**
 * The whole map, for a caller that looks several rows' foods up while
 * rendering one list — the shopping sheet's "Add hollandaise's ingredients
 * instead" option — rather than one at a time through `useSubRecipe`,
 * which would mean a hook call per row. Empty outside the provider.
 */
export function useSubRecipes(): ReadonlyMap<string, SubRecipe> {
  return useContext(SubRecipesContext) ?? new Map();
}
