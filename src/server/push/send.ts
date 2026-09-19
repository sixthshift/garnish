import webpush from "web-push";
import type { PushSubscription, VapidKeys } from "../../db/models/push/repo";

/** What one push came to: delivered, or refused, and whether the refusal means the device is gone for good. */
export type PushOutcome = { ok: true } | { ok: false; status: number; gone: boolean };

/** The slice of `fetch` the sender uses. */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: Uint8Array<ArrayBuffer> | string }
) => Promise<{ status: number }>;

/** How long the push service keeps an undelivered push: a timer that is an hour late is not worth ringing. */
const TTL_SECONDS = 60 * 60;

/** Whether `status` means the subscription no longer exists and should be forgotten. Pure. */
export function isGone(status: number): boolean {
  return status === 404 || status === 410;
}

/**
 * Encrypt `payload` to `subscription` and POST it to its push service, signed
 * with `keys`. web-push builds the headers and the aes128gcm body; the request
 * itself is a plain fetch so the whole thing runs in a test against a fake.
 * Never throws: a failed connection is a refusal with status 0.
 */
export async function sendPush(
  subscription: PushSubscription,
  payload: unknown,
  keys: VapidKeys,
  subject: string,
  fetchLike: FetchLike = fetch
): Promise<PushOutcome> {
  const details = webpush.generateRequestDetails(
    { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
    JSON.stringify(payload),
    { TTL: TTL_SECONDS, urgency: "high", vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey } }
  );
  const headers = Object.fromEntries(Object.entries(details.headers).map(([name, value]) => [name, String(value)]));
  try {
    // Copied into a fresh buffer: fetch wants a plain ArrayBuffer-backed view, and Node's Buffer may sit on a shared pool.
    const body = details.body === undefined || details.body === null ? "" : typeof details.body === "string" ? details.body : Uint8Array.from(details.body);
    const response = await fetchLike(details.endpoint, { method: details.method, headers, body });
    if (response.status >= 200 && response.status < 300) return { ok: true };
    return { ok: false, status: response.status, gone: isGone(response.status) };
  } catch {
    return { ok: false, status: 0, gone: false };
  }
}
