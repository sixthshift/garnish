import { Card } from "@sixthshift/design-system/card";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { dayName } from "../../../plan";
import { PlanAddForm } from "../PlanAddForm";
import type { PlanWeekViewProps } from "../PlanWeekView";

/** How many recipes a desktop's picker draws: no keyboard over it, so the hint to keep typing comes later than a phone's. */
export const PICKER_RESULT_LIMIT = 8;

/**
 * A desktop's way to fill the week (decisions.md row 206): the add form beside
 * the week rather than in a sheet over it, so each add is seen landing on its
 * day and the next can follow at once. It adds to the chosen day, which a
 * day's "+" chooses; it takes focus when a day is chosen, not when the page
 * opens. One add keeps the day, since the next is often for the same night
 * (a side) or the one after.
 */
export function PlanPicker({
  date,
  focus,
  busy,
  searchRecipes,
  onAddText,
  onAddRecipe,
}: { date: string; focus: boolean; busy: boolean } & Pick<PlanWeekViewProps, "searchRecipes" | "onAddText" | "onAddRecipe">) {
  const day = dayName(date);
  return (
    <section aria-labelledby="plan-picker" className="desktop:sticky desktop:top-[calc(var(--top-bar)+1.5rem)]" data-testid="plan-picker">
      <Card className="flex flex-col gap-3">
        <SectionTitle as="h2" id="plan-picker">
          Adding to {day}
        </SectionTitle>
        <PlanAddForm
          key={date}
          date={date}
          busy={busy}
          autoFocus={focus}
          limit={PICKER_RESULT_LIMIT}
          searchRecipes={searchRecipes}
          onAddText={onAddText}
          onAddRecipe={onAddRecipe}
        />
      </Card>
    </section>
  );
}
