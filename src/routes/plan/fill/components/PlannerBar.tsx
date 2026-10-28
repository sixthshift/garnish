import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Muted } from "@sixthshift/design-system/muted";
import { Spinner } from "@sixthshift/design-system/spinner";
import { type Meal, mealLabel } from "../../../../domain/plan";
import { OTHER_MEALS } from "./plannerPrefs";

/** Where the model's first pass is: not configured, asking, answered, or failed with why. */
export type PlannerStatus = { state: "off" } | { state: "asking" } | { state: "done" } | { state: "failed"; message: string };

/**
 * The model's part in the session, above the weeknights: what it is doing,
 * whether breakfast and lunch are planned too (remembered on the device), and
 * Ask again. A failure says so and leaves the rotation's week in its place.
 */
export function PlannerBar({
  status,
  meals,
  onToggleMeal,
  onAsk,
}: {
  status: Exclude<PlannerStatus, { state: "off" }>;
  meals: readonly Meal[];
  onToggleMeal: (meal: Meal) => void;
  onAsk: () => void;
}) {
  const asking = status.state === "asking";
  return (
    <section aria-label="Planner" className="flex flex-col gap-3 rounded-xl border border-border-normal p-4" aria-busy={asking}>
      <div className="flex items-center gap-3" role="status">
        {asking && <Spinner size="sm" />}
        <p className="min-w-0 flex-1">
          {asking && "The planner is choosing from your guide…"}
          {status.state === "done" && "Chosen by the planner from your guide. Change anything below."}
          {status.state === "failed" && "The planner couldn't answer, so these are from the rotation."}
        </p>
      </div>
      {status.state === "failed" && (
        <Muted as="p" className="text-sm">
          {status.message}
        </Muted>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm font-medium">Also plan</span>
        {OTHER_MEALS.map((meal) => (
          <Checkbox key={meal} label={mealLabel(meal) ?? meal} checked={meals.includes(meal)} disabled={asking} onCheckedChange={() => onToggleMeal(meal)} />
        ))}
        <Button type="button" variant="outline" intent="neutral" size="sm" className="ml-auto" disabled={asking} onClick={onAsk}>
          Ask again
        </Button>
      </div>
    </section>
  );
}
