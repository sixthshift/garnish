// The running-timer controller against an in-memory storage, including one
// that throws on every access. Every function here takes `now`, so the whole
// life of a timer — start, tick, pause, resume, expire, dismiss, clear — is
// tested with plain numbers and no fake clock.
import { describe, expect, test } from "vitest";
import { formatRemaining } from "../../src/lib/dates";
import {
  chipTimerId,
  clearTimers,
  dismissTimer,
  getTimers,
  pauseTimer,
  remainingSeconds,
  resumeTimer,
  startTimer,
  subscribeTimers,
  tickTimers,
  timerDisplay,
  type StorageLike,
  type Timer,
} from "../../src/lib/timers";

/** A plain in-memory Storage-like, for round-trip tests. */
function memoryStorage(): StorageLike & { size: () => number } {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    size: () => map.size,
  };
}

/** A storage whose every method throws, for the "storage is unavailable" cases. */
function throwingStorage(): StorageLike {
  return {
    getItem: () => {
      throw new DOMException("blocked", "SecurityError");
    },
    setItem: () => {
      throw new DOMException("blocked", "SecurityError");
    },
  };
}

const RECIPE = "11111111-1111-4111-8111-111111111111";
const OTHER_RECIPE = "22222222-2222-4222-8222-222222222222";
const STEP = "33333333-3333-4333-8333-333333333333";
const T0 = 1_800_000_000_000;

const chip = (offset = 0, text = "20 minutes") => chipTimerId(STEP, offset, text);

describe("getTimers", () => {
  test("is empty for a recipe with nothing stored", () => {
    expect(getTimers(memoryStorage(), RECIPE)).toEqual([]);
  });

  test("falls back to empty for malformed content, and drops records that are not timers", () => {
    const storage = memoryStorage();
    storage.setItem(`garnish.timers.${RECIPE}`, "not json{");
    expect(getTimers(storage, RECIPE)).toEqual([]);
    storage.setItem(`garnish.timers.${RECIPE}`, JSON.stringify({ id: "a" }));
    expect(getTimers(storage, RECIPE)).toEqual([]);
    storage.setItem(`garnish.timers.${RECIPE}`, JSON.stringify([{ id: "a", label: "x" }, 7, null]));
    expect(getTimers(storage, RECIPE)).toEqual([]);
  });

  test("a storage that throws reads as empty rather than blowing up", () => {
    expect(getTimers(throwingStorage(), RECIPE)).toEqual([]);
  });
});

describe("startTimer", () => {
  test("records the label, the length and the absolute end time", () => {
    const storage = memoryStorage();
    const timers = startTimer(storage, RECIPE, { id: chip(), label: "Simmer for 20 minutes", seconds: 1200 }, T0);
    expect(timers).toHaveLength(1);
    expect(timers[0]).toMatchObject({
      id: chip(),
      recipeId: RECIPE,
      label: "Simmer for 20 minutes",
      seconds: 1200,
      endsAt: T0 + 1_200_000,
      remaining: 1200,
      done: false,
    });
    // Survives a reload: the end time is absolute, not a countdown in memory.
    expect(getTimers(storage, RECIPE)).toEqual(timers);
  });

  test("a second chip in the same step is a second timer; the same chip restarts its own", () => {
    const storage = memoryStorage();
    startTimer(storage, RECIPE, { id: chip(0), label: "Simmer", seconds: 600 }, T0);
    startTimer(storage, RECIPE, { id: chip(30, "5 minutes"), label: "Rest", seconds: 300 }, T0);
    expect(getTimers(storage, RECIPE)).toHaveLength(2);

    const restarted = startTimer(storage, RECIPE, { id: chip(0), label: "Simmer", seconds: 600 }, T0 + 60_000);
    expect(restarted).toHaveLength(2);
    expect(restarted.find((timer) => timer.id === chip(0))?.endsAt).toBe(T0 + 60_000 + 600_000);
  });

  test("each recipe has its own set", () => {
    const storage = memoryStorage();
    startTimer(storage, RECIPE, { id: chip(), label: "Simmer", seconds: 600 }, T0);
    expect(getTimers(storage, OTHER_RECIPE)).toEqual([]);
  });

  test("a blank label falls back to the length, and the length is at least a second", () => {
    const storage = memoryStorage();
    const [timer] = startTimer(storage, RECIPE, { id: chip(), label: "   ", seconds: 0 }, T0);
    expect(timer?.label).toBe("1 seconds");
    expect(timer?.seconds).toBe(1);
  });

  test("a storage that throws still returns the new list, it just does not persist", () => {
    const timers = startTimer(throwingStorage(), RECIPE, { id: chip(), label: "Simmer", seconds: 600 }, T0);
    expect(timers).toHaveLength(1);
  });
});

