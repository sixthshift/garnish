import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Page, PageHeader } from "../../../../components/Page";
import { useLayout } from "../../../../lib/useLayout";
import type { RecipeSummary } from "../../../recipes/recipe";
import { addDays, type Meal, type PlanDay, type PlanEntry, todayIso, weekLabel } from "../../plan";
import { AddWeekToShoppingButton } from "./AddWeekToShoppingButton";
import { PlanBoard } from "./desktop/PlanBoard";
import { PlanAddSheet } from "./mobile/PlanAddSheet";
import { PlanDayRow } from "./PlanDayRow";
import { WeekArrow } from "./WeekArrow";

export type PlanWeekViewProps = {
  monday: string;
  days: readonly PlanDay[];
  /** The week after `monday`'s, which a desktop's board shows beneath it. Left out, the board shows the one week. */
  nextDays?: readonly PlanDay[];
  /** Today's date, injected so a render test does not move with the clock. */
  today?: string;
  /** A plain line was added from a day's sheet. `meal` is null unless a chip was pressed. */
  onAddText: (date: string, text: string, meal: Meal | null) => void;
  /** A recipe was picked from a day's sheet, with the chip pressed at the time. */
  onAddRecipe: (date: string, recipe: RecipeSummary, meal: Meal | null) => void;
  /** An entry was dragged, or moved from its row menu, to `date` at `position`. */
  onMove: (entry: PlanEntry, date: string, position: number) => void;
  onRemove: (entry: PlanEntry) => void;
  /** Feeds the add sheet's search. Left out, the sheet still takes a plain line. */
  searchRecipes?: (query: string) => Promise<RecipeSummary[]>;
  /** Every recipe, for a desktop's shelf. Left out, the shelf has its search and no tabs to browse. */
  shelfRecipes?: () => Promise<RecipeSummary[]>;
  /** A write is in flight: every control is disabled, as the other pages do. */
  busy?: boolean;
};

/**
 * The week itself, writes injected. Rendered by the route and by the tests.
 *
 * On a phone, one list (decisions.md row 141): the title and the week's
 * arrows on one line, then the seven days as rows of one card, then the
 * week's own actions — Plan the week (which asks the planner first when a
 * model is configured, decisions.md row 194) and adding it to the shopping
 * list — after the days they act on. A day's "+" opens its add sheet.
 *
 * On a desktop, a board (decisions.md row 207): this week and the next side
 * by side with a shelf of recipes to click or drag onto a day.
 */
export function PlanWeekView(props: PlanWeekViewProps) {
  const desktop = useLayout() === "desktop";
  return desktop ? <PlanBoard {...props} /> : <PlanWeekList {...props} />;
}

/** A phone's week: one list, a sheet per day's "+". */
function PlanWeekList({ monday, days, today = todayIso(), onAddText, onAddRecipe, onMove, onRemove, searchRecipes, busy = false }: PlanWeekViewProps) {
  const [adding, setAdding] = useState<string | null>(null);

  return (
    <Page width="focus">
      <PageHeader
        title="Plan"
        actions={
          <div className="flex items-center gap-1">
            <WeekArrow monday={addDays(monday, -7)} label="Previous week" glyph="‹" />
            <p className="min-w-0 px-1 text-center font-medium text-sm sm:min-w-40" data-testid="plan-week-label">
              {weekLabel(monday)}
            </p>
            <WeekArrow monday={addDays(monday, 7)} label="Next week" glyph="›" />
          </div>
        }
      />

      {/* No overflow-hidden: an entry's menu drops down inside the card, not in a portal. The first and last day round their own tint instead. */}
      <Card className="p-0">
        <ol className="flex flex-col divide-y divide-border-subtle" data-testid="plan-week" aria-label={`Week of ${weekLabel(monday)}`}>
          {days.map((day) => (
            <PlanDayRow key={day.date} day={day} days={days} today={today} busy={busy} onAdd={setAdding} onMove={onMove} onRemove={onRemove} />
          ))}
        </ol>
      </Card>

      <div className="flex flex-col gap-3" data-testid="plan-week-actions">
        <div className="flex flex-wrap gap-2">
          {/* The week's empty nights, filled from the rotation and the weekend recipes (decisions.md row 192). Gone once the week is over. */}
          {addDays(monday, 6) >= today && (
            <Button asChild variant="outline" intent="neutral" size="sm">
              <Link to="/plan/fill" search={{ week: monday }}>
                Plan the week
              </Link>
            </Button>
          )}
          <AddWeekToShoppingButton monday={monday} />
        </div>
      </div>

      {adding !== null && (
        <PlanAddSheet date={adding} busy={busy} onClose={() => setAdding(null)} searchRecipes={searchRecipes} onAddText={onAddText} onAddRecipe={onAddRecipe} />
      )}
    </Page>
  );
}
