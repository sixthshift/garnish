import { expect, test } from "vitest";
import { shelfFromValue } from "../../../../../src/domain/recipes/components/library/ShelfToggle";

test("Everything, or nothing pressed, is no shelf", () => {
  expect(shelfFromValue("all")).toBeUndefined();
  expect(shelfFromValue("")).toBeUndefined();
  expect(["rotation", "weekend", "try"].map(shelfFromValue)).toEqual(["rotation", "weekend", "try"]);
});
