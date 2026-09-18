import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { MEALS, type Meal, mealLabel } from "../../../domain/plan";

/**
 * Which meal the next entry names, if any: three small chips, none of them
 * pressed to begin with. A `multiple` group rather than a `single` one because
 * single select has no deselect — pressing the pressed chip does nothing —
 * and "no meal" has to stay reachable, since it is the normal answer
 * (decisions.md row 100). One value at a time is `nextMeal`'s job.
 */
export function MealPicker({
  value,
  onChange,
  disabled = false,
  label,
}: {
  value: Meal | null;
  onChange: (meal: Meal | null) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <ToggleGroup
      type="multiple"
      appearance="separate"
      variant="outline"
      intent="neutral"
      size="sm"
      disabled={disabled}
      aria-label={label}
      data-testid="plan-meal-picker"
      value={value === null ? [] : [value]}
      onValueChange={(values) => onChange(nextMeal(value, values))}
      options={MEALS.map((meal) => ({ value: meal, label: mealLabel(meal) ?? meal }))}
    />
  );
}

/**
 * The one meal a `multiple` group's answer means: the chip just pressed when a
 * new one was, and null when the pressed one was pressed again. Pure so the
 * "three chips, pick one or none" rule is testable without a DOM.
 */
export function nextMeal(current: Meal | null, values: readonly string[]): Meal | null {
  const chosen = values.find((value) => value !== current);
  return MEALS.find((meal) => meal === chosen) ?? null;
}
