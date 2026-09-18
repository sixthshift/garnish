// The one offline write path: ticks, unticks, removes and typed lines queue and replay; clearing the ticked stays server-first.

import type { ShoppingItem } from "../domain/shopping";
import { randomUuid } from "./id";

/** What a queued write does to one line. A `remove` supersedes anything queued before it; an `add` is a line the server has not seen. */
export type OutboxKind = "tick" | "untick" | "remove" | "add";

type OutboxBase = {
  /** The entry's own id, so a flush can match a result to an entry. */
  id: string;
  /** The `shopping_item` row this touches; for an `add`, the id the line has on this device until the server gives it one. */
  itemId: string;
  /** ISO stamp, injectable so an enqueue is a pure function of its arguments. */
  at: string;
};

/**
 * One pending write: which line, what to do, and when it was asked for. An
 * `add` carries the line itself, and its `ticked` too, because a tick on a
 * line the server has not seen has nowhere else to go.
 */
export type OutboxEntry = (OutboxBase & { kind: "tick" | "untick" | "remove" }) | (OutboxBase & { kind: "add"; text: string; ticked: boolean });

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
  const { id, itemId, kind, at, text, ticked } = value as Record<string, unknown>;
  if (typeof id !== "string" || typeof itemId !== "string" || typeof at !== "string") return false;
  if (kind === "add") return typeof text === "string" && typeof ticked === "boolean";
  return kind === "tick" || kind === "untick" || kind === "remove";
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
 * - once a remove is queued for a line, nothing further is queued for it;
 * - a line the server has not seen (a pending add) takes a tick or an untick
 * into itself, in place, and a remove simply drops it: there is no row
 * anywhere to write to.
 *
 * Otherwise the surviving entry is appended, so the queue stays in the order
 * the cook's last word on each line was given. Pure.
 */
export function enqueue(queue: readonly OutboxEntry[], entry: OutboxEntry): OutboxEntry[] {
  if (queue.some((queued) => queued.itemId === entry.itemId && queued.kind === "remove")) return [...queue];
  const pendingAdd = queue.find((queued) => queued.itemId === entry.itemId && queued.kind === "add");
  if (pendingAdd !== undefined && entry.kind !== "add") {
    if (entry.kind === "remove") return queue.filter((queued) => queued !== pendingAdd);
    return queue.map((queued) => (queued === pendingAdd ? { ...pendingAdd, ticked: entry.kind === "tick" } : queued));
  }
  const kept = queue.filter((queued) => queued.itemId !== entry.itemId);
  return [...kept, entry];
}

/** A new tick, untick or remove for `itemId`. `newId` and `at` are injected so the result is reproducible in a test. Pure. */
export function outboxEntry(
  itemId: string,
  kind: Exclude<OutboxKind, "add">,
  newId: () => string = randomUuid,
  at: string = new Date().toISOString()
): OutboxEntry {
  return { id: newId(), itemId, kind, at };
}

/** A new line for the list, unticked, under the id it has on this device. Pure. */
export function outboxAdd(itemId: string, text: string, newId: () => string = randomUuid, at: string = new Date().toISOString()): OutboxEntry {
  return { id: newId(), itemId, kind: "add", text, ticked: false, at };
}

/** The row a pending add stands for until the server has it: a hand-typed line, no food, no sources, at the foot of the list. Pure. */
export function pendingItem(entry: Extract<OutboxEntry, { kind: "add" }>, position: number): ShoppingItem {
  return {
    id: entry.itemId,
    position,
    quantity: null,
    unit: null,
    food: null,
    text: entry.text,
    ticked: entry.ticked,
    createdAt: entry.at,
    updatedAt: entry.at,
    sources: [],
  };
}

/**
 * `items` as the cook should see them: the last read from the server (or the
 * service worker's cache of it) with every pending write already applied. A
 * tick strikes the row through immediately, a remove takes it off the list,
 * a typed line joins the foot of it, and an entry for a line that is no
 * longer there is simply ignored. Pure.
 */
export function applyOutbox(items: readonly ShoppingItem[], queue: readonly OutboxEntry[]): ShoppingItem[] {
  const pending = new Map(queue.map((entry) => [entry.itemId, entry.kind]));
  const result: ShoppingItem[] = [];
  for (const item of items) {
    const kind = pending.get(item.id);
    if (kind === "remove") continue;
    if (kind === "tick" || kind === "untick") result.push({ ...item, ticked: kind === "tick" });
    else result.push(item);
  }
  const after = items.reduce((top, item) => Math.max(top, item.position + 1), 0);
  let position = after;
  for (const entry of queue) {
    if (entry.kind !== "add" || items.some((item) => item.id === entry.itemId)) continue;
    result.push(pendingItem(entry, position));
    position += 1;
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

/** A queue that persists itself. Every method is safe with a storage that throws. */
export type Outbox = {
  /** What is pending, oldest first. */
  list: () => OutboxEntry[];
  /** Queue a tick, untick or remove for `itemId`, coalescing per `enqueue`. Returns the new queue. */
  push: (itemId: string, kind: Exclude<OutboxKind, "add">) => OutboxEntry[];
  /** Queue a typed line under `itemId`, the id it has on this device. Returns the new queue. */
  add: (itemId: string, text: string) => OutboxEntry[];
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
    add: (itemId, text) => save(enqueue(memory, outboxAdd(itemId, text, newId, now()))),
    async flush(send) {
      const result = await flushOutbox(memory, send);
      save(result.queue);
      return result;
    },
    clear: () => void save([]),
  };
}
