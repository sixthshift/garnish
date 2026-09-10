// The online-state controller against a fake window. The React hook is a thin
// useEffect around it; the controller carries the behaviour.
import { expect, test, vi } from "vitest";
import { createOnlineController, type OnlineWindowLike } from "../../src/lib/useOnline";

function fakeWindow(onLine = true) {
  const listeners = new Map<string, Set<() => void>>();
  const win: OnlineWindowLike & { go: (online: boolean) => void; listenerCount: () => number } = {
    navigator: { onLine },
    addEventListener: (type, listener) => {
      listeners.set(type, (listeners.get(type) ?? new Set()).add(listener));
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },
    go(online) {
      win.navigator.onLine = online;
      for (const listener of [...(listeners.get(online ? "online" : "offline") ?? [])]) listener();
    },
    listenerCount: () => [...listeners.values()].reduce((n, set) => n + set.size, 0),
  };
  return win;
}

test("reports true before start and reads navigator.onLine on start", () => {
  const win = fakeWindow(false);
  const changes: boolean[] = [];
  const controller = createOnlineController(win, (online) => changes.push(online));

  expect(controller.online()).toBe(true);
  controller.start();
  expect(controller.online()).toBe(false);
  expect(changes).toEqual([false]);
  expect(win.listenerCount()).toBe(2);
});

test("an online start reports nothing (no change from the default)", () => {
  const win = fakeWindow(true);
  const onChange = vi.fn();
  createOnlineController(win, onChange).start();
  expect(onChange).not.toHaveBeenCalled();
});

test("follows offline and online events, reporting each flip once", () => {
  const win = fakeWindow(true);
  const changes: boolean[] = [];
  const controller = createOnlineController(win, (online) => changes.push(online));
  controller.start();

  win.go(false);
  win.go(false);
  win.go(true);
  expect(changes).toEqual([false, true]);
  expect(controller.online()).toBe(true);
});

test("stop removes both listeners and later events are ignored", () => {
  const win = fakeWindow(true);
  const changes: boolean[] = [];
  const controller = createOnlineController(win, (online) => changes.push(online));
  controller.start();
  controller.stop();

  expect(win.listenerCount()).toBe(0);
  win.go(false);
  expect(changes).toEqual([]);
  expect(controller.online()).toBe(true);
});

test("start and stop are idempotent", () => {
  const win = fakeWindow(true);
  const controller = createOnlineController(win);
  controller.start();
  controller.start();
  expect(win.listenerCount()).toBe(2);
  controller.stop();
  controller.stop();
  expect(win.listenerCount()).toBe(0);
});

test("a missing onLine (very old browsers) counts as online", () => {
  const win = fakeWindow();
  (win.navigator as { onLine?: boolean }).onLine = undefined;
  const controller = createOnlineController(win);
  controller.start();
  expect(controller.online()).toBe(true);
});
