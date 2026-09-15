import { useBlocker, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { draftFromInput, draftFromJson, draftToJson, type FieldErrors, hasDetails, isDirty, type RecipeDraft, validateDraft } from "../../../domain/draft";
import { browserStorage, clearDraft, draftNoticeText, getDraft, putDraft } from "../../../lib/drafts";
import { dataUrlFile, fetchedImageFile, uploadRecipeImage } from "../../../lib/images";
import { useMutate } from "../../../lib/mutate";
import { messageFrom, notify, notifyError } from "../../../lib/notify";
import { useOnline } from "../../../lib/useOnline";
import { createRecipe, updateRecipe } from "../../../server/fns/recipes";
import { fetchImage } from "../../../server/import/imageFetch";
import type { RecipeFormProps } from "./RecipeForm";
import { saveNotice } from "./recipeFormText";

export type UseRecipeFormOptions = Pick<RecipeFormProps, "initial" | "existing" | "online" | "importedImageUrl" | "storage" | "afterSaveSearch">;

export function useRecipeForm({ initial, existing, online: onlineOverride, importedImageUrl, storage: storageProp, afterSaveSearch }: UseRecipeFormOptions) {
  const navigate = useNavigate();
  const mutate = useMutate();
  const detectedOnline = useOnline();
  const online = onlineOverride ?? detectedOnline;
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

  // A `data:` URL is already the bytes — an image out of an uploaded Mealie
  // backup — so it is rebuilt here rather than fetched through the
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

  /** Forget the stored draft: after a save, a discard, or leaving anyway. */
  const clearStoredDraft = () => {
    if (storage) clearDraft(storage, existing?.id);
  };

  const resumePending = () => {
    if (pending === null) return;
    setDraft(pending.draft);
    setPending(null);
  };

  const discardPending = () => {
    clearStoredDraft();
    setPending(null);
  };

  const toggleJson = () => {
    if (json !== null) {
      setJson(null);
      setJsonError(null);
      return;
    }
    setJson(draftToJson(draft));
    setJsonError(null);
  };

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
    // A failed image does not fail the save: the document is stored either way and the notice says so.
    const image: { error: string | null } = { error: null };
    try {
      const saved = await mutate(async () => {
        const recipe = existing ? await updateRecipe({ data: { id: existing.id, doc: result.data } }) : await createRecipe({ data: result.data });
        if (file) {
          try {
            await uploadRecipeImage(recipe.id, file);
          } catch (error) {
            image.error = messageFrom(error);
          }
        }
        return recipe;
      });
      clearStoredDraft();
      notify(saveNotice({ existing: existing !== undefined, imageError: image.error }));
      await navigate({ to: "/recipes/$slug", params: { slug: saved.slug }, search: afterSaveSearch ?? {} });
    } catch (error) {
      notifyError(existing ? "Could not save changes" : "Could not create recipe", error);
      setSaving(false);
    }
  };

  return {
    online,
    draft,
    setDraft,
    patch,
    errors,
    setFile,
    saving,
    json,
    setJson,
    jsonError,
    detailsOpen,
    pending,
    dirty,
    blocker,
    clearStoredDraft,
    resumePending,
    discardPending,
    toggleJson,
    applyJson,
    submit,
  };
}
