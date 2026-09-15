// The shopping list's outbox (M31.5): the pure queue, the stored queue and the
// controller over it. No DOM anywhere — the hook's wiring is the route's, and
// the render side is covered in test/routes/shopping.test.tsx.
import { describe, expect, test, vi } from "vitest";
import {
  applyOutbox,
  createOutbox,
  enqueue,
  flushOutbox,
  OUTBOX_KEY,
  type OutboxEntry,
  type OutboxKind,
  outboxEntry,
  parseOutbox,
  pendingLabel,
  readOutbox,
  type StorageLike,
  writeOutbox,
} from "../../src/lib/outbox";

const at = "2026-09-13T00:00:00.000Z";
let n = 0;
function entry(itemId: string, kind: OutboxKind): OutboxEntry {
  n += 1;
  return { id: `e${n}`, itemId, kind, at };
}

/** A `localStorage` stand-in; `fail` makes every access throw, as a full or locked-down one does. */
function memoryStorage(fail = false): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  const boom = () => {
    if (fail) throw new Error("storage is unavailable");
  };
  return {
    map,
    getItem: (key) => (boom(), map.get(key) ?? null),
    setItem: (key, value) => void (boom(), map.set(key, value)),
    removeItem: (key) => void (boom(), map.delete(key)),
  };
}

describe("enqueue", () => {
  test("an entry for a new item is appended, oldest first", () => {
    const queue = enqueue(enqueue([], entry("a", "tick")), entry("b", "remove"));
    expect(queue.map((e) => [e.itemId, e.kind])).toEqual([
      ["a", "tick"],
      ["b", "remove"],
    ]);
  });

  test("a tick then an untick of the same item coalesces to the last word", () => {
    const queue = enqueue(enqueue([], entry("a", "tick")), entry("a", "untick"));
    expect(queue).toHaveLength(1);
    expect(queue[0]!.kind).toBe("untick");
  });

  test("coalescing does not touch other items' entries", () => {
    let queue = enqueue([], entry("a", "tick"));
    queue = enqueue(queue, entry("b", "tick"));
    queue = enqueue(queue, entry("a", "untick"));
    expect(queue.map((e) => [e.itemId, e.kind])).toEqual([
      ["b", "tick"],
      ["a", "untick"],
    ]);
  });

  test("a remove supersedes a tick already queued for that item", () => {
    const queue = enqueue(enqueue([], entry("a", "tick")), entry("a", "remove"));
    expect(queue.map((e) => e.kind)).toEqual(["remove"]);
  });

  test("nothing is queued behind a remove: the row is going away", () => {
    const queue = enqueue(enqueue([], entry("a", "remove")), entry("a", "tick"));
    expect(queue.map((e) => e.kind)).toEqual(["remove"]);
  });

  test("the queue it is given is not mutated", () => {
    const before: OutboxEntry[] = [entry("a", "tick")];
    enqueue(before, entry("a", "untick"));
    expect(before.map((e) => e.kind)).toEqual(["tick"]);
  });
});

test("outboxEntry takes its id and its clock from its caller", () => {
  expect(outboxEntry("a", "tick", () => "fixed", at)).toEqual({ id: "fixed", itemId: "a", kind: "tick", at });
});

describe("applyOutbox", () => {
  const items = [
    { id: "a", ticked: false },
    { id: "b", ticked: true },
    { id: "c", ticked: false },
  ];

  test("a pending tick and untick show on the rendered list", () => {
    expect(applyOutbox(items, [entry("a", "tick"), entry("b", "untick")])).toEqual([
      { id: "a", ticked: true },
      { id: "b", ticked: false },
      { id: "c", ticked: false },
    ]);
  });

  test("a pending remove takes the line off the list", () => {
    expect(applyOutbox(items, [entry("c", "remove")]).map((i) => i.id)).toEqual(["a", "b"]);
  });

  test("an entry for a line that is no longer there is ignored, and order is kept", () => {
    expect(applyOutbox(items, [entry("gone", "tick")])).toEqual(items);
  });

  test("an empty queue returns the list as read", () => {
    expect(applyOutbox(items, [])).toEqual(items);
  });
});

