// The secrets the OAuth server hands out, and the checks on them. Pure apart from the random bytes.
import { createHash, timingSafeEqual } from "node:crypto";

/** An access token lives an hour; the client renews it with the refresh token without asking anyone. */
export const ACCESS_TOKEN_SECONDS = 60 * 60;
/** A refresh token lives thirty days, and every use replaces it, so a connection in use never lapses. */
export const REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60;
/** A spent refresh token presented again within this long is a client retrying, not a thief. */
export const REFRESH_GRACE_SECONDS = 30;
/** An authorization code is good for two minutes, once. */
export const CODE_SECONDS = 2 * 60;

/** The scopes a client can hold: read the household's recipes and lists, change them, delete them. */
export const SCOPES = ["read", "write", "delete"] as const;
export type Scope = (typeof SCOPES)[number];

/** What each scope lets a client do, as the consent page says it. */
export const SCOPE_LABELS: Record<Scope, string> = {
  read: "Read recipes, foods, the shopping list and the meal plan",
  write: "Add and change recipes, the shopping list and the meal plan",
  delete: "Delete recipes, and remove lines from the shopping list and the meal plan",
};

/** The scopes in `text` (space-separated) that garnish knows, in SCOPES order; an empty or absent request is every scope. */
export function parseScope(text: string | null | undefined): Scope[] {
  const asked = new Set((text ?? "").split(/\s+/).filter(Boolean));
  if (asked.size === 0) return [...SCOPES];
  return SCOPES.filter((scope) => asked.has(scope));
}

/** A fresh secret: a prefix that says what it is, then 32 random bytes in base64url. */
export function newSecret(prefix: "gat" | "grt" | "gcs" | "gac"): string {
  return `${prefix}_${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url")}`;
}

/** What is stored in place of a secret. */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** Two strings compared in constant time, so a secret cannot be guessed a character at a time. */
export function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * A pairing code as typed, read the way Crockford's base32 reads: any case,
 * dashes and spaces ignored, and O, I and L taken for the 0 and 1 they look
 * like. Pure.
 */
export function readPairingCode(typed: string): string {
  return typed
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

/** Whether `typed` is the pairing code `expected`, compared in constant time. Pure. */
export function samePairingCode(typed: string, expected: string): boolean {
  return sameSecret(readPairingCode(typed), readPairingCode(expected));
}

/** PKCE (RFC 7636, S256 only): whether `verifier` is what `challenge` was made from. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

/** `now` plus `seconds`, as the ISO text the token table keeps. */
export function after(now: Date, seconds: number): string {
  return new Date(now.getTime() + seconds * 1000).toISOString();
}
