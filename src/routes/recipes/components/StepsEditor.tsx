import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { useState } from "react";
import { BulkAddSheet } from "../../../components/ui/bulk/BulkAddSheet";
import { BulkInlineAdd } from "../../../components/ui/bulk/BulkInlineAdd";
import { ReorderList } from "../../../components/ui/ReorderList";
import { addBulkSteps, addStep, type FieldErrors, type RecipeDraft, setStepImage, stepsOf, stepsPath, withSteps } from "../../../domain/draft";
import { paragraphs } from "../../../domain/ingredient";
import { uploadStepImage } from "../../../lib/images";
import { notify, notifyError } from "../../../lib/notify";
import { focusNamed, rowEnter, rowFieldName } from "../../../lib/rowKeys";
import { StepEditRow } from "./StepEditRow";
import { StepsEditorActions } from "./StepsEditorActions";

export type StepsEditorProps = {
  draft: RecipeDraft;
  /** Index of the part whose steps these are. */
  pi: number;
  onChange: (draft: RecipeDraft) => void;
  /** The list's heading. Default "Steps". */
  heading?: string;
  errors?: FieldErrors;
  disabled?: boolean;
  /** Step ids to open in preview rather than editing. The row menu moves them after that; tests use it to render the state a click would reach. */
  previewSteps?: readonly string[];
  /** POSTs a picked photo and resolves with the stored file name. Injectable so a test never touches the network. */
  uploadImage?: (recipeId: string, stepId: string, file: File) => Promise<string>;
};

export function StepsEditor({ draft, pi, onChange, heading = "Steps", errors = {}, disabled, previewSteps, uploadImage = uploadStepImage }: StepsEditorProps) {
  const [bulkOpen, setBulkOpen] = useState(false);
  // Step ids being previewed rather than edited. Keyed by id, not
  // index, so inserting a step above does not move the preview to another one.
  const [previewing, setPreviewing] = useState<ReadonlySet<string>>(() => new Set(previewSteps ?? []));
  // What has been typed into each step's ingredient picker, keyed by step id:
  // the Combobox is a controlled text field and picking a row clears it.
  const [picker, setPicker] = useState<Record<string, string>>({});
  const steps = stepsOf(draft, pi);
  const part = draft.parts[pi];
  if (!steps || !part) return null;
  const path = stepsPath(pi);
  const last = steps.length - 1;

  /**
   * Enter in a step's textarea is a newline, so appending takes the modifier
   * (⌘/Ctrl+Enter) — the same key every chat box uses to send. From the last
   * step it appends and focuses; from any earlier one it moves to the next
   *.
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
   * file name so the next save keeps it. The route is addressed by recipe and
   * step, and both ids exist only once the recipe has been written: a draft
   * with no id is told to save first here, and a step the recipe has not saved
   * yet is a 404 at the route that reads the same way.
   */
  const addImage = async (si: number, stepId: string, file: File) => {
    try {
      if (!draft.id) throw new Error("Save the recipe first, then add photos to its steps.");
      const image = await uploadImage(draft.id, stepId, file);
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
      <StepsEditorActions
        heading={heading}
        draft={draft}
        pi={pi}
        steps={steps}
        ingredientCount={part.ingredients.length}
        disabled={disabled}
        onChange={onChange}
        onBulkAdd={() => setBulkOpen(true)}
      />
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
            const id = step.id ?? "";
            return (
              <StepEditRow
                draft={draft}
                pi={pi}
                si={si}
                step={step}
                part={part}
                path={path}
                last={si === last}
                error={errors[`${path}.${si}.text`]}
                preview={previewing.has(id)}
                pickerText={picker[id] ?? ""}
                disabled={disabled}
                onChange={onChange}
                onTogglePreview={() => togglePreview(id)}
                onPickerText={(text) => setPicker((current) => ({ ...current, [id]: text }))}
                onEnter={() => enterOnStep(si)}
                onAddImage={(file) => {
                  if (step.id !== undefined) void addImage(si, step.id, file);
                }}
              />
            );
          }}
        />
      </EmptyBoundary>
    </div>
  );
}
