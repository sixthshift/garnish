import { Heading } from "@sixthshift/design-system/heading";
import { useMemo, useState } from "react";
import type { RecipeSummary } from "../../../../recipes/recipe";
import { addDays, type Meal, nextMonday, type PlanDay, type PlanEntry, rangeLabel, todayIso } from "../../../plan";
import type { PlanWeekViewProps } from "../PlanWeekView";
import { useShelfRecipes } from "../shelf";
import { WeekArrow } from "../WeekArrow";
import { BoardWeek } from "./BoardWeek";
import { PlanShelf } from "./PlanShelf";

/** What is being dragged across the board: an entry from a day, or a recipe off the shelf. */
export type BoardDrag = { kind: "entry"; entry: PlanEntry } | { kind: "recipe"; recipe: RecipeSummary; meal: Meal | null };

/** What a day needs to take part in the board's drag and its choosing. */
export type BoardDayHandlers = {
  /** The day the shelf adds to. */
  chosen: string;
  onChoose: (date: string) => void;
  dragging: BoardDrag | null;
  onDragStart: (drag: BoardDrag) => void;
  onDragEnd: () => void;
  /** Something was dropped on `date`, before the entry at `index` or, with none, at the end. */
  onDrop: (date: string, index: number | null) => void;
};

/**
 * Where an entry dropped before the `index`th entry of `day` lands, as the
 * plan's move counts it (the day's entries without the one moved), or null
 * when it would land where it already is. Pure.
 */
export function dropPosition(day: PlanDay, entry: PlanEntry, index: number | null): number | null {
  const at = index ?? day.entries.length;
  const from = day.entries.findIndex((other) => other.id === entry.id);
  if (from === -1) return at;
  const position = from < at ? at - 1 : at;
  return position === from ? null : position;
}

/**
 * A desktop's plan (decisions.md row 207): the chosen week and the one after
 * it as a board, each day a column from about 1280px of board and a row under
 * it, beside a shelf of recipes to click into the chosen day or drag onto any.
 * Entries drag between days, both weeks alike. The arrows still move a week at
 * a time, so last week's second row is this week's first.
 *
 * The shelf adds to the day chosen, which a day's drop target chooses: today
 * when it is on the board, else the first Monday, as the picker did (row 206).
 */
export function PlanBoard({
  monday,
  days,
  nextDays,
  today = todayIso(),
  onAddText,
  onAddRecipe,
  onMove,
  onRemove,
  searchRecipes,
  shelfRecipes,
  busy = false,
}: PlanWeekViewProps) {
  const weeks = useMemo(
    () => [{ monday, days }, ...(nextDays !== undefined ? [{ monday: nextMonday(monday), days: nextDays }] : [])],
    [monday, days, nextDays]
  );
  const allDays = useMemo(() => weeks.flatMap((week) => week.days), [weeks]);

  const [adding, setAdding] = useState<string | null>(null);
  // Whether the chosen day was chosen just now, by a click: then the shelf's search takes focus, but not as the page opens.
  const [focus, setFocus] = useState(false);
  const onBoard = (date: string) => allDays.some((day) => day.date === date);
  const chosen = adding !== null && onBoard(adding) ? adding : onBoard(today) ? today : monday;

  const [dragging, setDragging] = useState<BoardDrag | null>(null);

  // The shelf's recipes, read once as the board opens. A plan's writes do not change them.
  const recipes = useShelfRecipes(shelfRecipes);
  // The plan carries a recipe's name and picture, not its time: the shelf's copy has it.
  const minutes = useMemo(() => new Map((recipes ?? []).map((recipe) => [recipe.id, recipe.totalTime])), [recipes]);

  const choose = (date: string) => {
    setAdding(date);
    setFocus(true);
  };

  const drop = (date: string, index: number | null) => {
    const drag = dragging;
    setDragging(null);
    if (drag === null || busy) return;
    if (drag.kind === "recipe") {
      onAddRecipe(date, drag.recipe, drag.meal);
      return;
    }
    const day = allDays.find((one) => one.date === date);
    if (day === undefined) return;
    const position = dropPosition(day, drag.entry, index);
    if (position !== null) onMove(drag.entry, date, position);
  };

  const handlers: BoardDayHandlers = {
    chosen,
    onChoose: choose,
    dragging,
    onDragStart: setDragging,
    onDragEnd: () => setDragging(null),
    onDrop: drop,
  };

  const last = weeks[weeks.length - 1]?.monday ?? monday;
  return (
    // The shelf holds still beside the board as the board scrolls with the page, filling the window under the top bar.
    <div className="grid min-h-[calc(100dvh-var(--top-bar))] grid-cols-[minmax(0,1fr)_22.5rem]" data-testid="plan-board">
      <div className="@container flex min-w-0 flex-col gap-8 px-8 pt-6 pb-12">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-page-header="">
          <Heading as="h1">Plan</Heading>
          <div className="ml-auto flex items-center gap-1">
            <WeekArrow monday={addDays(monday, -7)} label="Previous week" glyph="‹" />
            <p className="min-w-44 px-1 text-center font-medium text-sm" data-testid="plan-week-label">
              {rangeLabel(monday, addDays(last, 6))}
            </p>
            <WeekArrow monday={addDays(monday, 7)} label="Next week" glyph="›" />
          </div>
        </div>
        {weeks.map((week) => (
          <BoardWeek
            key={week.monday}
            monday={week.monday}
            days={week.days}
            allDays={allDays}
            today={today}
            busy={busy}
            minutes={minutes}
            onMove={onMove}
            onRemove={onRemove}
            {...handlers}
          />
        ))}
      </div>
      <PlanShelf
        date={chosen}
        focus={focus}
        busy={busy}
        today={today}
        recipes={recipes}
        searchRecipes={searchRecipes}
        onAddText={onAddText}
        onAddRecipe={onAddRecipe}
        onDragStart={setDragging}
        onDragEnd={() => setDragging(null)}
      />
    </div>
  );
}
