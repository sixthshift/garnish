import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import type { PlannerRule } from "../../../../domain/planner";
import { createPlannerRule, deletePlannerRule, reorderPlannerRules, updatePlannerRule } from "../../../../server/fns/planner";
import { StatementList, type StatementOps } from "../StatementList";

export type PlannerTabProps = {
  /** The planner guide, in order. */
  rules: readonly PlannerRule[];
};

/**
 * The Planner tab: the guide read out to the model that proposes a week, and
 * nothing else. It is `StatementList`, the same list the Style tab renders.
 *
 * Which meals a week is planned for used to sit above it as three checkboxes;
 * it is a per-run choice on the proposal sheet now, beside the days
 * (decisions.md row 102). The date, the hemisphere and the week's open slots
 * are not statements either; they are fixed lines of the prompt.
 */
export function PlannerTab({ rules }: PlannerTabProps) {
  const ops: StatementOps = {
    create: (text) => createPlannerRule({ data: { text } }),
    update: (id, patch) => updatePlannerRule({ data: { id, ...patch } }),
    remove: (id) => deletePlannerRule({ data: { id } }),
    reorder: (ids) => reorderPlannerRules({ data: { ids } }),
  };

  return (
    <section className="flex flex-col gap-4" aria-label="Planner" data-planner-list>
      <SectionTitle as="h2">Planner guide</SectionTitle>
      <Muted as="p" className="text-sm">
        Statements read to the model when a week is proposed, in this order. The planner proposes; nothing is written to the plan until you accept it.
      </Muted>
      <StatementList statements={rules} ops={ops} guideName="planner guide" />
    </section>
  );
}
