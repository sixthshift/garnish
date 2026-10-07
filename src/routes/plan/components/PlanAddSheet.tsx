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
    <Modal size="md" align="top" closable onOpenChange={(open) => !open && onClose()}>
      <ModalHeader>{dayName(date)}</ModalHeader>
      {/* Clear of the home indicator, as the filters sheet's footer is. */}
      <ModalBody className="max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <PlanAddForm date={date} busy={busy} searchRecipes={searchRecipes} onAddText={onAddText} onAddRecipe={onAddRecipe} onDone={onClose} />
      </ModalBody>
    </Modal>
  );
}
