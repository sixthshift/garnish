// messageFrom: a thrown value as a line a person can read.
import { expect, test } from "vitest";
import { messageFrom } from "../../src/lib/errors";

test.each([
  [new Error("boom"), "boom"],
  ["plain string", "plain string"],
  [404, "404"],
  ["", "Something went wrong."],
])("messageFrom(%s) -> %s", (thrown, expected) => {
  expect(messageFrom(thrown)).toBe(expected);
});
