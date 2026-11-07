import { Muted } from "@sixthshift/design-system/muted";
import { NumberStepper } from "../../../../components/ui/NumberStepper";
import { MAX_VEGETARIAN_NIGHTS } from "../../plan";

/**
 * How varied the week is (decisions.md row 212): how many weeknights are
 * vegetarian, remembered on the device, and a line saying what the planner
 * always keeps to. The fixed rules read what the household marked a recipe as,
 * so the line says so.
 */
export function VarietyBar({ vegetarianNights, disabled, onChange }: { vegetarianNights: number; disabled?: boolean; onChange: (nights: number) => void }) {
  return (
    <section aria-label="Variety" className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2" data-testid="variety">
      <NumberStepper label="Vegetarian nights" value={vegetarianNights} min={0} max={MAX_VEGETARIAN_NIGHTS} disabled={disabled} onChange={onChange} />
      <Muted as="p" className="min-w-0 flex-1 basis-60 text-sm">
        No main ingredient two nights running, and no cuisine more than twice, going by what you've marked each recipe as.
      </Muted>
    </section>
  );
}
