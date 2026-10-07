import { ModalBody, ModalHeader } from "@sixthshift/design-system/modal";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { type KeyboardEvent, useEffect, useRef } from "react";
import type { RecipeSummary } from "../../domain/recipe";
import { nextSearchIndex } from "../../lib/search";
import { SearchResultList } from "./SearchResultList";

export type GlobalSearchContentProps = {
  query: string;
  onQueryChange: (value: string) => void;
  results: RecipeSummary[];
  /** True while a search for the current query is in flight. */
  loading?: boolean;
  selected: number;
  onSelect: (index: number) => void;
  onOpen: (index: number) => void;
};

/** The dialog's body: the search box and its results. Renders anywhere — used directly by the render test. */
export function GlobalSearchContent({ query, onQueryChange, results, loading = false, selected, onSelect, onOpen }: GlobalSearchContentProps) {
  const input = useRef<HTMLInputElement | null>(null);

  // The box takes focus two frames after the dialog opens rather than through
  // `autoFocus`, as the plan's add sheet does: the dialog's focus manager
  // records what held focus when it mounted, to hand it back on close, and an
  // autofocused box got there first, so closing left focus on the page body
  // instead of where "/" was pressed. Two frames because the manager moves
  // focus to its first control in a frame of its own.
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => input.current?.focus());
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onOpen(selected);
      return;
    }
    const next = nextSearchIndex(selected, results.length, event.key);
    if (next === null) return;
    event.preventDefault();
    onSelect(next);
  };

  return (
    <>
      <ModalHeader>Search recipes</ModalHeader>
      <ModalBody>
        {/* pt-1: the box is the body's first thing, and the body's scroll clipped the top of its focus ring. */}
        <div className="flex flex-col gap-3 pt-1">
          <SearchInput
            ref={input}
            value={query}
            onValueChange={onQueryChange}
            onKeyDown={onKeyDown}
            placeholder="Search recipes"
            aria-label="Search recipes"
            name="q"
          />
          {results.length === 0 ? (
            <p className="py-6 text-center text-sm text-fg-subtle">
              {loading ? "Searching…" : query.trim() === "" ? "Start typing to search." : "No recipes match."}
            </p>
          ) : (
            <SearchResultList results={results} selected={selected} onSelect={onSelect} />
          )}
        </div>
      </ModalBody>
    </>
  );
}
