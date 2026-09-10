// Register the service worker built by src/sw/plugin.ts. Production only: in
// dev there is no /sw.js, and a stale worker would hide Vite's live updates.
// The registration itself is fire-and-forget; a failure just means no offline
// support this visit.

/** The slice of `navigator` used. `serviceWorker` is absent in unsupported or insecure contexts. */
export type ServiceWorkerNavigatorLike = {
  serviceWorker?: { register: (url: string, options?: { scope?: string }) => Promise<unknown> };
};

export const SW_URL = "/sw.js";

/**
 * Register `/sw.js` at scope `/` when `production` and the API exists.
 * Returns whether a registration was attempted. Never throws or rejects.
 */
export function registerServiceWorker(navigatorLike: ServiceWorkerNavigatorLike | undefined, production: boolean): boolean {
  const api = navigatorLike?.serviceWorker;
  if (!production || !api) return false;
  try {
    void Promise.resolve(api.register(SW_URL, { scope: "/" })).catch(() => {});
  } catch {
    return false;
  }
  return true;
}
