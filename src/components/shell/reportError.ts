// Errors the browser catches, sent back to the server to be written down
// (decisions.md row 166). Without this, an error view's message is the only
// trace of a failure the server never saw — a render, a chunk that would not
// load — and it is gone when the tab closes.

import { isNotFound, isRedirect } from "@tanstack/react-router";
import { isNetworkError } from "../../lib/errors";
import { buildLabel } from "../../lib/version";
import { reportClientError } from "../../server/fns/diagnostics";

export type ClientErrorReport = Parameters<typeof reportClientError>[0]["data"];
type Where = ClientErrorReport["where"];

/** At most this many reports per page load, so an error thrown on every frame cannot flood the log. */
export const REPORTS_PER_LOAD = 10;

/**
 * The report for a thrown value, or null for one not worth sending: a network
 * failure (the server cannot hear about it, and the view already says so), a
 * redirect or a not-found (answers, not faults). Pure.
 */
export function clientErrorReport(error: unknown, where: Where, context: { page: string; userAgent: string; build?: string }): ClientErrorReport | null {
  if (isNetworkError(error) || isRedirect(error) || isNotFound(error)) return null;
  const message = error instanceof Error ? error.message || error.name : typeof error === "string" ? error : (JSON.stringify(error) ?? String(error));
  const stack = error instanceof Error && error.stack ? error.stack : "";
  return {
    where,
    message: message.slice(0, 4_000),
    stack: stack.slice(0, 16_000),
    page: context.page.slice(0, 2_000),
    build: context.build ?? buildLabel(),
    userAgent: context.userAgent.slice(0, 400),
  };
}

/** Sends reports through `send`, once per distinct message and place, and no more than `limit` in all. */
export function createReporter(send: (report: ClientErrorReport) => Promise<unknown>, limit = REPORTS_PER_LOAD) {
  const sent = new Set<string>();
  return (report: ClientErrorReport | null): void => {
    if (report === null || sent.size >= limit) return;
    const key = `${report.where}\n${report.message}`;
    if (sent.has(key)) return;
    sent.add(key);
    // Reporting must never become a failure of its own: a server that cannot be reached loses the report.
    send(report).catch(() => {});
  };
}

const report = createReporter((data) => reportClientError({ data }));

/** Send `error` to the server's diagnostics, as caught at `where`. A no-op outside a browser. */
export function reportError(error: unknown, where: Where): void {
  if (typeof window === "undefined") return;
  report(clientErrorReport(error, where, { page: window.location.pathname + window.location.search, userAgent: navigator.userAgent }));
}

/** Report what no boundary catches: an error thrown outside React, and a promise nobody awaited. Returns the undo. */
export function installErrorReporting(target: Window): () => void {
  const onError = (event: ErrorEvent) => reportError(event.error ?? event.message, "window");
  const onRejection = (event: PromiseRejectionEvent) => reportError(event.reason, "promise");
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
  };
}
