import { createContext, type ReactNode, useContext } from "react";
import type { Recipe } from "../../../../domain/recipe";
import { useMutate } from "../../../../lib/mutate";
import type { RunWrite } from "./saveQuickEdit";

/** What a row needs to edit itself: the stored (unscaled) document, and the page's `mutate`. */
export type QuickEditContext = { recipe: Recipe; run: RunWrite };

const Context = createContext<QuickEditContext | null>(null);

/**
 * Makes every ingredient and step row below it quick-editable. The recipe must
 * be the stored document, not the scaled view of it: what a save writes is
 * this, with one row changed.
 */
export function QuickEditProvider({ recipe, children }: { recipe: Recipe; children: ReactNode }) {
  const run = useMutate();
  return <Context.Provider value={{ recipe, run }}>{children}</Context.Provider>;
}

/** The quick-edit context, or null outside a provider (cook mode, the editor). */
export function useQuickEditContext(): QuickEditContext | null {
  return useContext(Context);
}
