// The notice store and its pure helpers. No DOM: the store is a plain array
// with subscribers, and the Toaster (test/components/Toaster.test.tsx) is what
// renders it.
import { describe, expect, test, vi } from "vitest";
import {
  createNoticeStore,
  defaultDuration,
  MAX_NOTICES,
  messageFrom,
  type Notice,
  type NoticeInput,
  toNotice,
  withNotice,
} from "../../src/lib/notify";

/** Ids in call order, so assertions can name them. */
function counter(): () => string {
  let n = 0;
  return () => `n${++n}`;
}

describe("defaultDuration", () => {
  test("failures stay until dismissed; everything else expires", () => {
    expect(defaultDuration("danger")).toBe(0);
    expect(defaultDuration("success")).toBeGreaterThan(0);
    expect(defaultDuration("warning")).toBeGreaterThan(0);
    expect(defaultDuration("neutral")).toBeGreaterThan(0);
  });
});

describe("messageFrom", () => {
  test.each([
    [new Error("boom"), "boom"],
    ["plain string", "plain string"],
    [404, "404"],
    ["", "Something went wrong."],
  ])("%s -> %s", (thrown, expected) => {
    expect(messageFrom(thrown)).toBe(expected);
  });
});

describe("toNotice", () => {
  test("fills in id, intent and duration, and keeps absent text absent", () => {
    expect(toNotice({ title: "Saved", intent: "success" }, counter())).toEqual({
      id: "n1",
      intent: "success",
      title: "Saved",
      duration: defaultDuration("success"),
    });
  });

  test("defaults to neutral, and an explicit duration wins", () => {
    const notice = toNotice({ message: "Hello", duration: 10 }, counter());
    expect(notice.intent).toBe("neutral");
    expect(notice.duration).toBe(10);
    expect(notice.title).toBeUndefined();
  });
});

describe("withNotice", () => {
  const notice = (id: string): Notice => ({ id, intent: "neutral", duration: 0 });

  test("appends", () => {
    expect(withNotice([notice("a")], notice("b")).map((n) => n.id)).toEqual(["a", "b"]);
  });

  test("keeps at most MAX_NOTICES, dropping the oldest", () => {
    let stack: Notice[] = [];
    for (let i = 0; i < MAX_NOTICES + 2; i++) stack = withNotice(stack, notice(`a${i}`));
    expect(stack).toHaveLength(MAX_NOTICES);
    expect(stack[0]!.id).toBe(`a${2}`);
  });
});

describe("createNoticeStore", () => {
  test("push adds and notifies; the snapshot is stable between changes", () => {
    const store = createNoticeStore(counter());
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.snapshot()).toEqual([]);
    const first = store.snapshot();
    expect(store.snapshot()).toBe(first); // reference-stable for useSyncExternalStore

    const id = store.push({ intent: "success", title: "Saved" });
    expect(id).toBe("n1");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.snapshot().map((n) => n.title)).toEqual(["Saved"]);
  });

  test("dismiss removes one notice; an unknown id changes nothing and notifies no one", () => {
    const store = createNoticeStore(counter());
    const a = store.push({ title: "A" });
    store.push({ title: "B" });
    const listener = vi.fn();
    store.subscribe(listener);

    store.dismiss(a);
    expect(store.snapshot().map((n) => n.title)).toEqual(["B"]);
    expect(listener).toHaveBeenCalledTimes(1);

    store.dismiss("nope");
    expect(store.snapshot().map((n) => n.title)).toEqual(["B"]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("clear empties the stack, and does nothing when it is already empty", () => {
    const store = createNoticeStore(counter());
    const listener = vi.fn();
    store.subscribe(listener);

    store.clear();
    expect(listener).not.toHaveBeenCalled();

    store.push({ title: "A" });
    store.clear();
    expect(store.snapshot()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test("unsubscribe stops the listener", () => {
    const store = createNoticeStore(counter());
    const listener = vi.fn();
    store.subscribe(listener)();
    store.push({ title: "A" });
    expect(listener).not.toHaveBeenCalled();
  });

  test("the stack never grows past MAX_NOTICES", () => {
    const store = createNoticeStore(counter());
    for (let i = 0; i < MAX_NOTICES + 3; i++) store.push({ title: `A${i}` } satisfies NoticeInput);
    expect(store.snapshot()).toHaveLength(MAX_NOTICES);
  });
});

test("a notice can carry one action button, and only when given", () => {
  const onSelect = () => {};
  expect(toNotice({ title: "3 items added", action: { label: "View list", onSelect } }, () => "id")).toMatchObject({
    action: { label: "View list", onSelect },
  });
  expect(toNotice({ title: "Saved" }, () => "id")).not.toHaveProperty("action");
});
