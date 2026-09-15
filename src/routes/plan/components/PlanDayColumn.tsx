import { Badge } from "@sixthshift/design-system/badge";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { ReorderList } from "../../../components/ui/ReorderList";
import { dayLabel, isToday, type PlanDay, reorderMove } from "../../../domain/plan";
import { PlanAddRow } from "./PlanAddRow";
import { PlanEntryCard } from "./PlanEntryCard";
import type { PlanWeekViewProps } from "./PlanWeekView";

/** The lists sharing a cross-day drag. One group for the whole week. */
const DRAG_GROUP = "plan-week";

/** One day: its heading, its entries as a reorderable list, and the add row. */
export function PlanDayColumn({
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
  return (
    <section
      aria-label={dayLabel(day.date)}
      data-testid="plan-day"
      data-date={day.date}
      data-today={marked ? "true" : "false"}
      className={
        marked
          ? "flex flex-col gap-2 rounded-lg border border-border-brand bg-bg-brand-subtle/30 p-2"
          : "flex flex-col gap-2 rounded-lg border border-border-subtle p-2"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <SectionTitle as="h2">{dayLabel(day.date)}</SectionTitle>
        {marked && (
          <Badge variant="soft" intent="brand">
            Today
          </Badge>
        )}
      </div>

      {day.entries.length === 0 && (
        <Muted as="p" className="px-1 py-2 text-sm" data-testid="plan-day-empty">
          Nothing planned
        </Muted>
      )}

      {/* Rendered even when empty: it is the drop target for a row dragged
          from another day, and an empty <ol> has no height of its own. */}
      <ReorderList
        items={day.entries}
        keyOf={(entry) => entry.id}
        itemName="entry"
        className="min-h-10 gap-1"
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
    </section>
  );
}
