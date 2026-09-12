// The recipe editor. A controlled form over a `RecipeDraft`, a concrete
// `RecipeInput`, so what it holds is exactly what `createRecipe` and
// `updateRecipe` accept; submit zod-parses the draft and shows field errors
// inline. Parts are edited through `PartsEditor` (add, rename, reorder,
// remove) with their ingredient and step rows; every step lives in a part, so
// the form has no step list of its own. A new recipe carries one blank part so
// the document validates.
//
// The order is the view page's order (decisions.md row 50, updated by row 61):
// name first — autofocused on a new recipe, so typing starts where the recipe
// does — then description, then the image, then notes, then the parts with
// their ingredients and steps. The picture is the one field you can only fill
// from the camera roll, so it does not stand between "New recipe" and the name.
// Everything else — yield, times, tags, source — is behind a `Details`
// disclosure that opens folded on a new recipe and open on one that has any of
// it, so the first thing between "New recipe" and the first ingredient is the
// name and not six pieces of paperwork. The disclosure is a `<details>`, so a
// field inside a closed one is still in the form and still validates.
//
// Rating and last made are not here at all (decisions.md row 51). Decision 41
// made "Made this" the thing that records a cook and writes `last_made`, and
// rating a recipe on the screen where you are first typing it in is rating
// something you have not cooked. The draft still carries both and an edit
// round-trips them untouched.
//
// The image is not part of the document write. A chosen file is held until the
// recipe has an id, then posted to /api/recipes/:id/image; both happen inside
// one `mutate` so the loaders refresh once, after the image is stored. A failed
// image does not fail the save: the document is stored either way and the
// notice says so.
//
// Outcomes are reported with `notify()` (src/lib/notify.ts), not inline copy —
// a save navigates away, so a message in this form would never be read. The
// offline banner stays inline: it is a standing state, not an outcome.
//
// The image field also takes a pasted URL: `fetchImage` (src/server/imageFetch.ts)
// GETs it on the server — the browser cannot, for CORS — and the bytes come
// back as a File that joins the same upload path as a picked one.
//
// "Edit as JSON" swaps the fields for the document itself. Apply parses the
// text with `recipeInputSchema`, the same schema Save uses, and reports the
// failing paths; nothing reaches the draft until it parses.
//
// Save and Cancel live in two places, one per width (decisions.md row 56's
// sibling, M22.2): an `EditorToolbar` above the form, sticky from `md` up and
// carrying the recipe's name, the dirty note and "Edit as JSON"; and a
// `SaveBar` at the foot, sticky above the phone's tab bar and hidden from `md`.
// The draft is compared with the one the form opened
// on (`isDirty`, plus a picked image file, which never enters the draft), and
// while it differs `useBlocker` stands in the way: leaving the route asks for
// a confirm, and closing the tab gets the browser's own prompt. A save in
// flight lifts the block, so the navigation it ends with goes through.
import { Button } from "@sixthshift/design-system/button";
import { FormField, type FormFieldFeedback } from "@sixthshift/design-system/form-field";
import { Input } from "@sixthshift/design-system/input";
import { Label } from "@sixthshift/design-system/label";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { Select } from "@sixthshift/design-system/select";
import { TagInput } from "@sixthshift/design-system/tag-input";
import { Textarea } from "@sixthshift/design-system/textarea";
import { Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useId, useState } from "react";
import { slugify } from "../domain/names";
import { type ParsedRecipeInput, type Recipe, type RecipeInput, recipeInputSchema, type Tag, type Unit } from "../domain/recipe";
import { randomUuid } from "../lib/ids";
import { fetchedImageFile, uploadRecipeImage } from "../lib/images";
import { useMutate } from "../lib/mutate";
import { messageFrom, type NoticeInput, notify, notifyError } from "../lib/notify";
import { useOnline } from "../lib/useOnline";
import { fetchImage } from "../server/imageFetch";
import { createRecipe, updateRecipe } from "../server/recipes";
import { newPart, PartsEditor } from "./PartsEditor";
import { NotesEditor } from "./NotesEditor";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { Disclosure } from "./ui/Disclosure";
import { EditorToolbar } from "./ui/EditorToolbar";
import { ImageUpload } from "./ui/ImageUpload";
import { NumberStepper } from "./ui/NumberStepper";
import { SaveBar } from "./ui/SaveBar";

