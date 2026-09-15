// The step rows of one part: a textarea per step in a ReorderList, with add,
// remove and move up/down. The parent owns the draft; every change goes
// through a pure helper and comes back through `onChange` as a new
// `RecipeDraft`.
//
// `pi` names the part whose `steps` these are — the only place a step can
// live (decisions.md row 49). The document carries no position fields: the
// repository writes them from array order on save, so moving a row is the
// whole story.
//
// Row actions are in one `⋮` per step and list actions are in the section
// header, once (decisions.md row 54). Four buttons under every textarea is
// forty controls for a ten-step method, and on a phone they wrapped to three
// lines under each one; Mealie's step menu carries seven entries and Tandoor
// puts split-all and merge-all above the list, which is what this is.
//
// A step is markdown on the view page and in cook mode, and the editor gave no
// way to see that, so a stray underscore or a mis-typed list was only ever
// found after saving. The row menu's Preview swaps the textarea for
// `Markdown`, per row and per step id, so previewing one step leaves the rest
// editing and inserting a step above does not move the preview onto another
// one (decisions.md row 56).
//
// A step links the ingredients it uses (M28.3, decisions.md row 64). Each row
// carries an "Ingredients" picker — a `Combobox` over the part's own rows by
// their formatted lines, the ones already linked left out of the list — and
// the chosen rows sit under the textarea as removable `Badge` chips. A link
// never crosses a part, so the options are this part's ingredients and nothing
// else. "Suggest links" in the header runs the M28.2 matcher over the part and
// fills only the steps that have no links, which is why it is a button and not
// something save does quietly.
//
// Entry is text first (M27.3, decisions.md row 63). An empty list renders
// `BulkInlineAdd` — a textarea, the placeholder inviting the whole method with
// a blank line between steps — instead of "No steps yet", and its Add splits
// on paragraphs (`paragraphs`, not `bulkLines`), so a step's own wrapped lines
// stay one step and a blank line is what starts the next one, the way a
// pasted method actually reads. No review stage: `addBulkSteps` appends every
// paragraph as its own step straight away, same as the header's "Bulk add"
// always has. Once the part has rows the textarea goes and "Bulk add" is the
// way to add more.
import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Muted } from "@sixthshift/design-system/muted";
import { Textarea } from "@sixthshift/design-system/textarea";
import { useRef, useState } from "react";
import { paragraphs } from "../../../domain/ingredient";
import { Markdown } from "../../../components/ui/Markdown";
import { ingredientLine, type FieldErrors, type RecipeDraft, stepsOf, withSteps, addStep, updateStep, setStepImage, removeStep, addBulkSteps, insertStepAbove, insertStepBelow, splitStepByParagraph, mergeStepWithNext, splitAllSteps, mergeAllSteps, canSplitAll, stepsPath, linkedIngredients, linkableIngredients, linkIngredient, unlinkStepIngredient, suggestPartLinks } from "../../../domain/draft";
import { focusNamed, rowEnter, rowFieldName } from "../../../lib/rowKeys";
import { notify, notifyError } from "../../../lib/notify";
import { stepImageUrl, uploadStepImage } from "../../../lib/images";
import { BulkAddSheet, BulkInlineAdd } from "../../../components/ui/BulkAddSheet";
import { Combobox } from "../../../components/ui/Combobox";
import { Menu } from "../../../components/ui/Menu";
import { ReorderList } from "../../../components/ui/ReorderList";

// --- Pure helpers -----------------------------------------------------------

// --- Ingredient links (M28.3) -----------------------------------------------

// --- Component --------------------------------------------------------------

export type StepsEditorProps = {
  draft: RecipeDraft;
  /** Index of the part whose steps these are. */
  pi: number;
  onChange: (draft: RecipeDraft) => void;
  /** The list's heading. Default "Steps". */
  heading?: string;
  errors?: FieldErrors;
  disabled?: boolean;
  /** Step ids to open in preview rather than editing (M22.1). The row menu moves them after that; tests use it to render the state a click would reach. */
  previewSteps?: readonly string[];
  /** POSTs a picked photo and resolves with the stored file name (M35.1). Injectable so a test never touches the network. */
  uploadImage?: (stepId: string, file: File) => Promise<string>;
};

