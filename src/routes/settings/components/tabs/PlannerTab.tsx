import { Card } from "@sixthshift/design-system/card";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { mealLabel } from "../../../../domain/plan";
import { MEALS, type Meal, type PlannerMeal, type PlannerRule } from "../../../../domain/planner";
import { useMutate } from "../../../../lib/mutate";
import { notifyError } from "../../../../lib/notify";
import { createPlannerRule, deletePlannerRule, reorderPlannerRules, setPlannerMeals, updatePlannerRule } from "../../../../server/fns/planner";
import { StatementList, type StatementOps } from "../StatementList";

export type PlannerTabProps = {
  /** The planner guide, in order. */
  rules: readonly PlannerRule[];
  /** The three meal rows, as the migration seeded and the household has since set them. */
  meals: readonly PlannerMeal[];
};

/**
 * The Planner tab: which meals a proposed week plans for, then the guide read
 * out to the model that proposes it.
 *
 * The meals are three checkboxes rather than a statement, because they are a
 * fact the proposal is built from — it fills the open slots of the meals that
 * are on — and not something the model is asked to weigh. Each writes on the
 * spot: there is nothing else on the row to save with it.
 *
 * The statements themselves are `StatementList`, the same list the Style tab
 * renders. The date, the hemisphere and the week's open slots are not
 * statements either; they are fixed lines of the prompt.
 */
export function PlannerTab({ rules, meals }: PlannerTabProps) {
  const mutate = useMutate();
  const isOn = (meal: Meal) => meals.some((row) => row.meal === meal && row.enabled);

  const setMeal = async (meal: Meal, enabled: boolean) => {
    try {
      await mutate(() => setPlannerMeals({ data: { meals: [{ meal, enabled }] } }));
    } catch (error) {
      notifyError("Could not change the meals planned", error);
    }
  };

  const ops: StatementOps = {
    create: (text) => createPlannerRule({ data: { text } }),
    update: (id, patch) => updatePlannerRule({ data: { id, ...patch } }),
    remove: (id) => deletePlannerRule({ data: { id } }),
    reorder: (ids) => reorderPlannerRules({ data: { ids } }),
  };

  return (
    <section className="flex flex-col gap-4" aria-label="Planner" data-planner-list>
      <SectionTitle as="h2">Meals planned</SectionTitle>
      <Muted as="p" className="text-sm">
        The meals a proposed week fills. A day can still hold anything you type; this is only what the planner is asked for.
      </Muted>
      <Card size="sm">
        <div className="flex flex-col gap-3 px-3 py-2">
          {MEALS.map((meal) => (
            <Checkbox key={meal} checked={isOn(meal)} label={mealLabel(meal)} onCheckedChange={(enabled) => void setMeal(meal, enabled)} />
          ))}
        </div>
      </Card>
      <SectionTitle as="h2">Planner guide</SectionTitle>
      <Muted as="p" className="text-sm">
        Statements read to the model when a week is proposed, in this order. The planner proposes; nothing is written to the plan until you accept it.
      </Muted>
      <StatementList statements={rules} ops={ops} guideName="planner guide" />
    </section>
  );
}