type PartInput = RecipeInput["parts"][number];
export type DraftIngredient = NonNullable<PartInput["ingredients"]>[number];
export type DraftStep = NonNullable<PartInput["steps"]>[number];
export type DraftNote = NonNullable<RecipeInput["notes"]>[number];

/** A part input with both lists present, so the editor never has to default them. */
export type DraftPart = Omit<PartInput, "ingredients" | "steps"> & { ingredients: DraftIngredient[]; steps: DraftStep[] };

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
  favourite: boolean;
  notes: DraftNote[];
  tags: Tag[];
  parts: DraftPart[];
};

/** Field path ("name", "parts.0.name") to its first error message. */
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
    favourite: false,
    notes: [],
    tags: [],
    parts: [newPart()],
  };
}

/** The stored recipe as an editable draft: slug and timestamps dropped (the server owns them), every id kept. Pure. */
export function draftFromRecipe(recipe: Recipe): RecipeDraft {
  const { slug: _slug, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = recipe;
  return {
    ...rest,
    notes: rest.notes.map((note) => ({ ...note })),
    tags: rest.tags.map((tag) => ({ ...tag })),
    parts: rest.parts.map((part) => ({
      ...part,
      ingredients: part.ingredients.map((ingredient) => ({ ...ingredient })),
      steps: part.steps.map((step) => ({ ...step })),
    })),
  };
}

/** Structural equality over the JSON-shaped values a draft is made of. Key order is not a difference; array order is. */
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => same(item, b[index]));
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) if (!same(left[key], right[key])) return false;
  return true;
}

/**
 * Has the draft moved away from the one the form opened on? Compared by value,
 * so retyping a field back to what it was is not dirty, and reordering a list
 * is. A picked image file lives outside the draft; the form ors it in. Pure.
 */
export function isDirty(initial: RecipeDraft, draft: RecipeDraft): boolean {
  return !same(initial, draft);
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

/** The draft as the document text the JSON view shows: the write shape, indented, key order as written. Pure. */
export function draftToJson(draft: RecipeDraft): string {
  return `${JSON.stringify(draft, null, 2)}\n`;
}

/** A parsed document as a draft: every list present, every child given an id so the editor can key on it. Pure apart from the ids it fills in. */
export function draftFromInput(input: ParsedRecipeInput): RecipeDraft {
  return {
    ...input,
    notes: input.notes.map((note) => ({ ...note, id: note.id ?? randomUuid() })),
    tags: input.tags.map((tag) => ({ ...tag })),
    parts: input.parts.map((part) => ({
      ...part,
      id: part.id ?? randomUuid(),
      ingredients: part.ingredients.map((ingredient) => ({ ...ingredient, id: ingredient.id ?? randomUuid() })),
      steps: part.steps.map((step) => ({ ...step, id: step.id ?? randomUuid() })),
    })),
  };
}

export type JsonResult = { ok: true; draft: RecipeDraft } | { ok: false; error: string };

/** Text from the JSON view back to a draft: a syntax error or the failing field paths come back as one message. Pure apart from any ids it fills in. */
export function draftFromJson(text: string): JsonResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: `That is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const result = recipeInputSchema.safeParse(value);
  if (!result.success) {
    const lines = result.error.issues.slice(0, 5).map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`);
    const extra = result.error.issues.length - lines.length;
    return { ok: false, error: extra > 0 ? `${lines.join("; ")} (and ${extra} more)` : lines.join("; ") };
  }
  return { ok: true, draft: draftFromInput(result.data) };
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

