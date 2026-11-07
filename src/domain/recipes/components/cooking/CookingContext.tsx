import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { isStepTicked, subscribeTicks } from "../../../../lib/ticks";
import type { AdjustmentMark } from "../../cooking";
import type { Recipe } from "../../recipe";

/**
 * What the page knows while it is cooked from (decisions.md row 214): the
 * step being cooked, and each row tonight has changed with what it read
 * before. Absent when the page is not cooking, so a row reads it and draws
 * nothing extra.
 */
export type CookingValue = {
  /** The first step not ticked, in the recipe's order: the one marked Now. Null once every step is done. */
  nowStepId: string | null;
  /** Each changed ingredient or step, by id. */
  marks: ReadonlyMap<string, AdjustmentMark>;
  /** What a changed ingredient read before tonight, at the page's servings. */
  was: ReadonlyMap<string, string>;
};

const CookingContext = createContext<CookingValue | null>(null);

export function CookingProvider({ value, children }: { value: CookingValue | null; children: ReactNode }) {
  return <CookingContext.Provider value={value}>{children}</CookingContext.Provider>;
}

/** The cooking state, or null when the page is not being cooked from. */
export function useCooking(): CookingValue | null {
  return useContext(CookingContext);
}

/** The first step of `recipe` not ticked off, or null. Pure over a tick reader. */
export function firstUndoneStep(recipe: Pick<Recipe, "parts">, ticked: (stepId: string) => boolean): string | null {
  for (const part of recipe.parts) {
    for (const step of part.steps) if (!ticked(step.id)) return step.id;
  }
  return null;
}

/** The step marked Now, following the ticks as they change anywhere on the page. Null on the server. */
export function useNowStep(recipe: Recipe, enabled: boolean): string | null {
  const read = () => {
    if (!enabled || typeof window === "undefined") return null;
    const storage = window.sessionStorage;
    return firstUndoneStep(recipe, (stepId) => isStepTicked(storage, recipe.id, stepId));
  };
  const [now, setNow] = useState(read);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `read` closes over these; re-subscribing on each is the point.
  useEffect(() => {
    setNow(read());
    return subscribeTicks(() => setNow(read()));
  }, [recipe, enabled]);
  return now;
}
