// One push to a fake push service: the request is a POST to the endpoint with
// a VAPID signature and an encrypted body, and the answer is read as
// delivered, refused, or gone for good.

import { describe, expect, test, vi } from "vitest";
import webpush from "web-push";
import { type FetchLike, isGone, sendPush } from "../../../src/server/push/send";
import { vapidKeys, vapidSubject } from "../../../src/server/push/vapid";

// A real browser's keys are a P-256 point and a 16-byte secret; these are the shapes web-push checks.
const SUBSCRIPTION = {
  id: "s1",
  endpoint: "https://push.example/send/abc",
  p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
  auth: "tBHItJI5svbpez7KI4CCXg",
  createdAt: "2026-09-19T10:00:00.000Z",
};
const KEYS = webpush.generateVAPIDKeys();

describe("isGone", () => {
  test("404 and 410 mean the subscription is dead; anything else does not", () => {
    expect(isGone(404)).toBe(true);
    expect(isGone(410)).toBe(true);
    expect(isGone(500)).toBe(false);
    expect(isGone(201)).toBe(false);
  });
});

describe("sendPush", () => {
  test("POSTs a signed, encrypted request to the endpoint and reads a 201 as delivered", async () => {
    const fetchLike = vi.fn<FetchLike>(async () => ({ status: 201 }));
    const outcome = await sendPush(SUBSCRIPTION, { type: "garnish:timer", timerId: "t", label: "Boil", url: "/" }, KEYS, "mailto:a@b.c", fetchLike);
    expect(outcome).toEqual({ ok: true });
    const [url, init] = fetchLike.mock.calls[0]!;
    expect(url).toBe(SUBSCRIPTION.endpoint);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toMatch(/^vapid t=.+, k=.+$/);
    expect(init.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(init.headers.TTL).toBe("3600");
    expect(init.headers.Urgency).toBe("high");
    expect(init.body).toBeInstanceOf(Uint8Array);
    // Encrypted: the label is not in the bytes.
    expect(new TextDecoder().decode(init.body as Uint8Array)).not.toContain("Boil");
  });

  test("a 410 is refused and gone; a 500 is refused and not; a failed connection is status 0", async () => {
    expect(await sendPush(SUBSCRIPTION, {}, KEYS, "mailto:a@b.c", async () => ({ status: 410 }))).toEqual({ ok: false, status: 410, gone: true });
    expect(await sendPush(SUBSCRIPTION, {}, KEYS, "mailto:a@b.c", async () => ({ status: 500 }))).toEqual({ ok: false, status: 500, gone: false });
    expect(
      await sendPush(SUBSCRIPTION, {}, KEYS, "mailto:a@b.c", async () => {
        throw new TypeError("fetch failed");
      })
    ).toEqual({ ok: false, status: 0, gone: false });
  });
});

describe("vapid", () => {
  test("the subject is PUSH_CONTACT or the project", () => {
    expect(vapidSubject({})).toBe("https://github.com/sixthshift/garnish");
    expect(vapidSubject({ PUSH_CONTACT: " mailto:me@home.lan " })).toBe("mailto:me@home.lan");
  });

  test("keys are made once and then read back", () => {
    let stored: { publicKey: string; privateKey: string } | null = null;
    const repo = { vapid: () => stored, setVapid: (keys: { publicKey: string; privateKey: string }) => (stored = keys) };
    const generate = vi.fn(() => ({ publicKey: "pub", privateKey: "priv" }));
    expect(vapidKeys(repo as never, generate)).toEqual({ publicKey: "pub", privateKey: "priv" });
    expect(vapidKeys(repo as never, generate)).toEqual({ publicKey: "pub", privateKey: "priv" });
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