export function StepsEditor({ draft, pi, onChange, heading = "Steps", errors = {}, disabled, previewSteps, uploadImage = uploadStepImage }: StepsEditorProps) {
  const [bulkOpen, setBulkOpen] = useState(false);
  // Step ids being previewed rather than edited (M22.1). Keyed by id, not
  // index, so inserting a step above does not move the preview to another one.
  const [previewing, setPreviewing] = useState<ReadonlySet<string>>(() => new Set(previewSteps ?? []));
  // What has been typed into each step's ingredient picker, keyed by step id:
  // the Combobox is a controlled text field and picking a row clears it.
  const [picker, setPicker] = useState<Record<string, string>>({});
  // One hidden file input per row, keyed by step id, so "Add image" in the row
  // menu opens the picker the way the recipe image's button does (M35.1).
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const steps = stepsOf(draft, pi);
  const part = draft.parts[pi];
  if (!steps || !part) return null;
  const path = stepsPath(pi);
  const last = steps.length - 1;

  /**
   * Enter in a step's textarea is a newline, so appending takes the modifier
   * (⌘/Ctrl+Enter) — the same key every chat box uses to send. From the last
   * step it appends and focuses; from any earlier one it moves to the next
   * (decisions.md row 55).
   */
  const togglePreview = (id: string) => {
    setPreviewing((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /**
   * Store a picked photo against the *saved* step, then point the draft at the
   * file name so the next save keeps it. A step that has never been saved is a
   * 404 at the route — the file is named for the step id, and the id only
   * exists in the database once the recipe has been written — so that reads as
   * "save the recipe first" rather than as a failure of the upload.
   */
  const addImage = async (si: number, stepId: string, file: File) => {
    try {
      const image = await uploadImage(stepId, file);
      onChange(setStepImage(draft, pi, si, image));
      notify({ intent: "success", title: "Photo added", message: "It is saved with the step." });
    } catch (error) {
      notifyError("Could not add the photo", error);
    }
  };

  const enterOnStep = (si: number) => {
    const action = rowEnter(si, steps.length);
    if (action === "ignore") return;
    if (action === "append") {
      onChange(addStep(draft, pi));
      focusNamed(rowFieldName(path, steps.length, "text"));
      return;
    }
    focusNamed(rowFieldName(path, si + 1, "text"));
  };

  return (
    <div className="flex flex-col gap-2" data-steps={pi}>
      <div className="flex items-center justify-between gap-3">
        <Muted as="span" className="text-xs font-medium uppercase tracking-wide">
          {heading}
        </Muted>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            intent="neutral"
            size="sm"
            disabled={disabled || steps.length === 0 || part.ingredients.length === 0}
            onClick={() => {
              const suggested = suggestPartLinks(draft, pi);
              onChange(suggested.draft);
              notify({ intent: suggested.filled === 0 ? "neutral" : "success", title: suggestNotice(suggested.filled) });
            }}
          >
            Suggest links
          </Button>
          <Button
            type="button"
            variant="ghost"
            intent="neutral"
            size="sm"
            disabled={disabled || !canSplitAll(steps)}
            onClick={() => onChange(splitAllSteps(draft, pi))}
          >
            Split all
          </Button>
          <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={disabled || steps.length < 2} onClick={() => onChange(mergeAllSteps(draft, pi))}>
            Merge all
          </Button>
          <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={disabled} onClick={() => setBulkOpen(true)}>
            Bulk add
          </Button>
          <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={disabled} onClick={() => onChange(addStep(draft, pi))}>
            Add step
          </Button>
        </div>
      </div>
      <BulkAddSheet
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        itemName="step"
        disabled={disabled}
        onAdd={(lines) => onChange(addBulkSteps(draft, pi, lines))}
      />
      <EmptyBoundary
        isEmpty={steps.length === 0}
        fallback={
          <BulkInlineAdd
            itemName="step"
            disabled={disabled}
            placeholder="The method, a blank line between steps"
            splitLines={paragraphs}
            onAdd={(lines) => onChange(addBulkSteps(draft, pi, lines))}
          />
        }
      >
        <ReorderList
          items={steps}
          keyOf={(step) => step.id ?? "unsaved"}
          itemName="step"
          onReorder={(next) => onChange(withSteps(draft, pi, next))}
          renderItem={(step, si) => {
            const error = errors[`${path}.${si}.text`];
            const preview = previewing.has(step.id ?? "");
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
                    rows={2}
                    placeholder="What to do"
                    value={step.text ?? ""}
                    disabled={disabled}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
                      event.preventDefault();
                      enterOnStep(si);
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
                      value={picker[step.id ?? ""] ?? ""}
                      options={linkable.map((row) => ({ value: row.id!, label: ingredientLine(row) }))}
                      disabled={disabled}
                      onChange={(text) => setPicker((current) => ({ ...current, [step.id ?? ""]: text }))}
                      onSelect={(option) => {
                        setPicker((current) => ({ ...current, [step.id ?? ""]: "" }));
                        onChange(linkIngredient(draft, pi, si, option.value));
                      }}
                    />
                  )}
                  {step.image != null && step.image !== "" && (
                    <img
                      src={stepImageUrl(step.image) ?? ""}
                      alt={`Step ${si + 1}`}
                      className="max-h-32 w-full rounded-md object-cover"
                      data-step-image={si}
                    />
                  )}
                  <input
                    ref={(node) => {
                      fileInputs.current[step.id ?? ""] = node;
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    aria-label={`Step ${si + 1} image`}
                    disabled={disabled}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file && step.id !== undefined) void addImage(si, step.id, file);
                    }}
                  />
                </div>
                <Menu label={`Step ${si + 1} actions`} iconOnly>
                  <Menu.Item onSelect={() => togglePreview(step.id ?? "")}>{preview ? "Edit" : "Preview"}</Menu.Item>
                  <Menu.Item onSelect={() => fileInputs.current[step.id ?? ""]?.click()}>{step.image ? "Replace image" : "Add image"}</Menu.Item>
                  {step.image != null && step.image !== "" && <Menu.Item onSelect={() => onChange(setStepImage(draft, pi, si, null))}>Remove image</Menu.Item>}
                  <Menu.Item onSelect={() => onChange(insertStepAbove(draft, pi, si))}>Insert above</Menu.Item>
                  <Menu.Item onSelect={() => onChange(insertStepBelow(draft, pi, si))}>Insert below</Menu.Item>
                  <Menu.Item disabled={paragraphs(step.text ?? "").length < 2} onSelect={() => onChange(splitStepByParagraph(draft, pi, si))}>
                    Split by paragraph
                  </Menu.Item>
                  <Menu.Item disabled={si === last} onSelect={() => onChange(mergeStepWithNext(draft, pi, si))}>
                    Merge with next
                  </Menu.Item>
                  <Menu.Item intent="danger" onSelect={() => onChange(removeStep(draft, pi, si))}>
                    Delete
                  </Menu.Item>
                </Menu>
              </div>
            );
          }}
        />
      </EmptyBoundary>
    </div>
  );
}

/** What "Suggest links" says it did. Pure. */
export function suggestNotice(filled: number): string {
  return filled === 0 ? "Nothing to link" : `Linked ${filled} step${filled === 1 ? "" : "s"}`;
}
