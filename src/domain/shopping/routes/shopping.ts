import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { listFoodPacks } from "../../../api/rpc/foods";
import { listShoppingItems } from "../../../api/rpc/shopping";
import { listUnits } from "../../../api/rpc/units";
import { Route as rootRoute } from "../../../routes/root";
import type { FoodPack, Unit } from "../../recipes/reference";
import type { ShoppingItem } from "../shopping";

export type ShoppingListData = {
  items: ShoppingItem[];
  /** Every food's sizes, which the aisle view rounds a line up to (decisions.md row 184). */
  packs: FoodPack[];
  /** Every unit: the sizes' units. */
  units: Unit[];
};

export const shoppingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "shopping",
  loader: async (): Promise<ShoppingListData> => {
    const [items, packs, units] = await Promise.all([listShoppingItems(), listFoodPacks(), listUnits({ data: {} })]);
    return { items, packs, units };
  },
  component: lazyRouteComponent(() => import("../pages/ShoppingPage"), "ShoppingPage"),
});
