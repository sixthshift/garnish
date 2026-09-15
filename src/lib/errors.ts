export type ErrorDescription = {
  title: string;
  detail: string;
  /** True when the failure is the network, not the app. */
  network: boolean;
};

/** Whether `error` is the TypeError a failed `fetch` rejects with, in any browser or in Bun. Pure. */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  return /fetch|network|load failed/i.test(error.message);
}

/**
 * Title and detail for an error view. A network failure while the browser
 * says it is offline is the user's connection; while online it is the server;
 * anything else is shown as itself. Pure.
 */
export function describeError(error: unknown, online = true): ErrorDescription {
  if (isNetworkError(error)) {
    if (!online) {
      return { title: "You are offline", detail: "Reconnect, then retry.", network: true };
    }
    return { title: "Can't reach the server", detail: "garnish is not answering. Check it is running, then retry.", network: true };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { title: "Something went wrong", detail: message === "" ? "No details were given." : message, network: false };
}
