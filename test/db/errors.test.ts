import { expect, test } from "vitest";
import { NotFound, isNotFoundError, required } from "../../src/db/errors";

test("NotFound carries entity and id and names itself", () => {
  const e = new NotFound("recipe", "abc");
  expect(e).toBeInstanceOf(Error);
  expect(e.name).toBe("NotFound");
  expect(e.entity).toBe("recipe");
  expect(e.id).toBe("abc");
  expect(e.message).toBe("recipe abc not found");
});

test("isNotFoundError matches by class or by name, nothing else", () => {
  expect(isNotFoundError(new NotFound("a", "1"))).toBe(true);
  const foreign = Object.assign(new Error("x"), { name: "NotFound" });
  expect(isNotFoundError(foreign)).toBe(true);
  expect(isNotFoundError(new Error("x"))).toBe(false);
  expect(isNotFoundError({ name: "NotFound" })).toBe(false);
  expect(isNotFoundError(undefined)).toBe(false);
});

test("required passes values through and throws NotFound on null or undefined", () => {
  expect(required(0, "n", "1")).toBe(0);
  expect(required("", "n", "1")).toBe("");
  expect(() => required(null, "unit", "u1")).toThrow(NotFound);
  expect(() => required(undefined, "unit", "u2")).toThrow("unit u2 not found");
});
