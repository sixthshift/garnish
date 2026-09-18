import { FormField } from "@sixthshift/design-system/form-field";
import { Input } from "@sixthshift/design-system/input";
import { Label } from "@sixthshift/design-system/label";
import { Select } from "@sixthshift/design-system/select";
import { TagInput } from "@sixthshift/design-system/tag-input";
import { useId } from "react";
import { Disclosure } from "../../../components/ui/Disclosure";
import { type FieldErrors, type RecipeDraft, tagsFromNames } from "../../../domain/draft";
import type { Tag, Unit } from "../../../domain/reference";
import { detailsHint, feedback, parseAmount, parseMinutes } from "./recipeFormText";

export type RecipeDetailsProps = {
  draft: RecipeDraft;
  errors: FieldErrors;
  /** True while a save is in flight; every field is disabled. */
  saving: boolean;
  units: readonly Unit[];
  /** The tags that already exist, so a typed name resolves to the stored one. */
  knownTags: readonly Tag[];
  /** Decided once from the draft the form opened on, so typing a tag does not fold the section. */
  defaultOpen: boolean;
  onPatch: (fields: Partial<RecipeDraft>) => void;
};

export function RecipeDetails({ draft, errors, saving, units, knownTags, defaultOpen, onPatch }: RecipeDetailsProps) {
  const tagsId = useId();
  const unitOptions = units.map((unit) => ({ value: unit.id, label: unit.name }));

  return (
    <Disclosure title="Details" hint={detailsHint(draft)} defaultOpen={defaultOpen}>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-medium">Yield</legend>
        <FormField label="Quantity" feedback={feedback(errors, "recipeYieldQuantity")}>
          <Input
            name="recipeYieldQuantity"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={draft.recipeYieldQuantity === 0 ? "" : String(draft.recipeYieldQuantity)}
            disabled={saving}
            onChange={(event) => onPatch({ recipeYieldQuantity: parseAmount(event.target.value) })}
          />
        </FormField>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Unit</span>
          <Select
            aria-label="Yield unit"
            options={unitOptions}
            value={draft.yieldUnit?.id}
            placeholder="No unit"
            clearable
            searchable
            disabled={saving}
            onValueChange={(id) => onPatch({ yieldUnit: units.find((unit) => unit.id === id) ?? null })}
          />
        </div>
        <FormField label="Makes" description="e.g. loaf, 12 muffins" feedback={feedback(errors, "recipeYield")}>
          <Input
            name="recipeYield"
            value={draft.recipeYield}
            autoComplete="off"
            disabled={saving}
            onChange={(event) => onPatch({ recipeYield: event.target.value })}
          />
        </FormField>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Prep time (minutes)" feedback={feedback(errors, "prepTime")}>
          <Input
            name="prepTime"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={draft.prepTime ?? ""}
            disabled={saving}
            onChange={(event) => onPatch({ prepTime: parseMinutes(event.target.value) })}
          />
        </FormField>
        <FormField label="Cook time (minutes)" feedback={feedback(errors, "performTime")}>
          <Input
            name="performTime"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={draft.performTime ?? ""}
            disabled={saving}
            onChange={(event) => onPatch({ performTime: parseMinutes(event.target.value) })}
          />
        </FormField>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={tagsId}>Tags</Label>
        <TagInput
          id={tagsId}
          value={draft.tags.map((tag) => tag.name)}
          placeholder="Add a tag and press Enter"
          onValueChange={(names) => onPatch({ tags: tagsFromNames(names, [...draft.tags, ...knownTags]) })}
        />
      </div>

      <FormField label="Source" description="Where the recipe came from" feedback={feedback(errors, "sourceUrl")}>
        <Input
          name="sourceUrl"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={draft.sourceUrl ?? ""}
          autoComplete="off"
          disabled={saving}
          onChange={(event) => onPatch({ sourceUrl: event.target.value.trim() === "" ? null : event.target.value })}
        />
      </FormField>
    </Disclosure>
  );
}
