// M27.5: the decision behind the phone's way into quick edit — has this press
// become a long press? The hook is a thin timer wrapper (there is no DOM under
// vitest); the pure decision carries the behaviour.
import { describe, expect, test } from "vitest";
import { isLongPress, LONG_PRESS_MOVE_PX, LONG_PRESS_MS } from "../../src/lib/useLongPress";

const press = (over: Partial<Parameters<typeof isLongPress>[0]> = {}) => ({
  pointerType: "touch",
  dx: 0,
  dy: 0,
  ms: LONG_PRESS_MS,
  ...over,
});

describe("isLongPress", () => {
  test("a still touch held to the threshold is a long press", () => {
    expect(isLongPress(press())).toBe(true);
    expect(isLongPress(press({ ms: LONG_PRESS_MS + 200 }))).toBe(true);
  });

  test("a pen counts too; a mouse never does, it has the hover pencil", () => {
    expect(isLongPress(press({ pointerType: "pen" }))).toBe(true);
    expect(isLongPress(press({ pointerType: "mouse" }))).toBe(false);
    expect(isLongPress(press({ pointerType: "" }))).toBe(false);
  });

  test("a tap that lifts early is not a long press", () => {
    expect(isLongPress(press({ ms: LONG_PRESS_MS - 1 }))).toBe(false);
    expect(isLongPress(press({ ms: 0 }))).toBe(false);
  });

  test("drifting past the threshold is a scroll, not a press", () => {
    expect(isLongPress(press({ dy: LONG_PRESS_MOVE_PX + 1 }))).toBe(false);
    expect(isLongPress(press({ dx: LONG_PRESS_MOVE_PX + 1 }))).toBe(false);
    // Diagonal drift counts as travel, not as two small movements.
    expect(isLongPress(press({ dx: 8, dy: 8 }))).toBe(false);
  });

  test("drift within the threshold is still a press: a finger is never perfectly still", () => {
    expect(isLongPress(press({ dx: 3, dy: -4 }))).toBe(true);
    expect(isLongPress(press({ dx: LONG_PRESS_MOVE_PX, dy: 0 }))).toBe(true);
  });

  test("nonsense numbers are not a long press", () => {
    expect(isLongPress(press({ dx: Number.NaN }))).toBe(false);
    expect(isLongPress(press({ ms: Number.POSITIVE_INFINITY }))).toBe(false);
  });
});
