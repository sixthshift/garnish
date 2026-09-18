// Service worker registration guard: production only, only where the API exists.
import { expect, test, vi } from "vitest";
import { registerServiceWorker, reloadOnControllerChange, SW_URL, updateNotice, watchForUpdate } from "../../src/lib/sw";
import { SKIP_WAITING } from "../../src/sw/message";

test("registers /sw.js at scope / in production when navigator.serviceWorker exists", () => {
  const register = vi.fn(async () => ({}));
  expect(registerServiceWorker({ serviceWorker: { register } }, true)).toBe(true);
  expect(register).toHaveBeenCalledWith(SW_URL, { scope: "/" });
  expect(SW_URL).toBe("/sw.js");
});

test("does nothing outside production", () => {
  const register = vi.fn(async () => ({}));
  expect(registerServiceWorker({ serviceWorker: { register } }, false)).toBe(false);
  expect(register).not.toHaveBeenCalled();
});

test("does nothing without the API or without a navigator", () => {
  expect(registerServiceWorker({}, true)).toBe(false);
  expect(registerServiceWorker(undefined, true)).toBe(false);
});

test("a rejected or throwing register never surfaces", async () => {
  expect(registerServiceWorker({ serviceWorker: { register: async () => Promise.reject(new Error("insecure")) } }, true)).toBe(true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(
    registerServiceWorker(
      {
        serviceWorker: {
          register: () => {
            throw new Error("sync");
          },
        },
      },
      true
    )
  ).toBe(false);
});

// The update watch: what turns "a new worker installed" into the notice, and
// what the notice's Reload does. No DOM; the registration is a fake.
function fakeWorker(state = "installing") {
  const listeners: (() => void)[] = [];
  return {
    state,
    postMessage: vi.fn<(message: unknown) => void>(),
    addEventListener: (_type: "statechange", listener: () => void) => void listeners.push(listener),
    fire: () => {
      for (const listener of listeners) listener();
    },
  };
}

type Waiting = ReturnType<typeof fakeWorker>;

function fakeRegistration() {
  const listeners: (() => void)[] = [];
  const registration = {
    waiting: null as Waiting | null,
    installing: null as Waiting | null,
    addEventListener: (_type: "updatefound", listener: () => void) => void listeners.push(listener),
    updateFound: () => {
      for (const listener of listeners) listener();
    },
  };
  return registration;
}

test("a worker already waiting is an update straight away", () => {
  const registration = fakeRegistration();
  registration.waiting = fakeWorker("installed");
  const onReady = vi.fn();

  watchForUpdate(registration, () => true, onReady);
  expect(onReady).toHaveBeenCalledWith(registration.waiting);
});

test("a worker that installs while the page is open is an update once", () => {
  const registration = fakeRegistration();
  const onReady = vi.fn();
  watchForUpdate(registration, () => true, onReady);

  const installing = fakeWorker();
  registration.installing = installing;
  registration.updateFound();
  installing.fire(); // still "installing"
  expect(onReady).not.toHaveBeenCalled();

  installing.state = "installed";
  installing.fire();
  installing.fire();
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(onReady).toHaveBeenCalledWith(installing);
});

test("the first install ever is not an update: there is nothing it replaces", () => {
  const registration = fakeRegistration();
  const onReady = vi.fn();
  watchForUpdate(registration, () => false, onReady);

  const installing = fakeWorker("installed");
  registration.installing = installing;
  registration.updateFound();
  installing.fire();
  expect(onReady).not.toHaveBeenCalled();
});

test("an updatefound with nothing installing is ignored", () => {
  const registration = fakeRegistration();
  const onReady = vi.fn();
  watchForUpdate(registration, () => true, onReady);
  registration.updateFound();
  expect(onReady).not.toHaveBeenCalled();
});

test("the notice is sticky and its Reload tells the waiting worker to take over", () => {
  const waiting = fakeWorker("installed");
  const notice = updateNotice(waiting);

  expect(notice.duration).toBe(0);
  expect(notice.action).toBe("Reload");
  expect(waiting.postMessage).not.toHaveBeenCalled();
  notice.onAction?.();
  expect(waiting.postMessage).toHaveBeenCalledWith(SKIP_WAITING);
});

test("the page reloads once when the controller changes, and not at all without the event", () => {
  const listeners: (() => void)[] = [];
  const reload = vi.fn();
  reloadOnControllerChange({ register: async () => ({}), addEventListener: (_type, listener) => void listeners.push(listener) }, reload);

  for (const listener of listeners) listener();
  for (const listener of listeners) listener();
  expect(reload).toHaveBeenCalledTimes(1);

  const quiet = vi.fn();
  reloadOnControllerChange({ register: async () => ({}) }, quiet);
  expect(quiet).not.toHaveBeenCalled();
});

test("registering watches the registration it gets back", async () => {
  const registration = fakeRegistration();
  registration.waiting = fakeWorker("installed");
  const onUpdateReady = vi.fn();

  expect(registerServiceWorker({ serviceWorker: { register: async () => registration, controller: fakeWorker("activated") } }, true, { onUpdateReady })).toBe(
    true
  );
  await Promise.resolve();
  expect(onUpdateReady).toHaveBeenCalledWith(registration.waiting);
});

test("a register that resolves to something other than a registration is no update", async () => {
  const onUpdateReady = vi.fn();
  expect(registerServiceWorker({ serviceWorker: { register: async () => undefined } }, true, { onUpdateReady })).toBe(true);
  await Promise.resolve();
  expect(onUpdateReady).not.toHaveBeenCalled();
});
