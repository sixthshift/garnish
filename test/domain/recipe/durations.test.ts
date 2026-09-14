// durationsIn: every duration named in a step's text, with its offset and its
// length in seconds. A table over the shapes it recognises, plus the shapes
// that look like a number but are not a duration.
import { describe, expect, test } from "vitest";
import { durationsIn } from "../../../src/domain/recipe/durations";

describe("durationsIn", () => {
  const cases: Array<[label: string, text: string, expected: Array<{ text: string; seconds: number; upperSeconds?: number }>]> = [
    ["minutes, spelled out", "Simmer for 20 minutes.", [{ text: "20 minutes", seconds: 1200 }]],
    ["minutes, abbreviated", "Simmer for 20 min.", [{ text: "20 min", seconds: 1200 }]],
    ["an hour, spelled out", "Prove for 1 hour.", [{ text: "1 hour", seconds: 3600 }]],
    ["a half hour written as a fraction glyph", "Prove for 1½ hours.", [{ text: "1½ hours", seconds: 5400 }]],
    ["hours and minutes together, one match", "Braise for 1 hr 30 min.", [{ text: "1 hr 30 min", seconds: 5400 }]],
    ["seconds, spelled out", "Blitz for 30 seconds.", [{ text: "30 seconds", seconds: 30 }]],
    ["a dash range keeps both bounds", "Bake for 10-12 minutes.", [{ text: "10-12 minutes", seconds: 600, upperSeconds: 720 }]],
    ["a 'to' range keeps both bounds", "Bake for 10 to 12 minutes.", [{ text: "10 to 12 minutes", seconds: 600, upperSeconds: 720 }]],
    ["a bare abbreviated hour", "Rest for 1 h.", [{ text: "1 h", seconds: 3600 }]],
    ["a bare abbreviated second", "Whisk for 5 s.", [{ text: "5 s", seconds: 5 }]],
    ["two durations in one step, in order", "Sear for 2 minutes, then rest for 1 hour.", [
      { text: "2 minutes", seconds: 120 },
      { text: "1 hour", seconds: 3600 },
    ]],
    ["a count of eggs is not a duration", "Add 2 eggs.", []],
    ["a step number is not a duration", "See step 3.", []],
    ["an oven temperature is not a duration", "Heat the oven to 350 degrees.", []],
    ["a temperature with a degree symbol is not a duration", "Heat the oven to 350°C.", []],
    ["a gas mark is not a duration", "Set the oven to gas mark 4.", []],
  ];

  for (const [label, text, expected] of cases) {
    test(label, () => {
      const matches = durationsIn(text).map(({ text: matchText, seconds, upperSeconds }) =>
        upperSeconds === undefined ? { text: matchText, seconds } : { text: matchText, seconds, upperSeconds },
      );
      expect(matches).toEqual(expected);
    });
  }

  test("offsets point back at the source text", () => {
    const text = "Simmer for 20 minutes, then rest for 1 hour.";
    const [first, second] = durationsIn(text);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(text.slice(first!.start, first!.end)).toBe("20 minutes");
    expect(text.slice(second!.start, second!.end)).toBe("1 hour");
    expect(first!.end).toBeLessThanOrEqual(second!.start);
  });

  test("case is ignored", () => {
    const text = "Bake for 20 MINUTES.";
    const [match] = durationsIn(text);
    expect(match).toBeDefined();
    expect(match).toMatchObject({ text: "20 MINUTES", seconds: 1200 });
    expect(text.slice(match!.start, match!.end)).toBe("20 MINUTES");
  });

  test("an empty step has no durations", () => {
    expect(durationsIn("")).toEqual([]);
    expect(durationsIn("   ")).toEqual([]);
  });
});
