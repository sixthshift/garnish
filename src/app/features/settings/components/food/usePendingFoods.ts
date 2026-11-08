import { useMemo, useState } from "react";
import { updateFood } from "../../../../../api/rpc/foods";
import type { FoodRow } from "../../../../../domain/recipes/reference";
import { useMutate } from "../../../../../lib/mutate";
import { toastError } from "../../../../../lib/toast";

/** A quick edit to one of a food's own fields: the grid's cells, the phone's sheet. */
export type FoodPatch = Partial<Pick<FoodRow, "name" | "aliases" | "aisleId" | "skipShopping">>;

/**
 * The foods with every edit saved but not yet brought back by the reload laid
 * over them, so a change shows at once, and `save`, which writes one. When a
 * save lands it takes back only what it set, and only where no later edit has
 * changed it since: two quick edits to one food each keep their own.
 */
export function usePendingFoods(foods: readonly FoodRow[]) {
  const mutate = useMutate();
  const [pending, setPending] = useState<Record<string, FoodPatch>>({});
  const shown = useMemo(() => foods.map((food) => (pending[food.id] ? { ...food, ...pending[food.id] } : food)), [foods, pending]);

  /** Write `patch`; `onSaved` runs once it is saved, a failure is a toast. */
  const save = async (food: FoodRow, patch: FoodPatch, onSaved?: () => void) => {
    setPending((all) => ({ ...all, [food.id]: { ...all[food.id], ...patch } }));
    try {
      await mutate(() => updateFood({ data: { id: food.id, ...patch } }));
      onSaved?.();
    } catch (error) {
      toastError(`Could not save ${food.name}`, error);
    } finally {
      setPending((all) => {
        const { [food.id]: mine, ...rest } = all;
        const left: FoodPatch = { ...mine };
        for (const key of Object.keys(patch) as (keyof FoodPatch)[]) if (left[key] === patch[key]) delete left[key];
        return Object.keys(left).length === 0 ? rest : { ...rest, [food.id]: left };
      });
    }
  };

  return { shown, save };
}
