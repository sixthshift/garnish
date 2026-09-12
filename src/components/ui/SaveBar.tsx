// The editor's save bar: a sticky strip at the foot of the screen on phone,
// a plain inline row from `md` up. The design system has no bar primitive, so
// it is built here from `Button` plus the app's border and surface tokens.
//
// On phone it sticks `bottom-20`, clear of the fixed tab bar in `AppShell`,
// and bleeds to the edges with `-mx-6 px-6` — both editor pages lay their
// content out with `p-6`, so the strip's background spans the full width.
// From `md` the stickiness, the bleed and the chrome all drop away.
//
// The Cancel control is passed in rather than built here: the editor's is a
// `Link` back to wherever the form was opened from, which only the form knows.
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
        "sticky bottom-20 z-10 -mx-6 flex flex-wrap items-center gap-3 border-t border-border-normal bg-bg-normal px-6 py-3 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0",
        className,
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
