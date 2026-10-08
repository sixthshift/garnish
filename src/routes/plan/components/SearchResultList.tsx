import type { ReactNode } from "react";
import type { RecipeSummary } from "../../../domain/recipe";

/** The id of the option at `index` in the list `listId`: what the input's `aria-activedescendant` names. */
export const resultOptionId = (listId: string, index: number) => `${listId}-option-${index}`;

type SearchResultListProps = {
  /** The listbox's id: the input's `aria-controls`, and the stem of each option's id. */
  id: string;
  results: readonly RecipeSummary[];
  /** The highlighted index. Out of range highlights nothing. */
  selected: number;
  onSelect: (index: number) => void;
  /** A result was clicked: it is picked, as Enter on the highlighted one picks it. */
  onChoose: (index: number) => void;
  /** What one result looks like. */
  renderResult: (recipe: RecipeSummary) => ReactNode;
  /** Names the listbox. */
  label: string;
};

/**
 * The results of a recipe search: a `listbox` of `option`s, the highlighted
 * one ringed, moving the pointer over a row moving the highlight. The plan
 * add sheet's results. The keyboard itself stays with the caller, because the
 * key handler belongs on whatever input has focus (`nextSearchIndex` in
 * src/lib/search.ts is its rule); that input is the list's combobox, pointing
 * at the highlighted option with `aria-activedescendant` (`resultOptionId`).
 */
export function SearchResultList({ id, results, selected, onSelect, onChoose, renderResult, label }: SearchResultListProps) {
  return (
    <div id={id} className="flex flex-col gap-2" role="listbox" aria-label={label}>
      {results.map((recipe, index) => (
        // biome-ignore lint/a11y/useKeyWithClickEvents: focus stays on the caller's search input, which owns the keyboard (see the doc comment); an option can never receive a key event.
        <div
          key={recipe.id}
          id={resultOptionId(id, index)}
          role="option"
          tabIndex={-1}
          aria-selected={index === selected}
          data-selected={index === selected}
          className={index === selected ? "rounded-xl ring-2 ring-border-brand" : "rounded-xl"}
          // Moved over, not entered: a result that appears under a resting
          // pointer as the list fills in must not take the highlight, or Enter
          // would add a recipe nobody pointed at (critique #15c).
          onMouseMove={() => index !== selected && onSelect(index)}
          onClick={() => onChoose(index)}
        >
          {renderResult(recipe)}
        </div>
      ))}
    </div>
  );
}
