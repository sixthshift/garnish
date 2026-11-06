import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Page, PageHeader } from "../../../../components/Page";
import { useLayout } from "../../../../lib/useLayout";
import type { RecipeSummary } from "../../../recipes/recipe";
import { addDays, type Meal, type PlanDay, type PlanEntry, todayIso, weekLabel } from "../../plan";
import { AddWeekToShoppingButton } from "./AddWeekToShoppingButton";
import { PlanPicker } from "./desktop/PlanPicker";
import { PlanAddSheet } from "./mobile/PlanAddSheet";
import { PlanDayRow } from "./PlanDayRow";

export type PlanWeekViewProps = {
  monday: string;
  days: readonly PlanDay[];
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
  /** A write is in flight: every control is disabled, as the other pages do. */
  busy?: boolean;
};

/**
 * The week itself, writes injected. Rendered by the route and by the tests.
 *
 * One list at every width (decisions.md row 141): the title and the week's
 * arrows on one line, then the seven days as rows of one card, then the
 * week's own actions — Plan the week (which asks the planner first when a
 * model is configured, decisions.md row 194) and adding it to the shopping
 * list — after the days they act on.
 *
 * On a phone a day's "+" opens its add sheet; on a desktop the picker sits
 * beside the week and the "+" chooses the day it adds to (decisions.md row
 * 206), today's to begin with, or Monday's for another week.
 */
export function PlanWeekView({ monday, days, today = todayIso(), onAddText, onAddRecipe, onMove, onRemove, searchRecipes, busy = false }: PlanWeekViewProps) {
  const desktop = useLayout() === "desktop";
  const [adding, setAdding] = useState<string | null>(null);
  // Across the line, the day chosen for the picker is not a sheet to open on a phone: let it go as the layout changes.
  const [layoutSeen, setLayoutSeen] = useState(desktop);
  if (layoutSeen !== desktop) {
    setLayoutSeen(desktop);
    setAdding(null);
  }
  // A desktop's picker always has a day: the one chosen, else today in this week, else its Monday.
  const inWeek = days.some((day) => day.date === today);
  const picking = adding !== null && days.some((day) => day.date === adding) ? adding : inWeek ? today : monday;

  const week = (
    <>
      {/* No overflow-hidden: an entry's menu drops down inside the card, not in a portal. The first and last day round their own tint instead. */}
      <Card className="p-0">
        <ol className="flex flex-col divide-y divide-border-subtle" data-testid="plan-week" aria-label={`Week of ${weekLabel(monday)}`}>
          {days.map((day) => (
            <PlanDayRow
              key={day.date}
              day={day}
              days={days}
              today={today}
              busy={busy}
              onAdd={setAdding}
              onMove={onMove}
              onRemove={onRemove}
              chosen={desktop ? day.date === picking : undefined}
            />
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
    </>
  );

  return (
    <Page width={desktop ? "page" : "focus"}>
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

      {desktop ? (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] items-start gap-6">
          <div className="flex min-w-0 flex-col gap-6">{week}</div>
          <PlanPicker date={picking} focus={adding !== null} busy={busy} searchRecipes={searchRecipes} onAddText={onAddText} onAddRecipe={onAddRecipe} />
        </div>
      ) : (
        week
      )}

      {!desktop && adding !== null && (
        <PlanAddSheet date={adding} busy={busy} onClose={() => setAdding(null)} searchRecipes={searchRecipes} onAddText={onAddText} onAddRecipe={onAddRecipe} />
      )}
    </Page>
  );
}

/** One of the two week arrows: a link, so the browser's back button walks the weeks. 44px, a kitchen's finger. */
function WeekArrow({ monday, label, glyph }: { monday: string; label: string; glyph: string }) {
  return (
    <Link
      to="/plan"
      search={{ week: monday }}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border-normal text-fg-normal text-lg hover:bg-bg-subtle-hovered"
    >
      <span aria-hidden="true">{glyph}</span>
    </Link>
  );
}
