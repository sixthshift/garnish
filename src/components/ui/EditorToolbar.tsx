import { Button } from "@sixthshift/design-system/button";
import { cn } from "@sixthshift/design-system/utils";
import type { ReactNode } from "react";
import { useLayout } from "../../lib/useLayout";

export type EditorToolbarProps = {
  /** What is being edited: the recipe's name, or what it will be called. */
  title: string;
  /** Shown in place of a blank title. */
  placeholder?: string;
  /** The submit button's text, e.g. "Save changes". */
  label: string;
  /** Its text while `busy`. Falls back to `label`. */
  busyLabel?: string;
  /** A save in flight: the controls are disabled and the submit reads `busyLabel`. */
  busy?: boolean;
  /** Refuse the save for another reason (offline). Cancel stays live. */
  disabled?: boolean;
  /** A standing line under the title, e.g. "Unsaved changes". */
  note?: ReactNode;
  /** Extra controls between the title and the buttons — the JSON toggle's menu. */
  actions?: ReactNode;
  /** The Cancel control, rendered beside the submit. */
  cancel: ReactNode;
  className?: string;
};

export function EditorToolbar({
  title,
  placeholder = "Untitled",
  label,
  busyLabel,
  busy = false,
  disabled = false,
  note,
  actions,
  cancel,
  className,
}: EditorToolbarProps) {
  const shown = title.trim();
  const desktop = useLayout() === "desktop";
  return (
    <div
      data-testid="editor-toolbar"
      className={cn(
        "-mx-4 flex flex-wrap items-center gap-3 border-b border-border-normal bg-bg-normal px-4 py-3 desktop:sticky desktop:top-(--top-bar) desktop:z-content-sticky desktop:-mx-6 desktop:px-6",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate font-medium", shown === "" && "text-fg-subtle")} data-toolbar-title="">
          {shown === "" ? placeholder : shown}
        </span>
        {note !== undefined && (
          <span className="text-xs text-fg-subtle" data-toolbar-note="">
            {note}
          </span>
        )}
      </div>
      {actions}
      {/* Save and Cancel are the phone's `SaveBar` job; here they are a desktop's (decisions.md row 206). */}
      {desktop && cancel}
      {desktop && (
        <Button type="submit" variant="solid" intent="brand" size="sm" disabled={busy || disabled}>
          {busy ? (busyLabel ?? label) : label}
        </Button>
      )}
    </div>
  );
}
