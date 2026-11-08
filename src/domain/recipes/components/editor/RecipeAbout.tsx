import { FormField } from "@sixthshift/design-system/form-field";
import { Input } from "@sixthshift/design-system/input";
import { Label } from "@sixthshift/design-system/label";
import { Select } from "@sixthshift/design-system/select";
import { Textarea } from "@sixthshift/design-system/textarea";
import { cn } from "@sixthshift/design-system/utils";
import { useId } from "react";
import { Disclosure } from "../../../../components/ui/Disclosure";
import { ImageUpload } from "../../../../components/ui/ImageUpload";
import { NumberStepper } from "../../../../components/ui/NumberStepper";
import type { FieldErrors, RecipeDraft } from "../../draft";
import { formatDuration, totalMinutes } from "../../ingredient";
import type { Tag, Unit } from "../../reference";
import { FacetField } from "../facets/FacetDetails";
import { NotesEditor } from "./NotesEditor";
import { feedback, parseAmount, parseMinutes } from "./recipeFormText";
import { TagField } from "./TagField";

// What a recipe is, before its ingredients and its method: the editor's
// pieces for what the recipe page shows above them, each in the place the
// page shows it (decisions.md row 211). A desktop stacks them down its left
// column (`AboutColumn`); a phone splits them round its two tabs
// (`PhoneAboveTabs`, `PhoneBelowTabs`).

export type RecipeAboutProps = {
  draft: RecipeDraft;
  errors: FieldErrors;
  /** True while a save is in flight; every field is disabled. */
  saving: boolean;
  /** True when editing a stored recipe; a new one autofocuses the name. */
  existing: boolean;
  /** An image an import found, shown until the fetched file replaces it. */
  importedImageUrl?: string | null;
  units: readonly Unit[];
  /** The tags that already exist, so a typed name resolves to the stored one. */
  knownTags: readonly Tag[];
  /** An import's new tags, offered as one-press additions (decisions.md row 171). */
  suggestedTags?: readonly string[];
  /** An import's tags left out, named. */
  leftOutTags?: readonly string[];
  onPatch: (fields: Partial<RecipeDraft>) => void;
  /** The whole draft replaced: the notes' list edits. */
  onChange: (draft: RecipeDraft) => void;
  /** The picked (or fetched) image file; null clears it. */
  onFile: (file: File | null) => void;
};

/** The photo, edge to edge where the page's is, its buttons on it. */
export function PhotoField({ draft, saving, importedImageUrl, onPatch, onFile, className }: RecipeAboutProps & { className?: string }) {
  return (
    <ImageUpload
      variant="hero"
      image={draft.image}
      previewUrl={importedImageUrl}
      disabled={saving}
      className={className}
      onSelect={(chosen) => onFile(chosen)}
      onRemove={() => {
        onFile(null);
        onPatch({ image: null });
      }}
    />
  );
}

