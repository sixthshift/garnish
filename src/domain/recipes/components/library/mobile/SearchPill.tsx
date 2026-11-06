import { SearchInput } from "@sixthshift/design-system/search-input";

/** Sliders: the filters. Drawn here, the one place that shows it. */
function FiltersIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="17" x2="20" y2="17" />
      <circle cx="9" cy="7" r="2.25" fill="var(--color-bg-normal)" />
      <circle cx="15" cy="17" r="2.25" fill="var(--color-bg-normal)" />
    </svg>
  );
}

export type SearchPillProps = {
  query: string;
  onQueryChange: (query: string) => void;
  /** Enter: the address takes the text now rather than after the pause. */
  onSubmit: () => void;
  /** How many recipes there are to search, for the placeholder. */
  total: number;
  /** How many filters are set, shown on the button. */
  filterCount: number;
  onOpenFilters: () => void;
};

/**
 * A phone's search, held at the foot of the screen just above the tab bar
 * where the thumb is (decisions.md row 208), with the filters as a round
 * button beside it carrying how many are set. Sticky rather than fixed, so at
 * the end of the list it settles under the last card instead of over it.
 */
export function SearchPill({ query, onQueryChange, onSubmit, total, filterCount, onOpenFilters }: SearchPillProps) {
  return (
    <div className="sticky bottom-[calc(var(--app-bar)+0.75rem)] z-content-sticky flex items-center gap-2" data-testid="search-pill" data-print="hide">
      <search className="min-w-0 flex-1">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <SearchInput
            value={query}
            onValueChange={onQueryChange}
            placeholder={total === 1 ? "Search 1 recipe" : `Search ${total} recipes`}
            aria-label="Search recipes"
            name="q"
            enterKeyHint="search"
            className="h-12 text-base [&_input]:rounded-full [&_input]:border-border-strong [&_input]:shadow-lg"
          />
        </form>
      </search>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={filterCount > 0 ? `Filters, ${filterCount} set` : "Filters"}
        onClick={onOpenFilters}
        className="relative grid size-12 shrink-0 cursor-pointer place-items-center rounded-full border border-border-strong bg-bg-normal text-fg-normal shadow-lg hover:bg-bg-normal-hovered focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
      >
        <FiltersIcon />
        {filterCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-bg-brand px-1 text-[11px] font-semibold text-fg-on-brand tabular-nums"
          >
            {filterCount}
          </span>
        )}
      </button>
    </div>
  );
}
