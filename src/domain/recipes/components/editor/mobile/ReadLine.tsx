import { Muted } from "@sixthshift/design-system/muted";
import { cn } from "@sixthshift/design-system/utils";
import { type LineRead, lineRead } from "../../../draft";
import type { FoodRow, Unit } from "../../../reference";

/** The amber dot of a line Check wants looked at. */
export function FlagDot({ className }: { className?: string }) {
  return <span className={cn("mt-1.5 size-2 shrink-0 rounded-full bg-[var(--color-border-warning)]", className)} aria-hidden="true" />;
}

/**
 * One ingredient line as garnish read it, on a phone (decisions.md row 208):
 * the amount and unit as a small chip, the food in bold, the note quieter,
 * and "no amount" in amber where there is none. A line no food was read from
 * is its own words, marked as kept as text.
 */
export function ReadLine({ read, className }: { read: LineRead; className?: string }) {
  if (read.kind === "text") {
    return (
      <span className={cn("leading-relaxed", className)} data-read="text">
        {read.text}{" "}
        <Muted as="span" className="whitespace-nowrap text-xs">
          · as text
        </Muted>
      </span>
    );
  }
  const chip = "mr-0.5 inline-block rounded-md border px-1.5 text-xs leading-5 font-semibold";
  return (
    <span className={cn("leading-relaxed", className)} data-read="parsed">
      {read.amount === "" ? (
        <span className={cn(chip, "border-[var(--color-border-warning)] bg-bg-warning-subtle text-fg-warning")} data-read-amount="">
          no amount
        </span>
      ) : (
        <span className={cn(chip, "border-border-brand-subtle bg-bg-brand-subtle text-fg-brand tabular-nums")} data-read-amount="">
          {read.fixed ? `= ${read.amount}` : read.amount}
        </span>
      )}{" "}
      {read.food === "" ? <span className="text-fg-warning">no food yet</span> : <strong className="font-semibold text-fg-strong">{read.food}</strong>}
      {!read.known && read.food !== "" && (
        <Muted as="span" className="whitespace-nowrap text-xs">
          {" "}
          · new food
        </Muted>
      )}
      {read.note !== "" && (
        <Muted as="span" className="text-sm">
          , {read.note}
        </Muted>
      )}
    </span>
  );
}

/**
 * The ingredient box's lines as garnish reads them, under the box as it is
 * typed: the same parser, against the same library, that the review after
 * Add uses, so nothing there is a surprise.
 */
export function ReadAsYouType({ lines, units, foods }: { lines: readonly string[]; units: readonly Unit[]; foods: readonly FoodRow[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="flex flex-col gap-1" data-testid="read-as-you-type">
      <Muted as="p" className="text-xs font-medium">
        How garnish reads it
      </Muted>
      <ol className="flex flex-col text-sm">
        {lines.map((line, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the box's lines, redrawn whole on every keystroke
          <li key={index} className="border-b border-dashed border-border-normal py-1.5 last:border-b-0" data-read-line={index + 1}>
            <ReadLine read={lineRead(line, { units, foods })} />
          </li>
        ))}
      </ol>
    </div>
  );
}
