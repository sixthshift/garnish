import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";
import { toast } from "@sixthshift/design-system/overlay";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { createRecipe } from "../../../../api/rpc/recipes";
import { messageFrom } from "../../../../lib/errors";
import { uploadRecipeImage } from "../../../../lib/images";
import { useMutate } from "../../../../lib/mutate";
import { createRestyledRecipe, restyleDraft } from "../../../../server/ai/restyle";
import { type RecipeDraft, validateDraft } from "../../draft";
import type { RestyledPart } from "../../style";
import { DiscardImportDialog, useImportGuard } from "../editor/DiscardImport";
import { imageFromUrl } from "../editor/importedImage";
import { saveNotice } from "../editor/recipeFormText";
import { StyleSpace } from "../style/StyleSpace";
import { forSaving } from "../style/styleSession";

export type ImportStyleProps = {
  /** The import as Check left it. */
  draft: RecipeDraft;
  /** The page's picture, when the import found one. */
  imageUrl: string | null;
  /** A picture picked on Check, which wins over `imageUrl`. */
  file: File | null;
  /** Back to Check, with the draft as it was handed on. */
  onBack: () => void;
  /**
   * Drop the import and go back to the chooser. From here the phone has no
   * tab bar, so this is the way out short of saving or going back to Check;
   * it asks first, since nothing is stored yet.
   * Leaving the page any other way (the browser's Back) asks the same.
   */
  onCancel: () => void;
};

/**
 * The import's third stage: the house style over the recipe before anything
 * is stored, so it lands in the library already in the household's voice.
 * Save creates it: restyled, with the author's words kept for Restore, or as
 * the author wrote it when nothing was taken.
 */
export function ImportStyle({ draft, imageUrl, file, onBack, onCancel }: ImportStyleProps) {
  const navigate = useNavigate();
  const mutate = useMutate();
  const checked = useMemo(() => validateDraft(draft), [draft]);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const guard = useImportGuard(true);

  const cancel = (
    <Button type="button" variant="ghost" intent="neutral" onClick={() => setConfirmingCancel(true)}>
      Cancel
    </Button>
  );
  const confirm = (
    <>
      {confirmingCancel && <DiscardImportDialog onStay={() => setConfirmingCancel(false)} onDiscard={onCancel} />}
      {guard.dialog}
    </>
  );

  if (!checked.ok) {
    return (
      <>
        <Message intent="warning" title="This import needs a fix first" data-testid="import-style-invalid">
          {Object.values(checked.errors)[0] ?? "Something in the recipe is not valid."} Fix it on Check, then come back to the style.
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" intent="neutral" onClick={onBack}>
              Back to Check
            </Button>
            <Button type="button" size="sm" variant="ghost" intent="neutral" onClick={() => setConfirmingCancel(true)}>
              Cancel
            </Button>
          </div>
        </Message>
        {confirm}
      </>
    );
  }
  const doc = checked.data;

  const save = async (parts: RestyledPart[] | null) => {
    // A failed picture does not fail the save: the recipe is stored either way and the notice says so.
    const image: { error: string | null } = { error: null };
    const saved = await mutate(async () => {
      const recipe = parts === null ? await createRecipe({ data: doc }) : await createRestyledRecipe({ data: { doc, parts: forSaving(parts) } });
      try {
        const picture = file ?? (imageUrl ? await imageFromUrl(imageUrl) : null);
        if (picture) await uploadRecipeImage(recipe.id, picture);
      } catch (cause) {
        image.error = messageFrom(cause);
      }
      return recipe;
    });
    toast(saveNotice({ existing: false, imageError: image.error }));
    guard.release();
    await navigate({ to: "/recipes/$slug", params: { slug: saved.slug } });
  };

  return (
    <>
      <StyleSpace
        parts={doc.parts}
        run={(ruleIds) => restyleDraft({ data: { doc, ruleIds } })}
        onSave={save}
        saveLabel="Save recipe"
        skipLabel="Skip, save as written"
        secondary={
          <>
            {cancel}
            <Button type="button" variant="outline" intent="neutral" onClick={onBack}>
              Back
            </Button>
          </>
        }
      />
      {confirm}
    </>
  );
}
