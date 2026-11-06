import { expect, test } from "vitest";
import { SWIPE_ROW_COMMIT_PX, swipeAxis, swipeOffset, swipeOutcome } from "../../../src/lib/ui/swipeRow";

test("a drag is undecided until it moves 8px, then the row's if sideways and the page's if down", () => {
  expect(swipeAxis(5, 3)).toBeNull();
  expect(swipeAxis(20, 4)).toBe("row");
  expect(swipeAxis(-20, 4)).toBe("row");
  expect(swipeAxis(4, 20)).toBe("page");
});

test("the row follows the finger only towards a side that has an action", () => {
  expect(swipeOffset(40, { right: true, left: false })).toBe(40);
  expect(swipeOffset(-40, { right: true, left: false })).toBe(0);
  expect(swipeOffset(-40, { right: false, left: true })).toBe(-40);
});

test("letting go past 90px does that side's action; short of it the row springs back", () => {
  expect(swipeOutcome(SWIPE_ROW_COMMIT_PX)).toBe("right");
  expect(swipeOutcome(-SWIPE_ROW_COMMIT_PX - 1)).toBe("left");
  expect(swipeOutcome(60)).toBeNull();
});
