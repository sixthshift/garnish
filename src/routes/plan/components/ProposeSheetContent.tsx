import { Button } from "@sixthshift/design-system/button";
import { Caption } from "@sixthshift/design-system/caption";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Sheet } from "@sixthshift/design-system/sheet";
import { dayLabel, type Meal, mealLabel } from "../../../domain/plan";
import { MEALS } from "../../../domain/planner";
import { recipeImageUrl } from "../../../lib/images";
import type { ProposedWeek } from "../../../server/ai/planner";
import { EntryImage } from "./EntryImage";
import { groupProposal, type ProposalDay, slotKey, tickedDates } from "./proposalSheet";

export type ProposeSheetContentProps = {
  /** The shown week's seven days, ticked, remembered and with the past ruled out. */
  days: readonly ProposalDay[];
  onToggleDay: (index: number) => void;
  /** The meals this run fills, remembered on the device: at least one, or Propose cannot run. */
  meals: readonly Meal[];
  onToggleMeal: (meal: Meal) => void;
  /** The model's answer, or null while the sheet is still asking for one. */
  week: ProposedWeek | null;
  /** The slot keys whose row is accepted. */
  ticked: ReadonlySet<string>;
  onToggleRow: (key: string) => void;
  busy?: boolean;
  error?: string | null;
  onPropose: () => void;
  onAdd: () => void;
  onCancel: () => void;
};

/**
 * The sheet's markup, every state of it, props only — the restyle sheet's
 * arrangement: a stage that asks (the seven days and the three meals), a stage
 * that answers (the rows to tick), and one footer button that runs whichever is
 * showing. Propose needs a day and a meal: with either row empty there is no
 * slot to fill, so it stays disabled rather than asking for nothing.
 */
export function ProposeSheetContent(props: ProposeSheetContentProps) {
  const { days, meals, week, ticked, busy = false, error = null } = props;
  const groups = week === null ? [] : groupProposal(week);
  const nothing = week !== null && week.entries.length === 0;

  return (
    <>
      <Sheet.Header>
        <h2 className="font-medium text-base">Propose a week</h2>
      </Sheet.Header>
      <Sheet.Body>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3" data-testid="propose-days">
            <Muted as="p" className="text-sm">
              The days and the meals to fill. Nothing is written until you add it.
            </Muted>
            <div className="flex flex-wrap gap-2">
              {days.map((day) => (
                <div
                  key={day.date}
                  className="flex w-12 flex-col items-center gap-1 text-center"
                  data-testid="propose-day"
                  data-date={day.date}
                  data-ticked={day.ticked ? "true" : "false"}
                  data-past={day.past ? "true" : "false"}
                >
                  {/* The letter and the date label the checkbox for the eye; its `aria-label` is the day's whole name. */}
                  <span aria-hidden="true" className="text-sm">
                    {day.letter}
                  </span>
                  <Checkbox
                    checked={day.ticked}
                    disabled={busy || day.past}
                    aria-label={dayLabel(day.date)}
                    onCheckedChange={() => props.onToggleDay(day.index)}
                  />
                  <Caption>{day.day}</Caption>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4" data-testid="propose-meals">
              {MEALS.map((meal) => (
                <Checkbox
                  key={meal}
                  checked={meals.includes(meal)}
                  disabled={busy}
                  label={mealLabel(meal)}
                  data-meal={meal}
                  onCheckedChange={() => props.onToggleMeal(meal)}
                />
              ))}
            </div>
          </div>

          {busy && week === null && (
            <p className="text-fg-subtle text-sm" data-testid="propose-working">
              Reading the week and asking the model…
            </p>
          )}

          {week !== null && (
            <div className="flex flex-col gap-6" data-testid="propose-answer">
              {nothing && (
                <Muted as="p" className="text-sm" data-testid="propose-nothing">
                  The model proposed nothing for these days.
                </Muted>
              )}
              {groups.map((group) => (
                <section key={group.date} className="flex flex-col gap-2" data-testid="propose-group" data-date={group.date} aria-label={dayLabel(group.date)}>
                  <SectionTitle as="h3">{dayLabel(group.date)}</SectionTitle>
                  {group.rows.map((row) => {
                    const on = ticked.has(row.key);
                    return (
                      <div key={row.key} className="flex items-start gap-2.5" data-testid="propose-row" data-slot={row.key} data-ticked={on ? "true" : "false"}>
                        <Checkbox
                          checked={on}
                          disabled={busy}
                          className="mt-1"
                          aria-label={`${mealLabel(row.meal)}: ${row.name}`}
                          onCheckedChange={() => props.onToggleRow(row.key)}
                        />
                        <EntryImage src={recipeImageUrl(row.image)} />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-baseline gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm">{row.name}</span>
                            <Caption className="shrink-0">{mealLabel(row.meal)}</Caption>
                          </div>
                          <Muted as="p" className="text-sm" data-testid="propose-reason">
                            {row.reason}
                          </Muted>
                        </div>
                      </div>
                    );
                  })}
                  {group.unfilled.map((meal: Meal) => (
                    <Muted as="p" key={slotKey(group.date, meal)} className="text-sm" data-testid="propose-unfilled" data-slot={slotKey(group.date, meal)}>
                      {`${mealLabel(meal)}: the model left this one empty.`}
                    </Muted>
                  ))}
                  {group.taken.map((slot) => (
                    <Muted as="p" key={slotKey(slot.date, slot.meal)} className="text-sm" data-testid="propose-taken" data-slot={slotKey(slot.date, slot.meal)}>
                      {`${mealLabel(slot.meal)}: already taken by ${slot.name}.`}
                    </Muted>
                  ))}
                </section>
              ))}
              {week.dropped.length > 0 && (
                <div className="flex flex-col gap-2 border-border-subtle border-t pt-4" data-testid="propose-dropped">
                  <SectionTitle as="h3">Lines dropped</SectionTitle>
                  <ul className="flex flex-col gap-1">
                    {week.dropped.map((line) => (
                      <li key={`${line.kind} ${line.reason}`} data-testid="propose-dropped-line" data-kind={line.kind}>
                        <Muted as="p" className="text-sm">
                          {line.reason}
                        </Muted>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {error !== null && (
            <p className="text-fg-danger text-sm" role="alert">
              {error}
            </p>
          )}
        </div>
      </Sheet.Body>
      <Sheet.Footer>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={props.onCancel}>
          Cancel
        </Button>
        {week === null ? (
          <Button
            type="button"
            variant="solid"
            intent="brand"
            disabled={busy || tickedDates(days).length === 0 || meals.length === 0}
            data-testid="propose-run"
            onClick={props.onPropose}
          >
            {busy ? "Proposing…" : error !== null ? "Try again" : "Propose"}
          </Button>
        ) : (
          <Button type="button" variant="solid" intent="brand" disabled={busy || ticked.size === 0} data-testid="propose-add" onClick={props.onAdd}>
            {busy ? "Adding…" : error !== null ? "Try again" : "Add to plan"}
          </Button>
        )}
      </Sheet.Footer>
    </>
  );
}
