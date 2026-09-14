// Global search (M12.5): "/" outside a form control opens a search dialog
// from anywhere in the app. Built on `Modal` rather than juggling a second
// `Sheet` variant — Modal's own mobile behaviour is already a full-width
// slide-up from the bottom (read: a sheet), and a centred dialog from `md`
// up, which is exactly the phone/wide split the task asks for.
//
// `search-input` drives `listRecipes`'s existing `q` filter, debounced.
// Arrow keys move the highlighted result (`nextSearchIndex`, clamped rather
// than wrapping, and leaving Home/End and the arrow keys' usual meaning in
// the text input alone); Enter opens the highlighted one. A result is a `RecipeCard` in list
// mode, so a click also opens it and behaves exactly like the recipe list's
// own cards. Any navigation, whichever way it happens, closes the dialog:
// an effect watches the router's current location.
//
// `GlobalSearchContent` holds the dialog's body and is what the render test
// exercises directly — `Modal` never paints during a static server render
// (see ui/ConfirmDialog.tsx and FoodMergeDialog.tsx for the same split).
import { Modal, ModalBody, ModalHeader } from "@sixthshift/design-system/modal";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import type { RecipeSummary } from "../../domain/recipe/recipe";
import { clampSelection, nextSearchIndex, selectedResult, shouldOpenGlobalSearch, type SearchEventTarget } from "../../domain/list/search";
import { listRecipes } from "../../server/fns/recipes";
import { notifyError } from "../../lib/notify";
import { RecipeCard } from "../recipe/list/RecipeCard";

/** How long typing pauses before the search runs. */
export const GLOBAL_SEARCH_DEBOUNCE_MS = 200;

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

export type SearchResultListProps = {
  results: readonly RecipeSummary[];
  /** The highlighted index. Out of range highlights nothing. */
  selected: number;
  onSelect: (index: number) => void;
  /**
   * A result was clicked. The dialog leaves this out — its rows are
   * `RecipeCard`s, which are links and navigate on their own — while the meal
   * plan's add row sets it, because there a result is picked, not opened.
   */
  onChoose?: (index: number) => void;
  /** What one result looks like. Default: the recipe list's own card in list mode. */
  renderResult?: (recipe: RecipeSummary) => ReactNode;
  /** Names the listbox. Default "Search results". */
  label?: string;
};

/**
 * The results of a recipe search: a `listbox` of `option`s, the highlighted
 * one ringed, hovering a row moving the highlight. Shared by the global search
 * dialog (M12.5) and the meal plan's add row (M33.2), which differ only in
 * what a row draws and whether clicking one opens or picks it. The keyboard
 * itself stays with the caller, because the key handler belongs on whatever
 * input has focus (`nextSearchIndex` in src/domain/list/search.ts is the rule both
 * use).
 */
export function SearchResultList({
  results,
  selected,
  onSelect,
  onChoose,
  renderResult = (recipe) => <RecipeCard recipe={recipe} mode="list" />,
  label = "Search results",
}: SearchResultListProps) {
  return (
    <ul className="flex flex-col gap-2" role="listbox" aria-label={label}>
      {results.map((recipe, index) => (
        <li key={recipe.id} role="option" aria-selected={index === selected}>
          <div
            data-selected={index === selected}
            className={index === selected ? "rounded-xl ring-2 ring-border-brand" : "rounded-xl"}
            onMouseEnter={() => onSelect(index)}
            onClick={onChoose === undefined ? undefined : () => onChoose(index)}
          >
            {renderResult(recipe)}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The dialog's body: the search box and its results. Renders anywhere — used directly by the render test. */
export function GlobalSearchContent({ query, onQueryChange, results, loading = false, selected, onSelect, onOpen }: GlobalSearchContentProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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
        <div className="flex flex-col gap-3" onKeyDown={onKeyDown}>
          <SearchInput autoFocus value={query} onChange={onQueryChange} placeholder="Search recipes" aria-label="Search recipes" name="q" />
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

/** Mounted once, app-wide (`src/routes/__root.tsx`), alongside the Toaster. */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const navigate = useNavigate();
  const href = useRouterState({ select: (state) => state.location.href });
  const requestId = useRef(0);

  // "/" opens the dialog from anywhere, unless a form control already has it.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (!shouldOpenGlobalSearch(event, event.target as SearchEventTarget, open)) return;
      event.preventDefault();
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Any navigation — a result opened, a link followed elsewhere, back/forward — closes it.
  useEffect(() => {
    setOpen(false);
  }, [href]);

  // Closing clears the search so reopening starts fresh.
  useEffect(() => {
    if (open) return;
    setQuery("");
    setResults([]);
    setSelected(0);
    setLoading(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term === "") {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      void listRecipes({ data: { q: term } })
        .then((found) => {
          if (requestId.current !== id) return;
          setResults(found);
          setSelected((current) => clampSelection(current, found.length));
        })
        .catch((error: unknown) => {
          if (requestId.current !== id) return;
          setResults([]);
          notifyError("Search failed", error);
        })
        .finally(() => {
          if (requestId.current === id) setLoading(false);
        });
    }, GLOBAL_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, open]);

  if (!open) return null;

  const openResult = (index: number) => {
    const recipe = selectedResult(results, index);
    if (!recipe) return;
    void navigate({ to: "/recipes/$slug", params: { slug: recipe.slug } });
  };

  return (
    <Modal size="lg" aria-label="Search recipes" onOpenChange={(next) => !next && setOpen(false)}>
      <GlobalSearchContent query={query} onQueryChange={setQuery} results={results} loading={loading} selected={selected} onSelect={setSelected} onOpen={openResult} />
    </Modal>
  );
}