describe("remainingSeconds", () => {
  const timer: Timer = { id: chip(), recipeId: RECIPE, label: "Simmer", seconds: 600, endsAt: T0 + 600_000, remaining: 600, done: false };

  test("counts down from the end time, rounding up so it reads 0:01 until it is up", () => {
    expect(remainingSeconds(timer, T0)).toBe(600);
    expect(remainingSeconds(timer, T0 + 599_500)).toBe(1);
    expect(remainingSeconds(timer, T0 + 600_000)).toBe(0);
    expect(remainingSeconds(timer, T0 + 900_000)).toBe(0);
  });

  test("a paused timer holds its remainder, and a done one is zero", () => {
    expect(remainingSeconds({ ...timer, endsAt: null, remaining: 42 }, T0 + 10_000_000)).toBe(42);
    expect(remainingSeconds({ ...timer, done: true }, T0)).toBe(0);
  });
});

describe("timerDisplay", () => {
  test("prints m:ss while running and Done once it is up", () => {
    const timer: Timer = { id: chip(), recipeId: RECIPE, label: "Simmer", seconds: 600, endsAt: T0 + 600_000, remaining: 600, done: false };
    expect(timerDisplay(timer, T0 + 328_000)).toEqual({ remainingSeconds: 272, text: "4:32", done: false });
    expect(timerDisplay({ ...timer, endsAt: null, remaining: 0, done: true }, T0)).toEqual({ remainingSeconds: 0, text: "Done", done: true });
  });
});

describe("tickTimers", () => {
  test("keeps the remainder in step while a timer runs, and expires nothing early", () => {
    const storage = memoryStorage();
    startTimer(storage, RECIPE, { id: chip(), label: "Simmer", seconds: 600 }, T0);
    const { timers, expired } = tickTimers(storage, RECIPE, T0 + 60_000);
    expect(expired).toEqual([]);
    expect(timers[0]?.remaining).toBe(540);
    expect(timers[0]?.done).toBe(false);
  });

  test("expires a timer whose end has passed, once", () => {
    const storage = memoryStorage();
    startTimer(storage, RECIPE, { id: chip(), label: "Simmer for 20 minutes", seconds: 1200 }, T0);

    const first = tickTimers(storage, RECIPE, T0 + 1_200_000);
    expect(first.expired.map((timer) => timer.label)).toEqual(["Simmer for 20 minutes"]);
    expect(first.timers[0]).toMatchObject({ done: true, endsAt: null, remaining: 0 });

    // A page reopened long after the fact does not announce it again.
    const second = tickTimers(storage, RECIPE, T0 + 9_000_000);
    expect(second.expired).toEqual([]);
    expect(second.timers[0]?.done).toBe(true);
  });

  test("a timer that ran out while the page was away is done on the first tick back", () => {
    const storage = memoryStorage();
    startTimer(storage, RECIPE, { id: chip(), label: "Simmer", seconds: 600 }, T0);
    expect(tickTimers(storage, RECIPE, T0 + 3_600_000).expired).toHaveLength(1);
    expect(getTimers(storage, RECIPE)[0]?.done).toBe(true);
  });

  test("nothing to do means no write and no notification", () => {
    const storage = memoryStorage();
    let writes = 0;
    const counting: StorageLike = { getItem: storage.getItem, setItem: (key, value) => (writes++, storage.setItem(key, value)) };
    startTimer(counting, RECIPE, { id: chip(), label: "Simmer", seconds: 600 }, T0);
    writes = 0;
    const { expired } = tickTimers(counting, RECIPE, T0 + 500);
    expect(expired).toEqual([]);
    expect(writes).toBe(0);
  });
});

