import { Badge } from "@sixthshift/design-system/badge";
import { Card } from "@sixthshift/design-system/card";
import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { dayParts, entryLabel, type PlanDay } from "../../../domain/plan";
import { GlanceHeader, glanceLinkClass } from "./GlanceHeader";

/**
 * This week in seven short lines: the weekday, what is on it, and today
 * marked in words and the selected tint (rule 5). Days gone by step back to
 * the subtle text, so what is still to come reads first. Read-only: moving
 * and adding are Plan's.
 */
export function WeekGlance({ days, today }: { days: readonly PlanDay[]; today: string }) {
  return (
    <section aria-labelledby="this-week" className="flex flex-col gap-2">
      <GlanceHeader
        id="this-week"
        title="This week"
        action={
          <Link to="/plan" className={glanceLinkClass}>
            Open the plan
          </Link>
        }
      />
      <Card className="p-1.5">
        <ul className="flex flex-col">
          {days.map((day) => {
            const isToday = day.date === today;
            const past = day.date < today;
            const label = day.entries.map(entryLabel).join(", ");
            return (
              <li
                key={day.date}
                aria-current={isToday ? "date" : undefined}
                className={cn("flex min-h-11 items-center gap-3 rounded-md px-3 py-1.5", isToday && "bg-bg-subtle-pressed")}
              >
                <span className="w-9 shrink-0 text-sm font-semibold text-fg-subtle">{dayParts(day.date).weekday}</span>
                <span className={cn("min-w-0 flex-1 truncate", past ? "text-fg-subtle" : "text-fg-normal", isToday && "font-medium")}>
                  {label === "" ? <span className="text-fg-subtle">—</span> : label}
                </span>
                {isToday && (
                  <Badge variant="soft" intent="neutral">
                    Today
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
