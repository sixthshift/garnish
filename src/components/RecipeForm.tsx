// The recipe editor's header form: name, description, servings, yield, times,
// rating, tags and image. It is a controlled form over a `RecipeDraft`, a
// concrete `RecipeInput`, so what it holds is exactly what `createRecipe` and
// `updateRecipe` accept; submit zod-parses the draft and shows field errors
// inline. Components are edited through `ComponentsEditor` (add, rename,
// reorder, remove) with their ingredient and step rows; the recipe's own
// steps (the ones printed after every component) and its notes have editors
// of their own below the components. A new recipe carries one blank component
// so the document validates.
//
// The image is not part of the document write. A chosen file is held until the
// recipe has an id, then posted to /api/recipes/:id/image; both happen inside
// one `mutate` so the loaders refresh once, after the image is stored.
import { Button } from "@sixthshift/design-system/button";
import { FormField, type FormFieldFeedback } from "@sixthshift/design-system/form-field";
import { Input } from "@sixthshift/design-system/input";
import { Label } from "@sixthshift/design-system/label";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Select } from "@sixthshift/design-system/select";
import { TagInput } from "@sixthshift/design-system/tag-input";
import { Textarea } from "@sixthshift/design-system/textarea";
import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useId, useState } from "react";
import { slugify } from "../db/names";
import { type ParsedRecipeInput, type Recipe, type RecipeInput, recipeInputSchema, type Tag, type Unit } from "../domain/recipe";
import { randomUuid } from "../lib/ids";
import { uploadRecipeImage } from "../lib/images";
import { useMutate } from "../lib/mutate";
import { createRecipe, updateRecipe } from "../server/recipes";
import { ComponentsEditor, newComponent } from "./ComponentsEditor";
import { NotesEditor } from "./NotesEditor";
import { StepsEditor } from "./StepsEditor";
import { ImageUpload } from "./ui/ImageUpload";
import { NumberStepper } from "./ui/NumberStepper";
import { Rating } from "./ui/Rating";

type ComponentInput = RecipeInput["components"][number];
export type DraftIngredient = NonNullable<ComponentInput["ingredients"]>[number];
export type DraftStep = NonNullable<ComponentInput["steps"]>[number];
export type DraftNote = NonNullable<RecipeInput["notes"]>[number];

/** A component input with both lists present, so the editor never has to default them. */
export type DraftComponent = Omit<ComponentInput, "ingredients" | "steps"> & { ingredients: DraftIngredient[]; steps: DraftStep[] };

/** A `RecipeInput` with every field present, so each input has a value to control. */
export type RecipeDraft = {
  id?: string;
  name: string;
  description: string;
  image: string | null;
  rating: number | null;
  lastMade: string | null;
  recipeServings: number;
  recipeYieldQuantity: number;
  yieldUnit: Unit | null;
  recipeYield: string;
  prepTime: number | null;
  performTime: number | null;
  sourceUrl: string | null;
  notes: DraftNote[];
  tags: Tag[];
  components: DraftComponent[];
  steps: DraftStep[];
};

/** Field path ("name", "components.0.name") to its first error message. */
export type FieldErrors = Record<string, string>;

export type ValidationResult = { ok: true; data: ParsedRecipeInput } | { ok: false; errors: FieldErrors };

/** A blank recipe with one unnamed, empty component: the least document that validates. Pure apart from the component's random id. */
export function emptyDraft(): RecipeDraft {
  return {
    name: "",
    description: "",
    image: null,
    rating: null,
    lastMade: null,
    recipeServings: 0,
    recipeYieldQuantity: 0,
    yieldUnit: null,
    recipeYield: "",
    prepTime: null,
    performTime: null,
    sourceUrl: null,
    notes: [],
    tags: [],
    components: [newComponent()],
    steps: [],
  };
}

