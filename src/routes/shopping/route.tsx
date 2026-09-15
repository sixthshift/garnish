import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import type { Aisle } from "../../domain/reference";
import type { ShoppingItem } from "../../domain/shopping";
import { listAisles } from "../../server/fns/aisles";
import { listShoppingItems } from "../../server/fns/shopping";
import { Route as rootRoute } from "../root";

export type ShoppingListData = { items: ShoppingItem[]; aisles: Aisle[] };

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/shopping",
  loader: async (): Promise<ShoppingListData> => {
    const [items, aisles] = await Promise.all([listShoppingItems(), listAisles({ data: {} })]);
    return { items, aisles };
  },
  component: lazyRouteComponent(() => import("./page"), "ShoppingPage"),
});
