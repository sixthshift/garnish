// What the OAuth server keeps in memory: the two-minute authorization codes and the attempt counters.
// A restart drops both, which is right: a code that outlives its consent page is not wanted, and a
// counter that resets costs an attacker a restart they cannot cause.

import type { Scope } from "./tokens";

/** What an Allow promised, waiting for the client to come back with the code. */
export type PendingCode = {
  clientId: string;
  redirectUri: string;
  scopes: Scope[];
  codeChallenge: string;
  resource: string;
  /** Epoch milliseconds. */
  expiresAt: number;
};

/** Most codes held at once: a page left open does not need more, and a flood cannot grow the map. */
export const MAX_PENDING_CODES = 100;

/** Authorization codes by code, each taken once. */
export class CodeStore {
  readonly #codes = new Map<string, PendingCode>();

  /** Keep `entry` under `code`. False when the store is full even after dropping the expired. */
  put(code: string, entry: PendingCode, now: number): boolean {
    if (this.#codes.size >= MAX_PENDING_CODES) this.sweep(now);
    if (this.#codes.size >= MAX_PENDING_CODES) return false;
    this.#codes.set(code, entry);
    return true;
  }

  /** The entry, removed whether or not it has expired; null when unknown or expired. */
  take(code: string, now: number): PendingCode | null {
    const entry = this.#codes.get(code);
    this.#codes.delete(code);
    return entry && entry.expiresAt > now ? entry : null;
  }

  sweep(now: number): void {
    for (const [code, entry] of this.#codes) if (entry.expiresAt <= now) this.#codes.delete(code);
  }
}

/**
 * At most `limit` events per `windowMs` for each key. The keys are coarse on
 * purpose — behind a tunnel every request comes from the tunnel — so a limit
 * guards the whole door, not one caller.
 */
export class AttemptLimit {
  readonly #hits = new Map<string, number[]>();

  constructor(
    readonly limit: number,
    readonly windowMs: number
  ) {}

  /** Whether another event under `key` is allowed at `now`; counts it when it is. */
  take(key: string, now: number): boolean {
    const recent = (this.#hits.get(key) ?? []).filter((at) => at > now - this.windowMs);
    if (recent.length >= this.limit) {
      this.#hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.#hits.set(key, recent);
    return true;
  }

  /** Whether `key` is at its limit now, without counting anything. */
  blocked(key: string, now: number): boolean {
    return (this.#hits.get(key) ?? []).filter((at) => at > now - this.windowMs).length >= this.limit;
  }
}
