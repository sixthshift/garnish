import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { useEffect, useRef, useState } from "react";
import { GLOBAL_SEARCH_DEBOUNCE_MS } from "../../../components/shell/GlobalSearch";
import { SearchResultList } from "../../../components/shell/SearchResultList";
import { dayName, type Meal } from "../../../domain/plan";
import type { RecipeSummary } from "../../../domain/recipe";
import { clampSelection, nextSearchIndex, selectedResult } from "../../../lib/search";
import { toastError } from "../../../lib/toast";
import { MealPicker } from "./MealPicker";
import { PlanSearchResult } from "./PlanSearchResult";

/**
 * How many results are drawn. With a phone's keyboard up the sheet shows about
 * 500px, and the note row has to stay in sight under the results whatever was
 * typed; a longer list is narrowed by typing, as the hint under it says.
 */
export const PLAN_RESULT_LIMIT = 4;

/**
 * What the add sheet holds for one day, top to bottom: the meal chips, the
 * search box, its results directly under it, and the typed line as an entry of
 * its own. The chips sit above the box rather than between it and its results,
 * where the old per-day row had them; naming a meal is optional and none is
 * pressed to begin with, so an entry added the way it always was still lands
 * with `meal: null`.
 *
 * Typing searches recipes (debounced, the same pause the global search uses).
 * Enter takes the highlighted recipe when there is one and the typed line
 * otherwise; arrow keys move the highlight. The line is also a button ("Add
 * “leftovers” as a note"), so a phone with no Enter in sight still gets one.
 * Every add is one entry: `onDone` follows it, and the sheet closes on it.
 */
export function PlanAddForm({
  date,
  busy = false,
  searchRecipes,
  onAddText,
  onAddRecipe,
  onDone,
}: {
  date: string;
  busy?: boolean;
  searchRecipes?: (query: string) => Promise<RecipeSummary[]>;
  onAddText: (date: string, text: string, meal: Meal | null) => void;
  onAddRecipe: (date: string, recipe: RecipeSummary, meal: Meal | null) => void;
  /** An entry was added. */
  onDone?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecipeSummary[]>([]);
  const [selected, setSelected] = useState(0);
  const [meal, setMeal] = useState<Meal | null>(null);
  const requestId = useRef(0);
  const input = useRef<HTMLInputElement | null>(null);
  const line = query.trim();
  const day = dayName(date);
  const shown = results.slice(0, PLAN_RESULT_LIMIT);
  const more = results.length - shown.length;

  const clear = () => {
    setQuery("");
    setResults([]);
    setSelected(0);
    setMeal(null);
  };

  // The box takes focus two frames after the sheet opens rather than through
  // `autoFocus`: the sheet's focus manager records what held focus when it
  // mounted, to hand it back on close, and an autofocused box got there first,
  // so closing the sheet left focus on the page body instead of the day's "+".
  // Two frames because the manager moves focus to its first control in a frame
  // of its own, which would otherwise land after this one.
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => input.current?.focus());
    });
    return () => cancelAnimationFrame(frame);
  }, []);

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
          setSelected((current) => clampSelection(current, Math.min(found.length, PLAN_RESULT_LIMIT)));
        })
        .catch((error: unknown) => {
          if (requestId.current !== id) return;
          setResults([]);
          toastError("Search failed", error);
        });
    }, GLOBAL_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, searchRecipes]);

  const choose = (index: number) => {
    const recipe = selectedResult(shown, index);
    if (recipe === null) return;
    onAddRecipe(date, recipe, meal);
    clear();
    onDone?.();
  };

  const addLine = () => {
    if (line === "") return;
    onAddText(date, line, meal);
    clear();
    onDone?.();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (selectedResult(shown, selected) !== null) choose(selected);
      else addLine();
      return;
    }
    const next = nextSearchIndex(selected, shown.length, event.key);
    if (next === null) return;
    event.preventDefault();
    setSelected(next);
  };

  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="plan-add">
      <MealPicker value={meal} onChange={setMeal} disabled={busy} label={`Meal for ${day}`} />
      <SearchInput
        ref={input}
        value={query}
        onValueChange={setQuery}
        onKeyDown={onKeyDown}
        disabled={busy}
        name="entry"
        placeholder="Search recipes, or type a note"
        aria-label="Search recipes, or type a note"
        enterKeyHint="done"
      />
      {shown.length > 0 && (
        <SearchResultList
          results={shown}
          selected={selected}
          onSelect={setSelected}
          onChoose={choose}
          label={`Recipes for ${day}`}
          renderResult={(recipe) => <PlanSearchResult recipe={recipe} />}
        />
      )}
      {line === "" ? (
        <Muted as="p" className="text-sm">
          A recipe, or a note of its own like “leftovers” or “out”.
        </Muted>
      ) : (
        // A plain line is the answer whenever nothing above is the meal, so it
        // stays on offer under the results rather than only when they are empty.
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} className="justify-start" data-testid="plan-add-line" onClick={addLine}>
          <span className="min-w-0 truncate">Add “{line}” as a note</span>
        </Button>
      )}
      {more > 0 && (
        <Muted as="p" className="text-sm" data-testid="plan-add-more">
          {more === 1 ? "1 more recipe matches" : `${more} more recipes match`}: keep typing to narrow them.
        </Muted>
      )}
    </div>
  );
}
