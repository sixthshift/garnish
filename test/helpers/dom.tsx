// The DOM project's render helper. `test/helpers/routes.tsx` renders the real
// route tree to a string with loaders run; this one mounts a component into a
// live DOM, with just enough router around it for a `Link` to resolve. Loaders
// and server functions stay out: these tests are about what a component does
// when you press it, not about what a page fetches.
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * Mount `ui` at `path` inside a memory router. The tree is the mounted
 * component plus a splat route, so a `Link` to anywhere in the app resolves
 * to a real href instead of throwing, and `router.state.location` says where a
 * click went. Returns Testing Library's result with the router beside it.
 */
export async function renderInRouter(ui: ReactNode, path = "/") {
  const rootRoute = createRootRoute();
  const atPath = createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => <>{ui}</> });
  // Every other address in the app, so a Link has somewhere to point.
  const anywhere = createRoute({ getParentRoute: () => rootRoute, path: "$", component: () => null });
  const router = createRouter({
    routeTree: rootRoute.addChildren([atPath, anywhere]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  return { ...render(<RouterProvider router={router as never} />), router };
}
