export type FieldOption = { value: string; label: string };

/** One editable field. `name` is the key in both the item and the saved values. */
export type FieldSpec = {
  name: string;
  label: string;
  kind: "text" | "textarea" | "number" | "checkbox" | "select";
  /** `select` only. An empty value is offered as "None" unless `required`. */
  options?: readonly FieldOption[];
  placeholder?: string;
  description?: string;
  required?: boolean;
};

/** What an editor holds while typing: text-ish fields as strings, checkboxes as booleans. */
export type FieldValues = Record<string, string | boolean>;

/** What a save hands back: text as string, number as number or null, checkbox as boolean, select as string or null. */
export type SavedValues = Record<string, string | number | boolean | null>;

/** A record whose keys a spec can read; anything the fields do not name is ignored. */
export type EditableItem = Record<string, unknown>;

/** The editing value for one field of `item`: `null`/`undefined` become "" (or false). Pure. */
export function initialValue(field: FieldSpec, item: EditableItem | null): string | boolean {
  const raw = item?.[field.name];
  if (field.kind === "checkbox") return raw === true;
  if (raw === null || raw === undefined) return "";
  return String(raw);
}

/** The starting values for a spec against `item`, or empty values when adding. Pure. */
export function initialValues(fields: readonly FieldSpec[], item: EditableItem | null): FieldValues {
  return Object.fromEntries(fields.map((field) => [field.name, initialValue(field, item)]));
}

/**
 * The values as they are saved: text trimmed, a number parsed (blank or
 * unparseable becomes null), a select's blank choice null, a checkbox boolean.
 * Pure.
 */
export function fieldValues(fields: readonly FieldSpec[], values: FieldValues): SavedValues {
  return Object.fromEntries(
    fields.map((field) => {
      const raw = values[field.name];
      if (field.kind === "checkbox") return [field.name, raw === true];
      const text = typeof raw === "string" ? raw.trim() : "";
      if (field.kind === "number") {
        const parsed = Number(text);
        return [field.name, text === "" || Number.isNaN(parsed) ? null : parsed];
      }
      if (field.kind === "select") return [field.name, text === "" ? null : text];
      return [field.name, text];
    })
  );
}

/** Message per field that fails: required and empty, or a number that will not parse. Pure. */
export function validateValues(fields: readonly FieldSpec[], values: FieldValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const raw = values[field.name];
    const text = typeof raw === "string" ? raw.trim() : "";
    if (field.kind === "checkbox") continue;
    if (field.required === true && text === "") errors[field.name] = `${field.label} is required.`;
    else if (field.kind === "number" && text !== "" && Number.isNaN(Number(text))) errors[field.name] = `${field.label} must be a number.`;
  }
  return errors;
}
