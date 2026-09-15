import { FormField } from "@sixthshift/design-system/form-field";
import { Input } from "@sixthshift/design-system/input";
import { Textarea } from "@sixthshift/design-system/textarea";
import { ImageUpload } from "../../../components/ui/ImageUpload";
import { NumberStepper } from "../../../components/ui/NumberStepper";
import type { FieldErrors, RecipeDraft } from "../../../domain/draft";
import { feedback } from "./recipeFormText";

export type RecipeHeadProps = {
  draft: RecipeDraft;
  errors: FieldErrors;
  /** True while a save is in flight; every field is disabled. */
  saving: boolean;
  /** True when editing a stored recipe; a new one autofocuses the name. */
  existing: boolean;
  /** An image an import found, shown until the fetched file replaces it. */
  importedImageUrl?: string | null;
  onPatch: (fields: Partial<RecipeDraft>) => void;
  /** The picked (or fetched) image file; null clears it. */
  onFile: (file: File | null) => void;
};

export function RecipeHead({ draft, errors, saving, existing, importedImageUrl, onPatch, onFile }: RecipeHeadProps) {
  return (
    <>
      <FormField label="Name" required feedback={feedback(errors, "name")}>
        <Input
          name="name"
          value={draft.name}
          autoComplete="off"
          autoFocus={!existing}
          disabled={saving}
          onChange={(event) => onPatch({ name: event.target.value })}
        />
      </FormField>

      <FormField label="Description" feedback={feedback(errors, "description")}>
        <Textarea name="description" rows={3} value={draft.description} disabled={saving} onChange={(event) => onPatch({ description: event.target.value })} />
      </FormField>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Image</span>
        <ImageUpload
          image={draft.image}
          previewUrl={importedImageUrl}
          disabled={saving}
          onSelect={(chosen) => onFile(chosen)}
          onRemove={() => {
            onFile(null);
            onPatch({ image: null });
          }}
        />
      </div>

      <NumberStepper label="Servings" value={draft.recipeServings} min={0} disabled={saving} onChange={(recipeServings) => onPatch({ recipeServings })} />
    </>
  );
}
