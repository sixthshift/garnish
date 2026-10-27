import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import type { Aisle, FoodPack, Unit } from "../../domain/reference";
import type { ShoppingItem } from "../../domain/shopping";
import { listAisles } from "../../server/fns/aisles";
import { listFoodPacks } from "../../server/fns/foods";
import { listShoppingItems } from "../../server/fns/shopping";
import { listUnits } from "../../server/fns/units";
import { Route as rootRoute } from "../root";

export type ShoppingListData = {
  items: ShoppingItem[];
  aisles: Aisle[];
  /** Every food's sizes, which the aisle view rounds a line up to (decisions.md row 184). */
  packs: FoodPack[];
  /** Every unit: the sizes' units, and the "Sold in" Select. */
  units: Unit[];
};

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/shopping",
  loader: async (): Promise<ShoppingListData> => {
    const [items, aisles, packs, units] = await Promise.all([listShoppingItems(), listAisles({ data: {} }), listFoodPacks(), listUnits({ data: {} })]);
    return { items, aisles, packs, units };
  },
  component: lazyRouteComponent(() => import("./page"), "ShoppingPage"),
});
