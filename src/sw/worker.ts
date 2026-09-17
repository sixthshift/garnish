// Fetch policy: navigations go network-first with the cached shell as fallback, built assets cache-first, GET server functions and images network-first into a data cache that survives deploys, anything else untouched.

import { isSkipWaiting } from "./message";

export type SwConfig = {
  /** Build hash. Names the precache; a new one evicts the old on activate. */
  version: string;
  /** The URL whose response is the SPA shell. */
  shell: string;
  /** Same-origin paths cached on install, e.g. "/assets/index-abc.js". */
  precache: string[];
};

/** The slice of `Request` the policies read. */
export type RequestLike = { method: string; url: string; mode: string };

/** The slice of `Cache` used. */
export type CacheLike = {
  match: (request: RequestLike | string) => Promise<Response | undefined>;
  put: (request: RequestLike | string, response: Response) => Promise<void>;
  addAll: (requests: string[]) => Promise<void>;
};

/** The slice of `CacheStorage` used. */
export type CacheStorageLike = {
  open: (name: string) => Promise<CacheLike>;
  keys: () => Promise<string[]>;
  delete: (name: string) => Promise<boolean>;
};

export type ExtendableEventLike = { waitUntil: (promise: Promise<unknown>) => void };
/** The slice of a `message` event the worker reads. */
export type MessageEventLike = { data: unknown };
export type FetchEventLike = ExtendableEventLike & {
  request: RequestLike;
  respondWith: (response: Promise<Response> | Response) => void;
};

/** The slice of `ServiceWorkerGlobalScope` used. */
export type ServiceWorkerScopeLike = {
  location: { origin: string };
  caches: CacheStorageLike;
  fetch: (request: RequestLike | string) => Promise<Response>;
  skipWaiting: () => Promise<void>;
  clients: { claim: () => Promise<void> };
  addEventListener: {
    (type: "install", listener: (event: ExtendableEventLike) => void): void;
    (type: "activate", listener: (event: ExtendableEventLike) => void): void;
    (type: "fetch", listener: (event: FetchEventLike) => void): void;
    (type: "message", listener: (event: MessageEventLike) => void): void;
  };
};

export const CACHE_PREFIX = "garnish-";
export const DATA_CACHE = `${CACHE_PREFIX}data-v1`;

/** The name of the precache for a build. Pure. */
export function precacheName(version: string): string {
  return `${CACHE_PREFIX}precache-${version}`;
}

export type Policy = "navigation" | "asset" | "data" | "passthrough";

/** Which policy handles a request. Pure. `precache` holds same-origin paths. */
export function classifyRequest(request: RequestLike, origin: string, precache: ReadonlySet<string>): Policy {
  if (request.method !== "GET") return "passthrough";
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return "passthrough";
  }
  if (url.origin !== origin) return "passthrough";
  if (request.mode === "navigate") return "navigation";
  const path = url.pathname;
  if (path.startsWith("/assets/") || precache.has(path)) return "asset";
  if (path.startsWith("/_serverFn/") || path.startsWith("/api/images/")) return "data";
  return "passthrough";
}

/** A same-origin 503 for when neither the network nor a cache can answer. */
function offlineResponse(): Response {
  return new Response("offline", { status: 503, statusText: "Service Unavailable", headers: { "content-type": "text/plain" } });
}

/** Wire the install, activate and fetch handlers onto `scope`. */
export function installServiceWorker(scope: ServiceWorkerScopeLike, config: SwConfig): void {
  const precache = new Set(config.precache);
  const precacheCache = precacheName(config.version);
  const keep = new Set([precacheCache, DATA_CACHE]);

  // No skipWaiting here: a new worker installs and then waits, so a deploy
  // never pulls the assets out from under a page that is already running (the
  // activate below deletes the old precache). The page offers the update and
  // sends SKIP_WAITING when it is taken. On a first install there is nothing
  // to wait behind, so the worker activates at once and claims the page.
  scope.addEventListener("install", (event) => {
    event.waitUntil(scope.caches.open(precacheCache).then((cache) => cache.addAll([config.shell, ...config.precache])));
  });

  scope.addEventListener("message", (event) => {
    if (isSkipWaiting(event.data)) void scope.skipWaiting();
  });

  scope.addEventListener("activate", (event) => {
    event.waitUntil(
      scope.caches
        .keys()
        .then((names) => Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && !keep.has(name)).map((name) => scope.caches.delete(name))))
        .then(() => scope.clients.claim())
    );
  });

  const navigation = async (request: RequestLike): Promise<Response> => {
    try {
      return await scope.fetch(request);
    } catch {
      const cache = await scope.caches.open(precacheCache);
      return (await cache.match(config.shell)) ?? offlineResponse();
    }
  };

  const cacheFirst = async (request: RequestLike): Promise<Response> => {
    const cache = await scope.caches.open(precacheCache);
    const hit = await cache.match(request);
    if (hit) return hit;
    const response = await scope.fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  };

  const networkFirst = async (request: RequestLike): Promise<Response> => {
    const cache = await scope.caches.open(DATA_CACHE);
    try {
      const response = await scope.fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      return (await cache.match(request)) ?? offlineResponse();
    }
  };

  scope.addEventListener("fetch", (event) => {
    switch (classifyRequest(event.request, scope.location.origin, precache)) {
      case "navigation":
        event.respondWith(navigation(event.request));
        return;
      case "asset":
        event.respondWith(cacheFirst(event.request));
        return;
      case "data":
        event.respondWith(networkFirst(event.request));
        return;
      case "passthrough":
        return;
    }
  });
}
