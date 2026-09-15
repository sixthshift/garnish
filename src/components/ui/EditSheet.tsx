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
import { type EditableItem, type FieldSpec, type FieldValues, fieldValues, initialValues, type SavedValues, validateValues } from "../../lib/ui/editSheet";

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
