import { Button } from "@sixthshift/design-system/button";
import { Modal, ModalBody, ModalHeader } from "@sixthshift/design-system/modal";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AddToShoppingButton } from "../../../../components/shopping/AddToShoppingButton";
import { PlayIcon } from "../../../../components/ui/icons";
import type { Choices, Recipe } from "../../recipe";
import { PlanPopoverContent, usePlanTo } from "../recipe/PlanPopover";

const ROUND = "size-12 shrink-0 rounded-full bg-bg-normal shadow-md";

/** A cart: the shopping list. Drawn here, the one place that shows it. */
function CartIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L20 8H6.2" />
      <circle cx="9.5" cy="19.5" r="1.25" />
      <circle cx="17" cy="19.5" r="1.25" />
    </svg>
  );
}

/** A calendar page: the plan. */
function CalendarIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

export type CookBarProps = {
  /** The recipe as the page shows it: scaled and made with its choices. */
  recipe: Recipe;
  /** The servings and choices the page was asked for, carried into cook mode. */
  servings: number | undefined;
  choices: Choices | undefined;
};

/**
 * A phone's recipe keeps Start cooking under the thumb (decisions.md row 208):
 * a bar held at the foot of the screen above the tab bar, Start cooking wide
 * and in brand, and beside it round buttons that add the recipe to the
 * shopping list and put it on the plan. Planning opens the days as a sheet
 * from the bottom, the actions menu's popover as a phone has it.
 */
export function CookBar({ recipe, servings, choices }: CookBarProps) {
  const [planning, setPlanning] = useState(false);
  const planTo = usePlanTo(recipe, () => setPlanning(false));

  return (
    <div
      className="sticky bottom-(--app-bar) z-content-sticky -mt-4 flex items-center gap-2 bg-linear-to-b from-transparent to-bg-subtle to-40% px-4 pt-6 pb-3"
      data-testid="cook-bar"
      data-print="hide"
    >
      <Button asChild variant="solid" intent="brand" className="h-12 flex-1 gap-2 rounded-xl text-base shadow-md">
        <Link to="/recipes/$slug/cook" params={{ slug: recipe.slug }} search={{ servings, choices }}>
          <PlayIcon />
          Start cooking
        </Link>
      </Button>
      <AddToShoppingButton recipe={recipe} icon={<CartIcon />} className={ROUND} />
      <Button
        variant="outline"
        intent="neutral"
        iconOnly
        aria-label="Put on the plan"
        aria-haspopup="dialog"
        className={ROUND}
        onClick={() => setPlanning(true)}
      >
        <CalendarIcon />
      </Button>
      {planning && (
        <Modal size="sm" closable aria-label={`Plan ${recipe.name}`} onOpenChange={(open) => !open && setPlanning(false)}>
          <ModalHeader>Put on the plan</ModalHeader>
          {/* Clear of the home indicator, as the filters sheet's footer is. */}
          <ModalBody className="max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <PlanPopoverContent recipe={recipe} onChoose={(date, chosen) => void planTo(date, chosen)} />
          </ModalBody>
        </Modal>
      )}
    </div>
  );
}
