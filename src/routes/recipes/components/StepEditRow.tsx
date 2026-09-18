import { Badge } from "@sixthshift/design-system/badge";
import { Muted } from "@sixthshift/design-system/muted";
import { Textarea } from "@sixthshift/design-system/textarea";
import { useRef } from "react";
import { Combobox } from "../../../components/ui/Combobox";
import { Markdown } from "../../../components/ui/Markdown";
import { Menu } from "../../../components/ui/Menu";
import {
  type DraftPart,
  ingredientLine,
  insertStepAbove,
  insertStepBelow,
  linkableIngredients,
  linkedIngredients,
  linkIngredient,
  mergeStepWithNext,
  type RecipeDraft,
  removeStep,
  setStepImage,
  splitStepByParagraph,
  unlinkStepIngredient,
  updateStep,
} from "../../../domain/draft";
import { paragraphs } from "../../../domain/ingredient";
import { stepImageUrl } from "../../../lib/images";

type DraftStep = DraftPart["steps"][number];

export type StepEditRowProps = {
  draft: RecipeDraft;
  pi: number;
  si: number;
  step: DraftStep;
  part: DraftPart;
  /** Field name prefix for the part's steps (`stepsPath(pi)`). */
  path: string;
  /** True for the part's last step, which has nothing to merge with. */
  last: boolean;
  error?: string;
  /** Showing the markdown preview rather than the textarea. */
  preview: boolean;
  /** What has been typed into this step's ingredient picker. */
  pickerText: string;
  disabled?: boolean;
  onChange: (draft: RecipeDraft) => void;
  onTogglePreview: () => void;
  onPickerText: (text: string) => void;
  /** ⌘/Ctrl+Enter in the textarea. */
  onEnter: () => void;
  /** A photo was picked for the step. */
  onAddImage: (file: File) => void;
};

export function StepEditRow({
  draft,
  pi,
  si,
  step,
  part,
  path,
  last,
  error,
  preview,
  pickerText,
  disabled,
  onChange,
  onTogglePreview,
  onPickerText,
  onEnter,
  onAddImage,
}: StepEditRowProps) {
  // The hidden file input, so "Add image" in the row menu opens the picker
  // the way the recipe image's button does.
  const fileInput = useRef<HTMLInputElement | null>(null);
  const linked = linkedIngredients(part, step);
  const linkable = linkableIngredients(part, step);
  return (
    <div className="flex gap-2" data-step={si}>
      <span className="mt-2 w-5 shrink-0 text-right text-sm font-medium text-fg-subtle" aria-hidden="true">
        {si + 1}.
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {preview ? (
          <div className="min-h-16 rounded-md border border-border-normal bg-bg-subtle px-3 py-2 text-sm" data-step-preview={si}>
            {(step.text ?? "").trim() === "" ? (
              <Muted as="span" className="text-sm">
                Nothing to preview
              </Muted>
            ) : (
              <Markdown source={step.text ?? ""} />
            )}
          </div>
        ) : (
          <Textarea
            name={`${path}.${si}.text`}
            aria-label={`Step ${si + 1}`}
            aria-invalid={error !== undefined || undefined}
            className="field-sizing-content"
            rows={2}
            placeholder="What to do"
            value={step.text ?? ""}
            disabled={disabled}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
              event.preventDefault();
              onEnter();
            }}
            onChange={(event) => onChange(updateStep(draft, pi, si, event.target.value))}
          />
        )}
        {error !== undefined && (
          <p className="text-sm text-fg-danger" role="alert">
            {error}
          </p>
        )}
        {linked.length > 0 && (
          <div className="flex flex-wrap items-center gap-1" data-step-links={si}>
            {linked.map((row) => (
              <Badge key={row.id} variant="soft" intent="neutral" className="inline-flex items-center gap-1">
                <span>{ingredientLine(row)}</span>
                <button
                  type="button"
                  aria-label={`Unlink ${ingredientLine(row)} from step ${si + 1}`}
                  className="text-fg-subtle hover:text-fg-normal disabled:opacity-50"
                  disabled={disabled}
                  onClick={() => onChange(unlinkStepIngredient(draft, pi, si, row.id!))}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}
        {linkable.length > 0 && !preview && (
          <Combobox
            name={`${path}.${si}.ingredients`}
            aria-label={`Step ${si + 1} ingredients`}
            placeholder="Ingredients"
            className="max-w-80"
            value={pickerText}
            options={linkable.map((row) => ({ value: row.id!, label: ingredientLine(row) }))}
            disabled={disabled}
            onChange={onPickerText}
            onSelect={(option) => {
              onPickerText("");
              onChange(linkIngredient(draft, pi, si, option.value));
            }}
          />
        )}
        {step.image != null && step.image !== "" && (
          <img src={stepImageUrl(step.image) ?? ""} alt={`Step ${si + 1}`} className="max-h-32 w-full rounded-md object-cover" data-step-image={si} />
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label={`Step ${si + 1} image`}
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file && step.id !== undefined) onAddImage(file);
          }}
        />
      </div>
      <Menu label={`Step ${si + 1} actions`} iconOnly>
        <Menu.Item onSelect={onTogglePreview}>{preview ? "Edit" : "Preview"}</Menu.Item>
        <Menu.Item onSelect={() => fileInput.current?.click()}>{step.image ? "Replace image" : "Add image"}</Menu.Item>
        {step.image != null && step.image !== "" && <Menu.Item onSelect={() => onChange(setStepImage(draft, pi, si, null))}>Remove image</Menu.Item>}
        <Menu.Item onSelect={() => onChange(insertStepAbove(draft, pi, si))}>Insert above</Menu.Item>
        <Menu.Item onSelect={() => onChange(insertStepBelow(draft, pi, si))}>Insert below</Menu.Item>
        <Menu.Item disabled={paragraphs(step.text ?? "").length < 2} onSelect={() => onChange(splitStepByParagraph(draft, pi, si))}>
          Split by paragraph
        </Menu.Item>
        <Menu.Item disabled={last} onSelect={() => onChange(mergeStepWithNext(draft, pi, si))}>
          Merge with next
        </Menu.Item>
        <Menu.Item intent="danger" onSelect={() => onChange(removeStep(draft, pi, si))}>
          Delete
        </Menu.Item>
      </Menu>
    </div>
  );
}
