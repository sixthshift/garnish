import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { type StyleRule, styleRuleNote } from "../../../../domain/style";
import { createStyleRule, deleteStyleRule, reorderStyleRules, updateStyleRule } from "../../../../server/fns/style";
import { StatementList, type StatementOps } from "../StatementList";

/**
 * The Style tab: the house style guide, which is the list of statements the
 * restyle pass reads out to the model. The list itself is `StatementList`,
 * shared with the planner guide; this tab is what the statements are for, and
 * which writes they go through.
 *
 * One statement carries a caveat (`styleRuleNote`), printed under it; a row the
 * household has reworded has none, which is correct — the note is about the
 * seeded sentence.
 */
export function StyleTab({ rules }: { rules: readonly StyleRule[] }) {
  const ops: StatementOps = {
    create: (text) => createStyleRule({ data: { text } }),
    update: (id, patch) => updateStyleRule({ data: { id, ...patch } }),
    remove: (id) => deleteStyleRule({ data: { id } }),
    reorder: (ids) => reorderStyleRules({ data: { ids } }),
  };

  return (
    <section className="flex flex-col gap-4" aria-label="House style" data-style-list>
      <SectionTitle as="h2">House style</SectionTitle>
      <Muted as="p" className="text-sm">
        Statements read to the model when a recipe's steps are restyled, in this order. The switch is the default for a run; every statement can still be ticked
        on or off for one recipe. Temperatures, times and quantities are never changed, whatever the guide says.
      </Muted>
      <StatementList statements={rules} ops={ops} guideName="style guide" noteFor={styleRuleNote} />
    </section>
  );
}
