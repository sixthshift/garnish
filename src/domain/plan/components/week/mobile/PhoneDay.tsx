import { Badge } from "@sixthshift/design-system/badge";
import { Caption } from "@sixthshift/design-system/caption";
import { cn } from "@sixthshift/design-system/utils";
import { dayName, type PlanDay } from "../../../plan";
import type { PlanWeekViewProps } from "../PlanWeekView";
import { PhoneEntry } from "./PhoneEntry";

/** The id a day's section carries, for the header's day buttons to bring it up. */
export function phoneDayId(date: string): string {
  return `plan-day-${date}`;
}

/**
 * One day on a phone's plan: its name, Today or "eaten" (a day gone by with
 * something on it), then its entries as cards. A day still to come with
 * nothing on it is one dashed "+ Add to Tuesday", the size of a card, so the
 * gaps in a week are what stands out; a day with entries, or one gone by, has
 * a small "+ Add" beside its name instead, so a meal can still be recorded
 * after the event.
 *
 * `scroll-mt-40` leaves the sticky header's room above a day the header's
 * buttons or the page's opening bring up.
 */
export function PhoneDay({
  day,
  allDays,
  today,
  busy,
  minutes,
  onAdd,
  onMove,
  onRemove,
}: {
  day: PlanDay;
  /** Every day on the page, both weeks: an entry's menu moves it to any of them. */
  allDays: readonly PlanDay[];
  today: string;
  busy: boolean;
  /** Recipes' total times by id, when the shelf has them. */
  minutes: ReadonlyMap<string, number | null>;
  /** "+ Add" was pressed: open this day's add sheet. */
  onAdd: (date: string) => void;
} & Pick<PlanWeekViewProps, "onMove" | "onRemove">) {
  const marked = day.date === today;
  const past = day.date < today;
  const empty = day.entries.length === 0;
  const name = dayName(day.date);
  const weekday = name.split(" ")[0] ?? name;
  const headingId = `${phoneDayId(day.date)}-name`;

  return (
    <section
      id={phoneDayId(day.date)}
      aria-labelledby={headingId}
      data-testid="plan-day"
      data-date={day.date}
      data-today={marked ? "true" : "false"}
      className="flex scroll-mt-40 flex-col gap-2"
    >
      <div className="flex min-h-8 items-center gap-2">
        <h2 id={headingId} className={cn("font-semibold text-[15px] text-fg-normal", past && "text-fg-subtle")}>
          {/* "Tuesday 10", as the day buttons say it; the month is in the header's span. */}
          {name.split(" ").slice(0, 2).join(" ")}
        </h2>
        {marked && (
          <Badge variant="soft" intent="neutral" data-testid="plan-today">
            Today
          </Badge>
        )}
        {past && !empty && <Caption>eaten</Caption>}
        {(!empty || past) && (
          <button
            type="button"
            aria-label={`Add to ${name}`}
            className="ml-auto rounded-md px-2 py-1.5 font-semibold text-fg-brand text-sm hover:bg-bg-subtle-hovered"
            onClick={() => onAdd(day.date)}
          >
            + Add
          </button>
        )}
      </div>

      {!empty && (
        <ul className="flex flex-col gap-2" aria-label={`Planned for ${name}`}>
          {day.entries.map((entry, index) => (
            <li key={entry.id}>
              <PhoneEntry
                entry={entry}
                index={index}
                day={day}
                allDays={allDays}
                busy={busy}
                past={past}
                minutes={entry.recipe === null ? null : (minutes.get(entry.recipe.id) ?? null)}
                onMove={onMove}
                onRemove={onRemove}
              />
            </li>
          ))}
        </ul>
      )}

      {empty && !past && (
        <button
          type="button"
          aria-label={`Add to ${name}`}
          data-testid="plan-day-empty"
          className="w-full rounded-xl border-[1.5px] border-border-normal border-dashed p-3.5 font-medium text-fg-subtle text-sm hover:bg-bg-subtle-hovered"
          onClick={() => onAdd(day.date)}
        >
          + Add to {weekday}
        </button>
      )}
      {empty && past && (
        <p className="text-fg-subtle text-sm" data-testid="plan-day-empty">
          <span aria-hidden="true">—</span>
          <span className="sr-only">Nothing planned</span>
        </p>
      )}
    </section>
  );
}
