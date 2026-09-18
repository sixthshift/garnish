import { Badge } from "@sixthshift/design-system/badge";
import { Caption } from "@sixthshift/design-system/caption";
import { Link } from "@tanstack/react-router";
import { Menu } from "../../../components/ui/Menu";
import { dayLabel, entryLabel, mealLabel, type PlanDay, type PlanEntry, servingsLabel } from "../../../domain/plan";
import { recipeImageUrl } from "../../../lib/images";
import { EntryImage } from "./EntryImage";

/**
 * One entry: the recipe's picture and name (a link to it) or the plain line,
 * its meal and its servings when it names them, and the row menu that moves it
 * to another day or takes it off the plan. The meal is a caption rather than a
 * second badge: most entries have none, and the ones that do are labelled, not
 * slotted (decisions.md row 100).
 */
export function PlanEntryCard({
  entry,
  days,
  busy,
  onMove,
  onRemove,
}: {
  entry: PlanEntry;
  days: readonly PlanDay[];
  busy: boolean;
  onMove: (entry: PlanEntry, date: string, position: number) => void;
  onRemove: (entry: PlanEntry) => void;
}) {
  const label = entryLabel(entry);
  const serves = servingsLabel(entry.servings);
  const meal = mealLabel(entry.meal);
  return (
    <div className="flex items-center gap-2 rounded-md p-1 hover:bg-bg-subtle" data-testid="plan-entry" data-kind={entry.recipe === null ? "text" : "recipe"}>
      {entry.recipe === null ? (
        <span className="min-w-0 flex-1 truncate py-1 text-sm">{label}</span>
      ) : (
        <Link to="/recipes/$slug" params={{ slug: entry.recipe.slug }} className="flex min-w-0 flex-1 items-center gap-2">
          <EntryImage src={recipeImageUrl(entry.recipe.image)} />
          <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
        </Link>
      )}
      {meal !== null && (
        <Caption className="shrink-0" data-testid="plan-entry-meal">
          {meal}
        </Caption>
      )}
      {serves !== "" && (
        <Badge variant="soft" intent="muted" className="shrink-0">
          {serves}
        </Badge>
      )}
      <Menu iconOnly label={`Actions for ${label}`} className="shrink-0">
        {days
          .filter((day) => day.date !== entry.date)
          .map((day) => (
            <Menu.Item key={day.date} disabled={busy} onSelect={() => onMove(entry, day.date, day.entries.length)}>
              Move to {dayLabel(day.date)}
            </Menu.Item>
          ))}
        <Menu.Separator />
        <Menu.Item intent="danger" disabled={busy} onSelect={() => onRemove(entry)}>
          Remove
        </Menu.Item>
      </Menu>
    </div>
  );
}
