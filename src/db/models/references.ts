import type { Food, Unit } from "../../domain/recipes/reference";
import type { AisleRepository } from "./aisle/repo";
import type { FoodRepository } from "./food/repo";
import type { UnitRepository } from "./unit/repo";

/** How a document reads a stored unit or food id: the unit, or the food with its aisle; null for none or a missing row. */
export type ReferenceReader = { unit: (id: string | null) => Unit | null; food: (id: string | null) => Food | null };

/**
 * A reader over the reference repositories that looks each id up once: make
 * one per document assembled, so a recipe or a list naming the same food
 * twenty times reads it once.
 */
export function referenceReader(repos: { units: UnitRepository; foods: FoodRepository; aisles: AisleRepository }): ReferenceReader {
  const units = new Map<string, Unit | null>();
  const foods = new Map<string, Food | null>();
  return {
    unit(id) {
      if (!id) return null;
      if (!units.has(id)) units.set(id, repos.units.get(id));
      return units.get(id) ?? null;
    },
    food(id) {
      if (!id) return null;
      if (!foods.has(id)) {
        const row = repos.foods.get(id);
        if (!row) foods.set(id, null);
        else {
          const { aisleId, ...rest } = row;
          foods.set(id, { ...rest, aisle: aisleId ? repos.aisles.get(aisleId) : null });
        }
      }
      return foods.get(id) ?? null;
    },
  };
}
