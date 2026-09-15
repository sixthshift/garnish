import { Heading } from "@sixthshift/design-system/heading";
import { Link } from "@tanstack/react-router";
import { addDays, type PlanDay, type PlanEntry, todayIso, weekLabel } from "../../../domain/plan";
import type { RecipeSummary } from "../../../domain/recipe";
import { AddWeekToShoppingButton } from "./AddWeekToShoppingButton";
import { PlanDayColumn } from "./PlanDayColumn";

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
export function PlanWeekView({ monday, days, today = todayIso(), onAddText, onAddRecipe, onMove, onRemove, searchRecipes, busy = false }: PlanWeekViewProps) {
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
