import type { Database } from "bun:sqlite";
import { orm } from "../../connection/client";
import { aisles as aisleRepository } from "../aisle/repo";
import { foods as foodRepository } from "../food/repo";
import { tags as tagRepository } from "../tag/repo";
import { units as unitRepository } from "../unit/repo";

export type RecipeContext = {
  dz: ReturnType<typeof orm>;
  units: ReturnType<typeof unitRepository>;
  foods: ReturnType<typeof foodRepository>;
  aisles: ReturnType<typeof aisleRepository>;
  tags: ReturnType<typeof tagRepository>;
};

export function recipeContext(db: Database): RecipeContext {
  return {
    dz: orm(db),
    units: unitRepository(db),
    foods: foodRepository(db),
    aisles: aisleRepository(db),
    tags: tagRepository(db),
  };
}
