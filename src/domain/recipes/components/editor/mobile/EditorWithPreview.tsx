import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { type ReactNode, useState } from "react";
import type { RecipeDraft } from "../../../draft";
import { DraftPreview, usePictureUrl } from "../DraftPreview";

export type EditorWithPreviewProps = {
  /** The form's fields, hidden rather than unmounted while the preview shows, so a half-typed box keeps its words. */
  children: ReactNode;
  draft: RecipeDraft;
  file: File | null;
  importedImageUrl?: string | null;
};

/**
 * The editor on a phone (decisions.md row 208): the form, and behind an Edit |
 * Preview switch at its top the recipe as it will be saved. The phone's
 * counterpart of a desktop's preview beside the form (desktop/EditorBeside);
 * the preview is the same drawing, narrowed.
 */
export function EditorWithPreview({ children, draft, file, importedImageUrl }: EditorWithPreviewProps) {
  const [view, setView] = useState<"edit" | "preview">("edit");
  const image = usePictureUrl(file, draft.image, importedImageUrl);
  return (
    <>
      <ToggleGroup
        type="single"
        appearance="segmented"
        variant="outline"
        size="sm"
        aria-label="Edit or preview"
        options={[
          { value: "edit", label: "Edit" },
          { value: "preview", label: "Preview" },
        ]}
        value={view}
        onValueChange={(value) => {
          if (value === "edit" || value === "preview") setView(value);
        }}
        className="self-center"
      />
      <div className="flex flex-col gap-6" hidden={view === "preview"}>
        {children}
      </div>
      {view === "preview" && <DraftPreview draft={draft} image={image} />}
    </>
  );
}
