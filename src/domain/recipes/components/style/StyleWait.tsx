import { Muted } from "@sixthshift/design-system/muted";
import type { ReactNode } from "react";
import { useSeconds, WaitSteps } from "../../../../components/wait/WaitSteps";
import { PenCard } from "../wait/PenCard";

export type StyleWaitProps = {
  /** The guide being read, or the model rewriting. */
  stage: "rules" | "rewrite";
  startedAt: number;
  /** How many steps the recipe has, for the rewrite's step. */
  steps: number;
  /** What the space offers while it waits: the skip, when there is one. */
  actions?: ReactNode;
};

/**
 * The Style space while a run is out: a loading screen, front and centre, in
 * place of the recipe. A card rewritten line by line, where the run has got
 * to (the house style read, then the steps rewritten), the seconds, and the
 * skip. The recipe comes back with the answer, its steps landing in turn.
 */
export function StyleWait({ stage, startedAt, steps, actions }: StyleWaitProps) {
  const seconds = useSeconds(startedAt);
  const labels = ["Reading your house style", `Rewriting ${steps} ${steps === 1 ? "step" : "steps"}`];
  return (
    // Most of a screen tall, centred in it, so the Save bar below sits near the foot rather than halfway up.
    <div className="flex min-h-[calc(100svh-18rem)] flex-col items-center justify-center gap-5 py-8 text-center" data-testid="style-wait">
      <PenCard className="w-48 desktop:w-60" />
      <div className="flex flex-col items-center gap-1">
        <p className="text-lg font-medium" role="status" data-testid="style-status">
          {stage === "rules" ? "Reading your house style…" : "Rewriting in your house style…"}
        </p>
        <Muted as="p" className="text-sm tabular-nums">
          This can take up to a minute.
          {seconds >= 3 && <span> {seconds} s</span>}
        </Muted>
      </div>
      <WaitSteps labels={labels} at={stage === "rules" ? 0 : 1} label="Restyle progress" />
      {actions}
    </div>
  );
}
