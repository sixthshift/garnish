// Whether the browser believes it has a network. `navigator.onLine` plus the
// `online` / `offline` events; the editor uses it to refuse saves offline
// rather than let a write fail half way. The browser's answer is optimistic
// (a connected LAN with no server still reads online), so callers keep their
// error handling: this is a notice, not a guarantee.
//
// Same shape as useWakeLock: a controller over the globals it needs so it can
// be tested without a DOM, and a thin React hook around it.
import { useEffect, useState } from "react";

/** The slice of `window` the controller uses. */
export type OnlineWindowLike = {
  navigator: { onLine: boolean };
  addEventListener: (type: "online" | "offline", listener: () => void) => void;
  removeEventListener: (type: "online" | "offline", listener: () => void) => void;
};

export type OnlineController = {
  /** Read the current state and start listening. Idempotent. */
  start: () => void;
  /** Stop listening. Idempotent. */
  stop: () => void;
  /** The last known state; true before start. */
  online: () => boolean;
};

/**
 * Online-state tracker over `windowLike`. `onChange` is told the state on
 * start and whenever it flips. Never throws.
 */
export function createOnlineController(windowLike: OnlineWindowLike, onChange: (online: boolean) => void = () => {}): OnlineController {
  let started = false;
  let online = true;

  const read = () => {
    const next = windowLike.navigator.onLine !== false;
    if (next !== online) {
      online = next;
      onChange(online);
    }
  };

  return {
    start() {
      if (started) return;
      started = true;
      windowLike.addEventListener("online", read);
      windowLike.addEventListener("offline", read);
      read();
    },
    stop() {
      if (!started) return;
      started = false;
      windowLike.removeEventListener("online", read);
      windowLike.removeEventListener("offline", read);
    },
    online: () => online,
  };
}

/**
 * The browser's online state. True on the server and on the first client
 * render (so hydration matches), then whatever `navigator.onLine` says.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const controller = createOnlineController(window, setOnline);
    controller.start();
    return () => controller.stop();
  }, []);
  return online;
}
