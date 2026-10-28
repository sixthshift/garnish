import { SectionTitle } from "@sixthshift/design-system/section-title";
import type { ReactNode } from "react";

/** A Home section's small-caps label, with an optional link at the far end of the line. */
export function GlanceHeader({ id, title, action }: { id: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <SectionTitle as="h2" id={id}>
        {title}
      </SectionTitle>
      {action}
    </div>
  );
}

/** The quiet link a GlanceHeader carries: brand text, no fill (rule 5 keeps the fill for the one primary action). */
export const glanceLinkClass = "text-sm font-medium text-fg-brand hover:text-fg-brand-hovered";
