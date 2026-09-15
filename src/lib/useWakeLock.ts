import { useEffect, useState } from "react";

/** The slice of `WakeLockSentinel` the controller uses. */
export type WakeLockSentinelLike = {
  release: () => Promise<void>;
  /** Fires when the browser releases the lock itself (tab hidden, battery policy). */
  addEventListener?: (type: "release", listener: () => void) => void;
};

/** The slice of `navigator` the controller uses. `wakeLock` is absent where unsupported. */
export type NavigatorLike = {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

/** The slice of `document` the controller uses. */
export type DocumentLike = {
  visibilityState: string;
  addEventListener: (type: "visibilitychange", listener: () => void) => void;
  removeEventListener: (type: "visibilitychange", listener: () => void) => void;
};

export type WakeLockController = {
  /** Start holding the lock and watching visibility. Idempotent. */
  enter: () => void;
  /** Release the lock and stop watching. Idempotent. */
  leave: () => void;
  /** Whether a lock is currently held. */
  active: () => boolean;
};

/**
 * Wake-lock state machine over `navigatorLike` and `documentLike`. `onChange`
 * is told whenever the held state flips. Never throws and never rejects.
 */
export function createWakeLockController(
  navigatorLike: NavigatorLike,
  documentLike: DocumentLike,
  onChange: (active: boolean) => void = () => {}
): WakeLockController {
  let entered = false;
  let sentinel: WakeLockSentinelLike | null = null;
  // Bumped on every request and on leave; a request that resolves after the
  // world moved on releases what it got instead of installing it.
  let generation = 0;

  const setSentinel = (next: WakeLockSentinelLike | null) => {
    const was = sentinel !== null;
    sentinel = next;
    if (was !== (next !== null)) onChange(next !== null);
  };

  const dropSentinel = (target: WakeLockSentinelLike) => {
    void target.release().catch(() => {});
    if (sentinel === target) setSentinel(null);
  };

  const request = async () => {
    const api = navigatorLike.wakeLock;
    if (!entered || !api || documentLike.visibilityState !== "visible") return;
    const mine = ++generation;
    try {
      const next = await api.request("screen");
      if (!entered || mine !== generation) {
        void next.release().catch(() => {});
        return;
      }
      // The browser has already released a lock from a hidden tab; releasing
      // again is a harmless no-op, and it keeps a single sentinel live.
      if (sentinel !== null && sentinel !== next) void sentinel.release().catch(() => {});
      setSentinel(next);
      next.addEventListener?.("release", () => {
        if (sentinel === next) setSentinel(null);
      });
    } catch {
      // Unsupported, denied, or a policy refusal: cook on with a dimming screen.
    }
  };

  const onVisibility = () => {
    if (documentLike.visibilityState === "visible") void request();
  };

  return {
    enter() {
      if (entered) return;
      entered = true;
      documentLike.addEventListener("visibilitychange", onVisibility);
      void request();
    },
    leave() {
      if (!entered) return;
      entered = false;
      generation++;
      documentLike.removeEventListener("visibilitychange", onVisibility);
      if (sentinel !== null) dropSentinel(sentinel);
    },
    active: () => sentinel !== null,
  };
}

/**
 * Hold a screen wake lock for the life of the calling component. Returns
 * whether one is currently held, for an optional indicator; false on the
 * server, in unsupported browsers, and until the request resolves.
 */
export function useWakeLock(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (typeof navigator === "undefined" || typeof document === "undefined") return;
    const controller = createWakeLockController(navigator, document, setActive);
    controller.enter();
    return () => controller.leave();
  }, []);
  return active;
}
