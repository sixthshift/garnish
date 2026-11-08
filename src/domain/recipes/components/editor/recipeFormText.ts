import type { FormFieldFeedback } from "@sixthshift/design-system/form-field";
import type { ToastOptions } from "@sixthshift/design-system/overlay";
import type { FieldErrors } from "../../draft";

export function feedback(errors: FieldErrors, path: string): FormFieldFeedback | undefined {
  const message = errors[path];
  return message === undefined ? undefined : { intent: "danger", message };
}

/** What to say once the document is stored: a failed image downgrades the success to a warning that names it. Pure. */
export function saveNotice(opts: { existing: boolean; imageError: string | null }): ToastOptions {
  const title = opts.existing ? "Changes saved" : "Recipe created";
  if (opts.imageError !== null) return { intent: "warning", title, children: `The image did not upload: ${opts.imageError}` };
  return { intent: "success", title };
}

/** A number field's text as a non-negative amount; blank or unparseable is 0. Pure. */
export function parseAmount(text: string): number {
  const value = Number(text);
  return text.trim() === "" || !Number.isFinite(value) ? 0 : value;
}

/** A minutes field's text: blank is null (not recorded); otherwise the number as typed, so zod can reject fractions. Pure. */
export function parseMinutes(text: string): number | null {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}
