import { describe, expect, test } from "vitest";
import { randomUuid, uuidFromBytes } from "../../src/domain/ids";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidFromBytes", () => {
  test("formats sixteen bytes with the version and variant bits set", () => {
    const zeros = uuidFromBytes(new Uint8Array(16));
    expect(zeros).toBe("00000000-0000-4000-8000-000000000000");
    const ones = uuidFromBytes(new Uint8Array(16).fill(0xff));
    expect(ones).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    expect(ones).toMatch(V4);
  });

  test("does not mutate its input", () => {
    const bytes = new Uint8Array(16).fill(0xff);
    uuidFromBytes(bytes);
    expect(bytes[6]).toBe(0xff);
  });

  test("rejects the wrong length", () => {
    expect(() => uuidFromBytes(new Uint8Array(15))).toThrow("16 bytes");
  });
});

describe("randomUuid", () => {
  test("is a v4 UUID and differs between calls", () => {
    const a = randomUuid();
    const b = randomUuid();
    expect(a).toMatch(V4);
    expect(b).toMatch(V4);
    expect(a).not.toBe(b);
  });
});
