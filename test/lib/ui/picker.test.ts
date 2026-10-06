import { describe, expect, test, vi } from "vitest";
import { exactMatch, picker, pickerSuggestions } from "../../../src/lib/ui/picker";

const options = [
  { value: "g", label: "gram", hint: "g" },
  { value: "gr", label: "grain" },
  { value: "cup", label: "cup" },
];

describe("exactMatch", () => {
  test("matches a label ignoring case and surrounding space", () => {
    expect(exactMatch(options, "Gram")).toBe(options[0]);
    expect(exactMatch(options, "  cup ")).toBe(options[2]);
  });

  test("blank or partial text matches nothing", () => {
    expect(exactMatch(options, "")).toBeUndefined();
    expect(exactMatch(options, "  ")).toBeUndefined();
    expect(exactMatch(options, "gra")).toBeUndefined();
  });
});

describe("pickerSuggestions", () => {
  test("each option by its id, writing its name and showing its hint after a dot", () => {
    expect(pickerSuggestions(options, "", true)).toEqual([
      { id: "g", value: "gram", label: "gram · g" },
      { id: "gr", value: "grain", label: "grain" },
      { id: "cup", value: "cup", label: "cup" },
    ]);
  });

  test("the exact match goes first, since Enter takes the top row", () => {
    expect(pickerSuggestions(options, "Grain", true).map((row) => row.id)).toEqual(["gr", "g", "cup"]);
  });

  test("a create row last for text no option has, when creation is allowed", () => {
    expect(pickerSuggestions(options, " pinch ", true).at(-1)).toEqual({ id: "", value: "pinch", label: "Create “pinch”" });
    expect(pickerSuggestions([], "pinch", true)).toHaveLength(1);
  });

  test("no create row for blank text, an exact match, or when creation is off", () => {
    expect(pickerSuggestions(options, "  ", true)).toHaveLength(3);
    expect(pickerSuggestions(options, "Cup", true)).toHaveLength(3);
    expect(pickerSuggestions(options, "pinch", false)).toHaveLength(3);
  });

  test("two options with the same name stay two rows", () => {
    const salts = [
      { value: "a", label: "salt" },
      { value: "b", label: "salt" },
    ];
    expect(pickerSuggestions(salts, "", false).map((row) => row.id)).toEqual(["a", "b"]);
  });
});

describe("picker", () => {
  const setup = (text: string, canCreate = true) => {
    const onSelect = vi.fn();
    const onCreate = vi.fn();
    return { onSelect, onCreate, props: picker({ options, text, onSelect, onCreate: canCreate ? onCreate : undefined }) };
  };

  test("a picked row is its option, found by id", () => {
    const { onSelect, props } = setup("gr");
    props.onSuggestionSelect(props.suggestions[1]!);
    expect(onSelect).toHaveBeenCalledWith(options[1]);
  });

  test("the create row creates the typed name (M21.5)", () => {
    const { onCreate, onSelect, props } = setup("pinch");
    props.onSuggestionSelect(props.suggestions.at(-1)!);
    expect(onCreate).toHaveBeenCalledWith("pinch");
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("Enter on the typed text takes the exact match, else creates, else nothing", () => {
    const exact = setup("x");
    exact.props.onSubmit(" Cup ");
    expect(exact.onSelect).toHaveBeenCalledWith(options[2]);

    const unknown = setup("x");
    unknown.props.onSubmit("almond meal");
    expect(unknown.onCreate).toHaveBeenCalledWith("almond meal");

    const cannot = setup("x", false);
    cannot.props.onSubmit("almond meal");
    expect(cannot.onSelect).not.toHaveBeenCalled();
    cannot.props.onSubmit("  ");
    expect(cannot.onSelect).not.toHaveBeenCalled();
  });
});
