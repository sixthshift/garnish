import { Card } from "@sixthshift/design-system/card";
import { Muted } from "@sixthshift/design-system/muted";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Page, PageHeader } from "../../../components/shell/Page";
import { addDays, type Meal, type PlanDay, type PlanEntry, todayIso, weekLabel } from "../../../domain/plan";
import type { RecipeSummary } from "../../../domain/recipe";
import { AddWeekToShoppingButton } from "./AddWeekToShoppingButton";
import { PlanAddSheet } from "./PlanAddSheet";
import { PlanDayRow } from "./PlanDayRow";
import { ProposeButton } from "./ProposeButton";

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
  /** A model is configured, so a week can be proposed. Off: no Propose button at all. */
  plannerAvailable?: boolean;
};

/**
 * The week itself, writes injected. Rendered by the route and by the tests.
 *
 * One list at every width (decisions.md row 141): the title and the week's
 * arrows on one line, then the seven days as rows of one card, then the
 * week's own actions — adding it to the shopping list, and Propose when a
 * model is configured — after the days they act on.
 */
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
}: PlanWeekViewProps) {
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
        <div>
          <AddWeekToShoppingButton monday={monday} />
        </div>
        {plannerAvailable && (
          <div className="flex flex-col items-start gap-1">
            <ProposeButton monday={monday} today={today} />
            <Muted as="p" className="text-sm">
              Suggests recipes for the days and meals you choose, from your planner guide. Nothing is added until you accept it.
            </Muted>
          </div>
        )}
      </div>

      {adding !== null && (
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
