import { Steps } from "@sixthshift/design-system/steps";

/** The stages an import goes through: Style only when a model is there to rewrite the steps (decisions.md row 203). */
const WITH_MODEL = ["Source", "Check", "Style", "Save"] as const;
const WITHOUT_MODEL = ["Source", "Check", "Save"] as const;

export type ImportStep = (typeof WITH_MODEL)[number];

/**
 * Where an import is: the stages its path reaches, in a line, the done ones ticked. A phone shows every marker and only the current stage's name.
 * `compact` keeps it to the width of the page header's actions, beside the title; `Steps` fills whatever holds it.
 */
export function ImportSteps({ current, model, compact = false }: { current: ImportStep; model: boolean; compact?: boolean }) {
  const steps: readonly ImportStep[] = model ? WITH_MODEL : WITHOUT_MODEL;
  const line = <Steps steps={steps.map((label) => ({ label }))} current={steps.indexOf(current)} aria-label="Import steps" data-testid="import-steps" />;
  // Capped at the screen's own width less the page's gutters: in the header's actions, a percentage has nothing to be a percentage of.
  return compact ? <div className={model ? "w-[min(20rem,calc(100vw-2rem))]" : "w-[min(15rem,calc(100vw-2rem))]"}>{line}</div> : line;
}
