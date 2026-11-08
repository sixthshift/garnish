import { Badge } from "@sixthshift/design-system/badge";
import { Muted } from "@sixthshift/design-system/muted";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { Textarea } from "@sixthshift/design-system/textarea";
import { useRef } from "react";
import { Markdown } from "../../../../components/ui/Markdown";
import { Menu } from "../../../../components/ui/Menu";
import type { ReorderRow } from "../../../../components/ui/ReorderList";
import { stepImageUrl } from "../../../../lib/images";
import { picker } from "../../../../lib/ui/picker";
import { useLayout } from "../../../../lib/useLayout";
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
} from "../../draft";
import { paragraphs } from "../../ingredient";
import { useLineSource } from "./mobile/LineSource";

type DraftStep = DraftPart["steps"][number];

export type StepEditRowProps = {
  draft: RecipeDraft;
  pi: number;
  si: number;
  step: DraftStep;
  /** The list's drag handle and moves, which this row places: the handle first, the moves in its menu on a narrow list only (a wide one has its up and down buttons). */
  reorder?: ReorderRow;
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
  reorder,
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
  const linked = linkedIngredients(draft, step);
  const linkable = linkableIngredients(draft, pi, step);
  // A phone's Check: the step's sheet beside the page it came from.
  const lines = useLineSource();
  const phone = useLayout() === "mobile";
  return (
    // On a narrow list (ReorderList's `@2xl` container) the handle, the step's
    // name and the menu share a line and the text takes the full width below
    // them; on a wide one they sit beside it, the handle at its first line.
    // A card, as the recipe page's step is (decisions.md row 211): the number in its circle, the words typed where they are read.
    <div
      className="flex items-start gap-2 rounded-xl border border-border-subtle bg-bg-normal p-3 focus-within:border-border-brand"
      data-step={si}
      data-row-id={step.id}
    >
      {reorder?.handle}
      <span
        className="mt-1.5 grid size-6 shrink-0 place-items-center rounded-full bg-bg-subtle-pressed text-xs font-semibold text-fg-normal tabular-nums"
        aria-hidden="true"
      >
        {si + 1}
      </span>
      {/* The label a step came with (an export's, or the restyle's), which the form keeps but has no field for; a phone names it beside the number. */}
      {phone && (step.title ?? "").trim() !== "" && (
        <span className="min-w-0 truncate text-sm font-semibold text-fg-strong" data-step-label={si}>
          {step.title}
        </span>
      )}
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
            // Borderless in its card until hovered or focused, so the step reads as the page's does.
            className="field-sizing-content border-transparent bg-transparent text-base shadow-none hover:border-border-normal focus-visible:border-border-brand"
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
          <SearchInput
            name={`${path}.${si}.ingredients`}
            aria-label={`Step ${si + 1} ingredients`}
            placeholder="Ingredients"
            className="max-w-80"
            value={pickerText}
            disabled={disabled}
            onValueChange={onPickerText}
            {...picker({
              // Another part's row says which part, so two "soy sauce" lines can be told apart.
              options: linkable.map(({ row, part: from }) => ({
                value: row.id!,
                label: from === null || from === "" ? ingredientLine(row) : `${ingredientLine(row)} (${from})`,
              })),
              text: pickerText,
              label: `Step ${si + 1} ingredient suggestions`,
              onSelect: (option) => {
                onPickerText("");
                onChange(linkIngredient(draft, pi, si, option.value));
              },
            })}
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
        {lines?.hasSource && step.id !== undefined && <Menu.Item onSelect={() => lines.show(step.id!)}>Where's this from?</Menu.Item>}
        <Menu.Item onSelect={onTogglePreview}>{preview ? "Edit" : "Preview"}</Menu.Item>
        <Menu.Item onSelect={() => fileInput.current?.click()}>{step.image ? "Replace image" : "Add image"}</Menu.Item>
        {step.image != null && step.image !== "" && <Menu.Item onSelect={() => onChange(setStepImage(draft, pi, si, null))}>Remove image</Menu.Item>}
        <Menu.Item onSelect={() => onChange(insertStepAbove(draft, pi, si))}>Insert above</Menu.Item>
        <Menu.Item onSelect={() => onChange(insertStepBelow(draft, pi, si))}>Insert below</Menu.Item>
        {reorder !== undefined && (
          <>
            <Menu.Item disabled={!reorder.moveUp} onSelect={reorder.moveUp} className="@2xl:hidden">
              Move up
            </Menu.Item>
            <Menu.Item disabled={!reorder.moveDown} onSelect={reorder.moveDown} className="@2xl:hidden">
              Move down
            </Menu.Item>
          </>
        )}
        <Menu.Item disabled={paragraphs(step.text ?? "").length < 2} onSelect={() => onChange(splitStepByParagraph(draft, pi, si))}>
          Split by paragraph
        </Menu.Item>
        <Menu.Item disabled={last} onSelect={() => onChange(mergeStepWithNext(draft, pi, si))}>
          Merge with next
        </Menu.Item>
        {/* Neutral: it changes the unsaved draft, which Cancel restores (rule 5 keeps red for a confirm). */}
        <Menu.Item onSelect={() => onChange(removeStep(draft, pi, si))}>Delete</Menu.Item>
      </Menu>
    </div>
  );
}
