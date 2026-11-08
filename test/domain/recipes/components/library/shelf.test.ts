import { expect, test } from "vitest";
import { shelfFromValue } from "../../../../../src/domain/recipes/components/library/shelf";

test("Everything, or nothing pressed, is no shelf", () => {
  expect(shelfFromValue("all")).toBeUndefined();
  expect(shelfFromValue("")).toBeUndefined();
  expect(shelfFromValue("try")).toBe("try");
});
