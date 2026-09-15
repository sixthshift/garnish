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
// An image a URL import found is fetched through `fetchImage`
// (src/server/import/imageFetch.ts) — the browser cannot, for CORS — and the
// bytes come back as a File that joins the same upload path as a picked one.
// The field itself no longer takes a pasted address (decisions.md row 79).
//
// What is typed here survives the tab: every change while the form is dirty is
// written to `localStorage` through src/lib/drafts.ts, keyed by the recipe id
// (or `new`), and cleared on a save or a confirmed discard. Opening the form
// on a stored draft that differs from `initial` shows a notice with Resume and
// Discard before anything is written back. The picked image file is not stored
// — it is a File handle — so the notice says to pick it again.
//
// "Edit as JSON" swaps the fields for the document itself. Apply parses the
// text with `recipeInputSchema`, the same schema Save uses, and reports the
// failing paths; nothing reaches the draft until it parses. It sits behind a
// one-item `Menu` at the toolbar's end (M27.6), the item reading "Edit as
// JSON" or "Back to form" depending on which view is showing.
//
// Save and Cancel live in two places, one per width (decisions.md row 56's
// sibling, M22.2): an `EditorToolbar` above the form, sticky from `md` up and
// carrying the recipe's name, the dirty note and that menu; and a `SaveBar`
// at the foot, sticky above the phone's tab bar and hidden from `md`.
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
import { type Recipe } from "../../../domain/recipe";
import { type Tag, type Unit } from "../../../domain/reference";
import { browserStorage, clearDraft, draftNoticeText, getDraft, putDraft, type StorageLike } from "../../../lib/drafts";
import { dataUrlFile, fetchedImageFile, uploadRecipeImage } from "../../../lib/images";
import { useMutate } from "../../../lib/mutate";
import { messageFrom, notify, notifyError, type NoticeInput } from "../../../lib/notify";
import { useOnline } from "../../../lib/useOnline";
import { fetchImage } from "../../../server/import/imageFetch";
import { createRecipe, updateRecipe } from "../../../server/fns/recipes";
import { PartsEditor } from "./PartsEditor";
import { NotesEditor } from "./NotesEditor";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Disclosure } from "../../../components/ui/Disclosure";
import { EditorToolbar } from "../../../components/ui/EditorToolbar";
import { ImageUpload } from "../../../components/ui/ImageUpload";
import { Menu } from "../../../components/ui/Menu";
import { NumberStepper } from "../../../components/ui/NumberStepper";
import { SaveBar } from "../../../components/ui/SaveBar";
import { type RecipeDraft, type FieldErrors, validateDraft, isDirty, draftFromInput, hasDetails, draftToJson, draftFromJson, tagsFromNames } from "../../../domain/draft";

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
   * Where the unsaved draft is kept (src/lib/drafts.ts). Defaults to
   * `localStorage`; tests pass an in-memory one.
   */
  storage?: StorageLike;
  /**
   * An image an import found, as a remote URL (M23.6). Shown straight away and
   * fetched once through `fetchImage`, so it joins the same upload path a
   * picked file does. A failure is silent: the recipe is worth more than its
   * picture, and the field is right there to try again with.
   */
  importedImageUrl?: string | null;
  /**
   * Search params the navigation after a successful Create carries (M37.6).
   * The new recipe page sets `{ restyle: true }` after an import when a model
   * is configured, so the recipe opens with the restyle sheet already up; a
   * recipe typed in by hand gets nothing, because there is no imported voice
   * to rewrite.
   */
  afterSaveSearch?: { restyle?: boolean };
  /**
   * Forwarded to the JSON toggle's `Menu` (tests). The menu is closed by
   * default and opens on click, like every other `Menu` in the app; there is
   * no jsdom in this project's vitest config, so a render test cannot click
   * it open and instead renders it open through this prop.
   */
  jsonMenuOpen?: boolean;
};

