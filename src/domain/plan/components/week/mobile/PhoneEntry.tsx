import { cn } from "@sixthshift/design-system/utils";
import { useState } from "react";
import { RecipeLink } from "../../../../../components/recipe/RecipeLink";
import { Menu } from "../../../../../components/ui/Menu";
import { SwipeRow } from "../../../../../components/ui/SwipeRow";
import { recipeImageUrl } from "../../../../../lib/images";
import { formatDuration } from "../../../../recipes/ingredient";
import { addDays, dayLabel, entryLabel, mealLabel, type PlanDay, type PlanEntry, servingsLabel } from "../../../plan";
import { ChooseOptionsSheet } from "../ChooseOptionsSheet";

/** A position past any day's end: the plan's move lands it last (`plan.move` clamps). For a day the page does not hold. */
const AT_THE_END = Number.MAX_SAFE_INTEGER;

/**
 * One entry on a phone's plan, a card: the recipe's photo, its name and its
 * meal (or its time when it names none), and its servings when it sets them;
 * a plain line is its words, set apart in italics. The card opens the recipe.
 *
 * It swipes (`SwipeRow`, decisions.md row 208): right pushes it to the next
 * day, left takes it off. A day gone by does not push. The menu beside the
 * card does both too, for a thumb that would rather tap, a keyboard and a
 * screen reader, and it moves the entry to any day on the page or up and down
 * its own: the drag handle the phone's rows had is gone, since a finger
 * moving sideways on a card is now the swipe. The menu sits beside the card
 * rather than on it because the swipe clips what it moves, and the menu's
 * panel would be clipped with it.
 */
export function PhoneEntry({
  entry,
  index,
  day,
  allDays,
  busy,
  past,
  minutes,
  onMove,
  onRemove,
}: {
  entry: PlanEntry;
  /** Its place in its day. */
  index: number;
  day: PlanDay;
  allDays: readonly PlanDay[];
  busy: boolean;
  past: boolean;
  /** The recipe's total time, when the shelf has it. */
  minutes: number | null;
  onMove: (entry: PlanEntry, date: string, position: number) => void;
  onRemove: (entry: PlanEntry) => void;
}) {
  const label = entryLabel(entry);
  const meal = mealLabel(entry.meal);
  const serves = servingsLabel(entry.servings);
  const [choosing, setChoosing] = useState(false);
  const choices = Object.keys(entry.choices).length > 0 ? entry.choices : undefined;
  const image = entry.recipe === null ? null : recipeImageUrl(entry.recipe.image);
  const details = [meal ?? (minutes !== null ? formatDuration(minutes) : null), serves !== "" ? serves : null].filter(Boolean).join(" · ");

  const next = addDays(entry.date, 1);
  const nextDay = allDays.find((one) => one.date === next);
  const push = () => onMove(entry, next, nextDay?.entries.length ?? AT_THE_END);
  const remove = () => onRemove(entry);

  const card = (
    <div
      className={cn(
        "flex min-h-[4.5rem] items-center gap-3 rounded-xl border p-2",
        entry.recipe === null ? "border-transparent bg-bg-subtle-pressed" : "border-border-subtle bg-bg-normal"
      )}
      data-testid="plan-entry"
      data-kind={entry.recipe === null ? "text" : "recipe"}
    >
      {entry.recipe === null ? (
        <span className={cn("min-w-0 flex-1 px-1.5 text-fg-subtle italic", past && "opacity-70")}>{label}</span>
      ) : (
        <RecipeLink slug={entry.recipe.slug} choices={choices} draggable={false} className={cn("flex min-w-0 flex-1 items-center gap-3", past && "opacity-60")}>
          {image === null ? (
            <span aria-hidden="true" className="size-14 shrink-0 rounded-[11px] bg-bg-subtle" />
          ) : (
            <img src={image} alt="" loading="lazy" draggable={false} className="size-14 shrink-0 rounded-[11px] object-cover" />
          )}
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="line-clamp-2 font-medium leading-snug">
              {label}
              {entry.chosen.length > 0 && (
                <span className="font-normal text-fg-subtle" data-testid="plan-entry-chosen">
                  {" "}
                  · {entry.chosen.join(", ")}
                </span>
              )}
            </span>
            {details !== "" && (
              <span className="truncate text-[13px] text-fg-subtle" data-testid="plan-entry-meal">
                {details}
              </span>
            )}
          </span>
        </RecipeLink>
      )}
    </div>
  );

  return (
    <div className="flex items-center gap-1">
      <SwipeRow
        className="min-w-0 flex-1 rounded-xl"
        right={past || busy ? undefined : { label: `Push to ${dayLabel(next).split(" ")[0]} →`, tone: "go", onSwipe: push }}
        left={busy ? undefined : { label: "Remove ✕", tone: "stop", onSwipe: remove }}
      >
        {card}
      </SwipeRow>
      <Menu iconOnly ghost label={`Actions for ${label}`} className="shrink-0">
        {!past && (
          <Menu.Item disabled={busy} onSelect={push}>
            Push to {dayLabel(next)}
          </Menu.Item>
        )}
        {allDays
          .filter((one) => one.date !== entry.date && (past || one.date !== next))
          .map((one) => (
            <Menu.Item key={one.date} disabled={busy} onSelect={() => onMove(entry, one.date, one.entries.length)}>
              Move to {dayLabel(one.date)}
            </Menu.Item>
          ))}
        {day.entries.length > 1 && (
          <>
            <Menu.Separator />
            <Menu.Item disabled={busy || index === 0} onSelect={() => onMove(entry, entry.date, index - 1)}>
              Move up
            </Menu.Item>
            <Menu.Item disabled={busy || index === day.entries.length - 1} onSelect={() => onMove(entry, entry.date, index + 1)}>
              Move down
            </Menu.Item>
          </>
        )}
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
        <Menu.Item disabled={busy} onSelect={remove}>
          Remove
        </Menu.Item>
      </Menu>
      {entry.choosable && <ChooseOptionsSheet entry={entry} open={choosing} onOpenChange={setChoosing} />}
    </div>
  );
}
