import { Badge } from "@sixthshift/design-system/badge";
import { Caption } from "@sixthshift/design-system/caption";
import { Link } from "@tanstack/react-router";
import { Menu } from "../../../components/ui/Menu";
import type { ReorderRow } from "../../../components/ui/ReorderList";
import { dayLabel, entryLabel, mealLabel, type PlanDay, type PlanEntry, servingsLabel } from "../../../domain/plan";
import { recipeImageUrl } from "../../../lib/images";
import { EntryImage } from "./EntryImage";

/**
 * One entry, a row under its day rather than a card of its own (design-language
 * rule 2): the recipe's picture and name (a link to it) or the plain line,
 * its meal and its servings when it names them, and the row menu that moves it
 * to another day or takes it off the plan. The meal is a caption rather than a
 * second badge: most entries have none, and the ones that do are labelled, not
 * slotted (decisions.md row 100).
 *
 * The row places its own drag handle and, on a narrow list (ReorderList's
 * `@2xl` container, `narrow="row"`), its up and down moves in that same menu,
 * as a step's are: a phone's row held a handle, a picture, the name, the meal,
 * a menu and two arrows, which left a recipe's name about nine characters.
 */
export function PlanEntryRow({
  entry,
  days,
  busy,
  onMove,
  onRemove,
  reorder,
}: {
  entry: PlanEntry;
  days: readonly PlanDay[];
  busy: boolean;
  onMove: (entry: PlanEntry, date: string, position: number) => void;
  onRemove: (entry: PlanEntry) => void;
  /** The handle and the moves ReorderList hands a `narrow="row"` row. */
  reorder?: ReorderRow;
}) {
  const label = entryLabel(entry);
  const serves = servingsLabel(entry.servings);
  const meal = mealLabel(entry.meal);
  return (
    <div
      className="flex items-center gap-2 rounded-md p-1 hover:bg-bg-subtle-hovered"
      data-testid="plan-entry"
      data-kind={entry.recipe === null ? "text" : "recipe"}
    >
      {reorder?.handle}
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
        {reorder !== undefined && (
          <>
            <Menu.Item disabled={busy || !reorder.moveUp} onSelect={reorder.moveUp} className="@2xl:hidden">
              Move up
            </Menu.Item>
            <Menu.Item disabled={busy || !reorder.moveDown} onSelect={reorder.moveDown} className="@2xl:hidden">
              Move down
            </Menu.Item>
          </>
        )}
        <Menu.Separator />
        {/* Neutral: no confirm, and an entry is re-added in two taps (rule 5 keeps red for a confirm). */}
        <Menu.Item disabled={busy} onSelect={() => onRemove(entry)}>
          Remove
        </Menu.Item>
      </Menu>
    </div>
  );
}
