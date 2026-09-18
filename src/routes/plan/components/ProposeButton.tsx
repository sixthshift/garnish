import { Button } from "@sixthshift/design-system/button";
import { useState } from "react";
import { enabledMeals, type PlannerMeal } from "../../../domain/planner";
import { ProposeSheet } from "./ProposeSheet";
import { NO_MEALS_HINT } from "./proposalSheet";

/**
 * "Propose", beside the week's other action. The plan page only renders it
 * when a model is configured (the route's `plannerAvailable`); with no meal
 * switched on there is no slot to fill, so it says so rather than opening a
 * sheet that can do nothing.
 */
export function ProposeButton({ monday, meals, today }: { monday: string; meals: readonly PlannerMeal[]; today?: string }) {
  const [open, setOpen] = useState(false);
  const noMeals = enabledMeals(meals).length === 0;

  return (
    <>
      <Button
        variant="outline"
        intent="neutral"
        size="sm"
        disabled={noMeals}
        title={noMeals ? NO_MEALS_HINT : undefined}
        data-testid="plan-propose"
        onClick={() => setOpen(true)}
      >
        Propose
      </Button>
      {noMeals && (
        <span className="sr-only" data-testid="plan-propose-hint">
          {NO_MEALS_HINT}
        </span>
      )}
      <ProposeSheet key={monday} open={open} monday={monday} meals={meals} today={today} onClose={() => setOpen(false)} />
    </>
  );
}