describe("pauseTimer / resumeTimer", () => {
  test("pausing freezes the remainder, and time passing does not move it", () => {
    const storage = memoryStorage();
    startTimer(storage, RECIPE, { id: chip(), label: "Simmer", seconds: 600 }, T0);
    const [paused] = pauseTimer(storage, RECIPE, chip(), T0 + 100_000);
    expect(paused).toMatchObject({ endsAt: null, remaining: 500, done: false });
    expect(tickTimers(storage, RECIPE, T0 + 9_000_000).expired).toEqual([]);
    expect(getTimers(storage, RECIPE)[0]?.remaining).toBe(500);
  });

  test("resuming gives it its remainder again, from now", () => {
    const storage = memoryStorage();
    startTimer(storage, RECIPE, { id: chip(), label: "Simmer", seconds: 600 }, T0);
    pauseTimer(storage, RECIPE, chip(), T0 + 100_000);
    const [resumed] = resumeTimer(storage, RECIPE, chip(), T0 + 5_000_000);
    expect(resumed?.endsAt).toBe(T0 + 5_000_000 + 500_000);
    expect(remainingSeconds(resumed!, T0 + 5_000_000)).toBe(500);
  });

  test("pausing a done timer, or one that is not there, changes nothing", () => {
    const storage = memoryStorage();
    startTimer(storage, RECIPE, { id: chip(), label: "Simmer", seconds: 600 }, T0);
    tickTimers(storage, RECIPE, T0 + 600_000);
    const before = getTimers(storage, RECIPE);
    expect(pauseTimer(storage, RECIPE, chip(), T0 + 700_000)).toEqual(before);
    expect(resumeTimer(storage, RECIPE, chip(), T0 + 700_000)).toEqual(before);
    expect(pauseTimer(storage, RECIPE, "no-such-timer", T0)).toEqual(before);
  });
});

describe("dismissTimer / clearTimers", () => {
  test("dismissing drops one, leaving the rest", () => {
    const storage = memoryStorage();
    startTimer(storage, RECIPE, { id: chip(0), label: "Simmer", seconds: 600 }, T0);
    startTimer(storage, RECIPE, { id: chip(30, "5 minutes"), label: "Rest", seconds: 300 }, T0);
    const left = dismissTimer(storage, RECIPE, chip(0));
    expect(left.map((timer) => timer.label)).toEqual(["Rest"]);
    expect(getTimers(storage, RECIPE)).toEqual(left);
  });

  test("a done timer stays until it is dismissed", () => {
    const storage = memoryStorage();
    startTimer(storage, RECIPE, { id: chip(), label: "Simmer", seconds: 600 }, T0);
    tickTimers(storage, RECIPE, T0 + 600_000);
    expect(getTimers(storage, RECIPE)).toHaveLength(1);
    expect(dismissTimer(storage, RECIPE, chip())).toEqual([]);
  });

  test("clearing drops the lot for that recipe only", () => {
    const storage = memoryStorage();
    startTimer(storage, RECIPE, { id: chip(), label: "Simmer", seconds: 600 }, T0);
    startTimer(storage, OTHER_RECIPE, { id: chip(), label: "Prove", seconds: 900 }, T0);
    expect(clearTimers(storage, RECIPE)).toEqual([]);
    expect(getTimers(storage, OTHER_RECIPE)).toHaveLength(1);
  });
});

describe("subscribeTimers", () => {
  test("every write tells the listeners, until they unsubscribe", () => {
    const storage = memoryStorage();
    let calls = 0;
    const stop = subscribeTimers(() => calls++);
    startTimer(storage, RECIPE, { id: chip(), label: "Simmer", seconds: 600 }, T0);
    pauseTimer(storage, RECIPE, chip(), T0 + 1000);
    expect(calls).toBe(2);
    stop();
    dismissTimer(storage, RECIPE, chip());
    expect(calls).toBe(2);
  });
});

describe("chipTimerId", () => {
  test("is stable per step, offset and matched text, so a reload finds the same timer", () => {
    expect(chipTimerId(STEP, 12, "20 minutes")).toBe(`${STEP}#12#20 minutes`);
    expect(chipTimerId(STEP, 12, "20 minutes")).toBe(chipTimerId(STEP, 12, "20 minutes"));
    expect(chipTimerId(STEP, 40, "20 minutes")).not.toBe(chipTimerId(STEP, 12, "20 minutes"));
  });
});

describe("formatRemaining", () => {
  test("m:ss, minutes unpadded and running past an hour", () => {
    expect(formatRemaining(0)).toBe("0:00");
    expect(formatRemaining(9)).toBe("0:09");
    expect(formatRemaining(90)).toBe("1:30");
    expect(formatRemaining(600)).toBe("10:00");
    expect(formatRemaining(5400)).toBe("90:00");
  });

  test("clamps below zero and rounds a part-second up", () => {
    expect(formatRemaining(-5)).toBe("0:00");
    expect(formatRemaining(0.2)).toBe("0:01");
  });
});
