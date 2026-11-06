import { Button } from "@sixthshift/design-system/button";
import { Caption } from "@sixthshift/design-system/caption";
import { Heading } from "@sixthshift/design-system/heading";
import { ProgressBar } from "@sixthshift/design-system/progress-bar";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { addDays, type PlanDay, type PlanEntry, weekLabel, weekMonday } from "../../../plan";
import { AddWeekToShoppingButton } from "../AddWeekToShoppingButton";
import { BoardDay } from "./BoardDay";
import type { BoardDayHandlers } from "./PlanBoard";

/** What a week on the board is called: this week, next week and last week by those names, any other by its dates. Pure. */
export function boardWeekTitle(monday: string, today: string): string {
  const current = weekMonday(undefined, today);
  if (monday === current) return "This week";
  if (monday === addDays(current, 7)) return "Next week";
  if (monday === addDays(current, -7)) return "Last week";
  return `Week of ${weekLabel(monday)}`;
}

/**
 * One week of the board: its name, its dates and how many of its nights have
 * something on them, with the week's own actions on the same line, then the
 * seven days. The days are columns once the board has about 1280px (the
 * board's container, `@7xl`), and rows under that, where seven columns would
 * leave a recipe's name a word wide.
 */
export function BoardWeek({
  monday,
  days,
  allDays,
  today,
  busy,
  minutes,
  onMove,
  onRemove,
  ...handlers
}: {
  monday: string;
  days: readonly PlanDay[];
  /** Both weeks' days, for an entry's Move to. */
  allDays: readonly PlanDay[];
  today: string;
  busy: boolean;
  minutes: ReadonlyMap<string, number | null>;
  onMove: (entry: PlanEntry, date: string, position: number) => void;
  onRemove: (entry: PlanEntry) => void;
} & BoardDayHandlers) {
  const id = useId();
  const title = boardWeekTitle(monday, today);
  const planned = days.filter((day) => day.entries.length > 0).length;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3" data-testid="plan-board-week" data-monday={monday}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Heading as="h2" id={id} className="text-xl">
          {title}
        </Heading>
        <Caption>
          {title.startsWith("Week of") ? "" : `${weekLabel(monday)} · `}
          {planned} of 7 nights
        </Caption>
        {/* The ink and the track cook mode's bar uses: a count of nights is not the page's action, so no brand (design-language rule 5). */}
        <ProgressBar
          completed={planned}
          total={7}
          showFraction={false}
          label={`${title}: nights planned`}
          className="w-28 [--progress-bar-fill-bg:var(--fg-normal)] [--progress-bar-track-bg:var(--border-normal)]"
        />
        <div className="ml-auto flex flex-wrap gap-2">
          {/* The week's empty nights, filled from the rotation and the weekend recipes (decisions.md row 192). Gone once the week is over. */}
          {addDays(monday, 6) >= today && (
            <Button asChild variant="outline" intent="neutral" size="sm">
              <Link to="/plan/fill" search={{ week: monday }}>
                Plan the week
              </Link>
            </Button>
          )}
          <AddWeekToShoppingButton monday={monday} label="Add to shopping" />
        </div>
      </div>
      <ol className="grid grid-cols-1 gap-2 @7xl:grid-cols-7 @7xl:gap-2.5" aria-label={`Week of ${weekLabel(monday)}`} data-testid="plan-week">
        {days.map((day) => (
          <BoardDay key={day.date} day={day} allDays={allDays} today={today} busy={busy} minutes={minutes} onMove={onMove} onRemove={onRemove} {...handlers} />
        ))}
      </ol>
    </section>
  );
}
