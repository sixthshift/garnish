import { useEffect, useState } from "react";
import { usingFood } from "../../../../../api/rpc/foods";
import type { RecipeSummary } from "../../../../../domain/recipes/recipe";

/**
 * The recipes that use the food, asked for whenever it changes: the same
 * query the delete confirm uses, so a food's details and the warning agree.
 * Null while asking; a failure reads as none.
 */
export function useFoodUsage(foodId: string): RecipeSummary[] | null {
  const [using, setUsing] = useState<RecipeSummary[] | null>(null);
  useEffect(() => {
    let live = true;
    setUsing(null);
    usingFood({ data: { id: foodId } }).then(
      (list) => live && setUsing(list),
      () => live && setUsing([])
    );
    return () => {
      live = false;
    };
  }, [foodId]);
  return using;
}
