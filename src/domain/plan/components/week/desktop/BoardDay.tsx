import { Badge } from "@sixthshift/design-system/badge";
import { cardVariants } from "@sixthshift/design-system/card";
import { cn } from "@sixthshift/design-system/utils";
import { type DragEvent, useEffect, useRef, useState } from "react";
import { dayName, dayParts, type PlanDay, type PlanEntry } from "../../../plan";
import { BoardEntry } from "./BoardEntry";
import type { BoardDayHandlers } from "./PlanBoard";

/**
 * One day on the board: its name and date, its entries as small cards with
 * their pictures, and a dashed target that takes a drop and, clicked, chooses
 * the day for the shelf. A column from about 1280px of board, a row under it.
 *
 * Today says so in words and takes a stronger edge; a day gone by sits back
 * on the page, its entries faded, and its target shrinks to a quiet "Add" (a
 * night already eaten is still worth writing down). The day chosen for the
 * shelf takes the selected tint, never the brand (design-language rule 5).
 */
export function BoardDay({
  day,
  allDays,
  today,
  busy,
  minutes,
  onMove,
  onRemove,
  chosen,
  onChoose,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  day: PlanDay;
  allDays: readonly PlanDay[];
  today: string;
  busy: boolean;
  minutes: ReadonlyMap<string, number | null>;
  onMove: (entry: PlanEntry, date: string, position: number) => void;
  onRemove: (entry: PlanEntry) => void;
} & BoardDayHandlers) {
  const isToday = day.date === today;
  const past = day.date < today;
  const picked = chosen === day.date;
  const empty = day.entries.length === 0;
  const { weekday, day: dayOfMonth } = dayParts(day.date);
  const name = dayName(day.date);

  // Entering a child fires the day's dragleave first; a count of what the pointer is inside says when it has really left.
  const inside = useRef(0);
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (dragging === null) {
      inside.current = 0;
      setOver(false);
    }
  }, [dragging]);

  const accept = (event: DragEvent) => {
    if (dragging === null) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = dragging.kind === "entry" ? "move" : "copy";
  };

  return (
    <li
      data-testid="plan-day"
      data-date={day.date}
      data-today={isToday ? "true" : "false"}
      data-chosen={picked ? "true" : undefined}
      data-over={over ? "true" : undefined}
      aria-current={isToday ? "date" : undefined}
      className={cn(
        past ? "rounded-xl border border-border-subtle p-2" : cardVariants({ size: "xs" }),
        "flex min-w-0 flex-row flex-wrap items-center gap-2 transition-shadow",
        "@7xl:min-h-64 @7xl:flex-col @7xl:flex-nowrap @7xl:items-stretch",
        isToday && "border-border-normal-pressed shadow-[0_0_0_1px_var(--border-normal-pressed)]",
        picked && "bg-bg-subtle-pressed",
        over && "outline-2 outline-border-normal-pressed outline-dashed outline-offset-2"
      )}
      onDragEnter={(event) => {
        if (dragging === null) return;
        event.preventDefault();
        inside.current += 1;
        setOver(true);
      }}
      onDragLeave={() => {
        if (dragging === null) return;
        inside.current = Math.max(0, inside.current - 1);
        if (inside.current === 0) setOver(false);
      }}
      onDragOver={accept}
      onDrop={(event) => {
        if (dragging === null) return;
        event.preventDefault();
        onDrop(day.date, null);
      }}
    >
      <h3 className="flex w-28 shrink-0 flex-col gap-0.5 px-1 @7xl:w-auto @7xl:flex-row @7xl:items-baseline @7xl:gap-1.5">
        <span className="font-semibold text-fg-normal text-xs uppercase tracking-wider">{weekday}</span>
        <span className={cn("text-sm", isToday ? "font-medium text-fg-normal" : "text-fg-subtle")}>{dayOfMonth}</span>
        {isToday && (
          <Badge variant="soft" intent="neutral" size="sm" className="self-start @7xl:ml-auto @7xl:self-center" data-testid="plan-today">
            Today
          </Badge>
        )}
      </h3>

      {!empty && (
        <ol className="contents" aria-label={`Planned for ${name}`}>
          {day.entries.map((entry, index) => (
            <BoardEntry
              key={entry.id}
              entry={entry}
              allDays={allDays}
              busy={busy}
              past={past}
              minutes={entry.recipe === null ? null : (minutes.get(entry.recipe.id) ?? null)}
              dragging={dragging?.kind === "entry" && dragging.entry.id === entry.id}
              onMove={onMove}
              onRemove={onRemove}
              onDragStart={() => onDragStart({ kind: "entry", entry })}
              onDragEnd={onDragEnd}
              onDropBefore={dragging === null ? undefined : () => onDrop(day.date, index)}
            />
          ))}
        </ol>
      )}
      {empty && <span className="sr-only">Nothing planned</span>}

      <button
        type="button"
        aria-label={`Add to ${name}`}
        aria-pressed={picked}
        data-testid="plan-day-add"
        onClick={() => onChoose(day.date)}
        className={cn(
          "flex min-h-11 min-w-32 cursor-pointer items-center justify-center rounded-lg border border-border-normal border-dashed px-2 py-1.5 text-center text-fg-subtle text-sm",
          "hover:border-border-normal-pressed hover:text-fg-normal",
          empty ? "flex-1 @7xl:min-h-24" : "flex-1 @7xl:flex-none",
          past && empty && "@7xl:flex-none",
          picked && "border-border-normal-pressed text-fg-normal"
        )}
      >
        {past ? "+ Add" : !empty ? "+ Add another" : picked ? "Pick from the shelf →" : "Drop a recipe, or click to choose"}
      </button>
    </li>
  );
}
