// The service worker against a fake ServiceWorkerGlobalScope: `caches`,
// `fetch`, `addEventListener`, `skipWaiting`, `clients`. The controller is
// installed on the fake directly, and once more from the real built sw.js
// (bundled here with the same plugin the build uses) evaluated with the fake
// as `self`, which is the stand-in for the "go offline, reload" Check.
import { describe, expect, test, vi } from "vitest";
import { buildServiceWorker, precacheList, SHELL_URL, stampVersion, versionOf } from "../../src/sw/plugin";
import {
  type CacheLike,
  classifyRequest,
  DATA_CACHE,
  type ExtendableEventLike,
  type FetchEventLike,
  installServiceWorker,
  precacheName,
  type RequestLike,
  type ServiceWorkerScopeLike,
} from "../../src/sw/worker";

const ORIGIN = "http://garnish.local";
const url = (path: string) => `${ORIGIN}${path}`;
const keyOf = (request: RequestLike | string) => (typeof request === "string" ? new URL(request, ORIGIN).href : new URL(request.url, ORIGIN).href);

type Listener<E> = (event: E) => void;

/** A fake scope. `fetch` is a vi.fn the test drives; caches are in-memory maps. */
function fakeScope() {
  const stores = new Map<string, Map<string, Response>>();
  const listeners = {
    install: [] as Listener<ExtendableEventLike>[],
    activate: [] as Listener<ExtendableEventLike>[],
    fetch: [] as Listener<FetchEventLike>[],
  };
  const fetch = vi.fn<(request: RequestLike | string) => Promise<Response>>();

  const openCache = (name: string): CacheLike => {
    const store = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, store);
    return {
      match: async (request) => store.get(keyOf(request))?.clone(),
      put: async (request, response) => void store.set(keyOf(request), response),
      addAll: async (requests) => {
        for (const request of requests) {
          const response = await fetch(url(request));
          if (!response.ok) throw new TypeError(`addAll: ${request} answered ${response.status}`);
          store.set(keyOf(request), response);
        }
      },
    };
  };

  const scope: ServiceWorkerScopeLike = {
    location: { origin: ORIGIN },
    caches: {
      open: async (name) => openCache(name),
      keys: async () => [...stores.keys()],
      delete: async (name) => stores.delete(name),
    },
    fetch,
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
    addEventListener: ((type: keyof typeof listeners, listener: Listener<never>) => {
      listeners[type].push(listener as never);
    }) as ServiceWorkerScopeLike["addEventListener"],
  };

  const extendable = () => {
    const pending: Promise<unknown>[] = [];
    return { event: { waitUntil: (promise: Promise<unknown>) => void pending.push(promise) }, settle: () => Promise.all(pending) };
  };

  return {
    scope,
    fetch,
    stores,
    cached: (name: string, path: string) => stores.get(name)?.get(keyOf(path)),
    async install() {
      const { event, settle } = extendable();
      for (const listener of listeners.install) listener(event);
      await settle();
    },
    async activate() {
      const { event, settle } = extendable();
      for (const listener of listeners.activate) listener(event);
      await settle();
    },
    /** Dispatch a fetch event; resolves to the response handed to respondWith, or null when none was. */
    async dispatch(request: RequestLike): Promise<Response | null> {
      let handled: Promise<Response> | Response | null = null;
      const { event, settle } = extendable();
      const fetchEvent: FetchEventLike = { ...event, request, respondWith: (response) => void (handled = response) };
      for (const listener of listeners.fetch) listener(fetchEvent);
      await settle();
      return handled === null ? null : await handled;
    },
  };
}

const request = (path: string, init: Partial<RequestLike> = {}): RequestLike => ({ method: "GET", url: url(path), mode: "cors", ...init });
const ok = (body: string, type = "text/plain") => new Response(body, { status: 200, headers: { "content-type": type } });
const offline = () => Promise.reject(new TypeError("Failed to fetch"));

const config = { version: "abc123", shell: SHELL_URL, precache: ["/assets/index-abc.js", "/assets/styles-def.css", "/manifest.webmanifest"] };
const PRECACHE = precacheName(config.version);

/** A scope answering every precache URL with a 200 whose body is its path. */
function installedScope() {
  const world = fakeScope();
  world.fetch.mockImplementation(async (req) => ok(`body of ${new URL(keyOf(req)).pathname}`, "text/html"));
  installServiceWorker(world.scope, config);
  return world;
}

