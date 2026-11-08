import { expect, test } from "vitest";
import { shelfFromValue } from "../../../../../src/domain/recipes/components/library/ShelfToggle";

test("Everything, or nothing pressed, is no shelf", () => {
  expect(shelfFromValue("all")).toBeUndefined();
  expect(shelfFromValue("")).toBeUndefined();
  expect(shelfFromValue("try")).toBe("try");
  // Rotation and Weekend are the week facet now (row 219), not shelves.
  expect(["rotation", "weekend"].map(shelfFromValue)).toEqual([undefined, undefined]);
});
