// Turning timer alerts on and off: permission, the browser's push
// subscription, and telling the server about it. The browser APIs are passed
// in as slices so the whole sequence runs in a test against fakes; the hook
// in usePushAlerts.ts wires the real ones.

/** The slice of `PushSubscription` used. */
export type PushSubscriptionLike = {
  endpoint: string;
  toJSON: () => { endpoint?: string; keys?: Record<string, string> };
  unsubscribe: () => Promise<boolean>;
};

/** The slice of `PushManager` used. */
export type PushManagerLike = {
  getSubscription: () => Promise<PushSubscriptionLike | null>;
  subscribe: (options: { userVisibleOnly: true; applicationServerKey: Uint8Array<ArrayBuffer> }) => Promise<PushSubscriptionLike>;
};

/** What a subscription hands the server: the endpoint and the two keys the payload is encrypted to. */
export type SubscriptionJson = { endpoint: string; keys: { p256dh: string; auth: string } };

/** What the toggle needs from the browser and the server. */
export type PushPorts = {
  /** `Notification.requestPermission`. */
  requestPermission: () => Promise<string>;
  /** The active registration's push manager, once the worker is ready. */
  pushManager: () => Promise<PushManagerLike>;
  /** The server's public key. */
  publicKey: () => Promise<string>;
  subscribe: (subscription: SubscriptionJson) => Promise<unknown>;
  unsubscribe: (endpoint: string) => Promise<unknown>;
};

/** Where the toggle stands. `denied` is the browser's answer and is undone only in its settings. */
export type PushState = "unsupported" | "off" | "on" | "denied";

/** A VAPID public key as `pushManager.subscribe` wants it: base64url text to bytes. Pure. */
export function applicationServerKey(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url
    .padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), "=")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** `subscription` as the server takes it, or null when the browser gave less than the two keys. Pure. */
export function subscriptionJson(subscription: PushSubscriptionLike): SubscriptionJson | null {
  const json = subscription.toJSON();
  const endpoint = json.endpoint ?? subscription.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  return endpoint && p256dh && auth ? { endpoint, keys: { p256dh, auth } } : null;
}

/** Whether this browser can do push at all: a worker, a push manager and notifications. Pure over the slice. */
export function pushSupported(windowLike: { Notification?: unknown; PushManager?: unknown; navigator?: { serviceWorker?: unknown } } | undefined): boolean {
  return (
    windowLike !== undefined &&
    windowLike.Notification !== undefined &&
    windowLike.PushManager !== undefined &&
    windowLike.navigator?.serviceWorker !== undefined
  );
}

/** The state to show: what the browser already holds, and whether it has said no. */
export async function readPushState(ports: Pick<PushPorts, "pushManager">, permission: string): Promise<PushState> {
  if (permission === "denied") return "denied";
  const subscription = await ports.pushManager().then((manager) => manager.getSubscription());
  return subscription ? "on" : "off";
}

/**
 * Turn alerts on: ask, subscribe, tell the server. Resolves to the resulting
 * state — `denied` when the person said no, `on` when it worked. Throws when
 * the browser or the server refused for another reason.
 */
export async function enablePush(ports: PushPorts): Promise<PushState> {
  const permission = await ports.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const manager = await ports.pushManager();
  const existing = await manager.getSubscription();
  const subscription = existing ?? (await manager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(await ports.publicKey()) }));
  const json = subscriptionJson(subscription);
  if (!json) throw new Error("The browser gave a subscription without keys.");
  await ports.subscribe(json);
  return "on";
}

/** Turn alerts off: drop the browser's subscription and tell the server. Idempotent. */
export async function disablePush(ports: Pick<PushPorts, "pushManager" | "unsubscribe">): Promise<PushState> {
  const manager = await ports.pushManager();
  const subscription = await manager.getSubscription();
  if (!subscription) return "off";
  await subscription.unsubscribe();
  await ports.unsubscribe(subscription.endpoint);
  return "off";
}

/**
 * This browser's push endpoint, or null when alerts are off, the worker is
 * not registered (dev), or push is unsupported. Never rejects: a timer that
 * cannot be pushed still runs on the page.
 */
export async function currentEndpoint(
  navigatorLike: { serviceWorker?: { getRegistration: () => Promise<{ pushManager?: PushManagerLike } | undefined> } } | undefined
): Promise<string | null> {
  try {
    const registration = await navigatorLike?.serviceWorker?.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    return subscription?.endpoint ?? null;
  } catch {
    return null;
  }
}
