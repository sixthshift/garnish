import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Combobox, enterChoice, exactMatch, listItems, stepActive } from "../../../src/components/ui/Combobox";

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

describe("enterChoice (M21.5)", () => {
  // A local pair with a shared prefix, so "first row" and "exact match" differ.
  const options = [
    { value: "1", label: "gram" },
    { value: "2", label: "grain" },
  ];
  const items = (text: string, canCreate = true) => listItems(options, text, canCreate);

  test("open: the highlighted row wins", () => {
    const active = { kind: "option" as const, option: options[1]! };
    expect(enterChoice(items("gr"), options, "gr", true, active, true)).toEqual({ kind: "pick", item: active });
  });

  test("open: with nothing highlighted the exact match wins, else the first row", () => {
    expect(enterChoice(items("gram"), options, "gram", true, undefined, true)).toEqual({ kind: "pick", item: { kind: "option", option: options[0] } });
    expect(enterChoice(items("gr"), options, "gr", true, undefined, true)).toEqual({ kind: "pick", item: { kind: "option", option: options[0] } });
  });

  test("closed: an exact match is still taken", () => {
    expect(enterChoice(items("gram"), options, " Gram ", false, undefined, true)).toEqual({ kind: "pick", item: { kind: "option", option: options[0] } });
  });

  test("closed: an unknown name is offered as a new value, Mealie's press-enter-to-create", () => {
    expect(enterChoice(items("almond meal"), options, "almond meal", false, undefined, true)).toEqual({ kind: "pick", item: { kind: "create", text: "almond meal" } });
  });

  test("closed: nothing to make of it passes the key on", () => {
    expect(enterChoice([], options, "  ", false, undefined, true)).toEqual({ kind: "pass" });
    // A field that cannot create has nothing to do with an unknown name.
    expect(enterChoice(items("almond meal", false), options, "almond meal", false, undefined, false)).toEqual({ kind: "pass" });
  });

  test("open with an empty list passes rather than picking nothing", () => {
    expect(enterChoice([], options, "", true, undefined, true)).toEqual({ kind: "pass" });
  });
});
