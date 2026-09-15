import { Button } from "@sixthshift/design-system/button";
import { cn } from "@sixthshift/design-system/utils";
import type { ReactNode } from "react";

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
  className?: string;
};

export function SaveBar({ label, busyLabel, busy = false, disabled = false, cancel, note, className }: SaveBarProps) {
  return (
    <div
      data-testid="save-bar"
      className={cn(
        "sticky bottom-20 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-border-normal bg-bg-normal px-4 py-3 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0",
        className
      )}
    >
      <Button type="submit" variant="solid" intent="brand" disabled={busy || disabled}>
        {busy ? (busyLabel ?? label) : label}
      </Button>
      {cancel}
      {note !== undefined && <span className="text-sm text-fg-subtle">{note}</span>}
    </div>
  );
}
