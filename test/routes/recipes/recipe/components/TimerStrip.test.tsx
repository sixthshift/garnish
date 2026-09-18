// The strip of running timers: its rows on their own (presentational), and the
// connected strip reading the session store. The suite has no DOM, so effects
// never run under `renderToString` — the clock is driven by hand with
// `vi.setSystemTime` and the store's own `tickTimersNow`, which is what the
// hook's interval calls once a second.

import { toastStore } from "@sixthshift/design-system/overlay";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type StorageLike, startTimer, type Timer, timerDisplay } from "../../../../../src/lib/timers";
import { type RunningTimer, tickTimersNow } from "../../../../../src/lib/useTimers";

/** Drop every toast at once: the store's own `clear` only begins their exit. */
function clearToasts() {
  for (const record of toastStore.snapshot()) toastStore.remove(record.id);
}

import { TimerStrip, TimerStripRows } from "../../../../../src/routes/recipes/recipe/components/TimerStrip";

const RECIPE = "11111111-1111-4111-8111-111111111111";
const STEP = "33333333-3333-4333-8333-333333333333";
const T0 = 1_800_000_000_000;

/** An in-memory sessionStorage, so the strip reads what a test seeds. */
function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
}

function withStorage(storage: StorageLike) {
  (globalThis as { window?: unknown }).window = { sessionStorage: storage };
}

const timer = (over: Partial<Timer> = {}): Timer => ({
  id: `${STEP}#0#20 minutes`,
  recipeId: RECIPE,
  label: "Simmer for 20 minutes",
  seconds: 1200,
  endsAt: T0 + 1_200_000,
  remaining: 1200,
  done: false,
  ...over,
});

const running = (over: Partial<Timer> = {}, now = T0): RunningTimer => {
  const record = timer(over);
  return { ...record, ...timerDisplay(record, now) };
};

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  vi.useRealTimers();
  clearToasts();
});

describe("TimerStripRows", () => {
  const handlers = { onPause: () => {}, onResume: () => {}, onDismiss: () => {} };

  test("renders nothing when no timer is going", () => {
    expect(renderToString(<TimerStripRows timers={[]} {...handlers} />)).toBe("");
  });

  test("a running timer shows the time left, its label, Pause and a dismiss", () => {
    const html = renderToString(<TimerStripRows timers={[running({}, T0 + 328_000)]} {...handlers} />);
    expect(html).toContain('data-testid="timer-strip"');
    expect(html).toContain('aria-label="Timers"');
    expect(html).toContain("4:32");
    expect(html).toContain("Simmer for 20 minutes");
    expect(html).toContain("Pause");
    expect(html).not.toContain("Resume");
    expect(html).toContain("Dismiss the timer for Simmer for 20 minutes");
    // Never printed: a countdown is not part of the recipe.
    expect(html).toContain('data-print="hide"');
  });

  test("a paused timer holds its remainder and offers Resume", () => {
    const html = renderToString(<TimerStripRows timers={[running({ endsAt: null, remaining: 500 })]} {...handlers} />);
    expect(html).toContain('data-paused="true"');
    expect(html).toContain("8:20");
    expect(html).toContain("Resume");
    expect(html).not.toContain(">Pause<");
  });

  test("a finished timer reads Done, with no pause left to press", () => {
    const html = renderToString(<TimerStripRows timers={[running({ endsAt: null, remaining: 0, done: true })]} {...handlers} />);
    expect(html).toContain('data-done="true"');
    expect(html).toContain("Done");
    expect(html).not.toContain("Pause");
    expect(html).not.toContain("Resume");
    expect(html).toContain("Dismiss the timer for");
  });

  test("one row per timer", () => {
    const two = [running(), running({ id: "b", label: "Rest" })];
    const html = renderToString(<TimerStripRows timers={two} {...handlers} />);
    expect(html.split('data-testid="timer-row"').length - 1).toBe(2);
  });
});

describe("TimerStrip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });

  test("nothing renders while the recipe has no timers", () => {
    withStorage(fakeStorage());
    expect(renderToString(<TimerStrip recipeId={RECIPE} />)).toBe("");
  });

  test("reads the session store, and pins itself above the tab bar when fixed", () => {
    const storage = fakeStorage();
    withStorage(storage);
    startTimer(storage, RECIPE, { id: `${STEP}#0#20 minutes`, label: "Simmer for 20 minutes", seconds: 1200 }, T0);

    vi.setSystemTime(T0 + 60_000);
    const html = renderToString(<TimerStrip recipeId={RECIPE} fixed />);
    expect(html).toContain("19:00");
    expect(html).toContain("Simmer for 20 minutes");
    // Fixed above the phone tab bar.
    expect(html).toContain("bottom-20");
    expect(html).toContain("md:bottom-4");
  });

  test("in cook mode it is not fixed: it sits in the footer's own flow", () => {
    const storage = fakeStorage();
    withStorage(storage);
    startTimer(storage, RECIPE, { id: `${STEP}#0#20 minutes`, label: "Simmer", seconds: 1200 }, T0);
    expect(renderToString(<TimerStrip recipeId={RECIPE} />)).not.toContain("bottom-20");
  });

  test("a timer that reaches zero notifies with the step's text, buzzes, and then reads Done", () => {
    const storage = fakeStorage();
    withStorage(storage);
    const vibrate = vi.fn();
    const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", { value: { vibrate }, configurable: true, writable: true });
    clearToasts();

    try {
      startTimer(storage, RECIPE, { id: `${STEP}#0#20 minutes`, label: "Simmer for 20 minutes", seconds: 1200 }, T0);
      expect(renderToString(<TimerStrip recipeId={RECIPE} />)).toContain("20:00");

      // A second short of the end: still counting, nobody told.
      vi.setSystemTime(T0 + 1_199_000);
      tickTimersNow(RECIPE);
      expect(toastStore.snapshot()).toHaveLength(0);
      expect(renderToString(<TimerStrip recipeId={RECIPE} />)).toContain("0:01");

      // Zero. This is what the hook's once-a-second interval does.
      vi.setSystemTime(T0 + 1_200_000);
      tickTimersNow(RECIPE);
      expect(toastStore.snapshot()).toHaveLength(1);
      expect(toastStore.snapshot()[0]).toMatchObject({ options: { title: "Timer done", children: "Simmer for 20 minutes" } });
      expect(vibrate).toHaveBeenCalledWith([200, 100, 200]);

      // Said once, however often it ticks afterwards; the row stays until dismissed.
      vi.setSystemTime(T0 + 1_300_000);
      tickTimersNow(RECIPE);
      expect(toastStore.snapshot()).toHaveLength(1);
      const html = renderToString(<TimerStrip recipeId={RECIPE} />);
      expect(html).toContain("Done");
      expect(html).toContain("Dismiss the timer for Simmer for 20 minutes");
    } finally {
      if (previous) Object.defineProperty(globalThis, "navigator", previous);
      else delete (globalThis as { navigator?: unknown }).navigator;
    }
  });

  test("no vibration API, or no storage at all: nothing throws", () => {
    withStorage(fakeStorage());
    expect(() => tickTimersNow(RECIPE)).not.toThrow();
    delete (globalThis as { window?: unknown }).window;
    expect(() => tickTimersNow(RECIPE)).not.toThrow();
    expect(renderToString(<TimerStrip recipeId={RECIPE} />)).toBe("");
  });
});
