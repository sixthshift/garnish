import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";
import { toast } from "@sixthshift/design-system/overlay";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { type RecipeDraft, validateDraft } from "../../../../domain/draft";
import type { RestyledPart } from "../../../../domain/style";
import { messageFrom } from "../../../../lib/errors";
import { uploadRecipeImage } from "../../../../lib/images";
import { useMutate } from "../../../../lib/mutate";
import { createRestyledRecipe, restyleDraft } from "../../../../server/ai/restyle";
import { createRecipe } from "../../../../server/fns/recipes";
import { imageFromUrl } from "../../components/importedImage";
import { saveNotice } from "../../components/recipeFormText";
import { StyleSpace } from "../../components/style/StyleSpace";
import { forSaving } from "../../components/style/styleSession";

export type ImportStyleProps = {
  /** The import as the review left it, or as Edit details returned it. */
  draft: RecipeDraft;
  /** The page's picture, when the import found one. */
  imageUrl: string | null;
  /** A picture picked in Edit details, which wins over `imageUrl`. */
  file: File | null;
  onEditDetails: () => void;
};

/**
 * The import's third stage: the house style over the recipe before anything
 * is stored, so it lands in the library already in the household's voice.
 * Save creates it: restyled, with the author's words kept for Restore, or as
 * the author wrote it when nothing was taken.
 */
export function ImportStyle({ draft, imageUrl, file, onEditDetails }: ImportStyleProps) {
  const navigate = useNavigate();
  const mutate = useMutate();
  const checked = useMemo(() => validateDraft(draft), [draft]);

  if (!checked.ok) {
    return (
      <Message intent="warning" title="This import needs a fix first" data-testid="import-style-invalid">
        {Object.values(checked.errors)[0] ?? "Something in the recipe is not valid."} Fix it in the details, then come back to the style.
        <div className="mt-2">
          <Button type="button" size="sm" variant="outline" intent="neutral" onClick={onEditDetails}>
            Edit details
          </Button>
        </div>
      </Message>
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
    await navigate({ to: "/recipes/$slug", params: { slug: saved.slug } });
  };

  return (
    <StyleSpace
      parts={doc.parts}
      run={(ruleIds) => restyleDraft({ data: { doc, ruleIds } })}
      onSave={save}
      saveLabel="Save recipe"
      secondary={
        <Button type="button" variant="outline" intent="neutral" onClick={onEditDetails}>
          Edit details
        </Button>
      }
    />
  );
}
