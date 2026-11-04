import { createRouter } from "@tanstack/react-router";
import { RouteError, RouteNotFound, RoutePending } from "./app/pages/RouteStates";
import { routeTree } from "./routes/tree";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPendingComponent: RoutePending,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
  });
}

// Type registration: gives Link, useNavigate and the hooks the tree's paths and search types.
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

declare module "@tanstack/react-start" {
  interface Register {
    ssr: true;
    router: ReturnType<typeof getRouter>;
  }
}
