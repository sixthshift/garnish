import { expect, test } from "vitest";
import { shelfFromValue } from "../../../../src/routes/library/components/ShelfToggle";

test("Everything, or nothing pressed, is no shelf", () => {
  expect(shelfFromValue("all")).toBeUndefined();
  expect(shelfFromValue("")).toBeUndefined();
  expect(["rotation", "weekend", "try"].map(shelfFromValue)).toEqual(["rotation", "weekend", "try"]);
});