describe("classifyRequest", () => {
  const precache = new Set(config.precache);
  test.each<[string, RequestLike, string]>([
    ["navigation", request("/recipes/lemon-tart", { mode: "navigate" }), "navigation"],
    ["built asset under /assets/", request("/assets/anything-xyz.js"), "asset"],
    ["precached public file", request("/manifest.webmanifest"), "asset"],
    ["server function GET", request("/_serverFn/abc?payload=%7B%7D"), "data"],
    ["image GET", request("/api/images/x.jpg"), "data"],
    ["server function POST", request("/_serverFn/abc", { method: "POST" }), "passthrough"],
    ["image upload POST", request("/api/recipes/1/image", { method: "POST" }), "passthrough"],
    ["DELETE", request("/_serverFn/abc", { method: "DELETE" }), "passthrough"],
    ["other same-origin GET", request("/api/health"), "passthrough"],
    ["cross-origin GET", { method: "GET", url: "https://example.com/assets/x.js", mode: "cors" }, "passthrough"],
    ["unparseable URL", { method: "GET", url: "not a url", mode: "cors" }, "passthrough"],
  ])("%s", (_name, req, policy) => {
    expect(classifyRequest(req, ORIGIN, precache)).toBe(policy);
  });
});

describe("install and activate", () => {
  test("install precaches the shell and every listed asset, then skips waiting", async () => {
    const world = installedScope();
    await world.install();

    expect(world.cached(PRECACHE, "/")).toBeDefined();
    for (const path of config.precache) expect(world.cached(PRECACHE, path), path).toBeDefined();
    expect(world.fetch).toHaveBeenCalledTimes(1 + config.precache.length);
    expect(world.scope.skipWaiting).toHaveBeenCalledTimes(1);
  });

  test("install fails (so the old worker stays) when an asset cannot be fetched", async () => {
    const world = fakeScope();
    world.fetch.mockImplementation(async (req) => (keyOf(req).endsWith(".css") ? new Response("", { status: 404 }) : ok("x")));
    installServiceWorker(world.scope, config);
    await expect(world.install()).rejects.toThrow(/404/);
    expect(world.scope.skipWaiting).not.toHaveBeenCalled();
  });

  test("activate drops older garnish precaches, keeps the data cache and other origins' caches, and claims clients", async () => {
    const world = installedScope();
    world.stores.set(precacheName("old"), new Map());
    world.stores.set(DATA_CACHE, new Map());
    world.stores.set("someone-elses", new Map());
    await world.install();
    await world.activate();

    expect([...world.stores.keys()].sort()).toEqual([DATA_CACHE, PRECACHE, "someone-elses"].sort());
    expect(world.scope.clients.claim).toHaveBeenCalledTimes(1);
  });
});

describe("fetch: navigation", () => {
  test("online, the network response is returned as is", async () => {
    const world = installedScope();
    await world.install();
    world.fetch.mockResolvedValueOnce(new Response("fresh", { status: 404 }));

    const response = await world.dispatch(request("/recipes/nope", { mode: "navigate" }));
    expect(response?.status).toBe(404);
    expect(await response?.text()).toBe("fresh");
  });

  test("offline, any navigation resolves to the cached shell", async () => {
    const world = installedScope();
    await world.install();
    world.fetch.mockImplementation(offline);

    const response = await world.dispatch(request("/recipes/lemon-tart", { mode: "navigate" }));
    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe("body of /");
    expect(response?.headers.get("content-type")).toBe("text/html");
  });

  test("offline with no shell cached answers a 503 rather than throwing", async () => {
    const world = fakeScope();
    world.fetch.mockImplementation(offline);
    installServiceWorker(world.scope, config);

    const response = await world.dispatch(request("/", { mode: "navigate" }));
    expect(response?.status).toBe(503);
  });
});

