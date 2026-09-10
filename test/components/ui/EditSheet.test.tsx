// The field-spec editor: the pure value helpers, and the form the sheet holds.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { EditSheetContent, type FieldSpec, fieldValues, initialValue, initialValues, validateValues } from "../../../src/components/ui/EditSheet";

const fields: FieldSpec[] = [
  { name: "name", label: "Name", kind: "text", required: true },
  { name: "pluralName", label: "Plural", kind: "text" },
  { name: "standardQuantity", label: "Standard quantity", kind: "number" },
  { name: "useAbbreviation", label: "Use abbreviation", kind: "checkbox" },
  { name: "aisleId", label: "Aisle", kind: "select", options: [{ value: "a1", label: "Dairy" }] },
];

const unit = { id: "u1", name: "gram", pluralName: null, standardQuantity: 1000, useAbbreviation: true, aisleId: "a1" };

describe("initialValue", () => {
  test("stringifies, turns null and undefined into empty, and a checkbox into a boolean", () => {
    expect(initialValue(fields[0]!, unit)).toBe("gram");
    expect(initialValue(fields[1]!, unit)).toBe("");
    expect(initialValue(fields[2]!, unit)).toBe("1000");
    expect(initialValue(fields[3]!, unit)).toBe(true);
    expect(initialValue(fields[3]!, {})).toBe(false);
    expect(initialValue(fields[0]!, null)).toBe("");
  });
});

describe("initialValues", () => {
  test("covers exactly the spec's fields", () => {
    expect(initialValues(fields, unit)).toEqual({ name: "gram", pluralName: "", standardQuantity: "1000", useAbbreviation: true, aisleId: "a1" });
    expect(initialValues(fields, null)).toEqual({ name: "", pluralName: "", standardQuantity: "", useAbbreviation: false, aisleId: "" });
  });

  test("a field the item does not carry starts empty, and extra item keys are ignored", () => {
    expect(initialValues([fields[0]!], { name: "gram", colour: "white" })).toEqual({ name: "gram" });
  });
});

describe("fieldValues", () => {
  test("trims text, parses numbers, keeps booleans, and empties become null", () => {
    expect(fieldValues(fields, { name: "  gram  ", pluralName: "", standardQuantity: " 1000 ", useAbbreviation: true, aisleId: "a1" })).toEqual({
      name: "gram",
      pluralName: "",
      standardQuantity: 1000,
      useAbbreviation: true,
      aisleId: "a1",
    });
  });

  test("a blank or unparseable number is null, a blank select is null, a blank checkbox is false", () => {
    expect(fieldValues(fields, { name: "gram", pluralName: "", standardQuantity: "", useAbbreviation: false, aisleId: "" })).toMatchObject({
      standardQuantity: null,
      aisleId: null,
      useAbbreviation: false,
    });
    expect(fieldValues(fields, { standardQuantity: "many" })).toMatchObject({ standardQuantity: null });
  });

  test("a decimal number keeps its fraction", () => {
    expect(fieldValues([fields[2]!], { standardQuantity: "0.5" })).toEqual({ standardQuantity: 0.5 });
  });
});

describe("validateValues", () => {
  test("flags a required field that is blank or only spaces", () => {
    expect(validateValues(fields, initialValues(fields, null))).toEqual({ name: "Name is required." });
    expect(validateValues(fields, { ...initialValues(fields, null), name: "   " })).toEqual({ name: "Name is required." });
  });

  test("flags a number that will not parse, and passes a good record", () => {
    expect(validateValues(fields, { ...initialValues(fields, unit), standardQuantity: "lots" })).toEqual({ standardQuantity: "Standard quantity must be a number." });
    expect(validateValues(fields, initialValues(fields, unit))).toEqual({});
  });
});

describe("EditSheetContent render", () => {
  test("renders the title, a control per field and Save / Cancel", () => {
    const html = renderToString(<EditSheetContent title="Edit gram" fields={fields} item={unit} onSave={() => {}} onCancel={() => {}} />);
    expect(html).toContain("Edit gram");
    for (const field of fields) expect(html).toContain(field.label);
    expect(html).toContain('value="gram"');
    expect(html).toContain('type="number"');
    expect(html).toContain('role="checkbox"');
    expect(html).toContain(">Save<");
    expect(html).toContain(">Cancel<");
  });

  test("adding starts blank and busy disables both buttons", () => {
    const html = renderToString(<EditSheetContent title="Add unit" fields={fields} onSave={() => {}} onCancel={() => {}} busy saveLabel="Add" />);
    expect(html).toContain("Add unit");
    expect(html).not.toContain('value="gram"');
    expect(html).toContain("Saving…");
    expect(html.match(/<button[^>]*disabled/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
