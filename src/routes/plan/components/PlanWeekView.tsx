import { Link } from "@tanstack/react-router";
import { Page, PageHeader } from "../../../components/shell/Page";
import { addDays, type Meal, type PlanDay, type PlanEntry, todayIso, weekLabel } from "../../../domain/plan";
import type { PlannerMeal } from "../../../domain/planner";
import type { RecipeSummary } from "../../../domain/recipe";
import { AddWeekToShoppingButton } from "./AddWeekToShoppingButton";
import { PlanDayRow } from "./PlanDayRow";
import { ProposeButton } from "./ProposeButton";

export type PlanWeekViewProps = {
  monday: string;
  days: readonly PlanDay[];
  /** Today's date, injected so a render test does not move with the clock. */
  today?: string;
  /** A plain line was typed and Enter pressed on text that matched nothing. `meal` is null unless a chip was pressed. */
  onAddText: (date: string, text: string, meal: Meal | null) => void;
  /** A recipe was picked from the add row's results, with the chip pressed at the time. */
  onAddRecipe: (date: string, recipe: RecipeSummary, meal: Meal | null) => void;
  /** An entry was dragged, or moved from its row menu, to `date` at `position`. */
  onMove: (entry: PlanEntry, date: string, position: number) => void;
  onRemove: (entry: PlanEntry) => void;
  /** Feeds the add row. Left out, the add row still takes a plain line. */
  searchRecipes?: (query: string) => Promise<RecipeSummary[]>;
  /** A write is in flight: every control is disabled, as the other pages do. */
  busy?: boolean;
  /** A model is configured, so a week can be proposed. Off: no Propose button at all. */
  plannerAvailable?: boolean;
  /** The three meals as Settings holds them; the proposal plans for the ones that are on. */
  plannerMeals?: readonly PlannerMeal[];
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
  plannerAvailable = false,
  plannerMeals = [],
}: PlanWeekViewProps) {
  return (
    <Page width="focus">
      <PageHeader
        title="Plan"
        actions={
          <>
            {plannerAvailable && <ProposeButton monday={monday} meals={plannerMeals} today={today} />}
            <AddWeekToShoppingButton monday={monday} />
            <div className="flex items-center gap-2">
              <WeekArrow monday={addDays(monday, -7)} label="Previous week" glyph="‹" />
              <p className="min-w-40 text-center font-medium text-sm" data-testid="plan-week-label">
                {weekLabel(monday)}
              </p>
              <WeekArrow monday={addDays(monday, 7)} label="Next week" glyph="›" />
            </div>
          </>
        }
      />

      <div className="flex flex-col gap-2" data-testid="plan-week">
        {days.map((day) => (
          <PlanDayRow
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
    </Page>
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
      className="flex h-9 w-9 items-center justify-center rounded-md border border-border-normal text-fg-normal hover:bg-bg-subtle-hovered"
    >
      <span aria-hidden="true">{glyph}</span>
    </Link>
  );
}
