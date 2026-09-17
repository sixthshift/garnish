// The one message the page sends the worker. Its own file because both sides
// import it and neither should pull the other's code in: the page must not
// bundle the worker, and the worker must not bundle the app.

/** "Stop waiting and take over": what the update prompt's Reload sends. */
export const SKIP_WAITING = { type: "garnish:skip-waiting" } as const;

/** Whether a received message is the skip-waiting one. Pure; `data` is untrusted. */
export function isSkipWaiting(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as { type?: unknown }).type === SKIP_WAITING.type;
}