describe("fetch: assets", () => {
  test("a precached asset is served from the cache without touching the network", async () => {
    const world = installedScope();
    await world.install();
    world.fetch.mockClear();

    const response = await world.dispatch(request("/assets/index-abc.js"));
    expect(await response?.text()).toBe("body of /assets/index-abc.js");
    expect(world.fetch).not.toHaveBeenCalled();
  });

  test("an unlisted /assets/ file is fetched once and cached", async () => {
    const world = installedScope();
    await world.install();
    world.fetch.mockClear();
    world.fetch.mockResolvedValueOnce(ok("lazy chunk"));

    expect(await (await world.dispatch(request("/assets/lazy-999.js")))?.text()).toBe("lazy chunk");
    expect(await (await world.dispatch(request("/assets/lazy-999.js")))?.text()).toBe("lazy chunk");
    expect(world.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("fetch: server function GETs and images", () => {
  const rpc = request("/_serverFn/getRecipe_abc?payload=%7B%22slug%22%3A%22lemon-tart%22%7D");

  test("online: the network answers and a copy is stored; offline: the copy is served", async () => {
    const world = installedScope();
    await world.install();
    world.fetch.mockResolvedValueOnce(ok('{"name":"Lemon tart"}', "application/json"));

    const online = await world.dispatch(rpc);
    expect(await online?.json()).toEqual({ name: "Lemon tart" });
    expect(world.cached(DATA_CACHE, new URL(rpc.url).pathname + new URL(rpc.url).search)).toBeDefined();

    world.fetch.mockImplementation(offline);
    const cached = await world.dispatch(rpc);
    expect(cached?.status).toBe(200);
    expect(await cached?.json()).toEqual({ name: "Lemon tart" });
    expect(cached?.headers.get("content-type")).toBe("application/json");
  });

  test("a failed network answer (non-2xx) is returned but not stored", async () => {
    const world = installedScope();
    world.fetch.mockResolvedValueOnce(new Response("nope", { status: 500 }));

    const response = await world.dispatch(rpc);
    expect(response?.status).toBe(500);
    expect(world.stores.get(DATA_CACHE)?.size ?? 0).toBe(0);
  });

  test("offline with nothing cached answers a 503", async () => {
    const world = installedScope();
    world.fetch.mockImplementation(offline);
    const response = await world.dispatch(request("/api/images/missing.jpg"));
    expect(response?.status).toBe(503);
  });

  test("images follow the same network-first path", async () => {
    const world = installedScope();
    world.fetch.mockResolvedValueOnce(ok("jpeg bytes", "image/jpeg"));
    const image = request("/api/images/lemon.jpg");
    await world.dispatch(image);
    world.fetch.mockImplementation(offline);
    const cached = await world.dispatch(image);
    expect(await cached?.text()).toBe("jpeg bytes");
  });
});

describe("fetch: writes pass through", () => {
  test.each<RequestLike>([
    request("/_serverFn/updateRecipe_abc", { method: "POST" }),
    request("/api/recipes/1/image", { method: "POST" }),
    request("/api/recipes/1/image", { method: "DELETE" }),
    request("/_serverFn/abc", { method: "PUT" }),
  ])("$method $url is not handled", async (req) => {
    const world = installedScope();
    await world.install();
    world.fetch.mockClear();
    expect(await world.dispatch(req)).toBeNull();
    expect(world.fetch).not.toHaveBeenCalled();
  });

  test("a cross-origin GET is not handled either", async () => {
    const world = installedScope();
    expect(await world.dispatch({ method: "GET", url: "https://fonts.example/a.woff2", mode: "cors" })).toBeNull();
  });
});

describe("build step", () => {
  test("precacheList: bundle files plus public files as URL paths, no maps, no sw.js, sorted, deduplicated", () => {
    const list = precacheList(
      ["assets/index-a.js", "assets/index-a.js.map", "assets/styles-b.css", "assets/index-a.js"],
      ["manifest.webmanifest", "icons/icon.svg", "sw.js"]
    );
    expect(list).toEqual(["/assets/index-a.js", "/assets/styles-b.css", "/icons/icon.svg", "/manifest.webmanifest"]);
  });

  test("stampVersion replaces every placeholder with a stable 12-char hash of the code", () => {
    const first = stampVersion('a "__SW_VERSION__" b __SW_VERSION__');
    expect(first.version).toMatch(/^[0-9a-f]{12}$/);
    expect(first.code).toBe(`a "${first.version}" b ${first.version}`);
    expect(stampVersion('a "__SW_VERSION__" b __SW_VERSION__')).toEqual(first);
    expect(versionOf("other")).not.toBe(first.version);
  });

  test("the built sw.js, evaluated with the fake scope as self, precaches and serves offline", async () => {
    const { code, version } = await buildServiceWorker({ shell: SHELL_URL, precache: config.precache });
    expect(code).not.toContain("__SW_VERSION__");
    expect(code).not.toMatch(/^\s*(import|export)\s/m);
    for (const path of config.precache) expect(code).toContain(path);

    const world = fakeScope();
    world.fetch.mockImplementation(async (req) => ok(`body of ${new URL(keyOf(req)).pathname}`, "text/html"));
    new Function("self", code)(world.scope);

    await world.install();
    expect(world.cached(precacheName(version), "/")).toBeDefined();
    expect(world.cached(precacheName(version), "/assets/index-abc.js")).toBeDefined();

    world.fetch.mockResolvedValueOnce(ok('{"id":"r1"}', "application/json"));
    await world.dispatch(request("/_serverFn/getRecipe?payload=x"));
    world.fetch.mockImplementation(offline);

    const shell = await world.dispatch(request("/recipes/lemon-tart", { mode: "navigate" }));
    expect(await shell?.text()).toBe("body of /");
    const data = await world.dispatch(request("/_serverFn/getRecipe?payload=x"));
    expect(await data?.json()).toEqual({ id: "r1" });
    expect(await world.dispatch(request("/_serverFn/updateRecipe", { method: "POST" }))).toBeNull();
  });
});
