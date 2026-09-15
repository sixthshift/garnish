import type { Database } from "bun:sqlite";
import { orm } from "../../connection/client";
import { aisles as aisleRepository } from "../aisle/repo";
import { foods as foodRepository } from "../food/repo";
import { units as unitRepository } from "../unit/repo";

export type ShoppingContext = {
  dz: ReturnType<typeof orm>;
  units: ReturnType<typeof unitRepository>;
  foods: ReturnType<typeof foodRepository>;
  aisles: ReturnType<typeof aisleRepository>;
};

export function shoppingContext(db: Database): ShoppingContext {
  return {
    dz: orm(db),
    units: unitRepository(db),
    foods: foodRepository(db),
    aisles: aisleRepository(db),
  };
}
