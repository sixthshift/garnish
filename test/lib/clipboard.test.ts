// writeClipboard: the injected-clipboard form, including the browsers that
// have none and the ones that reject.
import { describe, expect, test, vi } from "vitest";
import { systemClipboard, writeClipboard } from "../../src/lib/clipboard";

describe("writeClipboard", () => {
  test("writes the text and reports success", async () => {
    const writeText = vi.fn(async () => {});
    await expect(writeClipboard("200 g flour", { writeText })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("200 g flour");
  });

  test("a rejecting clipboard is false, not a throw", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("Document is not focused");
    });
    await expect(writeClipboard("x", { writeText })).resolves.toBe(false);
  });

  test("no clipboard at all is false", async () => {
    await expect(writeClipboard("x", null)).resolves.toBe(false);
  });
});

describe("systemClipboard", () => {
  test("is null where the platform has no navigator.clipboard", () => {
    expect(systemClipboard()).toBeNull();
  });

  test("is the browser's clipboard when there is one", () => {
    const clipboard = { writeText: async () => {} };
    (globalThis as { navigator?: unknown }).navigator = { clipboard };
    try {
      expect(systemClipboard()).toBe(clipboard);
    } finally {
      delete (globalThis as { navigator?: unknown }).navigator;
    }
  });
});
