// Service worker registration guard: production only, only where the API exists.
import { expect, test, vi } from "vitest";
import { registerServiceWorker, SW_URL } from "../../src/lib/sw";

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
