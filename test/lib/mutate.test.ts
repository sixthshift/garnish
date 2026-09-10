import { expect, test, vi } from "vitest";
import { mutate } from "../../src/lib/mutate";

test("mutate runs the write, then invalidates, and returns the write's result", async () => {
  const order: string[] = [];
  const router = {
    invalidate: vi.fn(async () => {
      order.push("invalidate");
    }),
  };
  const result = await mutate(router, async () => {
    order.push("write");
    return 42;
  });
  expect(result).toBe(42);
  expect(order).toEqual(["write", "invalidate"]);
  expect(router.invalidate).toHaveBeenCalledTimes(1);
});

test("a failed write is rethrown and nothing is invalidated", async () => {
  const router = { invalidate: vi.fn(async () => {}) };
  await expect(mutate(router, async () => Promise.reject(new Error("nope")))).rejects.toThrow("nope");
  expect(router.invalidate).not.toHaveBeenCalled();
});

test("mutate waits for invalidate to settle before resolving", async () => {
  let settled = false;
  const router = {
    invalidate: () =>
      new Promise<void>((resolve) =>
        setTimeout(() => {
          settled = true;
          resolve();
        }, 5),
      ),
  };
  await mutate(router, async () => "ok");
  expect(settled).toBe(true);
});
