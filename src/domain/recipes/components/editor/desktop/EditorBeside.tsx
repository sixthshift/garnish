import { Muted } from "@sixthshift/design-system/muted";
import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { cn } from "@sixthshift/design-system/utils";
import { type ReactNode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { indexSource, linkSource, type RecipeDraft } from "../../../draft";
import { DraftPreview, usePictureUrl } from "../DraftPreview";
import { SourceView } from "./SourceView";

/** From here a desktop has the width for the source and the preview both, beside the editor, rather than a toggle between them. */
export const THREE_COLUMNS_MEDIA = "(min-width: 1900px)";

export type EditorBesideProps = {
  /** The editor itself, on the left. */
  children: ReactNode;
  /** The draft as it stands, redrawn in the preview as it changes. */
  draft: RecipeDraft;
  /** The draft as the form opened on it: for an import, the read as it was handed to Check. */
  initial: RecipeDraft;
  /** A picked or fetched picture, not yet stored. */
  file: File | null;
  /** The import's picture, shown until its file arrives. */
  importedImageUrl?: string | null;
  /** What the import read, as text; absent outside an import, or for a file. */
  sourceText?: string;
};

type View = "source" | "preview";

/** Whether the window is wide enough for a third column, followed as it is resized. */
function useThreeColumns(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const media = window.matchMedia(THREE_COLUMNS_MEDIA);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => typeof window.matchMedia === "function" && window.matchMedia(THREE_COLUMNS_MEDIA).matches,
    () => false
  );
}

/** The draft row an event happened in, by the `data-row-id` the editor's ingredient and step rows carry. */
function rowOf(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>("[data-row-id]")?.dataset.rowId ?? null;
}

/**
 * The editor on a desktop (decisions.md row 207): the form on the left, and
 * beside it the recipe as it will be saved, redrawn as it is typed. On an
 * import's Check that has the text it read, the right also holds that text,
 * behind a Preview / Source toggle, or as a third column where the window is
 * wide enough; pointing at an ingredient or a step in the form lights the
 * line it was made from. The form scrolls with the page and the columns
 * beside it stay in view, each scrolling on its own.
 */
export function EditorBeside({ children, draft, initial, file, importedImageUrl, sourceText }: EditorBesideProps) {
  const three = useThreeColumns();
  const [view, setView] = useState<View>("source");
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const image = usePictureUrl(file, draft.image, importedImageUrl);

  const hasSource = sourceText !== undefined && sourceText.trim() !== "";
  // Indexed once: the text is fixed for the life of Check, the draft is not.
  const indexed = useMemo(() => (hasSource ? indexSource(sourceText) : null), [hasSource, sourceText]);
  const lines = useMemo(() => (indexed === null ? null : linkSource(indexed, initial, draft)), [indexed, initial, draft]);
  const lit = hovered ?? focused;

  // Watched, not handled: the editor's rows are pointed at and focused as ever, and the source only follows.
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = editor.current;
    if (element === null) return;
    const over = (event: Event) => setHovered(rowOf(event.target));
    const leave = () => setHovered(null);
    const focus = (event: Event) => setFocused(rowOf(event.target));
    const blur = () => setFocused(null);
    element.addEventListener("pointerover", over);
    element.addEventListener("pointerleave", leave);
    element.addEventListener("focusin", focus);
    element.addEventListener("focusout", blur);
    return () => {
      element.removeEventListener("pointerover", over);
      element.removeEventListener("pointerleave", leave);
      element.removeEventListener("focusin", focus);
      element.removeEventListener("focusout", blur);
    };
  }, []);

  const preview = <DraftPreview draft={draft} image={image} />;
  const source = lines === null ? null : <SourceView lines={lines} lit={lit} />;
  const pane = "sticky top-[calc(var(--top-bar)+1rem)] flex h-[calc(100dvh-var(--top-bar)-2rem)] min-w-0 flex-col gap-3 rounded-2xl bg-bg-subtle p-4";
  const body = "-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-4";
  const label = (text: string) => (
    <Muted as="p" className="text-center text-xs font-medium uppercase tracking-wide">
      {text}
    </Muted>
  );

  return (
    <div
      className={cn(
        "grid items-start gap-8",
        source !== null && three ? "grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]" : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      )}
      data-testid="editor-beside"
    >
      <div className="min-w-0" ref={editor}>
        {children}
      </div>

      {source !== null && three && (
        <aside className={pane} aria-label="What the import read">
          {label("Source · what the import read")}
          <div className={body}>{source}</div>
        </aside>
      )}

      <aside className={pane} aria-label={source !== null && !three ? "Preview and source" : "Preview"}>
        {source !== null && !three ? (
          <ToggleGroup
            type="single"
            appearance="segmented"
            variant="outline"
            size="sm"
            aria-label="Beside the editor"
            options={[
              { value: "source", label: "Source" },
              { value: "preview", label: "Preview" },
            ]}
            value={view}
            onValueChange={(value) => {
              if (value === "source" || value === "preview") setView(value);
            }}
            className="self-center"
          />
        ) : (
          label("Preview · as it will be saved")
        )}
        <div className={body}>{source !== null && !three && view === "source" ? source : preview}</div>
      </aside>
    </div>
  );
}
