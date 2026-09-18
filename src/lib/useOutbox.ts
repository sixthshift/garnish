import { useCallback, useEffect, useRef, useState } from "react";
import { createOutbox, type OutboxEntry, type OutboxKind, type StorageLike } from "./outbox";

/** `window.localStorage`, or undefined on the server and where it is unavailable. */
export function browserStorage(): StorageLike | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

// --- The hook ----------------------------------------------------------------

/** What the page needs from the outbox. */
export type UseOutbox = {
  /** The pending writes, oldest first. */
  queue: OutboxEntry[];
  /** Queue a tick, untick or remove and re-render with it applied. */
  push: (itemId: string, kind: Exclude<OutboxKind, "add">) => void;
  /** Queue a typed line under the id it has on this device, and re-render with it on the list. */
  add: (itemId: string, text: string) => void;
  /** Flush now. Called on coming back online and on regaining focus; safe to call by hand. */
  flush: () => Promise<void>;
};

export type UseOutboxOptions = {
  /** How one entry reaches the server. */
  send: (entry: OutboxEntry) => Promise<unknown>;
  /** Whether the browser believes it has a network; a false→true flip flushes. */
  online: boolean;
  /** Called after a flush that sent at least one entry, so the page can re-read the list. */
  onFlushed?: () => void;
  /** Injected in tests; defaults to `window.localStorage`. */
  storage?: StorageLike;
};

/**
 * The stored queue as React state, flushed when `online` turns true and when
 * the page regains focus (coming back to the app in the car park is a focus,
 * not always an `online` event). One flush at a time: a second call while one
 * is in flight is dropped rather than queued, since the next trigger will pick
 * up whatever is left.
 */
export function useOutbox({ send, online, onFlushed, storage }: UseOutboxOptions): UseOutbox {
  const [outbox] = useState(() => createOutbox(storage ?? browserStorage()));
  const [queue, setQueue] = useState<OutboxEntry[]>(() => outbox.list());
  const running = useRef(false);
  // Kept in refs so the flush effect does not re-subscribe on every render.
  const sendRef = useRef(send);
  sendRef.current = send;
  const flushedRef = useRef(onFlushed);
  flushedRef.current = onFlushed;

  const flush = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const result = await outbox.flush((entry) => sendRef.current(entry));
      setQueue(result.queue);
      if (result.sent.length > 0) flushedRef.current?.();
    } finally {
      running.current = false;
    }
  }, [outbox]);

  const push = useCallback(
    (itemId: string, kind: Exclude<OutboxKind, "add">) => {
      setQueue(outbox.push(itemId, kind));
    },
    [outbox]
  );

  const add = useCallback(
    (itemId: string, text: string) => {
      setQueue(outbox.add(itemId, text));
    },
    [outbox]
  );

  // Coming back online: flush what the shelf collected. Runs on mount too,
  // which clears anything a previous visit left behind.
  useEffect(() => {
    if (online) void flush();
  }, [online, flush]);

  // Regaining focus, with a network: same flush. `focus` rather than
  // `visibilitychange` alone because a phone waking to the app fires both and
  // one handler is enough.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onFocus = () => {
      if (online) void flush();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [online, flush]);

  return { queue, push, add, flush };
}
