import { Steps } from "@sixthshift/design-system/steps";

const STEPS = ["Source", "Review", "Style", "Save"] as const;

export type ImportStep = (typeof STEPS)[number];

const ITEMS = STEPS.map((label) => ({ label }));

/** Where an import is: the four stages in a line, the done ones ticked. A phone shows every marker and only the current stage's name. */
export function ImportSteps({ current }: { current: ImportStep }) {
  return <Steps steps={ITEMS} current={STEPS.indexOf(current)} aria-label="Import steps" data-testid="import-steps" />;
}
