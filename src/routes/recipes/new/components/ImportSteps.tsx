import { cn } from "@sixthshift/design-system/utils";

const STEPS = ["Source", "Review", "Style", "Save"] as const;

export type ImportStep = (typeof STEPS)[number];

/** Where an import is: the four stages in a line, the done ones ticked and the current one named for a screen reader. */
export function ImportSteps({ current }: { current: ImportStep }) {
  const at = STEPS.indexOf(current);
  return (
    <nav aria-label="Import steps" data-testid="import-steps">
      {/* A phone has room for where you are, not for the whole line of stages. */}
      <p className="text-sm text-fg-subtle sm:hidden" aria-hidden="true">
        Step {at + 1} of {STEPS.length} · <span className="font-semibold text-fg-normal">{current}</span>
      </p>
      <ol className="hidden flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-subtle sm:flex">
        {STEPS.map((step, index) => (
          <li key={step} className="flex items-center gap-2" aria-current={index === at ? "step" : undefined}>
            {index > 0 && (
              <span aria-hidden="true" className="text-border-normal">
                —
              </span>
            )}
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex size-5 items-center justify-center rounded-full text-xs",
                index < at && "bg-bg-brand-subtle text-fg-brand",
                index === at && "bg-bg-brand text-fg-on-brand",
                index > at && "border border-border-normal"
              )}
            >
              {index < at ? "✓" : index + 1}
            </span>
            <span className={cn(index === at && "font-semibold text-fg-normal")}>{step}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