/** What to say once the document is stored: a failed image downgrades the success to a warning that names it. Pure. */
export function saveNotice(opts: { existing: boolean; imageError: string | null }): NoticeInput {
  const title = opts.existing ? "Changes saved" : "Recipe created";
  if (opts.imageError !== null) return { intent: "warning", title, message: `The image did not upload: ${opts.imageError}` };
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

/**
 * Does the draft have anything in the Details section — yield, times, tags or
 * a source? A new recipe has none of it, which is why the section opens
 * folded; an existing one usually has some, and a field you cannot see is a
 * field you will forget to change. Pure.
 */
export function hasDetails(draft: RecipeDraft): boolean {
  return (
    draft.recipeYieldQuantity > 0 ||
    draft.yieldUnit !== null ||
    draft.recipeYield.trim() !== "" ||
    draft.prepTime !== null ||
    draft.performTime !== null ||
    draft.tags.length > 0 ||
    (draft.sourceUrl ?? "").trim() !== ""
  );
}

/** The quiet line beside "Details": what is in there, or what is not. Pure. */
export function detailsHint(draft: RecipeDraft): string {
  const parts: string[] = [];
  if (draft.recipeYieldQuantity > 0 || draft.recipeYield.trim() !== "") parts.push("yield");
  if (draft.prepTime !== null || draft.performTime !== null) parts.push("times");
  if (draft.tags.length > 0) parts.push(`${draft.tags.length} tag${draft.tags.length === 1 ? "" : "s"}`);
  if ((draft.sourceUrl ?? "").trim() !== "") parts.push("source");
  return parts.length === 0 ? "Yield, times, tags, source" : parts.join(", ");
}

function feedback(errors: FieldErrors, path: string): FormFieldFeedback | undefined {
  const message = errors[path];
  return message === undefined ? undefined : { intent: "danger", message };
}

export type RecipeFormProps = {
  initial: RecipeDraft;
  units: Unit[];
  tags: Tag[];
  /**
   * The stored recipe being edited. Absent for a new recipe. `servings`, when
   * the edit link carried one, is only used to send Cancel back to the same
   * scale on the view page.
   */
  existing?: { id: string; slug: string; servings?: number };
  /** Override the detected online state (tests). Writes are refused offline; nothing is queued. */
  online?: boolean;
  /**
   * An image an import found, as a remote URL (M23.6). Shown straight away and
   * fetched once through `fetchImage`, so it joins the same upload path a
   * picked file does. A failure is silent: the recipe is worth more than its
   * picture, and the field is right there to try again with.
   */
  importedImageUrl?: string | null;
};

export function RecipeForm({ initial, units, tags: knownTags, existing, online: onlineOverride, importedImageUrl }: RecipeFormProps) {
  const navigate = useNavigate();
  const mutate = useMutate();
  const detectedOnline = useOnline();
  const online = onlineOverride ?? detectedOnline;
  const tagsId = useId();
  const [draft, setDraft] = useState<RecipeDraft>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [json, setJson] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  // Decided from the draft the form opened on, not the live one, so typing a
  // tag does not fold the section you typed it into.
  const [detailsOpen] = useState(() => hasDetails(initial));

  const dirty = (isDirty(initial, draft) || file !== null) && !saving;
  const blocker = useBlocker({ shouldBlockFn: () => true, enableBeforeUnload: () => dirty, disabled: !dirty, withResolver: true });

  const patch = (fields: Partial<RecipeDraft>) => setDraft((current) => ({ ...current, ...fields }));

  const cancelLink = (
    <Button asChild variant="ghost" intent="neutral" size="sm" disabled={saving}>
      {existing ? (
        <Link to="/recipes/$slug" params={{ slug: existing.slug }} search={{ servings: existing.servings }}>
          Cancel
        </Link>
      ) : (
        <Link to="/">Cancel</Link>
      )}
    </Button>
  );

  const fetchFromUrl = async (url: string): Promise<File> => fetchedImageFile(await fetchImage({ data: { url } }));

  // An imported image is a URL on someone else's server. Fetch it once, into
  // the same `file` a picked one lands in, so Save stores it here.
  useEffect(() => {
    if (importedImageUrl == null || importedImageUrl === "") return;
    let stale = false;
    fetchFromUrl(importedImageUrl)
      .then((fetched) => {
        if (!stale) setFile(fetched);
      })
      .catch(() => {
        // Shown as a warning by `saveNotice` only if a save actually tries it.
      });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importedImageUrl]);

  const applyJson = () => {
    const result = draftFromJson(json ?? "");
    if (!result.ok) {
      setJsonError(result.error);
      return;
    }
    setDraft(result.draft);
    setErrors({});
    setJsonError(null);
    setJson(null);
  };
  const unitOptions = units.map((unit) => ({ value: unit.id, label: unit.name }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!online) return;
    const result = validateDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    const image: { error: string | null } = { error: null };
    try {
      const saved = await mutate(async () => {
        const recipe = existing
          ? await updateRecipe({ data: { id: existing.id, doc: result.data } })
          : await createRecipe({ data: result.data });
        if (file) {
          try {
            await uploadRecipeImage(recipe.id, file);
          } catch (error) {
            image.error = messageFrom(error);
          }
        }
        return recipe;
      });
      notify(saveNotice({ existing: existing !== undefined, imageError: image.error }));
      await navigate({ to: "/recipes/$slug", params: { slug: saved.slug } });
    } catch (error) {
      notifyError(existing ? "Could not save changes" : "Could not create recipe", error);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-6" aria-label={existing ? "Edit recipe" : "New recipe"}>
      {!online && (
        <Message intent="warning" title="You are offline" data-testid="offline-notice">
          Changes cannot be saved offline. Keep editing; Save comes back with the connection.
        </Message>
      )}
      <EditorToolbar
        title={draft.name}
        placeholder={existing ? "Untitled recipe" : "New recipe"}
        label={existing ? "Save changes" : "Create recipe"}
        busyLabel="Saving…"
        busy={saving}
        disabled={!online}
        note={dirty ? "Unsaved changes" : undefined}
        cancel={cancelLink}
        actions={
          <Button
            type="button"
            variant="outline"
            intent="neutral"
            size="sm"
            disabled={saving}
            data-testid="json-toggle"
            onClick={() => {
              if (json !== null) {
                setJson(null);
                setJsonError(null);
                return;
              }
              setJson(draftToJson(draft));
              setJsonError(null);
            }}
          >
            {json !== null ? "Back to form" : "Edit as JSON"}
          </Button>
        }
      />

      {json !== null ? (
        <div className="flex flex-col gap-3" data-testid="json-view">
          <Muted as="p" className="text-sm">
            The recipe document. Apply parses it and puts it back in the form; Save then stores it.
          </Muted>
          <Textarea aria-label="Recipe JSON" rows={24} spellCheck={false} className="font-mono text-xs" value={json} disabled={saving} onChange={(event) => setJson(event.target.value)} />
          {jsonError !== null && (
            <Message intent="danger" title="That document did not parse" data-testid="json-error">
              {jsonError}
            </Message>
          )}
          <div className="flex gap-2">
            <Button type="button" intent="primary" size="sm" disabled={saving} onClick={applyJson}>
              Apply
            </Button>
          </div>
        </div>
      ) : (
        <>
      <FormField label="Name" required feedback={feedback(errors, "name")}>
        <Input
          name="name"
          value={draft.name}
          autoComplete="off"
          autoFocus={existing === undefined}
          disabled={saving}
          onChange={(event) => patch({ name: event.target.value })}
        />
      </FormField>

      <FormField label="Description" feedback={feedback(errors, "description")}>
        <Textarea name="description" rows={3} value={draft.description} disabled={saving} onChange={(event) => patch({ description: event.target.value })} />
      </FormField>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Image</span>
        <ImageUpload
          image={draft.image}
          previewUrl={importedImageUrl}
          disabled={saving}
          onUrl={fetchFromUrl}
          onSelect={(chosen) => setFile(chosen)}
          onRemove={() => {
            setFile(null);
            patch({ image: null });
          }}
        />
      </div>

      <NumberStepper label="Servings" value={draft.recipeServings} min={0} disabled={saving} onChange={(recipeServings) => patch({ recipeServings })} />

      <NotesEditor draft={draft} onChange={setDraft} errors={errors} disabled={saving} />

      <PartsEditor draft={draft} onChange={setDraft} units={units} errors={errors} disabled={saving} />

      <Disclosure title="Details" hint={detailsHint(draft)} defaultOpen={detailsOpen}>
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

        <FormField label="Source" description="Where the recipe came from" feedback={feedback(errors, "sourceUrl")}>
          <Input
            name="sourceUrl"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={draft.sourceUrl ?? ""}
            autoComplete="off"
            disabled={saving}
            onChange={(event) => patch({ sourceUrl: event.target.value.trim() === "" ? null : event.target.value })}
          />
        </FormField>
      </Disclosure>
        </>
      )}

      {/* The phone's footer save; from `md` the toolbar above carries it. */}
      <SaveBar
        className="md:hidden"
        label={existing ? "Save changes" : "Create recipe"}
        busyLabel="Saving…"
        busy={saving}
        disabled={!online}
        note={dirty ? "Unsaved changes" : undefined}
        cancel={cancelLink}
      />

      {blocker.status === "blocked" && (
        <ConfirmDialog
          title="Discard changes?"
          confirmLabel="Discard"
          aria-label="Discard changes"
          onCancel={blocker.reset}
          onConfirm={blocker.proceed}
        >
          <p>This recipe has changes that have not been saved. Leaving now loses them.</p>
        </ConfirmDialog>
      )}
    </form>
  );
}
