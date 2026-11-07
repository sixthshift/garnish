import { useEffect, useRef } from "react";
import { startCooking } from "../../../../api/rpc/cooking";
import { useMutate } from "../../../../lib/mutate";
import { toastError } from "../../../../lib/toast";
import type { CookSession } from "../../cooking";
import type { Choices } from "../../recipe";

/**
 * Cooking with no session yet — Start cooking, or Home's Cook — begins one at
 * the page's servings and choices, once, and reloads the page's data so the
 * session is in it (decisions.md row 214). A session already there is
 * resumed as it is.
 */
export function useCookingSession(input: {
  recipeId: string;
  cooking: boolean;
  session: CookSession | null;
  servings: number | undefined;
  choices: Choices | undefined;
}): void {
  const mutate = useMutate();
  const started = useRef<string | null>(null);
  const { recipeId, cooking, session, servings, choices } = input;
  useEffect(() => {
    if (!cooking || session !== null || started.current === recipeId) return;
    started.current = recipeId;
    mutate(() => startCooking({ data: { recipeId, servings: servings ?? null, choices: choices ?? null } })).catch((error) => {
      started.current = null;
      toastError("Could not start cooking", error);
    });
  }, [cooking, session, recipeId, servings, choices, mutate]);
}