export function RecipeForm({ initial, units, tags: knownTags, existing, online: onlineOverride, importedImageUrl, storage: storageProp, afterSaveSearch, jsonMenuOpen }: RecipeFormProps) {
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
  const storage = storageProp ?? browserStorage();
  // A draft left behind by an earlier visit, read once on mount and only kept
  // if it actually differs from what the form opened on. While it is here the
  // fields are live but nothing is written back: the choice comes first.
  const [pending, setPending] = useState<{ draft: RecipeDraft; text: string } | null>(() => {
    const stored = storage ? getDraft(storage, existing?.id) : null;
    if (stored === null) return null;
    const candidate = draftFromInput(stored.draft);
    return isDirty(initial, candidate) ? { draft: candidate, text: draftNoticeText(stored) } : null;
  });

  const dirty = (isDirty(initial, draft) || file !== null) && !saving;
  const blocker = useBlocker({ shouldBlockFn: () => true, enableBeforeUnload: () => dirty, disabled: !dirty, withResolver: true });

  const patch = (fields: Partial<RecipeDraft>) => setDraft((current) => ({ ...current, ...fields }));

  // Write through on every change while the form is dirty. The picked file is
  // not stored (it is a File handle, not JSON); `hadImage` remembers there was
  // one so the notice can say to pick it again.
  useEffect(() => {
    if (storage === undefined || pending !== null || saving) return;
    if (isDirty(initial, draft) || file !== null) putDraft(storage, existing?.id, draft, file !== null);
  }, [storage, pending, saving, initial, draft, file, existing?.id]);

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

  // A `data:` URL is already the bytes — an image out of an uploaded Mealie
  // backup (M34.3) — so it is rebuilt here rather than fetched through the
  // server, which only reads http(s).
  const fetchFromUrl = async (url: string): Promise<File> =>
    url.trim().startsWith("data:") ? dataUrlFile(url) : fetchedImageFile(await fetchImage({ data: { url } }));

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
      if (storage) clearDraft(storage, existing?.id);
      notify(saveNotice({ existing: existing !== undefined, imageError: image.error }));
      await navigate({ to: "/recipes/$slug", params: { slug: saved.slug }, search: afterSaveSearch ?? {} });
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
      {pending !== null && (
        <Message intent="info" title="Unsaved changes" data-testid="draft-notice">
          <div className="flex flex-col gap-2">
            <p>{pending.text}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                intent="primary"
                size="sm"
                data-testid="draft-resume"
                onClick={() => {
                  setDraft(pending.draft);
                  setPending(null);
                }}
              >
                Resume
              </Button>
              <Button
                type="button"
                variant="outline"
                intent="neutral"
                size="sm"
                data-testid="draft-discard"
                onClick={() => {
                  if (storage) clearDraft(storage, existing?.id);
                  setPending(null);
                }}
              >
                Discard
              </Button>
            </div>
          </div>
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
          <Menu label="Editor actions" iconOnly open={jsonMenuOpen}>
            <Menu.Item
              data-testid="json-toggle"
              disabled={saving}
              onSelect={() => {
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
            </Menu.Item>
          </Menu>
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
          onConfirm={() => {
            if (storage) clearDraft(storage, existing?.id);
            blocker.proceed();
          }}
        >
          <p>This recipe has changes that have not been saved. Leaving now loses them.</p>
        </ConfirmDialog>
      )}
    </form>
  );
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

/** The quiet line beside "Details": what is in there, or what is not. Pure. */
export function detailsHint(draft: RecipeDraft): string {
  const parts: string[] = [];
  if (draft.recipeYieldQuantity > 0 || draft.recipeYield.trim() !== "") parts.push("yield");
  if (draft.prepTime !== null || draft.performTime !== null) parts.push("times");
  if (draft.tags.length > 0) parts.push(`${draft.tags.length} tag${draft.tags.length === 1 ? "" : "s"}`);
  if ((draft.sourceUrl ?? "").trim() !== "") parts.push("source");
  return parts.length === 0 ? "Yield, times, tags, source" : parts.join(", ");
}
