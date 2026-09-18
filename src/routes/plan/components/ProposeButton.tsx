import { Button } from "@sixthshift/design-system/button";
import { useState } from "react";
import { ProposeSheet } from "./ProposeSheet";

/**
 * "Propose", beside the week's other action. The plan page only renders it
 * when a model is configured (the route's `plannerAvailable`), which is the
 * whole of the gate: the days and the meals a run covers are chosen in the
 * sheet itself (decisions.md row 102), so there is nothing here to be missing.
 */
export function ProposeButton({ monday, today }: { monday: string; today?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" intent="neutral" size="sm" data-testid="plan-propose" onClick={() => setOpen(true)}>
        Propose
      </Button>
      <ProposeSheet key={monday} open={open} monday={monday} today={today} onClose={() => setOpen(false)} />
    </>
  );
}
