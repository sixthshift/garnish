import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { dayParts, entryLabel, type PlanDay, weekLabel } from "../../../plan/plan";
import { Tile, tileLinkClass } from "./Tile";

/**
 * Next week's seven nights in small slots, filled or dashed, so how much of
 * it is planned shows at a glance. Read-only: planning is Plan's.
 */
export function NextWeekTile({ monday, days }: { monday: string; days: readonly PlanDay[] }) {
  return (
    <Tile
      id="next-week"
      title={`Next week · ${weekLabel(monday)}`}
      className="col-span-2 row-span-2"
      action={
        <Link to="/plan" search={{ week: monday }} className={tileLinkClass}>
          Open the plan
        </Link>
      }
    >
      <ul className="grid flex-1 grid-cols-7 gap-2">
        {days.map((day) => {
          const label = day.entries.map(entryLabel).join(", ");
          return (
            <li
              key={day.date}
              className={cn(
                "flex min-w-0 flex-col justify-between gap-1 rounded-lg px-2 py-1.5 text-xs",
                label === "" ? "border-[1.5px] border-dashed border-border-normal text-fg-subtle" : "bg-bg-brand-subtle text-fg-normal"
              )}
            >
              <span className="font-semibold uppercase tracking-wider text-fg-subtle">{dayParts(day.date).weekday}</span>
              <span className="line-clamp-2 leading-snug">{label === "" ? "—" : label}</span>
            </li>
          );
        })}
      </ul>
    </Tile>
  );
}

/**
 * The weekend's call to plan next week, as a brand tile: shown only when the
 * page asks (the weekend, next week empty), and then the page's one brand
 * fill (rule 5).
 */
export function PlanNextWeekTile({ monday }: { monday: string }) {
  return (
    <section aria-labelledby="plan-now" className="row-span-2 flex min-w-0 flex-col justify-between gap-3 rounded-2xl bg-bg-brand p-5 text-fg-on-brand">
      <div className="flex flex-col gap-1">
        <h2 id="plan-now" className="font-display text-xl font-semibold">
          Next week isn't planned yet
        </h2>
        <p className="opacity-85">Weeknights from the rotation, then something for the weekend.</p>
      </div>
      <Link
        to="/plan/fill"
        search={{ week: monday }}
        className="inline-flex min-h-10 items-center self-start rounded-lg bg-bg-normal px-4 text-sm font-medium text-fg-brand hover:bg-bg-normal-hovered"
      >
        Plan next week
      </Link>
    </section>
  );
}
