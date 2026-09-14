// Controlled number input with minus and plus. The design system has Input and
// Button but no stepper, so this composes them. Typing is allowed: the field
// keeps the raw text while it is being edited and commits every parseable value,
// clamped to [min, max]; on blur it snaps back to the committed value. The
// buttons move by `step`, rounded to the step's precision, and disable at the
// bounds. Replaces the inline scale control on the recipe page later.
import { Button } from "@sixthshift/design-system/button";
import { Input } from "@sixthshift/design-system/input";
import { Label } from "@sixthshift/design-system/label";
import { cn } from "@sixthshift/design-system/utils";
import { useId, useState } from "react";
import { clamp, stepValue, parseDecimal } from "../../lib/numbers";

export type NumberStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Amount each button press moves by. Default 1. */
  step?: number;
  /** Visible label; also names the buttons ("Decrease Servings"). */
  label?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
};

export function NumberStepper({ value, onChange, min, max, step = 1, label, id, disabled, className }: NumberStepperProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  // The text while the user is mid-edit; null means "show the committed value".
  const [draft, setDraft] = useState<string | null>(null);

  const atMin = min !== undefined && value <= min;
  const atMax = max !== undefined && value >= max;
  const what = label ?? "value";

  const commitText = (text: string) => {
    setDraft(text);
    const parsed = parseDecimal(text);
    if (parsed !== null) onChange(clamp(parsed, min, max));
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label !== undefined && <Label htmlFor={inputId}>{label}</Label>}
      <div className="flex items-center gap-2" role="group" aria-label={label}>
        <Button
          type="button"
          variant="outline"
          intent="neutral"
          size="sm"
          iconOnly
          aria-label={`Decrease ${what}`}
          disabled={disabled || atMin}
          onClick={() => onChange(stepValue(value, step, -1, min, max))}
        >
          −
        </Button>
        <Input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="w-20 text-center"
          value={draft ?? String(value)}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(event) => commitText(event.target.value)}
          onBlur={() => setDraft(null)}
        />
        <Button
          type="button"
          variant="outline"
          intent="neutral"
          size="sm"
          iconOnly
          aria-label={`Increase ${what}`}
          disabled={disabled || atMax}
          onClick={() => onChange(stepValue(value, step, 1, min, max))}
        >
          +
        </Button>
      </div>
    </div>
  );
}
