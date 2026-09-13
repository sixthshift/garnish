// The meal plan (M33.2): one household plan, one week at a time, days rather
// than meals (decisions.md row 71).
//
// `?week=` is the Monday's date and the only state the page keeps in the URL,
// so the previous and next arrows are plain links and the loader re-runs on
// them like every other filtered read. A mid-week date normalises to its
// Monday (`weekMonday`), so a link from anywhere else in the app can name a
// day and still land on a whole week.
//
// Layout is the one the task asks for: seven columns from `md`, one vertical
// list of days below that, today marked. A day draws its entries as small
// cards and an add row that searches recipes as you type — the same result
// list the global search dialog uses (`SearchResultList`) — and, on text that
// matched nothing, adds a plain line on Enter ("leftovers").
//
// Adding a recipe copies the recipe's *name* into the entry's `text` as well
// as its id. The row keeps no other copy, and `recipe_id` goes null when a
// recipe is deleted; without the copied name that day would go blank a year
// later. `entryLabel` prefers the live recipe, so a rename still shows through.
//
// Entries move between days two ways: dragging, through `ReorderList`'s group
// drag (each day is a list in the `plan-week` group, and a row dropped on
// another day's list is reported once on release), and a row menu listing the
// other six days, which is the accessible path and the one that works on a
// phone. A drag inside one day is a reorder; `reorderMove` turns the whole
// rearranged array `ReorderList` hands back into the single move the
// repository takes.
//
// `PlanWeekView` takes its writes as callbacks and renders anywhere; the route
// component binds them to the server functions through `useMutate`, as
// `/shopping` does. That split is what the render tests exercise.
import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { SHOPPING_PATH } from "../components/AddToShoppingSheet";
import { GLOBAL_SEARCH_DEBOUNCE_MS, SearchResultList } from "../components/GlobalSearch";
import { Menu } from "../components/ui/Menu";
import { ReorderList } from "../components/ui/ReorderList";
import {
  addDays,
  dayLabel,
  entryLabel,
  isToday,
  reorderMove,
  servingsLabel,
  todayIso,
  weekLabel,
  weekMonday,
  type PlanDay,
  type PlanEntry,
} from "../domain/plan";
import type { RecipeSummary } from "../domain/recipe";
import { clampSelection, nextSearchIndex, selectedResult } from "../domain/search";
import { recipeImageUrl } from "../lib/images";
import { addedMessage } from "../lib/shopping";
import { useMutate } from "../lib/mutate";
import { notify, notifyError } from "../lib/notify";
import { addPlanEntry, addPlanWeekToShopping, listPlanWeek, movePlanEntry, removePlanEntry } from "../server/plan";
import { listRecipes } from "../server/recipes";

/** `?week=` is the Monday's date; anything else falls back to this week. */
export const PlanSearch = z.object({ week: z.string().optional() });

export type PlanWeekData = { monday: string; days: PlanDay[] };

/** The lists sharing a cross-day drag. One group for the whole week. */
const DRAG_GROUP = "plan-week";

/** Search recipes by name for the add row. The route's default; tests inject their own. */
export function searchPlanRecipes(query: string): Promise<RecipeSummary[]> {
  return listRecipes({ data: { q: query } });
}

export const Route = createFileRoute("/plan")({
  validateSearch: PlanSearch,
  loaderDeps: ({ search: { week } }) => ({ week }),
  loader: async ({ deps }): Promise<PlanWeekData> => {
    const monday = weekMonday(deps.week);
    return { monday, days: await listPlanWeek({ data: { monday } }) };
  },
  component: PlanPage,
});

export type PlanWeekViewProps = {
  monday: string;
  days: readonly PlanDay[];
  /** Today's date, injected so a render test does not move with the clock. */
  today?: string;
  /** A plain line was typed and Enter pressed on text that matched nothing. */
  onAddText: (date: string, text: string) => void;
  /** A recipe was picked from the add row's results. */
  onAddRecipe: (date: string, recipe: RecipeSummary) => void;
  /** An entry was dragged, or moved from its row menu, to `date` at `position`. */
  onMove: (entry: PlanEntry, date: string, position: number) => void;
  onRemove: (entry: PlanEntry) => void;
  /** Feeds the add row. Left out, the add row still takes a plain line. */
  searchRecipes?: (query: string) => Promise<RecipeSummary[]>;
  /** A write is in flight: every control is disabled, as the other pages do. */
  busy?: boolean;
};

