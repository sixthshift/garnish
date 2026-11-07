import { Button } from "@sixthshift/design-system/button";
import { cn } from "@sixthshift/design-system/utils";
import type { ReactNode } from "react";
import { scrollClearance } from "../../lib/ui/scrollClearance";

export type SaveBarProps = {
  /** The submit button's text, e.g. "Save changes". */
  label: string;
  /** Its text while `busy`. Falls back to `label`. */
  busyLabel?: string;
  /** A save in flight: both controls are disabled and the submit reads `busyLabel`. */
  busy?: boolean;
  /** Refuse the save for another reason (offline). Cancel stays live. */
  disabled?: boolean;
  /** The Cancel control, rendered to the right of the submit. */
  cancel: ReactNode;
  /** A standing line beside the buttons, e.g. "Unsaved changes". */
  note?: ReactNode;
  /** More controls at the end of the bar, e.g. the editor's Preview. */
  extra?: ReactNode;
  className?: string;
};

/**
 * On a phone, sticky at the foot of the screen: `--app-bar` is the shell's tab
 * bar, none on the routes that hide it (the editor), so the bar sits at the
 * very bottom and pads itself clear of the home indicator. Inline on a desktop.
 * While it is stuck, focus scrolls clear of it (`scrollClearance`).
 */
export function SaveBar({ label, busyLabel, busy = false, disabled = false, cancel, note, extra, className }: SaveBarProps) {
  return (
    <div
      ref={scrollClearance}
      data-testid="save-bar"
      className={cn(
        "sticky bottom-(--app-bar) z-content-sticky -mx-4 -mb-4 flex flex-wrap items-center gap-3 border-t border-border-normal bg-bg-normal px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] desktop:static desktop:mx-0 desktop:mb-0 desktop:border-0 desktop:bg-transparent desktop:px-0 desktop:py-0",
        className
      )}
    >
      <Button type="submit" variant="solid" intent="brand" disabled={busy || disabled}>
        {busy ? (busyLabel ?? label) : label}
      </Button>
      {cancel}
      {note !== undefined && <span className="text-sm text-fg-subtle">{note}</span>}
      {extra !== undefined && <div className="ml-auto flex items-center gap-2">{extra}</div>}
    </div>
  );
}
