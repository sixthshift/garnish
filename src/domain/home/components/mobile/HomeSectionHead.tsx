import type { ReactNode } from "react";

/** A section's heading on a phone's Home, in display type, with an optional link at the far end of the line. */
export function HomeSectionHead({ id, title, action }: { id: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="font-display text-lg font-semibold text-fg-strong">
        {title}
      </h2>
      {action}
    </div>
  );
}
