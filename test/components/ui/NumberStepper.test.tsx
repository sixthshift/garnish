import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { NumberStepper } from "../../../src/components/ui/NumberStepper";
import { clamp, parseDecimal, stepPrecision, stepValue } from "../../../src/lib/numbers";

/** The opening tag of the control carrying `label`. */
function tagWithLabel(html: string, label: string): string {
  const match = html.match(new RegExp(`<(?:button|input)[^>]*aria-label="${label}"[^>]*>`));
  if (!match) throw new Error(`no control labelled ${label}`);
  return match[0];
}

describe("clamp", () => {
  test.each([
    [5, 1, 10, 5],
    [0, 1, 10, 1],
    [11, 1, 10, 10],
    [Number.NaN, 1, 10, 1],
  ])("clamp(%s, %s, %s) -> %s", (value, min, max, expected) => {
    expect(clamp(value, min, max)).toBe(expected);
  });

  test("unbounded by default; NaN becomes 0 with no min", () => {
    expect(clamp(-1e9)).toBe(-1e9);
    expect(clamp(Number.NaN)).toBe(0);
  });
});

describe("stepPrecision", () => {
  test.each([
    [1, 0],
    [0.5, 1],
    [0.25, 2],
    [10, 0],
  ])("%s -> %s", (step, expected) => {
    expect(stepPrecision(step)).toBe(expected);
  });
});

describe("stepValue", () => {
  test("moves by step and rounds to the step's precision", () => {
    expect(stepValue(0.1, 0.2, 1)).toBe(0.3);
    expect(stepValue(4, 1, -1)).toBe(3);
  });

  test("clamps at the bounds", () => {
    expect(stepValue(1, 1, -1, 1, 10)).toBe(1);
    expect(stepValue(10, 1, 1, 1, 10)).toBe(10);
    expect(stepValue(9.5, 1, 1, 1, 10)).toBe(10);
  });
});

describe("parseDecimal", () => {
  test.each([
    ["4", 4],
    [" 2.5 ", 2.5],
    ["-1", -1],
    ["", null],
    ["-", null],
    ["1.", null],
    ["abc", null],
    ["1e3", null],
  ])("%j -> %s", (text, expected) => {
    expect(parseDecimal(text)).toBe(expected);
  });
});

describe("NumberStepper", () => {
  test("renders labelled buttons and a decimal text input showing the value", () => {
    const html = renderToString(<NumberStepper value={4} onChange={() => {}} min={1} max={10} label="Servings" />);
    expect(html).toContain('aria-label="Decrease Servings"');
    expect(html).toContain('aria-label="Increase Servings"');
    expect(html).toMatch(/inputmode="decimal"/i);
    expect(html).toContain('value="4"');
    expect(html).toContain(">Servings</label>");
    expect(html).not.toContain('disabled=""');
  });

  test("disables the minus at min and the plus at max", () => {
    const atMin = renderToString(<NumberStepper value={1} onChange={() => {}} min={1} max={10} />);
    expect(tagWithLabel(atMin, "Decrease value")).toContain('disabled=""');
    expect(tagWithLabel(atMin, "Increase value")).not.toContain('disabled=""');

    const atMax = renderToString(<NumberStepper value={10} onChange={() => {}} min={1} max={10} />);
    expect(tagWithLabel(atMax, "Increase value")).toContain('disabled=""');
    expect(tagWithLabel(atMax, "Decrease value")).not.toContain('disabled=""');
  });

  test("disabled disables everything", () => {
    const html = renderToString(<NumberStepper value={5} onChange={() => {}} min={1} max={10} disabled />);
    expect(html.match(/disabled=""/g)).toHaveLength(3);
  });
});
