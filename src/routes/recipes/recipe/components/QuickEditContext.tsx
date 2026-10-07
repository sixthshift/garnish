import { Button } from "@sixthshift/design-system/button";
import { createContext, type ReactNode, type RefObject, useContext, useState } from "react";
import type { Recipe } from "../../../../domain/recipe";
import { useMutate } from "../../../../lib/mutate";
import type { RunWrite } from "./saveQuickEdit";

/**
 * What a row needs to edit itself: the stored (unscaled) document, and the page's `mutate`;
 * and whether the page is fixing lines, the mode that shows every row's trigger at rest.
 */
export type QuickEditContext = { recipe: Recipe; run: RunWrite; fixing: boolean; setFixing: (fixing: boolean) => void };

const Context = createContext<QuickEditContext | null>(null);

/**
 * Makes every ingredient and step row below it quick-editable. The recipe must
 * be the stored document, not the scaled view of it: what a save writes is
 * this, with one row changed.
 */
export function QuickEditProvider({ recipe, children }: { recipe: Recipe; children: ReactNode }) {
  const run = useMutate();
  const [fixing, setFixing] = useState(false);
  return <Context.Provider value={{ recipe, run, fixing, setFixing }}>{children}</Context.Provider>;
}

/** The quick-edit context, or null outside a provider (cook mode, the editor). */
export function useQuickEditContext(): QuickEditContext | null {
  return useContext(Context);
}

/**
 * The row under the ingredients heading: the parts toggle, when the page has
 * one, and while fixing lines the way out of the mode, where its pencils
 * start. Nothing when there is neither. Done takes itself away, so it hands
 * focus to `returnFocus` (the ingredients heading) rather than the page body.
 */
export function IngredientsToolbar({ toggle, returnFocus }: { toggle?: ReactNode; returnFocus?: RefObject<HTMLElement | null> }) {
  const context = useContext(Context);
  const fixing = context?.fixing === true;
  if (!fixing && !toggle) return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {fixing && (
        <Button
          variant="link"
          intent="neutral"
          size="sm"
          data-print="hide"
          className="mr-auto"
          onClick={() => {
            context.setFixing(false);
            returnFocus?.current?.focus();
          }}
        >
          Done fixing
        </Button>
      )}
      {toggle}
    </div>
  );
}
