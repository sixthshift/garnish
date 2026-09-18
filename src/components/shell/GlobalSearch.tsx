import { Modal } from "@sixthshift/design-system/modal";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { RecipeSummary } from "../../domain/recipe";
import { clampSelection, type SearchEventTarget, selectedResult, shouldOpenGlobalSearch } from "../../lib/search";
import { toastError } from "../../lib/toast";
import { listRecipes } from "../../server/fns/recipes";
import { GlobalSearchContent } from "./GlobalSearchContent";

/** How long typing pauses before the search runs. */
export const GLOBAL_SEARCH_DEBOUNCE_MS = 200;

/** Mounted once, app-wide (`src/routes/root.tsx`), inside the overlay provider. */
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: href is the trigger, not a value the effect reads — it is what makes a navigation close the dialog.
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
          toastError("Search failed", error);
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
      <GlobalSearchContent
        query={query}
        onQueryChange={setQuery}
        results={results}
        loading={loading}
        selected={selected}
        onSelect={setSelected}
        onOpen={openResult}
      />
    </Modal>
  );
}
