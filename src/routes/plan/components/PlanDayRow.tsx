import { Caption } from "@sixthshift/design-system/caption";
import { Card } from "@sixthshift/design-system/card";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { cn } from "@sixthshift/design-system/utils";
import { ReorderList } from "../../../components/ui/ReorderList";
import { dayParts, isToday, type PlanDay, reorderMove } from "../../../domain/plan";
import { PlanAddRow } from "./PlanAddRow";
import { PlanEntryCard } from "./PlanEntryCard";
import type { PlanWeekViewProps } from "./PlanWeekView";

/** The lists sharing a cross-day drag. One group for the whole week. */
const DRAG_GROUP = "plan-week";

/**
 * One day, full width: a date rail on the left, then the day's entries and the
 * add row. A row rather than one of seven columns because that is what
 * decisions.md row 71 argued for — "seven days of a vertical list is the shape
 * that fits the screen" — and because the column it replaced was about 120px
 * wide inside its padding, which is narrower than the date it had to hold.
 */
export function PlanDayRow({
  day,
  days,
  today,
  busy,
  onAddText,
  onAddRecipe,
  onMove,
  onRemove,
  searchRecipes,
}: {
  day: PlanDay;
  days: readonly PlanDay[];
  today: string;
  busy: boolean;
} & Pick<PlanWeekViewProps, "onAddText" | "onAddRecipe" | "onMove" | "onRemove" | "searchRecipes">) {
  const marked = isToday(day.date, today);
  const { weekday, day: dayOfMonth } = dayParts(day.date);
  return (
    // The primitive, not `cardVariants`: `Card` renders a `<div>` and nothing
    // here needs another element. The day was a labelled `<section>` first,
    // which made seven `region` landmarks on one page to say what the `<h2>`
    // in the rail already says. Today is marked in the rail and nowhere else:
    // the nav's `bg-bg-brand-subtle` is sized for a nav pill and reads as a
    // block of colour across a full-width card, so what carries over is the
    // brand foreground on the two words that name the day.
    <Card size="sm" data-testid="plan-day" data-date={day.date} data-today={marked ? "true" : "false"} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
      {/* Left rail from `sm` up, fixed-width so every day's entries start on
          the same vertical line and the date stacks rather than wrapping. On a
          phone it goes back over the top in one line: 64px of rail beside a
          drag handle, a thumbnail and three row buttons left a recipe's name
          about ten characters. */}
      <div className="flex shrink-0 items-baseline gap-1.5 sm:w-16 sm:flex-col sm:items-start sm:gap-0 sm:pt-0.5">
        {/* The mark is colour alone, so the word rides along where only a
            screen reader hears it rather than becoming a second thing on the
            card saying what the rail already says. */}
        <SectionTitle as="h2" className={cn(marked && "text-fg-brand")}>
          {weekday}
          {marked && <span className="sr-only"> (today)</span>}
        </SectionTitle>
        <Caption className={cn(marked && "text-fg-brand")}>{dayOfMonth}</Caption>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {day.entries.length === 0 && (
          <Muted as="p" className="px-1 text-sm" data-testid="plan-day-empty">
            Nothing planned
          </Muted>
        )}

        {/* Rendered even when empty: it is the drop target for a row dragged
            from another day, and an empty <ol> has no height of its own. */}
        <ReorderList
          items={day.entries}
          keyOf={(entry) => entry.id}
          itemName="entry"
          className={cn("gap-1", day.entries.length === 0 && "min-h-5")}
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
          renderItem={(entry) => <PlanEntryCard entry={entry} days={days} busy={busy} onMove={onMove} onRemove={onRemove} />}
        />

        <PlanAddRow date={day.date} busy={busy} searchRecipes={searchRecipes} onAddText={onAddText} onAddRecipe={onAddRecipe} />
      </div>
    </Card>
  );
}