/** The week itself, writes injected. Rendered by the route and by the tests. */
export function PlanWeekView({
  monday,
  days,
  today = todayIso(),
  onAddText,
  onAddRecipe,
  onMove,
  onRemove,
  searchRecipes,
  busy = false,
}: PlanWeekViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Heading as="h1">Plan</Heading>
          <AddWeekToShoppingButton monday={monday} />
        </div>
        <div className="flex items-center gap-2">
          <WeekArrow monday={addDays(monday, -7)} label="Previous week" glyph="‹" />
          <p className="min-w-40 text-center text-sm font-medium" data-testid="plan-week-label">
            {weekLabel(monday)}
          </p>
          <WeekArrow monday={addDays(monday, 7)} label="Next week" glyph="›" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-7" data-testid="plan-week">
        {days.map((day) => (
          <PlanDayColumn
            key={day.date}
            day={day}
            days={days}
            today={today}
            busy={busy}
            onAddText={onAddText}
            onAddRecipe={onAddRecipe}
            onMove={onMove}
            onRemove={onRemove}
            searchRecipes={searchRecipes}
          />
        ))}
      </div>
    </div>
  );
}

/** One of the two week arrows: a link, so the browser's back button walks the weeks. */
function WeekArrow({ monday, label, glyph }: { monday: string; label: string; glyph: string }) {
  return (
    <Link
      to="/plan"
      search={{ week: monday }}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-border-normal text-fg-normal hover:bg-bg-normal-hovered"
    >
      <span aria-hidden="true">{glyph}</span>
    </Link>
  );
}

/**
 * "Add this week to the shopping list" (M33.3): runs `addPlanWeekToShopping`
 * for `monday`'s week and toasts how many lines the list gained, with a way
 * to it — the same toast `AddToShoppingButton` raises for one recipe
 * (src/components/AddToShoppingSheet.tsx). Its own busy state, not the page's:
 * this is one self-contained write, not one of the entry writes the page
 * threads through `onAddText`/`onAddRecipe`/`onMove`/`onRemove`.
 */
