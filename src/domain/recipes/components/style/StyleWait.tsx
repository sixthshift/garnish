import { Muted } from "@sixthshift/design-system/muted";
import type { ReactNode } from "react";
import { SimmerPot } from "../wait/SimmerPot";
import { useSeconds, WaitSteps } from "../wait/WaitSteps";

export type StyleWaitProps = {
  /** The guide being read, or the model rewriting. */
  stage: "rules" | "rewrite";
  startedAt: number;
  /** How many steps the recipe has, for the rewrite's step. */
  steps: number;
  /** What the space offers while it waits: the skip, the house style it is running. */
  actions?: ReactNode;
};

/**
 * The Style space while a run is out: the pot at a boil beside where the run
 * has got to, as an import's wait has it, in a row above the recipe so the
 * steps being rewritten stay in view, a reading line passing down them
 * (StylePart). The rewrite is the model's alone, so the pot boils from the
 * start.
 */
export function StyleWait({ stage, startedAt, steps, actions }: StyleWaitProps) {
  const seconds = useSeconds(startedAt);
  const labels = ["Reading your house style", `Rewriting ${steps} ${steps === 1 ? "step" : "steps"}`];
  return (
    <div className="flex items-center gap-4 desktop:gap-6" data-testid="style-wait">
      <SimmerPot boil className="w-24 shrink-0 desktop:w-32" />
      <div className="flex min-w-0 grow flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-lg font-medium" role="status" data-testid="style-status">
            {stage === "rules" ? "Reading your house style…" : "Rewriting in your house style…"}
          </p>
          <Muted as="p" className="text-sm tabular-nums">
            This can take up to a minute.
            {seconds >= 3 && <span> {seconds} s</span>}
          </Muted>
        </div>
        <WaitSteps labels={labels} at={stage === "rules" ? 0 : 1} label="Restyle progress" className="mobile:hidden" />
        {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
