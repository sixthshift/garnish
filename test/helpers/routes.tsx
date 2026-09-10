// Render a page through the real route tree with a memory history, the way the
// browser would after navigation: loaders run in `router.load()`, then the tree
// renders to a string. Route tests that hit loaders must also `vi.mock` the
// `src/server/*` modules through `runLocally` (see ./server.ts).
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { RouteError, RouteNotFound, RoutePending } from "../../src/components/RouteStates";
import { routeTree } from "../../src/routeTree.gen";

export async function renderRoute(path: string): Promise<string> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPendingComponent: RoutePending,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
  });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}
