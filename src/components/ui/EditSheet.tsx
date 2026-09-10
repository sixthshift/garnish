// The editor behind a DataTable row: a sheet whose fields come from a spec,
// so a tab describes its columns once and gets a form for free. Foods, units,
// aisles and tags all edit a flat record of strings, numbers, booleans and
// one-of choices, which is exactly what a spec can cover; anything richer
// belongs in its own component.
//
// Values are held as strings (and booleans for a checkbox) while editing —
// what an input gives back — and are converted once, on save, by `fieldValues`.
// That keeps a half-typed number from becoming NaN mid-keystroke.
//
// Sheet only paints after mounting on the client, so the form lives in
// `EditSheetContent`, which renders anywhere and is what the tests exercise.
import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { FormField } from "@sixthshift/design-system/form-field";
import { Input } from "@sixthshift/design-system/input";
import { Select } from "@sixthshift/design-system/select";
import { Sheet } from "@sixthshift/design-system/sheet";
import { Textarea } from "@sixthshift/design-system/textarea";
import { useState } from "react";

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
    }),
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

export type EditSheetContentProps = {
  /** Header text, e.g. "Edit butter". */
  title: string;
  fields: readonly FieldSpec[];
  /** The row being edited, or null when adding. */
  item?: EditableItem | null;
  /** Called with the converted values once validation passes. */
  onSave: (values: SavedValues) => void;
  onCancel: () => void;
  /** While true both buttons are disabled and Save reads "Saving…". */
  busy?: boolean;
  saveLabel?: string;
};

export function EditSheetContent({ title, fields, item = null, onSave, onCancel, busy = false, saveLabel = "Save" }: EditSheetContentProps) {
  const [values, setValues] = useState<FieldValues>(() => initialValues(fields, item));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (name: string, value: string | boolean) => setValues((current) => ({ ...current, [name]: value }));

  const submit = () => {
    const found = validateValues(fields, values);
    setErrors(found);
    if (Object.keys(found).length === 0) onSave(fieldValues(fields, values));
  };

  return (
    <>
      <Sheet.Header>
        <h2 className="text-base font-medium">{title}</h2>
      </Sheet.Header>
      <Sheet.Body>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {fields.map((field) => {
            const error = errors[field.name];
            const feedback = error === undefined ? undefined : ({ message: error, intent: "danger" } as const);
            if (field.kind === "checkbox") {
              return (
                <Checkbox
                  key={field.name}
                  label={field.label}
                  checked={values[field.name] === true}
                  disabled={busy}
                  onCheckedChange={(checked) => set(field.name, checked)}
                />
              );
            }
            const value = typeof values[field.name] === "string" ? (values[field.name] as string) : "";
            return (
              <FormField key={field.name} label={field.label} description={field.description} required={field.required} feedback={feedback}>
                {field.kind === "select" ? (
                  <Select
                    options={field.required === true ? (field.options ?? []) : [{ value: "", label: "None" }, ...(field.options ?? [])]}
                    value={value}
                    disabled={busy}
                    placeholder={field.placeholder}
                    onValueChange={(next) => set(field.name, next)}
                  />
                ) : field.kind === "textarea" ? (
                  <Textarea value={value} disabled={busy} placeholder={field.placeholder} onChange={(event) => set(field.name, event.target.value)} />
                ) : (
                  <Input
                    type={field.kind === "number" ? "number" : "text"}
                    value={value}
                    disabled={busy}
                    placeholder={field.placeholder}
                    onChange={(event) => set(field.name, event.target.value)}
                  />
                )}
              </FormField>
            );
          })}
        </form>
      </Sheet.Body>
      <Sheet.Footer>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="solid" intent="brand" disabled={busy} onClick={submit}>
          {busy ? "Saving…" : saveLabel}
        </Button>
      </Sheet.Footer>
    </>
  );
}

export type EditSheetProps = EditSheetContentProps & { open: boolean };

export function EditSheet({ open, ...props }: EditSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && props.onCancel()} size="sm" closable aria-label={props.title}>
      <EditSheetContent {...props} />
    </Sheet>
  );
}
