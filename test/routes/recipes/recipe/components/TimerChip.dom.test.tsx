// The tap rule, pressed through StepCard at both sizes (critique #5): a tap
// starts an idle timer, pauses a running one with its time held, resumes a
// paused one from that time, and only restarts one that is done. The node
// suite asserts the chip's markup and `timerChipAction`.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Step } from "../../../../../src/domain/recipe";
import { tickTimersNow } from "../../../../../src/lib/useTimers";
import { StepCard } from "../../../../../src/routes/recipes/recipe/components/StepCard";

vi.mock("../../../../../src/server/fns/push", () => ({ setTimerAlarm: vi.fn(), clearTimerAlarm: vi.fn() }));

const RECIPE_ID = "11111111-1111-4111-8111-111111111111";
const step: Step = { id: "22222222-2222-4222-8222-222222222222", text: "Simmer for 2 minutes.", title: "", summary: "", ingredientIds: [], image: null };
const T0 = Date.UTC(2026, 9, 8, 6, 0, 0);

beforeEach(() => {
  window.sessionStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

/** Move the clock on and let the card's timers catch up, as its one-second tick would. */
function advance(ms: number) {
  act(() => {
    vi.setSystemTime(Date.now() + ms);
    tickTimersNow(RECIPE_ID);
  });
}

const chip = () => screen.getByTestId("timer-chip");

describe.each(["page", "cook"] as const)("a timer chip at %s size", (size) => {
  test("tapping a running timer pauses it with its time held, and tapping again resumes from there", () => {
    render(
      <ul>
        <StepCard recipeId={RECIPE_ID} step={step} position={1} size={size} />
      </ul>
    );
    fireEvent.click(chip());
    expect(chip().getAttribute("data-running")).toBe("true");

    advance(4_000);
    // Re-render on the next write: the time left is read from the store.
    fireEvent.click(chip());
    expect(chip().getAttribute("data-paused")).toBe("true");
    expect(chip().getAttribute("aria-label")).toBe("2 minutes: 1:56. Resume timer");

    // Paused, the clock moving on changes nothing, and a tap never resets it to 2:00.
    advance(30_000);
    fireEvent.click(chip());
    expect(chip().getAttribute("data-running")).toBe("true");
    expect(chip().getAttribute("aria-label")).toBe("2 minutes: 1:56. Pause timer");
  });

  test("only a done timer starts again on a tap", () => {
    render(
      <ul>
        <StepCard recipeId={RECIPE_ID} step={step} position={1} size={size} />
      </ul>
    );
    fireEvent.click(chip());
    advance(121_000);
    fireEvent.click(chip()); // a no-op write would not re-render, so this tap is the restart itself
    expect(chip().getAttribute("data-running")).toBe("true");
    expect(chip().getAttribute("aria-label")).toBe("2 minutes: 2:00. Pause timer");
  });
});
