import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { Caption } from "@sixthshift/design-system/caption";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { cn } from "@sixthshift/design-system/utils";
import { PlusIcon } from "../../../components/ui/icons";
import { ReorderList } from "../../../components/ui/ReorderList";
import { dayName, dayParts, isToday, type PlanDay, reorderMove } from "../../../domain/plan";
import { PlanEntryRow } from "./PlanEntryRow";
import type { PlanWeekViewProps } from "./PlanWeekView";

/** The lists sharing a cross-day drag. One group for the whole week. */
const DRAG_GROUP = "plan-week";

/**
 * One day of the week's list: the weekday and date on the left, one "+" on the
 * right that opens the day's add sheet, and the day's entries beneath as rows.
 * A row inside the week's one card rather than a card of its own (rule 2: a
 * sequence of rows inside a container is not a card each), and no form: the
 * search and the meal chips the day used to repeat seven times live in the
 * sheet the "+" opens, so a week of empty days reads as seven short lines.
 *
 * Today takes a neutral tint across its row and says "Today" in words, so it
 * is found at a glance without the brand colour (rule 5), and without the
 * colour alone carrying it. The tint is `bg-subtle-hovered`: a step darker
 * than the card in light and a step lighter in dark, so in neither mode does
 * the row read as sunk below the card (decision 139).
 */
export function PlanDayRow({
  day,
  days,
  today,
  busy,
  onAdd,
  onMove,
  onRemove,
}: {
  day: PlanDay;
  days: readonly PlanDay[];
  today: string;
  busy: boolean;
  /** The "+" was pressed: open this day's add sheet. */
  onAdd: (date: string) => void;
} & Pick<PlanWeekViewProps, "onMove" | "onRemove">) {
  const marked = isToday(day.date, today);
  const { weekday, day: dayOfMonth } = dayParts(day.date);
  const empty = day.entries.length === 0;
  return (
    // A grid so the "+" can span both lines of an empty day (its date and the
    // dash) and keep to the first line of a day with entries, which then run
    // the full width beneath it: a phone's entry row already holds a handle, a
    // picture, the name, the meal and a menu.
    <li
      data-testid="plan-day"
      data-date={day.date}
      data-today={marked ? "true" : "false"}
      aria-current={marked ? "date" : undefined}
      className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-start py-1 pr-1 pl-4 first:rounded-t-xl last:rounded-b-xl", marked && "bg-bg-subtle-hovered")}
    >
      <h2 className="col-start-1 row-start-1 flex min-w-0 items-baseline gap-1.5 pt-2.5">
        <SectionTitle as="span" className={cn(marked && "text-fg-normal")}>
          {weekday}
        </SectionTitle>
        <Caption className={cn(marked && "font-medium text-fg-normal")}>{dayOfMonth}</Caption>
        {marked && (
          <Badge variant="soft" intent="muted" className="ml-1 self-center" data-testid="plan-today">
            Today
          </Badge>
        )}
      </h2>
      {/* Never disabled by a write in flight, unlike the rest of the page: an
          add closes the sheet and starts its write in one render, and focus
          has to come back to this button, which it cannot do to a disabled
          one. The sheet's own controls wait for the write instead. */}
      <Button
        type="button"
        variant="ghost"
        intent="neutral"
        iconOnly
        aria-label={`Add to ${dayName(day.date)}`}
        className={cn("col-start-2 row-start-1 h-11 w-11", empty && "row-span-2 self-center")}
        onClick={() => onAdd(day.date)}
      >
        <PlusIcon />
      </Button>

      {/* Rendered even when empty: it is the drop target for a row dragged from
          another day, and an empty <ol> has no height of its own. The dash sits
          over it, so an empty day costs one short line and still takes a drop. */}
      <div className={cn("relative row-start-2", empty ? "col-start-1 pb-1.5" : "col-span-2 pr-3 pb-1")}>
        {empty && (
          <>
            <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 text-fg-subtle text-sm leading-5" data-testid="plan-day-empty">
              —
            </span>
            <span className="sr-only">Nothing planned</span>
          </>
        )}
        <ReorderList
          items={day.entries}
          keyOf={(entry) => entry.id}
          itemName="entry"
          narrow="row"
          className={cn("gap-1", empty && "min-h-5")}
          group={DRAG_GROUP}
          listKey={day.date}
          onReorder={(next) => {
            const move = reorderMove(
              day.entries.map((entry) => entry.id),
              next.map((entry) => entry.id)
            );
            if (move === null) return;
            const moved = day.entries.find((entry) => entry.id === move.id);
            if (moved !== undefined) onMove(moved, day.date, move.position);
          }}
          onMoveOut={(entry, _from, toList, toIndex) => onMove(entry, toList, toIndex)}
          renderItem={(entry, _index, reorder) => <PlanEntryRow entry={entry} days={days} busy={busy} onMove={onMove} onRemove={onRemove} reorder={reorder} />}
        />
      </div>
    </li>
  );
}