describe("flushOutbox", () => {
  test("sends every entry in order and empties the queue", async () => {
    const seen: string[] = [];
    const queue = [entry("a", "tick"), entry("b", "remove"), entry("c", "untick")];
    const result = await flushOutbox(queue, async (e) => void seen.push(`${e.itemId}:${e.kind}`));
    expect(seen).toEqual(["a:tick", "b:remove", "c:untick"]);
    expect(result.queue).toEqual([]);
    expect(result.sent).toHaveLength(3);
    expect(result.error).toBeUndefined();
  });

  test("a failure keeps the entry and everything behind it, and stops", async () => {
    const seen: string[] = [];
    const queue = [entry("a", "tick"), entry("b", "tick"), entry("c", "tick")];
    const result = await flushOutbox(queue, async (e) => {
      seen.push(e.itemId);
      if (e.itemId === "b") throw new Error("no network");
      return undefined;
    });
    expect(seen).toEqual(["a", "b"]); // c was never attempted: order has to hold
    expect(result.queue.map((e) => e.itemId)).toEqual(["b", "c"]);
    expect(result.sent.map((e) => e.itemId)).toEqual(["a"]);
    expect((result.error as Error).message).toBe("no network");
  });

  test("a retained entry goes on the next flush", async () => {
    const queue = [entry("a", "tick")];
    const failing = await flushOutbox(queue, async () => {
      throw new Error("offline");
    });
    expect(failing.queue).toHaveLength(1);
    const send = vi.fn(async () => undefined);
    expect((await flushOutbox(failing.queue, send)).queue).toEqual([]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  test("an empty queue sends nothing", async () => {
    const send = vi.fn(async () => undefined);
    expect(await flushOutbox([], send)).toEqual({ queue: [], sent: [] });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("pendingLabel", () => {
  test("singular, plural and nothing", () => {
    expect(pendingLabel(1)).toBe("1 change waiting");
    expect(pendingLabel(3)).toBe("3 changes waiting");
    expect(pendingLabel(0)).toBe("");
    expect(pendingLabel(-1)).toBe("");
  });
});

describe("the stored queue", () => {
  test("round-trips, and an empty queue removes the key", () => {
    const storage = memoryStorage();
    writeOutbox(storage, [entry("a", "tick")]);
    expect(storage.map.has(OUTBOX_KEY)).toBe(true);
    expect(readOutbox(storage).map((e) => e.itemId)).toEqual(["a"]);
    writeOutbox(storage, []);
    expect(storage.map.has(OUTBOX_KEY)).toBe(false);
    expect(readOutbox(storage)).toEqual([]);
  });

  test("unparseable, malformed and unknown-kind entries are dropped, not thrown over", () => {
    const storage = memoryStorage();
    storage.map.set(OUTBOX_KEY, "{not json");
    expect(readOutbox(storage)).toEqual([]);
    storage.map.set(OUTBOX_KEY, JSON.stringify([{ id: "e", itemId: "a", kind: "explode", at }, { id: 1 }, entry("b", "tick")]));
    expect(readOutbox(storage).map((e) => e.itemId)).toEqual(["b"]);
    expect(parseOutbox({ nope: true })).toEqual([]);
  });

  test("a storage that throws reads empty and swallows the write", () => {
    const storage = memoryStorage(true);
    expect(readOutbox(storage)).toEqual([]);
    expect(() => writeOutbox(storage, [entry("a", "tick")])).not.toThrow();
  });
});

describe("createOutbox", () => {
  const ids = () => {
    let i = 0;
    return () => `e${(i += 1)}`;
  };

  test("picks up what a previous visit left behind and persists every push", () => {
    const storage = memoryStorage();
    writeOutbox(storage, [entry("a", "tick")]);
    const outbox = createOutbox(storage, ids(), () => at);
    expect(outbox.list().map((e) => e.itemId)).toEqual(["a"]);
    outbox.push("b", "remove");
    expect(readOutbox(storage).map((e) => [e.itemId, e.kind])).toEqual([
      ["a", "tick"],
      ["b", "remove"],
    ]);
  });

  test("a push coalesces through the stored queue", () => {
    const storage = memoryStorage();
    const outbox = createOutbox(storage, ids(), () => at);
    outbox.push("a", "tick");
    outbox.push("a", "untick");
    expect(outbox.list()).toHaveLength(1);
    expect(readOutbox(storage)[0]!.kind).toBe("untick");
  });

  test("a successful flush empties the store; a failed one leaves it", async () => {
    const storage = memoryStorage();
    const outbox = createOutbox(storage, ids(), () => at);
    outbox.push("a", "tick");
    const failed = await outbox.flush(async () => {
      throw new Error("no network");
    });
    expect(failed.queue).toHaveLength(1);
    expect(readOutbox(storage)).toHaveLength(1);
    await outbox.flush(async () => undefined);
    expect(outbox.list()).toEqual([]);
    expect(storage.map.has(OUTBOX_KEY)).toBe(false);
  });

  test("with no storage the queue still works, it just does not survive a reload", () => {
    const outbox = createOutbox(undefined, ids(), () => at);
    outbox.push("a", "tick");
    expect(outbox.list().map((e) => e.itemId)).toEqual(["a"]);
    outbox.clear();
    expect(outbox.list()).toEqual([]);
  });
});
