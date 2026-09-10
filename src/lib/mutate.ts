// The one mutation pattern: call a server function, then `router.invalidate()`.
//
// Route loaders are the only read path (no client cache), so after any write
// the router re-runs every active loader and the page reflects the new state.
// Awaiting invalidate() means a caller that navigates afterwards lands on
// fresh data. A failed write is rethrown untouched and nothing is invalidated.
//
//   const mutate = useMutate();
//   await mutate(() => updateRecipe({ data: { id, doc } }));
import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

/** The slice of the router a mutation needs. */
export type Invalidator = { invalidate: () => Promise<unknown> };

/** Run `write`, then invalidate the router's loaders. Pure apart from the two calls. */
export async function mutate<T>(router: Invalidator, write: () => Promise<T>): Promise<T> {
  const result = await write();
  await router.invalidate();
  return result;
}

/** `mutate` bound to the app router. */
export function useMutate(): <T>(write: () => Promise<T>) => Promise<T> {
  const router = useRouter();
  return useCallback(<T,>(write: () => Promise<T>) => mutate(router, write), [router]);
}
