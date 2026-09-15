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
  return useCallback(<T>(write: () => Promise<T>) => mutate(router, write), [router]);
}
