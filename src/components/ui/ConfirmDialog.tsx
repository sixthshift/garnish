// A destructive confirm built from the design system's Modal: title, a line
// of explanation, Cancel and a danger button. The design system has no
// confirm primitive of its own. Mount-driven like Modal: the parent renders it
// while a decision is pending and unmounts it on either answer.
//
// Modal only paints after mounting on the client, so the header, body and
// footer live in `ConfirmDialogContent`, which renders anywhere and is what
// the tests exercise.
import { Button } from "@sixthshift/design-system/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@sixthshift/design-system/modal";
import type { ReactNode } from "react";

export type ConfirmDialogProps = {
  /** Question in the header, e.g. "Delete Lemon tart?". */
  title: ReactNode;
  /** What happens if they go ahead. A plain string is wrapped in a paragraph. */
  children: ReactNode;
  /** The danger button's text. */
  confirmLabel: string;
  /** Accessible name for the dialog; without it the dialog names itself from the title. */
  "aria-label"?: string;
  /** While true both buttons are disabled and the danger button reads `busyLabel`. */
  busy?: boolean;
  busyLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialogContent({ title, children, confirmLabel, busy = false, busyLabel, onCancel, onConfirm }: Omit<ConfirmDialogProps, "aria-label">) {
  return (
    <>
      <ModalHeader>{title}</ModalHeader>
      <ModalBody>{typeof children === "string" ? <p>{children}</p> : children}</ModalBody>
      <ModalFooter>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="solid" intent="danger" disabled={busy} onClick={onConfirm}>
          {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
        </Button>
      </ModalFooter>
    </>
  );
}

export function ConfirmDialog({ "aria-label": ariaLabel, ...props }: ConfirmDialogProps) {
  const { busy = false, onCancel } = props;
  return (
    <Modal size="sm" aria-label={ariaLabel} dismissable={!busy} onOpenChange={(open) => !open && onCancel()}>
      <ConfirmDialogContent {...props} />
    </Modal>
  );
}
