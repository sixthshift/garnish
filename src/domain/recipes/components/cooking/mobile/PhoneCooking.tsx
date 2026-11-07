import { Button } from "@sixthshift/design-system/button";
import { type ReactNode, useState } from "react";
import type { Recipe } from "../../../recipe";
import { RecipeTabs } from "../../mobile/RecipeTabs";
import { CookingHeader, FinishCooking } from "../CookingHeader";

export type PhoneCookingProps = {
  recipe: Recipe;
  ingredients: ReactNode;
  method: ReactNode;
  /** Under both tabs: the notes. */
  after: ReactNode;
  /** The button beside Finish: Ask (the assistant) or Note. */
  ask: ReactNode;
};

/**
 * A phone's recipe while it is cooked from (decisions.md row 214): the same
 * Ingredients and Method tabs, opening on the method, under the cooking
 * header in place of the photo and the facts; the tab bar steps aside for Ask
 * (or Note) and Finish, held under the thumb.
 */
export function PhoneCooking({ recipe, ingredients, method, after, ask }: PhoneCookingProps) {
  const [tab, setTab] = useState("method");
  const steps = recipe.parts.reduce((count, part) => count + part.steps.length, 0);
  return (
    <article className="relative mx-auto w-full max-w-3xl" data-testid="phone-cooking">
      <CookingHeader recipe={recipe} />
      <div className="flex flex-col gap-4 px-4 pt-4 pb-28" data-testid="recipe-body">
        <div className="flex flex-col gap-4" data-testid="recipe-columns">
          <RecipeTabs
            value={tab}
            onValueChange={setTab}
            tabs={[
              { value: "ingredients", label: "Ingredients", content: ingredients, as: "aside", testId: "ingredients-column" },
              { value: "method", label: steps === 1 ? "Method · 1 step" : `Method · ${steps} steps`, content: method, testId: "method-column" },
            ]}
          />
        </div>
        {after}
      </div>
      <div
        className="fixed inset-x-0 bottom-0 z-content-sticky flex gap-2 bg-linear-to-b from-transparent to-bg-subtle to-40% px-4 pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        data-testid="cooking-bar"
        data-print="hide"
      >
        {ask}
        <FinishCooking slug={recipe.slug} className="h-12 flex-1 rounded-xl text-base shadow-md" />
      </div>
    </article>
  );
}

/** The phone's Ask (the assistant's sheet) or, with no model to ask, Note (a sheet of what is noted and changed). */
export function NoteButton({ onOpen, label = "Note" }: { onOpen: () => void; label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      intent="neutral"
      className="h-12 flex-1 rounded-xl bg-bg-normal text-base shadow-md"
      onClick={onOpen}
      aria-haspopup="dialog"
    >
      {label}
    </Button>
  );
}
