import { Modal, ModalBody, ModalHeader } from "@sixthshift/design-system/modal";
import { dayName } from "../../../domain/plan";
import { PlanAddForm } from "./PlanAddForm";
import type { PlanWeekViewProps } from "./PlanWeekView";

/**
 * A day's "+" opened: the add form in a sheet titled with the day. `Modal`
 * rather than `Sheet`, as the recipe filters are (decisions.md rows 44 and
 * 45): below `sm` it rises from the bottom at its content's height and is
 * centred above it, and it traps focus and hands it back to the "+" that
 * opened it. One add closes it, so the entry is seen landing on its day.
 * The Modal has no phone-height option of its own, so the height is a class
 * on it.
 */
export function PlanAddSheet({
  date,
  busy,
  onClose,
  searchRecipes,
  onAddText,
  onAddRecipe,
}: { date: string; busy: boolean; onClose: () => void } & Pick<PlanWeekViewProps, "searchRecipes" | "onAddText" | "onAddRecipe">) {
  return (
    // A fixed height on a phone rather than the content's: content-sized, the
    // sheet sat 230px tall at the bottom with its box under the keyboard, then
    // jumped up as results arrived. At 85dvh the chips and the box sit in the
    // top third and stay put while the body below them scrolls.
    <Modal size="md" align="top" closable className="max-sm:h-[85dvh]" onOpenChange={(open) => !open && onClose()}>
      <ModalHeader>{dayName(date)}</ModalHeader>
      {/* Clear of the home indicator, as the filters sheet's footer is. */}
      <ModalBody className="max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <PlanAddForm date={date} busy={busy} searchRecipes={searchRecipes} onAddText={onAddText} onAddRecipe={onAddRecipe} onDone={onClose} />
      </ModalBody>
    </Modal>
  );
}
