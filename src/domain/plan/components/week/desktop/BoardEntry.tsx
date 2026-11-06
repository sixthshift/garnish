import { Badge } from "@sixthshift/design-system/badge";
import { cn } from "@sixthshift/design-system/utils";
import { type DragEvent, useState } from "react";
import { RecipeLink } from "../../../../../components/recipe/RecipeLink";
import { Menu } from "../../../../../components/ui/Menu";
import { recipeImageUrl } from "../../../../../lib/images";
import { formatDuration } from "../../../../recipes/ingredient";
import { dayLabel, entryLabel, mealLabel, type PlanDay, type PlanEntry, servingsLabel } from "../../../plan";
import { ChooseOptionsSheet } from "../ChooseOptionsSheet";

/** Firefox starts no drag without some data; what it carries is the entry's own words, should it land outside the board. */
function startDrag(event: DragEvent, text: string, effect: "move" | "copy") {
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = effect;
  event.dataTransfer.setData("text/plain", text);
}

/**
 * One entry on the board: the recipe's picture across the top of the card in
 * a column, beside the name in a row, then the name and its meal, or its time
 * when it names no meal. A plain line is its words alone. The card drags to
 * another day (or to another place in its own); its menu moves it, picks its
 * options or takes it off, for a keyboard or a hand that would rather not
 * drag. Its link opens the recipe in the side panel (decisions.md row 206).
 *
 * The card is the drag, not the link inside it: a link drags its address,
 * which no day would know what to do with.
 */
export function BoardEntry({
  entry,
  allDays,
  busy,
  past,
  minutes,
  dragging,
  onMove,
  onRemove,
  onDragStart,
  onDragEnd,
  onDropBefore,
}: {
  entry: PlanEntry;
  allDays: readonly PlanDay[];
  busy: boolean;
  past: boolean;
  /** The recipe's total time, when the shelf has it. */
  minutes: number | null;
  /** This entry is the one being dragged. */
  dragging: boolean;
  onMove: (entry: PlanEntry, date: string, position: number) => void;
  onRemove: (entry: PlanEntry) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  /** Something is being dragged: a drop on this card lands before it. */
  onDropBefore?: () => void;
}) {
  const label = entryLabel(entry);
  const meal = mealLabel(entry.meal);
  const serves = servingsLabel(entry.servings);
  const [choosing, setChoosing] = useState(false);
  const choices = Object.keys(entry.choices).length > 0 ? entry.choices : undefined;
  const image = entry.recipe === null ? null : recipeImageUrl(entry.recipe.image);
  const details = [meal === null && minutes !== null ? formatDuration(minutes) : null, serves !== "" ? serves : null].filter(Boolean).join(" · ");

  return (
    <li
      draggable={!busy}
      data-testid="plan-entry"
      data-kind={entry.recipe === null ? "text" : "recipe"}
      onDragStart={(event) => {
        startDrag(event, label, "move");
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (onDropBefore === undefined) return;
        event.preventDefault();
      }}
      onDrop={(event) => {
        if (onDropBefore === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        onDropBefore();
      }}
      className={cn(
        "group relative flex w-60 min-w-0 cursor-grab items-center gap-2 rounded-lg border border-border-subtle bg-bg-normal p-1 pr-0.5 transition-shadow hover:shadow-md",
        "@7xl:w-auto @7xl:flex-col @7xl:items-stretch @7xl:gap-0 @7xl:p-0",
        entry.recipe === null && "bg-bg-subtle @7xl:p-2",
        dragging && "opacity-40"
      )}
    >
      {entry.recipe === null ? (
        <span className={cn("min-w-0 flex-1 py-1.5 pl-1 text-fg-subtle text-sm italic @7xl:pr-8 @7xl:pl-0", past && "opacity-70")}>{label}</span>
      ) : (
        <RecipeLink
          slug={entry.recipe.slug}
          choices={choices}
          draggable={false}
          // Faded here rather than on the card: opacity makes a stacking context, and the menu's panel would sit under the next day.
          className={cn("flex min-w-0 flex-1 items-center gap-2 @7xl:flex-col @7xl:items-stretch @7xl:gap-0", past && "opacity-70")}
        >
          {image === null ? (
            // In a column a recipe with no picture is its name alone: a blank band the width of the day says nothing.
            <span aria-hidden="true" className="size-12 shrink-0 rounded-md bg-bg-subtle @7xl:hidden" />
          ) : (
            <img
              src={image}
              alt=""
              loading="lazy"
              draggable={false}
              className="size-12 shrink-0 rounded-md object-cover @7xl:aspect-[16/10] @7xl:size-auto @7xl:w-full @7xl:rounded-b-none"
            />
          )}
          <span className={cn("flex min-w-0 flex-col gap-0.5 @7xl:px-2 @7xl:pt-1.5 @7xl:pb-2", image === null && "@7xl:pt-2 @7xl:pr-9")}>
            <span className="line-clamp-2 font-medium text-sm leading-snug">
              {label}
              {entry.chosen.length > 0 && (
                <span className="font-normal text-fg-subtle" data-testid="plan-entry-chosen">
                  {" "}
                  · {entry.chosen.join(", ")}
                </span>
              )}
            </span>
            {(meal !== null || details !== "") && (
              <span className="flex flex-wrap items-center gap-1.5 text-fg-subtle text-xs">
                {meal !== null && (
                  <Badge variant="soft" intent="neutral" size="sm" data-testid="plan-entry-meal">
                    {meal}
                  </Badge>
                )}
                {details}
              </span>
            )}
          </span>
        </RecipeLink>
      )}
      <Menu
        iconOnly
        ghost
        label={`Actions for ${label}`}
        className={cn("shrink-0 @7xl:absolute @7xl:top-1 @7xl:right-1", entry.recipe !== null && "@7xl:rounded-md @7xl:bg-bg-normal/85")}
      >
        {allDays
          .filter((day) => day.date !== entry.date)
          .map((day) => (
            <Menu.Item key={day.date} disabled={busy} onSelect={() => onMove(entry, day.date, day.entries.length)}>
              Move to {dayLabel(day.date)}
            </Menu.Item>
          ))}
        {entry.choosable && (
          <>
            <Menu.Separator />
            <Menu.Item disabled={busy} onSelect={() => setChoosing(true)}>
              Choose…
            </Menu.Item>
          </>
        )}
        <Menu.Separator />
        {/* Neutral: no confirm, and an entry is re-added in two taps (rule 5 keeps red for a confirm). */}
        <Menu.Item disabled={busy} onSelect={() => onRemove(entry)}>
          Remove
        </Menu.Item>
      </Menu>
      {entry.choosable && <ChooseOptionsSheet entry={entry} open={choosing} onOpenChange={setChoosing} />}
    </li>
  );
}
