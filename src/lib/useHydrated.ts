import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False while React is hydrating server HTML (and on the server), true from the
 * render after, and true at once for anything mounted later. For markup that
 * must not depend on the address or the browser until the page is the
 * browser's: the one cached shell answers every address offline
 * (decisions.md row 169).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
