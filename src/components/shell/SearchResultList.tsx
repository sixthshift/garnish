import type { ReactNode } from "react";
import type { RecipeSummary } from "../../domain/recipe";
import { RecipeCard } from "../recipe/RecipeCard";

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
 * dialog and the meal plan's add row, which differ only in
 * what a row draws and whether clicking one opens or picks it. The keyboard
 * itself stays with the caller, because the key handler belongs on whatever
 * input has focus (`nextSearchIndex` in src/lib/search.ts is the rule both
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
    <div className="flex flex-col gap-2" role="listbox" aria-label={label}>
      {results.map((recipe, index) => (
        // biome-ignore lint/a11y/useKeyWithClickEvents: focus stays on the caller's search input, which owns the keyboard (see the doc comment); an option can never receive a key event.
        <div
          key={recipe.id}
          role="option"
          tabIndex={-1}
          aria-selected={index === selected}
          data-selected={index === selected}
          className={index === selected ? "rounded-xl ring-2 ring-border-brand" : "rounded-xl"}
          onMouseEnter={() => onSelect(index)}
          onClick={onChoose === undefined ? undefined : () => onChoose(index)}
        >
          {renderResult(recipe)}
        </div>
      ))}
    </div>
  );
}
