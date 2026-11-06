import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { SwipeRow } from "../../../src/components/ui/SwipeRow";

const drag = (el: HTMLElement, to: number) => {
  fireEvent.pointerDown(el, { pointerType: "touch", pointerId: 1, clientX: 100, clientY: 10 });
  fireEvent.pointerMove(el, { pointerType: "touch", pointerId: 1, clientX: 120, clientY: 11 });
  fireEvent.pointerMove(el, { pointerType: "touch", pointerId: 1, clientX: 100 + to, clientY: 11 });
  fireEvent.pointerUp(el, { pointerType: "touch", pointerId: 1, clientX: 100 + to, clientY: 11 });
};

test("a drag right past 90px does the right action, once the row has slid off, and is not also a tap", () => {
  vi.useFakeTimers();
  const onRight = vi.fn();
  const onTap = vi.fn();
  render(
    <SwipeRow right={{ label: "In the trolley", tone: "go", onSwipe: onRight }}>
      <button type="button" onClick={onTap}>
        2 lemons
      </button>
    </SwipeRow>
  );
  const row = screen.getByText("2 lemons");
  drag(row, 140);
  fireEvent.click(row);
  expect(onTap).not.toHaveBeenCalled();
  expect(onRight).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(200));
  expect(onRight).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});

test("a short drag springs back, a drag towards a side with no action does nothing, and a tap is still a tap", () => {
  const onLeft = vi.fn();
  const onTap = vi.fn();
  render(
    <SwipeRow left={{ label: "Remove", tone: "stop", onSwipe: onLeft }}>
      <button type="button" onClick={onTap}>
        Dal
      </button>
    </SwipeRow>
  );
  const row = screen.getByText("Dal");
  drag(row, -50);
  drag(row, 150);
  expect(onLeft).not.toHaveBeenCalled();
  // A tap starts with its own press, which clears the drag before it.
  fireEvent.pointerDown(row, { pointerType: "touch", pointerId: 2, clientX: 100, clientY: 10 });
  fireEvent.pointerUp(row, { pointerType: "touch", pointerId: 2, clientX: 100, clientY: 10 });
  fireEvent.click(row);
  expect(onTap).toHaveBeenCalledTimes(1);
});
