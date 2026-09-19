// Turning alerts on and off against fakes for the browser and the server.
import { describe, expect, test } from "vitest";
import {
  applicationServerKey,
  currentEndpoint,
  disablePush,
  enablePush,
  type PushManagerLike,
  type PushPorts,
  type PushSubscriptionLike,
  pushSupported,
  readPushState,
  subscriptionJson,
} from "../../src/lib/push";

/** A browser's subscription. `keys: null` is one that hands over no keys at all. */
function fakeSubscription(
  endpoint = "https://push.example/a",
  keys: Record<string, string> | null = { p256dh: "p", auth: "a" }
): PushSubscriptionLike & { gone: boolean } {
  const sub = {
    endpoint,
    gone: false,
    toJSON: () => ({ endpoint, keys: keys ?? undefined }),
    unsubscribe: async () => {
      sub.gone = true;
      return true;
    },
  };
  return sub;
}

function fakeManager(existing: PushSubscriptionLike | null = null) {
  let current = existing;
  const manager: PushManagerLike & { subscribed: number } = {
    subscribed: 0,
    getSubscription: async () => current,
    subscribe: async () => {
      manager.subscribed++;
      current = fakeSubscription();
      return current;
    },
  };
  return manager;
}

function ports(manager: PushManagerLike, permission = "granted"): PushPorts & { server: string[] } {
  const server: string[] = [];
  return {
    server,
    requestPermission: async () => permission,
    pushManager: async () => manager,
    publicKey: async () => "BAAA",
    subscribe: async (subscription) => void server.push(`subscribe ${subscription.endpoint} ${subscription.keys.p256dh}/${subscription.keys.auth}`),
    unsubscribe: async (endpoint) => void server.push(`unsubscribe ${endpoint}`),
  };
}

describe("pure bits", () => {
  test("applicationServerKey decodes base64url, padding as needed", () => {
    expect([...applicationServerKey("AQID")]).toEqual([1, 2, 3]);
    expect([...applicationServerKey("_-8")]).toEqual([255, 239]);
  });

  test("subscriptionJson wants the endpoint and both keys", () => {
    expect(subscriptionJson(fakeSubscription())).toEqual({ endpoint: "https://push.example/a", keys: { p256dh: "p", auth: "a" } });
    expect(subscriptionJson(fakeSubscription("https://push.example/a", { p256dh: "p" }))).toBeNull();
    expect(subscriptionJson(fakeSubscription("https://push.example/a", null))).toBeNull();
  });

  test("pushSupported needs a worker, a push manager and notifications", () => {
    expect(pushSupported(undefined)).toBe(false);
    expect(pushSupported({ Notification: {}, PushManager: {}, navigator: {} })).toBe(false);
    expect(pushSupported({ Notification: {}, navigator: { serviceWorker: {} } })).toBe(false);
    expect(pushSupported({ Notification: {}, PushManager: {}, navigator: { serviceWorker: {} } })).toBe(true);
  });
});

describe("readPushState", () => {
  test("denied wins; otherwise on when the browser holds a subscription", async () => {
    expect(await readPushState(ports(fakeManager()), "denied")).toBe("denied");
    expect(await readPushState(ports(fakeManager()), "default")).toBe("off");
    expect(await readPushState(ports(fakeManager(fakeSubscription())), "granted")).toBe("on");
  });
});

describe("enablePush", () => {
  test("asks, subscribes with the server's key, and tells the server", async () => {
    const manager = fakeManager();
    const p = ports(manager);
    expect(await enablePush(p)).toBe("on");
    expect(manager.subscribed).toBe(1);
    expect(p.server).toEqual(["subscribe https://push.example/a p/a"]);
  });

  test("reuses a subscription the browser already holds", async () => {
    const manager = fakeManager(fakeSubscription("https://push.example/kept"));
    const p = ports(manager);
    expect(await enablePush(p)).toBe("on");
    expect(manager.subscribed).toBe(0);
    expect(p.server).toEqual(["subscribe https://push.example/kept p/a"]);
  });

  test("a refused permission subscribes nothing", async () => {
    const manager = fakeManager();
    expect(await enablePush(ports(manager, "denied"))).toBe("denied");
    expect(await enablePush(ports(manager, "default"))).toBe("off");
    expect(manager.subscribed).toBe(0);
  });
});

describe("disablePush", () => {
  test("drops the browser's subscription and tells the server; nothing to drop is fine", async () => {
    const sub = fakeSubscription();
    const p = ports(fakeManager(sub));
    expect(await disablePush(p)).toBe("off");
    expect(sub.gone).toBe(true);
    expect(p.server).toEqual(["unsubscribe https://push.example/a"]);
    expect(await disablePush(ports(fakeManager()))).toBe("off");
  });
});

describe("currentEndpoint", () => {
  test("is the subscription's endpoint, or null without a worker, a registration or a subscription", async () => {
    expect(await currentEndpoint(undefined)).toBeNull();
    expect(await currentEndpoint({})).toBeNull();
    expect(await currentEndpoint({ serviceWorker: { getRegistration: async () => undefined } })).toBeNull();
    expect(await currentEndpoint({ serviceWorker: { getRegistration: async () => ({ pushManager: fakeManager() }) } })).toBeNull();
    expect(await currentEndpoint({ serviceWorker: { getRegistration: async () => ({ pushManager: fakeManager(fakeSubscription()) }) } })).toBe(
      "https://push.example/a"
    );
    expect(
      await currentEndpoint({
        serviceWorker: {
          getRegistration: () => {
            throw new Error("no");
          },
        },
      })
    ).toBeNull();
  });
});
