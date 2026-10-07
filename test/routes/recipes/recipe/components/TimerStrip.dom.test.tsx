// The recipe page's fixed strip tells the document its height, so the toast
// stack stands on it (critique #15c), and takes the measure back when its last
// timer is dismissed. The node suite cannot run the effect that does it.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { startTimer } from "../../../../../src/lib/timers";
import { TIMER_STRIP_VAR } from "../../../../../src/lib/toast";
import { TimerStrip } from "../../../../../src/routes/recipes/recipe/components/TimerStrip";

vi.mock("../../../../../src/server/fns/push", () => ({ setTimerAlarm: vi.fn(), clearTimerAlarm: vi.fn() }));

const RECIPE = "11111111-1111-4111-8111-111111111111";
const T0 = Date.UTC(2026, 9, 8, 6, 0, 0);

beforeEach(() => {
  window.sessionStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

test("a fixed strip publishes its height while it shows, and dismissing its last timer takes it back", () => {
  startTimer(window.sessionStorage, RECIPE, { id: "step#0#20 minutes", label: "Simmer", seconds: 1200 }, T0);
  render(<TimerStrip recipeId={RECIPE} fixed />);
  expect(document.documentElement.style.getPropertyValue(TIMER_STRIP_VAR)).toMatch(/^\d+px$/);

  fireEvent.click(screen.getByRole("button", { name: "Dismiss the timer for Simmer" }));
  expect(screen.queryByTestId("timer-strip")).toBeNull();
  expect(document.documentElement.style.getPropertyValue(TIMER_STRIP_VAR)).toBe("");
});

test("cook mode's strip, in the footer's flow, publishes nothing", () => {
  startTimer(window.sessionStorage, RECIPE, { id: "step#0#20 minutes", label: "Simmer", seconds: 1200 }, T0);
  render(<TimerStrip recipeId={RECIPE} size="cook" />);
  expect(screen.getByTestId("timer-strip")).toBeInTheDocument();
  expect(document.documentElement.style.getPropertyValue(TIMER_STRIP_VAR)).toBe("");
});
