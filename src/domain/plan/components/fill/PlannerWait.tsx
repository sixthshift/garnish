import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { useSeconds } from "../../../../components/wait/WaitSteps";
import type { Meal } from "../../plan";
import { WeekFill } from "./WeekFill";

export type PlannerWaitProps = {
  startedAt: number;
  /** How many days the planner is filling. */
  days: number;
  /** Breakfast or lunch, when it is asked to plan them as well as dinner. */
  others: readonly Meal[];
  /** Fill the week from the weeknight recipes and stop waiting. */
  onSkip: () => void;
};

/** Each meal's name for more than one of it. */
const PLURAL: Record<Meal, string> = { breakfast: "breakfasts", lunch: "lunches", dinner: "dinners" };

/** "Choosing 7 dinners from your guide.", or "… 7 dinners, breakfasts and lunches …"; one day takes the singular. Pure. */
export function choosingLine(days: number, others: readonly Meal[]): string {
  const meals = (["dinner", ...others] as Meal[]).map((meal) => (days === 1 ? meal : PLURAL[meal]));
  const named = meals.length === 1 ? meals[0]! : `${meals.slice(0, -1).join(", ")} and ${meals.at(-1)}`;
  return `Choosing ${days} ${named} from your guide.`;
}

/**
 * The planner's first pass, front and centre: the week filling itself in,
 * what it is choosing, the seconds, and the way out to the weeknight recipes.
 * The planner is one call to the model, so there are no steps to tick.
 */
export function PlannerWait({ startedAt, days, others, onSkip }: PlannerWaitProps) {
  const seconds = useSeconds(startedAt);
  return (
    <div className="flex min-h-[calc(100svh-20rem)] flex-col items-center justify-center gap-5 py-8 text-center" data-testid="planner-wait">
      <WeekFill className="w-56 desktop:w-72" />
      <div className="flex flex-col items-center gap-1">
        <p className="text-lg font-medium" role="status">
          Planning your week…
        </p>
        <Muted as="p" className="text-sm">
          {choosingLine(days, others)}
        </Muted>
        <Muted as="p" className="text-sm tabular-nums">
          This can take up to a minute.
          {seconds >= 3 && <span> {seconds} s</span>}
        </Muted>
      </div>
      <Button type="button" variant="ghost" intent="neutral" size="sm" onClick={onSkip}>
        Use my weeknight recipes instead
      </Button>
    </div>
  );
}
