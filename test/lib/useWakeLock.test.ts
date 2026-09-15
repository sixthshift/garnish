// The wake-lock controller against a mocked `navigator.wakeLock` and
// `document`. The React hook is a thin `useEffect` around it and has no DOM to
// run in here; the controller carries all the behaviour the task names.
import { expect, test, vi } from "vitest";
import { createWakeLockController, type DocumentLike, type NavigatorLike, type WakeLockSentinelLike } from "../../src/lib/useWakeLock";

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** A fake document whose visibility the test flips, dispatching `visibilitychange`. */
function fakeDocument(state = "visible") {
  const listeners = new Set<() => void>();
  const doc: DocumentLike & { setVisibility: (next: string) => void; listenerCount: () => number } = {
    visibilityState: state,
    addEventListener: (_type, listener) => void listeners.add(listener),
    removeEventListener: (_type, listener) => void listeners.delete(listener),
    setVisibility(next) {
      doc.visibilityState = next;
      for (const listener of [...listeners]) listener();
    },
    listenerCount: () => listeners.size,
  };
  return doc;
}

/** A fake sentinel that records release() and can fire its own `release` event. */
function fakeSentinel() {
  let onRelease: (() => void) | undefined;
  const sentinel: WakeLockSentinelLike & { fireRelease: () => void } = {
    release: vi.fn(async () => {}),
    addEventListener: (_type, listener) => {
      onRelease = listener;
    },
    fireRelease: () => onRelease?.(),
  };
  return sentinel;
}

function fakeNavigator(request = vi.fn(async (_type: "screen") => fakeSentinel() as WakeLockSentinelLike)) {
  const nav: NavigatorLike = { wakeLock: { request } };
  return { nav, request };
}

test("enter requests a screen lock and reports active", async () => {
  const { nav, request } = fakeNavigator();
  const doc = fakeDocument();
  const changes: boolean[] = [];
  const controller = createWakeLockController(nav, doc, (active) => changes.push(active));

  controller.enter();
  await flush();

  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith("screen");
  expect(controller.active()).toBe(true);
  expect(changes).toEqual([true]);
  expect(doc.listenerCount()).toBe(1);
});

test("leave releases the sentinel, reports inactive, and stops listening", async () => {
  const sentinel = fakeSentinel();
  const { nav } = fakeNavigator(vi.fn(async () => sentinel));
  const doc = fakeDocument();
  const changes: boolean[] = [];
  const controller = createWakeLockController(nav, doc, (active) => changes.push(active));

  controller.enter();
  await flush();
  controller.leave();
  await flush();

  expect(sentinel.release).toHaveBeenCalledTimes(1);
  expect(controller.active()).toBe(false);
  expect(changes).toEqual([true, false]);
  expect(doc.listenerCount()).toBe(0);
});

test("the lock is requested again when the page becomes visible", async () => {
  const first = fakeSentinel();
  const second = fakeSentinel();
  const request = vi
    .fn(async () => first)
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce(second);
  const { nav } = fakeNavigator(request);
  const doc = fakeDocument();
  const controller = createWakeLockController(nav, doc);

  controller.enter();
  await flush();
  // The browser drops the lock when the tab hides and tells the sentinel.
  doc.setVisibility("hidden");
  first.fireRelease();
  expect(controller.active()).toBe(false);
  expect(request).toHaveBeenCalledTimes(1);

  doc.setVisibility("visible");
  await flush();

  expect(request).toHaveBeenCalledTimes(2);
  expect(controller.active()).toBe(true);
  controller.leave();
  await flush();
  expect(second.release).toHaveBeenCalledTimes(1);
});

test("no request while hidden; enter on a hidden page waits for visibility", async () => {
  const { nav, request } = fakeNavigator();
  const doc = fakeDocument("hidden");
  const controller = createWakeLockController(nav, doc);

  controller.enter();
  await flush();
  expect(request).not.toHaveBeenCalled();
  expect(controller.active()).toBe(false);

  doc.setVisibility("visible");
  await flush();
  expect(request).toHaveBeenCalledTimes(1);
  expect(controller.active()).toBe(true);
});

test("does nothing, and does not throw, when navigator.wakeLock is undefined", async () => {
  const doc = fakeDocument();
  const changes: boolean[] = [];
  const controller = createWakeLockController({}, doc, (active) => changes.push(active));

  expect(() => controller.enter()).not.toThrow();
  await flush();
  doc.setVisibility("hidden");
  doc.setVisibility("visible");
  await flush();
  expect(() => controller.leave()).not.toThrow();

  expect(controller.active()).toBe(false);
  expect(changes).toEqual([]);
});

test("a rejected request is swallowed and leaves the controller inactive", async () => {
  const request = vi.fn(async (): Promise<WakeLockSentinelLike> => Promise.reject(new DOMException("denied", "NotAllowedError")));
  const { nav } = fakeNavigator(request);
  const doc = fakeDocument();
  const changes: boolean[] = [];
  const controller = createWakeLockController(nav, doc, (active) => changes.push(active));

  controller.enter();
  await flush();

  expect(request).toHaveBeenCalledTimes(1);
  expect(controller.active()).toBe(false);
  expect(changes).toEqual([]);
  expect(() => controller.leave()).not.toThrow();
});

test("a lock that resolves after leave is released rather than kept", async () => {
  const sentinel = fakeSentinel();
  let resolve!: (value: WakeLockSentinelLike) => void;
  const request = vi.fn(() => new Promise<WakeLockSentinelLike>((r) => (resolve = r)));
  const { nav } = fakeNavigator(request);
  const doc = fakeDocument();
  const changes: boolean[] = [];
  const controller = createWakeLockController(nav, doc, (active) => changes.push(active));

  controller.enter();
  controller.leave();
  resolve(sentinel);
  await flush();

  expect(sentinel.release).toHaveBeenCalledTimes(1);
  expect(controller.active()).toBe(false);
  expect(changes).toEqual([]);
});

test("enter and leave are idempotent", async () => {
  const { nav, request } = fakeNavigator();
  const doc = fakeDocument();
  const controller = createWakeLockController(nav, doc);

  controller.enter();
  controller.enter();
  await flush();
  expect(request).toHaveBeenCalledTimes(1);
  expect(doc.listenerCount()).toBe(1);

  controller.leave();
  controller.leave();
  expect(doc.listenerCount()).toBe(0);
});