/** The stored recipe as an editable draft: slug and timestamps dropped (the server owns them), every id kept. Pure. */
export function draftFromRecipe(recipe: Recipe): RecipeDraft {
  const { slug: _slug, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = recipe;
  return {
    ...rest,
    notes: rest.notes.map((note) => ({ ...note })),
    tags: rest.tags.map((tag) => ({ ...tag })),
    components: rest.components.map((component) => ({
      ...component,
      ingredients: component.ingredients.map((ingredient) => ({ ...ingredient })),
      steps: component.steps.map((step) => ({ ...step })),
    })),
    steps: rest.steps.map((step) => ({ ...step })),
  };
}

/** A friendlier line for the errors a person can actually cause here. */
function messageFor(path: string, code: string, fallback: string): string {
  if (path === "name" && code === "too_small") return "Name is required";
  if ((path === "prepTime" || path === "performTime") && code === "invalid_type") return "Enter whole minutes";
  if ((path === "prepTime" || path === "performTime") && code === "too_small") return "Minutes cannot be negative";
  if ((path === "prepTime" || path === "performTime") && code === "invalid_format") return "Enter whole minutes";
  if (path === "recipeYieldQuantity" && code === "too_small") return "Yield cannot be negative";
  if (path === "recipeServings" && code === "too_small") return "Servings cannot be negative";
  return fallback;
}

/** Parse the draft with `recipeInputSchema`; either the document to send or one message per failing field. Pure. */
export function validateDraft(draft: RecipeDraft): ValidationResult {
  const result = recipeInputSchema.safeParse(draft);
  if (result.success) return { ok: true, data: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.map(String).join(".");
    if (!(path in errors)) errors[path] = messageFor(path, issue.code, issue.message);
  }
  return { ok: false, errors };
}

/**
 * Tag references for the names in the tag input: an existing tag by name
 * (case-insensitive, from `known`), else a new reference the server will
 * find-or-create by name. Blank and duplicate names are dropped. Pure apart
 * from the random id on a new tag.
 */
export function tagsFromNames(names: readonly string[], known: readonly Tag[]): Tag[] {
  const out: Tag[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (name === "" || seen.has(key)) continue;
    seen.add(key);
    out.push(known.find((tag) => tag.name.toLowerCase() === key) ?? { id: randomUuid(), name, slug: slugify(name) || name });
  }
  return out;
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

function feedback(errors: FieldErrors, path: string): FormFieldFeedback | undefined {
  const message = errors[path];
  return message === undefined ? undefined : { intent: "danger", message };
}

export type RecipeFormProps = {
  initial: RecipeDraft;
  units: Unit[];
  tags: Tag[];
  /** The stored recipe being edited. Absent for a new recipe. */
  existing?: { id: string; slug: string };
};

export function RecipeForm({ initial, units, tags: knownTags, existing }: RecipeFormProps) {
  const navigate = useNavigate();
  const mutate = useMutate();
  const tagsId = useId();
  const [draft, setDraft] = useState<RecipeDraft>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const patch = (fields: Partial<RecipeDraft>) => setDraft((current) => ({ ...current, ...fields }));
  const unitOptions = units.map((unit) => ({ value: unit.id, label: unit.name }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFailure(null);
    setSaving(true);
    try {
      const saved = await mutate(async () => {
        const recipe = existing
          ? await updateRecipe({ data: { id: existing.id, doc: result.data } })
          : await createRecipe({ data: result.data });
        if (file) await uploadRecipeImage(recipe.id, file);
        return recipe;
      });
      await navigate({ to: "/recipes/$slug", params: { slug: saved.slug } });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-6" aria-label={existing ? "Edit recipe" : "New recipe"}>
      {failure !== null && (
        <Message intent="danger" title="Could not save">
          {failure}
        </Message>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Image</span>
        <ImageUpload
          image={draft.image}
          disabled={saving}
          onSelect={(chosen) => setFile(chosen)}
          onRemove={() => {
            setFile(null);
            patch({ image: null });
          }}
        />
      </div>

      <FormField label="Name" required feedback={feedback(errors, "name")}>
        <Input name="name" value={draft.name} autoComplete="off" disabled={saving} onChange={(event) => patch({ name: event.target.value })} />
      </FormField>

      <FormField label="Description" feedback={feedback(errors, "description")}>
        <Textarea name="description" rows={3} value={draft.description} disabled={saving} onChange={(event) => patch({ description: event.target.value })} />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberStepper label="Servings" value={draft.recipeServings} min={0} disabled={saving} onChange={(recipeServings) => patch({ recipeServings })} />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Rating</span>
          <Rating value={draft.rating ?? 0} disabled={saving} onChange={(rating) => patch({ rating: rating === 0 ? null : rating })} />
        </div>
      </div>

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
            onChange={(event) => patch({ recipeYieldQuantity: parseAmount(event.target.value) })}
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
            onValueChange={(id) => patch({ yieldUnit: units.find((unit) => unit.id === id) ?? null })}
          />
        </div>
        <FormField label="Makes" description="e.g. loaf, 12 muffins" feedback={feedback(errors, "recipeYield")}>
          <Input name="recipeYield" value={draft.recipeYield} autoComplete="off" disabled={saving} onChange={(event) => patch({ recipeYield: event.target.value })} />
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
            onChange={(event) => patch({ prepTime: parseMinutes(event.target.value) })}
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
            onChange={(event) => patch({ performTime: parseMinutes(event.target.value) })}
          />
        </FormField>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={tagsId}>Tags</Label>
        <TagInput
          id={tagsId}
          value={draft.tags.map((tag) => tag.name)}
          placeholder="Add a tag and press Enter"
          onChange={(names) => patch({ tags: tagsFromNames(names, [...draft.tags, ...knownTags]) })}
        />
      </div>

      <ComponentsEditor draft={draft} onChange={setDraft} units={units} errors={errors} disabled={saving} />

      <section className="flex flex-col gap-3" aria-label="Method">
        <SectionTitle as="h2">{draft.components.length > 1 ? "To finish" : "Method"}</SectionTitle>
        <Muted as="p" className="text-sm">
          Steps that come after every component.
        </Muted>
        <StepsEditor draft={draft} ci={null} onChange={setDraft} errors={errors} disabled={saving} />
      </section>

      <NotesEditor draft={draft} onChange={setDraft} errors={errors} disabled={saving} />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="solid" intent="brand" disabled={saving}>
          {saving ? "Saving…" : existing ? "Save changes" : "Create recipe"}
        </Button>
        <Button asChild variant="ghost" intent="neutral" disabled={saving}>
          {existing ? (
            <Link to="/recipes/$slug" params={{ slug: existing.slug }}>
              Cancel
            </Link>
          ) : (
            <Link to="/">Cancel</Link>
          )}
        </Button>
      </div>
    </form>
  );
}
