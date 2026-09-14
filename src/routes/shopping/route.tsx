// shopping: the route. What the URL carries, what the loader reads, and
// the page it renders, loaded on demand. The page itself is page.tsx.
import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { Route as rootRoute } from "../root";
import type { Aisle } from "../../domain/recipe/recipe";
import { type ShoppingItem } from "../../domain/shopping/shopping";
import { listAisles } from "../../server/fns/aisles";
import { listShoppingItems } from "../../server/fns/shopping";

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
