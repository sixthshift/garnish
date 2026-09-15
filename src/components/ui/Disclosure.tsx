import { cn } from "@sixthshift/design-system/utils";
import type { ReactNode } from "react";

export type DisclosureProps = {
  /** The summary line, always visible. */
  title: string;
  /** A quiet line beside the title: what is inside, or how much of it is set. */
  hint?: string;
  /** Open on first render. Uncontrolled after that — the browser owns it. */
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  /** Names the section for assistive technology. Defaults to `title`. */
  "aria-label"?: string;
};

export function Disclosure({ title, hint, defaultOpen, children, className, ...rest }: DisclosureProps) {
  // A <details> keeps a closed section's fields in the form and in validation; a conditional render would drop them.
  return (
    <details
      open={defaultOpen}
      data-disclosure=""
      aria-label={rest["aria-label"] ?? title}
      className={cn("group rounded-xl border border-border-normal", className)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium marker:hidden hover:bg-bg-subtle">
        <span className="flex min-w-0 items-baseline gap-2">
          <span>{title}</span>
          {hint !== undefined && <span className="truncate text-xs font-normal text-fg-subtle">{hint}</span>}
        </span>
        <span aria-hidden="true" className="shrink-0 text-fg-subtle transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-border-subtle px-4 py-4">{children}</div>
    </details>
  );
}
