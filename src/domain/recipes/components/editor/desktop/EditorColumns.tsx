import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { indexSource, linkSource, type RecipeDraft } from "../../../draft";
import { SCROLL_COLUMN } from "../../desktop/scrollColumn";
import { SourceView } from "./SourceView";

export type EditorColumnsProps = {
  /** The left column: the photo, the name, the times, the kind and what it is, the words, the tags, the source, the notes. */
  about: ReactNode;
  /** The middle column: every part's ingredients. */
  ingredients: ReactNode;
  /** The right column: every part's steps, and Add part. */
  method: ReactNode;
  /** The draft as it stands, for the source's lines to follow. */
  draft: RecipeDraft;
  /** The draft as the form opened on it: for an import, the read as it was handed to Check. */
  initial: RecipeDraft;
  /** What the import read, as text; absent outside an import, or for a file. */
  sourceText?: string;
};

/** The draft row an event happened in, by the `data-row-id` the editor's ingredient and step rows carry. */
function rowOf(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>("[data-row-id]")?.dataset.rowId ?? null;
}

/**
 * The editor on a desktop, in the recipe page's own three columns (decisions.md
 * row 211, replacing row 207's form beside a preview): what the recipe is down
 * the left, the ingredients in the middle, the method on the right, each
 * changed where the page shows it, so the editor is its own preview. Each
 * column scrolls on its own under the toolbar, and the ingredients stay beside
 * whichever step is being written. On an import's Check that has the text it
 * read, the right column turns between the method and that text; pointing at
 * an ingredient or a step lights the line it was made from.
 */
export function EditorColumns({ about, ingredients, method, draft, initial, sourceText }: EditorColumnsProps) {
  const [view, setView] = useState<"method" | "source">("method");
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  const hasSource = sourceText !== undefined && sourceText.trim() !== "";
  // Indexed once: the text is fixed for the life of Check, the draft is not.
  const indexed = useMemo(() => (hasSource ? indexSource(sourceText) : null), [hasSource, sourceText]);
  const lines = useMemo(() => (indexed === null ? null : linkSource(indexed, initial, draft)), [indexed, initial, draft]);
  const lit = hovered ?? focused;

  // Watched, not handled: the rows are pointed at and focused as ever, and the source only follows.
  const columns = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = columns.current;
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

  return (
    <div ref={columns} className="grid min-h-0 flex-1 grid-cols-[minmax(17rem,0.95fr)_minmax(16rem,0.8fr)_minmax(22rem,1.3fr)]" data-testid="editor-columns">
      <div className={`${SCROLL_COLUMN} border-r border-border-subtle bg-bg-normal`}>{about}</div>
      <div className={`${SCROLL_COLUMN} border-r border-border-subtle px-6 pt-6 pb-16`}>{ingredients}</div>
      <div className={`${SCROLL_COLUMN} flex flex-col gap-4 px-8 pt-6 pb-16`}>
        {lines !== null && (
          <ToggleGroup
            type="single"
            appearance="segmented"
            variant="outline"
            size="sm"
            aria-label="Method or what the import read"
            options={[
              { value: "method", label: "Method" },
              { value: "source", label: "What the import read" },
            ]}
            value={view}
            onValueChange={(value) => {
              if (value === "method" || value === "source") setView(value);
            }}
            className="self-start"
          />
        )}
        {/* Hidden rather than unmounted, so a half-typed step keeps its words while the source is read. */}
        <div hidden={lines !== null && view === "source"}>{method}</div>
        {lines !== null && view === "source" && (
          <aside aria-label="What the import read">
            <SourceView lines={lines} lit={lit} />
          </aside>
        )}
      </div>
    </div>
  );
}
