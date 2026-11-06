import type { ReactNode } from "react";
import type { RecipeDraft } from "../../../draft";
import { ImportCheckCard, type ImportCheckProps, type ImportCheckState } from "../ImportCheck";
import { EditorWithPreview } from "./EditorWithPreview";
import { LineSourceProvider } from "./LineSource";
import { LinesToCheck } from "./LinesToCheck";

export type PhoneEditorProps = {
  /** The form's own fields: the head, the parts, the notes, the details. */
  children: ReactNode;
  draft: RecipeDraft;
  initial: RecipeDraft;
  file: File | null;
  importedImageUrl?: string | null;
  importCheck?: ImportCheckProps;
  check: ImportCheckState | null;
};

/**
 * The editor's body on a phone (decisions.md row 208): Edit | Preview at the
 * top, and on an import's Check what the read says, then the lines to look at
 * first, each opening in a sheet beside the page it came from.
 */
export function PhoneEditor({ children, draft, initial, file, importedImageUrl, importCheck, check }: PhoneEditorProps) {
  const body = (
    <EditorWithPreview draft={draft} file={file} importedImageUrl={importedImageUrl}>
      {importCheck !== undefined && check !== null && (
        <>
          <ImportCheckCard draft={draft} check={importCheck} state={check} />
          <LinesToCheck draft={draft} check={check} />
        </>
      )}
      {children}
    </EditorWithPreview>
  );
  if (importCheck === undefined || check === null) return body;
  return (
    <LineSourceProvider draft={draft} initial={initial} sourceText={importCheck.sourceText} check={check}>
      {body}
    </LineSourceProvider>
  );
}