function AddWeekToShoppingButton({ monday }: { monday: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      const { added } = await addPlanWeekToShopping({ data: { monday } });
      notify({
        intent: "success",
        title: addedMessage(added),
        action: { label: "View list", onSelect: () => void router.navigate({ to: SHOPPING_PATH }) },
      });
    } catch (error) {
      notifyError("Couldn't add the week to the shopping list", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      intent="neutral"
      size="sm"
      disabled={busy}
      data-testid="plan-add-week"
      onClick={() => void add()}
    >
      {busy ? "Adding…" : "Add this week to the shopping list"}
    </Button>
  );
}

/** One day: its heading, its entries as a reorderable list, and the add row. */
function PlanDayColumn({
  day,
  days,
  today,
  busy,
  onAddText,
  onAddRecipe,
  onMove,
  onRemove,
  searchRecipes,
}: {
  day: PlanDay;
  days: readonly PlanDay[];
  today: string;
  busy: boolean;
} & Pick<PlanWeekViewProps, "onAddText" | "onAddRecipe" | "onMove" | "onRemove" | "searchRecipes">) {
  const marked = isToday(day.date, today);
  return (
    <section
      aria-label={dayLabel(day.date)}
      data-testid="plan-day"
      data-date={day.date}
      data-today={marked ? "true" : "false"}
      className={
        marked
          ? "flex flex-col gap-2 rounded-lg border border-border-brand bg-bg-brand-subtle/30 p-2"
          : "flex flex-col gap-2 rounded-lg border border-border-subtle p-2"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <SectionTitle as="h2">{dayLabel(day.date)}</SectionTitle>
        {marked && (
          <Badge variant="soft" intent="brand">
            Today
          </Badge>
        )}
      </div>

      {day.entries.length === 0 && (
        <Muted as="p" className="px-1 py-2 text-sm" data-testid="plan-day-empty">
          Nothing planned
        </Muted>
      )}

      {/* Rendered even when empty: it is the drop target for a row dragged
          from another day, and an empty <ol> has no height of its own. */}
      <ReorderList
        items={day.entries}
        keyOf={(entry) => entry.id}
        itemName="entry"
        className="min-h-10 gap-1"
        group={DRAG_GROUP}
        listKey={day.date}
        onReorder={(next) => {
          const move = reorderMove(
            day.entries.map((entry) => entry.id),
            next.map((entry) => entry.id),
          );
          if (move === null) return;
          const moved = day.entries.find((entry) => entry.id === move.id);
          if (moved !== undefined) onMove(moved, day.date, move.position);
        }}
        onMoveOut={(entry, _from, toList, toIndex) => onMove(entry, toList, toIndex)}
        renderItem={(entry) => (
          <PlanEntryCard entry={entry} days={days} busy={busy} onMove={onMove} onRemove={onRemove} />
        )}
      />

      <PlanAddRow date={day.date} busy={busy} searchRecipes={searchRecipes} onAddText={onAddText} onAddRecipe={onAddRecipe} />
    </section>
  );
}

/** The picture on an entry card, or a placeholder square so the rows line up. */
function EntryImage({ src }: { src: string | null }) {
  const size = "h-9 w-9 shrink-0 rounded-md";
  return src === null ? (
    <div data-placeholder="image" aria-hidden="true" className={`${size} bg-bg-subtle`} />
  ) : (
    <img src={src} alt="" loading="lazy" className={`${size} object-cover`} />
  );
}

/**
 * One entry: the recipe's picture and name (a link to it) or the plain line,
 * its servings when they differ from the recipe's own, and the row menu that
 * moves it to another day or takes it off the plan.
 */
export function PlanEntryCard({
  entry,
  days,
  busy,
  onMove,
  onRemove,
}: {
  entry: PlanEntry;
  days: readonly PlanDay[];
  busy: boolean;
  onMove: (entry: PlanEntry, date: string, position: number) => void;
  onRemove: (entry: PlanEntry) => void;
}) {
  const label = entryLabel(entry);
  const serves = servingsLabel(entry.servings);
  return (
    <div
      className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-normal p-1"
      data-testid="plan-entry"
      data-kind={entry.recipe === null ? "text" : "recipe"}
    >
      {entry.recipe === null ? (
        <span className="min-w-0 flex-1 truncate py-1 text-sm">{label}</span>
      ) : (
        <Link to="/recipes/$slug" params={{ slug: entry.recipe.slug }} className="flex min-w-0 flex-1 items-center gap-2">
          <EntryImage src={recipeImageUrl(entry.recipe.image)} />
          <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
        </Link>
      )}
      {serves !== "" && (
        <Badge variant="soft" intent="muted" className="shrink-0">
          {serves}
        </Badge>
      )}
      <Menu iconOnly label={`Actions for ${label}`} className="shrink-0">
        {days
          .filter((day) => day.date !== entry.date)
          .map((day) => (
            <Menu.Item key={day.date} disabled={busy} onSelect={() => onMove(entry, day.date, day.entries.length)}>
              Move to {dayLabel(day.date)}
            </Menu.Item>
          ))}
        <Menu.Separator />
        <Menu.Item intent="danger" disabled={busy} onSelect={() => onRemove(entry)}>
          Remove
        </Menu.Item>
      </Menu>
    </div>
  );
}

/** One result in the add row: small, no link — clicking it plans the recipe rather than opening it. */
export function PlanSearchResult({ recipe }: { recipe: RecipeSummary }) {
  return (
    <div className="flex w-full cursor-pointer items-center gap-2 rounded-md p-1 text-left text-sm hover:bg-bg-normal-hovered" data-testid="plan-result">
      <EntryImage src={recipeImageUrl(recipe.image)} />
      <span className="min-w-0 flex-1 truncate">{recipe.name}</span>
    </div>
  );
}

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

/** The route's wiring: the loader's week in, the server functions out. */
function PlanPage() {
  const { monday, days } = Route.useLoaderData();
  const mutate = useMutate();
  const [busy, setBusy] = useState(false);

  const write = async (what: string, run: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await mutate(run);
    } catch (error) {
      notifyError(what, error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PlanWeekView
      monday={monday}
      days={days}
      busy={busy}
      searchRecipes={searchPlanRecipes}
      onAddText={(date, text) => void write("Couldn't add the line", () => addPlanEntry({ data: { date, text } }))}
      // The recipe's name travels with its id: the entry keeps reading as
      // something after the recipe is deleted and `recipe_id` goes null.
      onAddRecipe={(date, recipe) =>
        void write("Couldn't add the recipe", () => addPlanEntry({ data: { date, recipeId: recipe.id, text: recipe.name } }))
      }
      onMove={(entry, date, position) => void write("Couldn't move the entry", () => movePlanEntry({ data: { id: entry.id, date, position } }))}
      onRemove={(entry) => void write("Couldn't remove the entry", () => removePlanEntry({ data: { id: entry.id } }))}
    />
  );
}