/** The name, typed over the title in the title's own face. */
export function NameField({ draft, errors, saving, existing, onPatch }: RecipeAboutProps) {
  const error = feedback(errors, "name");
  return (
    <div className="flex flex-col gap-1">
      <Textarea
        name="name"
        aria-label="Name"
        aria-required
        aria-invalid={error !== undefined || undefined}
        rows={1}
        placeholder="Recipe name"
        value={draft.name}
        autoComplete="off"
        autoFocus={!existing}
        disabled={saving}
        // One line in the title's face, wrapping as the title does; Enter is not a newline in a name.
        className="field-sizing-content resize-none border-transparent bg-transparent px-1.5 -mx-1.5 font-display text-3xl font-semibold leading-tight tracking-tight shadow-none hover:border-border-normal focus-visible:border-border-brand"
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
        onChange={(event) => onPatch({ name: event.target.value.replace(/\n/g, " ") })}
      />
      {error !== undefined && (
        <p className="text-sm text-fg-danger" role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}

/** One time, as the page's strip names it, in minutes. */
function MinutesField({
  label,
  name,
  value,
  onChange,
  disabled,
  error,
}: {
  label: string;
  name: "prepTime" | "performTime";
  value: number | null;
  onChange: (minutes: number | null) => void;
  disabled: boolean;
  error?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-fg-subtle" aria-hidden="true">
        {label}
      </span>
      <Input
        name={name}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        aria-label={`${label} time (minutes)`}
        aria-invalid={error !== undefined || undefined}
        className="w-18 text-center"
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(parseMinutes(event.target.value))}
      />
      <span className="text-fg-subtle">min</span>
    </div>
  );
}

/** Prep and cook where the page's strip has them, the total worked out beside them. */
export function TimesFields({ draft, errors, saving, onPatch }: RecipeAboutProps) {
  const total = totalMinutes(draft.prepTime, draft.performTime);
  const timeError = errors.prepTime ?? errors.performTime;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="times">
      <MinutesField
        label="Prep"
        name="prepTime"
        value={draft.prepTime}
        disabled={saving}
        error={errors.prepTime}
        onChange={(prepTime) => onPatch({ prepTime })}
      />
      <MinutesField
        label="Cook"
        name="performTime"
        value={draft.performTime}
        disabled={saving}
        error={errors.performTime}
        onChange={(performTime) => onPatch({ performTime })}
      />
      {total !== null && <span className="text-sm text-fg-subtle">Total {formatDuration(total)}</span>}
      {/* The fields only turn red; the reason is said once under the pair. */}
      {timeError !== undefined && (
        <p className="w-full text-sm text-fg-danger" role="alert">
          {timeError}
        </p>
      )}
    </div>
  );
}

/** How many it serves, and what it makes: a loaf, 12 muffins, 500 ml. The yield folds away until it is set. */
export function YieldFields({ draft, errors, saving, units, onPatch }: RecipeAboutProps) {
  const unitOptions = units.map((unit) => ({ value: unit.id, label: unit.name }));
  const hasYield = draft.recipeYieldQuantity > 0 || draft.yieldUnit !== null || draft.recipeYield.trim() !== "";
  return (
    <div className="flex flex-col gap-2">
      <NumberStepper label="Servings" value={draft.recipeServings} min={0} disabled={saving} onChange={(recipeServings) => onPatch({ recipeServings })} />
      <Disclosure title="Makes" hint={hasYield ? undefined : "a loaf, 12 muffins, 500 ml"} defaultOpen={hasYield} aria-label="Yield">
        <div className="grid gap-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
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
      </Disclosure>
    </div>
  );
}

/** What the recipe is, layer by layer: kept in the draft, written with Save. */
export function NatureFields({ draft, saving, onPatch }: RecipeAboutProps) {
  return (
    <FacetField name={draft.name.trim() || "this recipe"} facets={draft.facets} linked={false} disabled={saving} onChange={(facets) => onPatch({ facets })} />
  );
}

/** The description, in the page's reading size. */
export function DescriptionField({ draft, errors, saving, onPatch }: RecipeAboutProps) {
  return (
    <FormField label="Description" feedback={feedback(errors, "description")}>
      <Textarea
        name="description"
        rows={3}
        className="field-sizing-content min-h-20"
        placeholder="What it is, where it came from, how it's served"
        value={draft.description}
        disabled={saving}
        onChange={(event) => onPatch({ description: event.target.value })}
      />
    </FormField>
  );
}

export function TagsField({ draft, saving, knownTags, suggestedTags, leftOutTags, onPatch }: RecipeAboutProps) {
  const tagsId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={tagsId}>Tags</Label>
      <TagField
        id={tagsId}
        value={draft.tags}
        known={knownTags}
        suggested={suggestedTags}
        leftOut={leftOutTags}
        disabled={saving}
        onChange={(tags) => onPatch({ tags })}
      />
    </div>
  );
}

export function SourceField({ draft, errors, saving, onPatch }: RecipeAboutProps) {
  return (
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
  );
}

/**
 * A desktop's left column, as the recipe page's left page: the photo across
 * its top, then the name, the times, the servings, the kind and what it is,
 * the description and the tags; then the source and the notes, which the
 * page keeps further down.
 */
export function AboutColumn(props: RecipeAboutProps & { top?: React.ReactNode }) {
  return (
    <div className="flex flex-col" data-testid="about-column">
      <PhotoField {...props} className="h-64 shrink-0" />
      <div className="flex flex-col gap-4 p-6">
        {props.top}
        <NameField {...props} />
        <TimesFields {...props} />
        <YieldFields {...props} />
        <NatureFields {...props} />
        <DescriptionField {...props} />
        <TagsField {...props} />
        <div className={cn("flex flex-col gap-4 border-t border-border-subtle pt-4")}>
          <SourceField {...props} />
          <NotesEditor draft={props.draft} onChange={props.onChange} errors={props.errors} disabled={props.saving} />
        </div>
      </div>
    </div>
  );
}
