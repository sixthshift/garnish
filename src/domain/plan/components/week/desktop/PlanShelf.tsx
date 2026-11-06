import { Caption } from "@sixthshift/design-system/caption";
import { Muted } from "@sixthshift/design-system/muted";
import { Spinner } from "@sixthshift/design-system/spinner";
import { type TabItem, Tabs } from "@sixthshift/design-system/tabs";
import { useState } from "react";
import { recipeImageUrl } from "../../../../../lib/images";
import { formatDuration } from "../../../../recipes/ingredient";
import type { RecipeSummary } from "../../../../recipes/recipe";
import { dayName, type Meal } from "../../../plan";
import { PlanAddForm } from "../PlanAddForm";
import type { PlanWeekViewProps } from "../PlanWeekView";
import { emptyShelfLine, madeAgo, openingTab, SHELF_TABS, type ShelfTab, shelfTab } from "../shelf";
import type { BoardDrag } from "./PlanBoard";

/** How many recipes the shelf's search draws: no keyboard over it, and the tabs below wait while it runs. */
export const SHELF_RESULT_LIMIT = 8;

/**
 * A desktop's shelf beside the board (decisions.md row 207): which day it adds
 * to, the search that takes a recipe or a plain note (the add sheet's own
 * form), and the recipes to browse in four tabs. A recipe clicked goes on the
 * chosen day; one dragged goes on whichever day it is dropped on. While a
 * search is typed its results stand in for the tabs.
 */
export function PlanShelf({
  date,
  focus,
  busy,
  today,
  recipes,
  searchRecipes,
  onAddText,
  onAddRecipe,
  onDragStart,
  onDragEnd,
}: {
  date: string;
  /** Take focus to the search: a day was just chosen. */
  focus: boolean;
  busy: boolean;
  today: string;
  /** Every recipe, or null while they load. Left out, the shelf is its search alone. */
  recipes?: readonly RecipeSummary[] | null;
  onDragStart: (drag: BoardDrag) => void;
  onDragEnd: () => void;
} & Pick<PlanWeekViewProps, "searchRecipes" | "onAddText" | "onAddRecipe">) {
  const [chosen, setTab] = useState<ShelfTab | null>(null);
  const tab = chosen ?? openingTab(recipes);
  // The form's own query and meal, mirrored for the tabs: the form starts afresh on each day chosen, and so do these.
  const [typed, setTyped] = useState({ date, query: "", meal: null as Meal | null });
  const current = typed.date === date ? typed : { date, query: "", meal: null };
  const searching = current.query.trim() !== "";
  const day = dayName(date);

  const card = (recipe: RecipeSummary) => (
    <ShelfCard
      key={recipe.id}
      recipe={recipe}
      today={today}
      day={day}
      busy={busy}
      onAdd={() => onAddRecipe(date, recipe, current.meal)}
      onDragStart={() => onDragStart({ kind: "recipe", recipe, meal: current.meal })}
      onDragEnd={onDragEnd}
    />
  );

  const items: TabItem[] = SHELF_TABS.map(({ value, label }) => {
    const shelf = recipes ? shelfTab(recipes, value) : [];
    return {
      value,
      label,
      content:
        recipes === null ? (
          <div className="flex justify-center py-6">
            <Spinner aria-label="Loading recipes" />
          </div>
        ) : shelf.length === 0 ? (
          <Muted as="p" className="py-4 text-sm">
            {emptyShelfLine(value)}
          </Muted>
        ) : (
          <ul className="flex flex-col gap-1" aria-label={`${label} recipes`}>
            {shelf.map(card)}
          </ul>
        ),
    };
  });

  return (
    <section
      aria-labelledby="plan-shelf"
      className="sticky top-[var(--top-bar)] flex h-[calc(100dvh-var(--top-bar))] min-h-0 flex-col gap-3 border-border-subtle border-l bg-bg-normal p-5"
      data-testid="plan-picker"
    >
      <div className="rounded-lg bg-bg-subtle-pressed px-3 py-2.5">
        <Caption aria-hidden="true" className="font-medium uppercase tracking-wider">
          Adding to
        </Caption>
        <h2 id="plan-shelf" className="font-semibold text-fg-normal text-lg">
          <span className="sr-only">Adding to </span>
          {day}
        </h2>
        <Caption>Click a recipe, or drag one onto any day.</Caption>
      </div>
      <PlanAddForm
        key={date}
        date={date}
        busy={busy}
        autoFocus={focus}
        limit={SHELF_RESULT_LIMIT}
        searchRecipes={searchRecipes}
        onAddText={onAddText}
        onAddRecipe={onAddRecipe}
        onQueryChange={(query) => setTyped((was) => (was.date === date ? { ...was, query } : { date, query, meal: null }))}
        onMealChange={(meal) => setTyped((was) => (was.date === date ? { ...was, meal } : { date, query: "", meal }))}
      />
      {!searching && recipes !== undefined && (
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1" data-testid="plan-shelf">
          <Tabs items={items} value={tab} onValueChange={(value) => setTab(value as ShelfTab)}>
            <Tabs.List className="sticky top-0 z-10 bg-bg-normal" />
            <Tabs.Panels />
          </Tabs>
        </div>
      )}
    </section>
  );
}

/** One recipe on the shelf: a button that adds it to the chosen day, and a card that drags onto any. */
function ShelfCard({
  recipe,
  today,
  day,
  busy,
  onAdd,
  onDragStart,
  onDragEnd,
}: {
  recipe: RecipeSummary;
  today: string;
  day: string;
  busy: boolean;
  onAdd: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const image = recipeImageUrl(recipe.image);
  const meta = [recipe.totalTime !== null ? formatDuration(recipe.totalTime) : null, madeAgo(recipe.lastMade, today)].filter(Boolean).join(" · ");
  return (
    <li>
      <button
        type="button"
        draggable={!busy}
        disabled={busy}
        aria-label={`Add ${recipe.name} to ${day}`}
        data-testid="plan-shelf-card"
        onClick={onAdd}
        onDragStart={(event) => {
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "copy";
            event.dataTransfer.setData("text/plain", recipe.name);
          }
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        className="flex w-full cursor-grab items-center gap-3 rounded-lg border border-transparent p-1.5 text-left hover:border-border-subtle hover:bg-bg-subtle-hovered disabled:cursor-default disabled:opacity-60"
      >
        {image === null ? (
          <span aria-hidden="true" className="size-12 shrink-0 rounded-md bg-bg-subtle" />
        ) : (
          <img src={image} alt="" loading="lazy" draggable={false} className="size-12 shrink-0 rounded-md object-cover" />
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium text-sm">{recipe.name}</span>
          <span className="truncate text-fg-subtle text-xs">{meta}</span>
        </span>
        <span aria-hidden="true" className="pr-1.5 text-fg-subtle tracking-[-0.3em]">
          ⋮⋮
        </span>
      </button>
    </li>
  );
}
