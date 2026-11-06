import { Steps } from "@sixthshift/design-system/steps";

/** The stages an import goes through: Style only when a model is there to rewrite the steps (decisions.md row 203). */
const WITH_MODEL = ["Source", "Check", "Style", "Save"] as const;
const WITHOUT_MODEL = ["Source", "Check", "Save"] as const;

export type ImportStep = (typeof WITH_MODEL)[number];

/** Where an import is: the stages its path reaches, in a line, the done ones ticked. A phone shows every marker and only the current stage's name. */
export function ImportSteps({ current, model }: { current: ImportStep; model: boolean }) {
  const steps: readonly ImportStep[] = model ? WITH_MODEL : WITHOUT_MODEL;
  return <Steps steps={steps.map((label) => ({ label }))} current={steps.indexOf(current)} aria-label="Import steps" data-testid="import-steps" />;
}
