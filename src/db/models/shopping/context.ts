import type { Database } from "bun:sqlite";
import { orm } from "../../connection/client";
import { aisleRepository } from "../aisle/repo";
import { foodRepository } from "../food/repo";
import { unitRepository } from "../unit/repo";

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
