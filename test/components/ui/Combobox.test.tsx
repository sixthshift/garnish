import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Combobox, exactMatch, listItems, stepActive } from "../../../src/components/ui/Combobox";

const options = [
  { value: "g", label: "gram", hint: "g" },
  { value: "cup", label: "cup" },
];

describe("exactMatch", () => {
  test("matches a label ignoring case and surrounding space", () => {
    expect(exactMatch(options, "Gram")).toBe(options[0]);
    expect(exactMatch(options, "  cup ")).toBe(options[1]);
  });

  test("blank or partial text matches nothing", () => {
    expect(exactMatch(options, "")).toBeUndefined();
    expect(exactMatch(options, "  ")).toBeUndefined();
    expect(exactMatch(options, "gra")).toBeUndefined();
  });
});

describe("listItems", () => {
  test("every option, then a create row for unmatched text when creation is allowed", () => {
    const items = listItems(options, "pinch", true);
    expect(items).toHaveLength(3);
    expect(items[2]).toEqual({ kind: "create", text: "pinch" });
  });

  test("no create row for blank text, an exact match, or when creation is off", () => {
    expect(listItems(options, "  ", true)).toHaveLength(2);
    expect(listItems(options, "Cup", true)).toHaveLength(2);
    expect(listItems(options, "pinch", false)).toHaveLength(2);
    expect(listItems([], "", true)).toEqual([]);
  });
});

describe("stepActive", () => {
  test("steps from nothing to the ends, wraps around, and stays at -1 for no rows", () => {
    expect(stepActive(-1, 1, 3)).toBe(0);
    expect(stepActive(-1, -1, 3)).toBe(2);
    expect(stepActive(0, 1, 3)).toBe(1);
    expect(stepActive(2, 1, 3)).toBe(0);
    expect(stepActive(0, -1, 3)).toBe(2);
    expect(stepActive(1, 1, 0)).toBe(-1);
  });
});

describe("Combobox", () => {
  test("renders a closed combobox input with its text and label", () => {
    const html = renderToString(<Combobox aria-label="Unit" value="gr" options={options} onChange={() => {}} onSelect={() => {}} onCreate={() => {}} />);
    expect(html).toMatch(/<input[^>]*role="combobox"/);
    expect(html).toContain('aria-label="Unit"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('value="gr"');
    expect(html).toContain('autoComplete="off"');
    // The list only opens with focus, which the server never has.
    expect(html).not.toContain('role="listbox"');
    expect(html).not.toContain("Create");
  });

  test("disabled and invalid pass through to the input", () => {
    const html = renderToString(<Combobox aria-label="Food" value="" options={[]} onChange={() => {}} onSelect={() => {}} disabled aria-invalid />);
    expect(html).toMatch(/<input[^>]*disabled=""/);
    expect(html).toMatch(/<input[^>]*aria-invalid="true"/);
  });
});
