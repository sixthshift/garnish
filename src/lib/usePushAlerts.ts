import { useCallback, useEffect, useState } from "react";
import { getPushPublicKey, subscribePush, unsubscribePush } from "../server/fns/push";
import { messageFrom } from "./errors";
import { disablePush, enablePush, type PushPorts, type PushState, pushSupported, readPushState } from "./push";

/** The real browser and server behind the toggle. Client only. */
function browserPorts(): PushPorts {
  return {
    requestPermission: () => Notification.requestPermission(),
    pushManager: async () => (await navigator.serviceWorker.ready).pushManager,
    publicKey: async () => (await getPushPublicKey()).publicKey,
    subscribe: (subscription) => subscribePush({ data: subscription }),
    unsubscribe: (endpoint) => unsubscribePush({ data: { endpoint } }),
  };
}

export type PushAlerts = {
  state: PushState;
  /** A change is in flight, or the state is still being read. */
  pending: boolean;
  /** Why the last change failed, or null. */
  error: string | null;
  /** Turn alerts on or off. */
  setEnabled: (enabled: boolean) => void;
};

/**
 * Timer alerts on this device. Reads the browser's current answer on mount
 * (unsupported until then, and on the server), and turns them on or off
 * through the ports above.
 */
export function usePushAlerts(): PushAlerts {
  const [state, setState] = useState<PushState>("unsupported");
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported(typeof window === "undefined" ? undefined : window)) {
      setPending(false);
      return;
    }
    let cancelled = false;
    readPushState(browserPorts(), Notification.permission)
      .then((read) => {
        if (!cancelled) setState(read);
      })
      // A worker that never becomes ready (dev, a failed registration): alerts stay unsupported.
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setPending(true);
    setError(null);
    const ports = browserPorts();
    (enabled ? enablePush(ports) : disablePush(ports))
      .then(setState)
      .catch((failure: unknown) => setError(messageFrom(failure)))
      .finally(() => setPending(false));
  }, []);

  return { state, pending, error, setEnabled };
}
