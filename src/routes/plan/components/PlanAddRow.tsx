import { SearchInput } from "@sixthshift/design-system/search-input";
import { useEffect, useRef, useState } from "react";
import { GLOBAL_SEARCH_DEBOUNCE_MS } from "../../../components/shell/GlobalSearch";
import { SearchResultList } from "../../../components/shell/SearchResultList";
import { dayLabel } from "../../../domain/plan";
import type { RecipeSummary } from "../../../domain/recipe";
import { notifyError } from "../../../lib/notify";
import { clampSelection, nextSearchIndex, selectedResult } from "../../../lib/search";
import { PlanSearchResult } from "./PlanSearchResult";

/**
 * The day's add row. Typing searches recipes (debounced, the same pause the
 * global search uses) and the results list is that dialog's; Enter takes the
 * highlighted recipe when there is one, and the typed line otherwise, which is
 * how a day gets "leftovers". Arrow keys move the highlight.
 */
export function PlanAddRow({
  date,
  busy = false,
  searchRecipes,
  onAddText,
  onAddRecipe,
}: {
  date: string;
  busy?: boolean;
  searchRecipes?: (query: string) => Promise<RecipeSummary[]>;
  onAddText: (date: string, text: string) => void;
  onAddRecipe: (date: string, recipe: RecipeSummary) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecipeSummary[]>([]);
  const [selected, setSelected] = useState(0);
  const requestId = useRef(0);

  const clear = () => {
    setQuery("");
    setResults([]);
    setSelected(0);
  };

  useEffect(() => {
    const term = query.trim();
    if (searchRecipes === undefined || term === "") {
      setResults([]);
      return;
    }
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      void searchRecipes(term)
        .then((found) => {
          if (requestId.current !== id) return;
          setResults(found);
          setSelected((current) => clampSelection(current, found.length));
        })
        .catch((error: unknown) => {
          if (requestId.current !== id) return;
          setResults([]);
          notifyError("Search failed", error);
        });
    }, GLOBAL_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, searchRecipes]);

  const choose = (index: number) => {
    const recipe = selectedResult(results, index);
    if (recipe === null) return;
    onAddRecipe(date, recipe);
    clear();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const recipe = selectedResult(results, selected);
      if (recipe !== null) {
        choose(selected);
        return;
      }
      const line = query.trim();
      if (line === "") return;
      onAddText(date, line);
      clear();
      return;
    }
    const next = nextSearchIndex(selected, results.length, event.key);
    if (next === null) return;
    event.preventDefault();
    setSelected(next);
  };

  return (
    <div className="flex flex-col gap-1" onKeyDown={onKeyDown} data-testid="plan-add">
      <SearchInput
        value={query}
        onChange={setQuery}
        disabled={busy}
        name="entry"
        placeholder="Add a recipe or a line"
        aria-label={`Add to ${dayLabel(date)}`}
        enterKeyHint="done"
      />
      {results.length > 0 && (
        <SearchResultList
          results={results}
          selected={selected}
          onSelect={setSelected}
          onChoose={choose}
          label={`Recipes for ${dayLabel(date)}`}
          renderResult={(recipe) => <PlanSearchResult recipe={recipe} />}
        />
      )}
    </div>
  );
}
