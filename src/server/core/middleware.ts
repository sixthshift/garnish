// The app-wide middleware src/start.ts registers: every failure a server
// function or an /api route throws is written down on its way out (decisions.md
// row 166), then thrown on unchanged, so the caller sees what it always saw.
// The bodies run on the server alone; Start's compiler strips them, and the
// imports only they use, from the client build.

import { createMiddleware } from "@tanstack/react-start";
import diagnostics, { isExpected } from "./diagnostics";

/** Function middleware, outermost: a server function that throws anything but a redirect or a not-found is recorded under its name. */
export const recordFunctionFailures = createMiddleware({ type: "function" }).server(async ({ next, serverFnMeta }) => {
  try {
    return await next();
  } catch (error) {
    if (!isExpected(error)) diagnostics.failure("server", serverFnMeta.name, error, { file: serverFnMeta.filename });
    throw error;
  }
});

/** Whether a request is one of the outside-facing /api routes, the only router requests that can fail on the server. Pure. */
export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/**
 * Request middleware: an /api route that throws, or answers 5xx, is recorded
 * under its method and path. A 4xx is the caller's mistake and is told to the
 * caller; server functions are left to the function middleware, which knows
 * their names.
 */
export const recordApiFailures = createMiddleware().server(async ({ next, request, pathname, handlerType }) => {
  if (handlerType !== "router" || !isApiPath(pathname)) return next();
  const name = `${request.method} ${pathname}`;
  try {
    const result = await next();
    if (result.response.status >= 500) {
      diagnostics.record({ source: "server", level: "error", name, message: `Answered ${result.response.status}`, detail: { status: result.response.status } });
    }
    return result;
  } catch (error) {
    if (!isExpected(error)) diagnostics.failure("server", name, error);
    throw error;
  }
});
