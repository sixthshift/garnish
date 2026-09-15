// The one offline write path: ticks, unticks and removes queue and replay; adding a line and clearing the ticked stay server-first.

import type { ShoppingItem } from "../domain/shopping";
import { randomUuid } from "./id";

/** What a queued write does to one line. A `remove` supersedes anything queued before it. */
export type OutboxKind = "tick" | "untick" | "remove";

/** One pending write: which line, what to do, and when it was asked for. */
export type OutboxEntry = {
  /** The entry's own id, so a flush can match a result to an entry. */
  id: string;
  /** The `shopping_item` row this touches. */
  itemId: string;
  kind: OutboxKind;
  /** ISO stamp, injectable so an enqueue is a pure function of its arguments. */
  at: string;
};

/** The key the queue lives under. One list, so one key. */
export const OUTBOX_KEY = "garnish.outbox.shopping";

/** The slice of `Storage` the controller uses. */
export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

// --- The pure core -----------------------------------------------------------

function isEntry(value: unknown): value is OutboxEntry {
  if (typeof value !== "object" || value === null) return false;
  const { id, itemId, kind, at } = value as Record<string, unknown>;
  return typeof id === "string" && typeof itemId === "string" && typeof at === "string" && (kind === "tick" || kind === "untick" || kind === "remove");
}

/** A queue parsed out of whatever was stored. Anything unrecognised is dropped, not thrown over. Pure. */
export function parseOutbox(value: unknown): OutboxEntry[] {
  return Array.isArray(value) ? value.filter(isEntry) : [];
}

/**
 * `queue` with `entry` added, coalesced against what is already pending for
 * the same line:
 *
 * - a tick or an untick replaces any tick or untick already queued for that
 * line — a cook who ticks and unticks the same lemon has changed their
 * mind, not made two writes, and the server only ever needs the last word;
 * - a remove supersedes everything queued for that line: there is nothing to
 * tick on a row that is going away;
 * - once a remove is queued for a line, nothing further is queued for it.
 *
 * The surviving entry is appended, so the queue stays in the order the cook's
 * last word on each line was given. Pure.
 */
export function enqueue(queue: readonly OutboxEntry[], entry: OutboxEntry): OutboxEntry[] {
  if (queue.some((queued) => queued.itemId === entry.itemId && queued.kind === "remove")) return [...queue];
  const kept = queue.filter((queued) => queued.itemId !== entry.itemId);
  return [...kept, entry];
}

/** A new entry for `itemId`. `newId` and `at` are injected so the result is reproducible in a test. Pure. */
export function outboxEntry(itemId: string, kind: OutboxKind, newId: () => string = randomUuid, at: string = new Date().toISOString()): OutboxEntry {
  return { id: newId(), itemId, kind, at };
}

/**
 * `items` as the cook should see them: the last read from the server (or the
 * service worker's cache of it) with every pending write already applied. A
 * tick strikes the row through immediately, a remove takes it off the list,
 * and an entry for a line that is no longer there is simply ignored. Pure.
 */
export function applyOutbox<T extends Pick<ShoppingItem, "id" | "ticked">>(items: readonly T[], queue: readonly OutboxEntry[]): T[] {
  const pending = new Map(queue.map((entry) => [entry.itemId, entry.kind]));
  const result: T[] = [];
  for (const item of items) {
    const kind = pending.get(item.id);
    if (kind === "remove") continue;
    if (kind === "tick" || kind === "untick") result.push({ ...item, ticked: kind === "tick" });
    else result.push(item);
  }
  return result;
}

/** What one flush attempt did. `queue` is what is still pending afterwards. */
export type FlushResult = {
  /** Entries still waiting: the one that failed and everything behind it. */
  queue: OutboxEntry[];
  /** Entries the server accepted, in the order they were sent. */
  sent: OutboxEntry[];
  /** Why the flush stopped, when it did. */
  error?: unknown;
};

/**
 * Send `queue` through `send`, oldest first, stopping at the first failure.
 * Order matters — an untick behind a tick has to land behind it — so a failed
 * entry is kept along with everything after it rather than skipped over, and
 * the next flush starts again from the same place. Never throws: a failure is
 * a result, because the caller is an effect nobody is watching.
 */
export async function flushOutbox(queue: readonly OutboxEntry[], send: (entry: OutboxEntry) => Promise<unknown>): Promise<FlushResult> {
  const sent: OutboxEntry[] = [];
  for (let index = 0; index < queue.length; index += 1) {
    const entry = queue[index]!;
    try {
      await send(entry);
      sent.push(entry);
    } catch (error) {
      return { queue: queue.slice(index), sent, error };
    }
  }
  return { queue: [], sent };
}

/** "1 change waiting" / "3 changes waiting"; empty for nothing pending. Pure. */
export function pendingLabel(count: number): string {
  if (count <= 0) return "";
  return `${count} ${count === 1 ? "change" : "changes"} waiting`;
}

// --- The stored queue --------------------------------------------------------

/** The queue as stored, or empty when unset, malformed, or the storage throws. */
export function readOutbox(storage: StorageLike): OutboxEntry[] {
  try {
    const raw = storage.getItem(OUTBOX_KEY);
    if (raw == null) return [];
    return parseOutbox(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

/** Write `queue`, removing the key when it is empty. A throwing storage just means the queue does not survive a reload. */
export function writeOutbox(storage: StorageLike, queue: readonly OutboxEntry[]): void {
  try {
    if (queue.length === 0) storage.removeItem(OUTBOX_KEY);
    else storage.setItem(OUTBOX_KEY, JSON.stringify(queue));
  } catch {
    // ignored: see above
  }
}

/** A queue that persists itself. All four methods are safe with a storage that throws. */
export type Outbox = {
  /** What is pending, oldest first. */
  list: () => OutboxEntry[];
  /** Queue a write for `itemId`, coalescing per `enqueue`. Returns the new queue. */
  push: (itemId: string, kind: OutboxKind) => OutboxEntry[];
  /** Try to send everything, keeping what fails. Returns the result. */
  flush: (send: (entry: OutboxEntry) => Promise<unknown>) => Promise<FlushResult>;
  /** Forget everything pending. */
  clear: () => void;
};

/**
 * An `Outbox` over `storage`, or over memory alone when there is none (the
 * server, a locked-down browser): the ticks still apply to the rendered list
 * for this page's life, they just do not survive a reload.
 */
export function createOutbox(storage: StorageLike | undefined, newId: () => string = randomUuid, now: () => string = () => new Date().toISOString()): Outbox {
  let memory: OutboxEntry[] = storage ? readOutbox(storage) : [];
  const save = (queue: OutboxEntry[]): OutboxEntry[] => {
    memory = queue;
    if (storage) writeOutbox(storage, queue);
    return queue;
  };
  return {
    list: () => [...memory],
    push: (itemId, kind) => save(enqueue(memory, outboxEntry(itemId, kind, newId, now()))),
    async flush(send) {
      const result = await flushOutbox(memory, send);
      save(result.queue);
      return result;
    },
    clear: () => void save([]),
  };
}
